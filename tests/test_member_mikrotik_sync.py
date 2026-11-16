import threading
import time

from app import create_app
from app.models import db, Grup, Member, MikroTikConfig
from app.services.member import member_service


class FakeClient:
    active = 0
    max_active = 0
    lock = threading.Lock()

    def __init__(self, *a, **k):
        pass

    def login(self):
        with FakeClient.lock:
            FakeClient.active += 1
            FakeClient.max_active = max(FakeClient.max_active, FakeClient.active)
        time.sleep(0.1)
        return True

    def add_user(self, *a):
        pass

    def close(self):
        with FakeClient.lock:
            FakeClient.active -= 1


def test_update_commit_dulu_baru_sync(tmp_path, monkeypatch):
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path / 'order.db'}",
    })
    with app.app_context():
        grup = Grup(nama="reguler")
        db.session.add(grup)
        db.session.commit()
        member = Member(username="m2", grup_id=grup.id, aktif=True)
        member.set_password("lama")
        db.session.add(member)
        db.session.commit()

        urutan = []
        monkeypatch.setattr(db.session, "commit", lambda: urutan.append("commit"))
        monkeypatch.setattr(
            member_service.MemberService,
            "_sync_mikrotik",
            staticmethod(lambda *a, **k: urutan.append("sync")),
        )

        member_service.MemberService.update(
            member.id, {"password": "baru"}, operator="admin"
        )

        assert urutan == ["commit", "sync"]


def test_mikrotik_worker_uses_captured_username_without_orm_session(tmp_path, monkeypatch):
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path / 'captured.db'}",
    })
    with app.app_context():
        grup = Grup(nama="reguler")
        db.session.add(grup)
        db.session.commit()
        member = Member(username="m-captured", grup_id=grup.id, aktif=True)
        member.set_password("pw")
        db.session.add(member)
        db.session.add(
            MikroTikConfig(enabled=True, host="127.0.0.1", username="u", password="p")
        )
        db.session.commit()

        panggilan = []

        class CapturingClient:
            def __init__(self, *a, **k):
                pass

            def login(self):
                return True

            def get_user(self, username):
                panggilan.append(("get_user", username))
                return {".id": "1"}

            def set_user_password(self, user_id, password):
                panggilan.append(("set_password", user_id, password))

            def close(self):
                pass

        class DeferredExecutor:
            def submit(self, fn):
                self.fn = fn

        executor = DeferredExecutor()
        monkeypatch.setattr(member_service, "MikroTikAPIClient", CapturingClient)
        monkeypatch.setattr(member_service, "_MIKROTIK_EXECUTOR", executor)

        member_service.MemberService._sync_mikrotik("update", member, "baru")
        db.session.expire_all()

        worker = threading.Thread(target=executor.fn)
        worker.start()
        worker.join(timeout=5)

        assert panggilan == [("get_user", "m-captured"), ("set_password", "1", "baru")]


def test_sinkronisasi_mikrotik_berjalan_satu_per_satu(tmp_path, monkeypatch):
    app = create_app(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path / 'mt.db'}",
        }
    )
    with app.app_context():
        grup = Grup(nama="reguler")
        db.session.add(grup)
        db.session.commit()
        member = Member(username="m1", grup_id=grup.id, aktif=True)
        member.set_password("pw")
        db.session.add(member)
        db.session.add(
            MikroTikConfig(enabled=True, host="127.0.0.1", username="u", password="p")
        )
        db.session.commit()

        monkeypatch.setattr(member_service, "MikroTikAPIClient", FakeClient)
        for _ in range(5):
            member_service.MemberService._sync_mikrotik("add", member, "pw")
        member_service._MIKROTIK_EXECUTOR.shutdown(wait=True)
        assert FakeClient.max_active == 1
        member_service._MIKROTIK_EXECUTOR = member_service.ThreadPoolExecutor(
            max_workers=1, thread_name_prefix="mikrotik"
        )
