# app/repositories/tutorial/tutorial_repository.py
from app.models import SystemTutorial
from app.models.base.base import db

class TutorialRepository:
    @staticmethod
    def get_all():
        return SystemTutorial.query.order_by(SystemTutorial.urutan.asc(), SystemTutorial.id.asc()).all()

    @staticmethod
    def get_by_id(tutorial_id):
        return SystemTutorial.query.get(tutorial_id)

    @staticmethod
    def create(data):
        t = SystemTutorial(
            title=data.get("title", "").strip(),
            icon=data.get("icon", "🌐").strip(),
            category=data.get("category", "Umum").strip(),
            content=data.get("content", "").strip(),
            urutan=int(data.get("urutan", 0))
        )
        db.session.add(t)
        db.session.commit()
        return t

    @staticmethod
    def update(tutorial_id, data):
        t = SystemTutorial.query.get(tutorial_id)
        if not t:
            return None
        if "title" in data and data["title"] is not None:
            t.title = str(data["title"]).strip()
        if "icon" in data and data["icon"] is not None:
            t.icon = str(data["icon"]).strip()
        if "category" in data and data["category"] is not None:
            t.category = str(data["category"]).strip()
        if "content" in data and data["content"] is not None:
            t.content = str(data["content"]).strip()
        if "urutan" in data and data["urutan"] is not None:
            t.urutan = int(data["urutan"])
        db.session.commit()
        return t

    @staticmethod
    def delete(tutorial_id):
        t = SystemTutorial.query.get(tutorial_id)
        if not t:
            return False
        db.session.delete(t)
        db.session.commit()
        return True

    @staticmethod
    def delete_category(category_name):
        category_name = str(category_name).strip()
        tuts = SystemTutorial.query.filter_by(category=category_name).all()
        for t in tuts:
            t.category = "Kosong"
        db.session.commit()
        return len(tuts)

    @staticmethod
    def get_all_categories():
        categories = db.session.query(SystemTutorial.category).distinct().all()
        result = set([c[0] for c in categories if c[0]])
        result.add("Umum")
        return sorted(list(result))
