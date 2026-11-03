import json
import pytest
from app import create_app, db
from app.models import PC, Grup, HardwareMonitor

@pytest.fixture
def test_setup():
    app = create_app()
    app.config["TESTING"] = True
    app.config["WTF_CSRF_ENABLED"] = False

    with app.app_context():
        # Bersihkan data uji sebelumnya jika ada
        for code in ["TM-SPEC01", "TM-NOHW", "TM-CORRUPT"]:
            p = PC.query.filter_by(kode=code).first()
            if p:
                db.session.delete(p)
        db.session.commit()

        # 1. Grup VIP dengan PC dan Hardware lengkap
        grup_vip = Grup.query.filter_by(nama="vip").first()
        if not grup_vip:
            grup_vip = Grup(nama="vip", warna="#8b5cf6")
            db.session.add(grup_vip)
            db.session.commit()

        pc1 = PC(
            kode="TM-SPEC01",
            nama="PC Gaming VIP 01",
            ip_address="192.168.1.111",
            mac_address="AA:BB:CC:DD:EE:99",
            grup_id=grup_vip.id,
            aktif=True,
        )
        db.session.add(pc1)
        db.session.commit()

        hw1 = HardwareMonitor(
            pc_id=pc1.id,
            cpu_name="AMD Ryzen 7 5800X",
            gpu_name="NVIDIA GeForce RTX 4060",
            total_ram="16 GB",
            motherboard="B550M AORUS ELITE",
            nic_speed="1 Gbps",
            cpu_temp=45.2,
            gpu_temp=50.1,
            cpu_usage=12.5,
            hardware_baseline=json.dumps({
                "cpu": {"name": "AMD Ryzen 7 5800X", "cores": 8},
                "ram_sticks": ["DDR4 8GB 3200MHz", "DDR4 8GB 3200MHz"],
                "disks": ["Kingston NV2 1TB NVMe"],
            }),
        )
        db.session.add(hw1)

        # 2. PC tanpa hardware (fallback)
        pc_nohw = PC(
            kode="TM-NOHW",
            nama="PC Tanpa HW",
            ip_address="192.168.1.112",
            mac_address="AA:BB:CC:DD:EE:98",
            grup_id=grup_vip.id,
            aktif=False,
        )
        db.session.add(pc_nohw)

        # 3. PC dengan baseline JSON rusak (corrupt)
        pc_corrupt = PC(
            kode="TM-CORRUPT",
            nama="PC Corrupt JSON",
            ip_address="192.168.1.113",
            mac_address="AA:BB:CC:DD:EE:97",
            grup_id=grup_vip.id,
            aktif=True,
        )
        db.session.add(pc_corrupt)
        db.session.commit()

        hw_corrupt = HardwareMonitor(
            pc_id=pc_corrupt.id,
            cpu_name="Intel Core i3-10100",
            gpu_name="Intel UHD Graphics 630",
            total_ram="8 GB",
            motherboard="H410M",
            nic_speed="1 Gbps",
            hardware_baseline="{corrupt_json: invalid",
        )
        db.session.add(hw_corrupt)
        db.session.commit()

        client = app.test_client()
        yield app, client, db

        # Cleanup setelah test selesai
        for code in ["TM-SPEC01", "TM-NOHW", "TM-CORRUPT"]:
            p = PC.query.filter_by(kode=code).first()
            if p:
                db.session.delete(p)
        db.session.commit()


def test_public_specs_route_success_and_catalog(test_setup):
    """Pastikan route /spesifikasi merender HTTP 200 dan menyertakan specs_catalog_json terstruktur."""
    app, client, _ = test_setup

    res = client.get("/spesifikasi")
    assert res.status_code == 200
    html = res.data.decode("utf-8")

    assert "Spesifikasi PC" in html
    assert "TM-SPEC01" in html
    assert "specs-catalog-data" in html

    start_tag = '<script id="specs-catalog-data" type="application/json">'
    end_tag = '</script>'
    assert start_tag in html
    json_str = html.split(start_tag)[1].split(end_tag)[0].strip()
    catalog = json.loads(json_str)

    assert "TM-SPEC01" in catalog
    item = catalog["TM-SPEC01"]
    assert item["kode"] == "TM-SPEC01"
    assert item["cpu"]["name"] == "AMD Ryzen 7 5800X"
    assert item["gpu"]["name"] == "NVIDIA GeForce RTX 4060"
    assert item["ram"]["total"] == "16 GB"
    assert item["motherboard"] == "B550M AORUS ELITE"
    assert item["online"] is True
    assert len(item["ram"]["sticks"]) == 2
    assert len(item["disks"]) == 1


def test_public_specs_route_missing_hardware_fallback(test_setup):
    """Pastikan jika PC belum memiliki data hardware, fallback nilai default ditampilkan tanpa error."""
    app, client, _ = test_setup

    res = client.get("/spesifikasi")
    assert res.status_code == 200
    html = res.data.decode("utf-8")
    assert "TM-NOHW" in html

    start_tag = '<script id="specs-catalog-data" type="application/json">'
    end_tag = '</script>'
    json_str = html.split(start_tag)[1].split(end_tag)[0].strip()
    catalog = json.loads(json_str)

    assert "TM-NOHW" in catalog
    item = catalog["TM-NOHW"]
    assert item["cpu"]["name"] == "Belum Terkumpul"
    assert item["gpu"]["name"] == "Belum Terkumpul"
    assert item["ram"]["total"] == "Belum Terkumpul"
    assert item["motherboard"] == "Belum Terkumpul"
    assert item["online"] is False


def test_public_specs_route_malformed_baseline_json_resilience(test_setup):
    """Pastikan jika hardware_baseline berisi JSON rusak, tidak menyebabkan HTTP 500 dan tetap menyajikan data."""
    app, client, _ = test_setup

    res = client.get("/spesifikasi")
    assert res.status_code == 200
    html = res.data.decode("utf-8")
    assert "TM-CORRUPT" in html

    start_tag = '<script id="specs-catalog-data" type="application/json">'
    end_tag = '</script>'
    json_str = html.split(start_tag)[1].split(end_tag)[0].strip()
    catalog = json.loads(json_str)

    assert "TM-CORRUPT" in catalog
    item = catalog["TM-CORRUPT"]
    assert item["cpu"]["name"] == "Intel Core i3-10100"
    assert item["ram"]["sticks"] == []
    assert item["disks"] == []


def test_public_specs_compact_cards_markup(test_setup):
    """Pastikan markup card PC berbentuk compact dan memiliki trigger modal serta atribut aksesibilitas."""
    app, client, _ = test_setup

    res = client.get("/spesifikasi")
    assert res.status_code == 200
    html = res.data.decode("utf-8")

    assert "grid-cols-2 gap-2 sm:gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5" in html
    assert 'onclick="openSpecModal(\'TM-SPEC01\')"' in html
    assert 'data-pc-kode="TM-SPEC01"' in html
    assert 'role="button"' in html
    assert 'tabindex="0"' in html


def test_public_specs_modal_structure_and_controller(test_setup):
    """Pastikan modal #spec-modal ada di HTML dengan backdrop solid bg-black/90 dan JS controller openSpecModal."""
    app, client, _ = test_setup

    res = client.get("/spesifikasi")
    assert res.status_code == 200
    html = res.data.decode("utf-8")

    assert 'id="spec-modal"' in html
    assert 'id="spec-modal-backdrop"' in html
    assert "bg-black/90" in html
    assert "backdrop-blur" not in html.split('id="spec-modal"')[1].split('</main>')[0]

    assert 'id="modal-pc-kode"' in html
    assert 'id="modal-cpu-name"' in html
    assert 'id="modal-gpu-name"' in html
    assert 'id="modal-ram-total"' in html
    assert 'id="modal-mobo-name"' in html
    assert 'id="modal-nic-speed"' in html
    assert 'id="modal-disks-container"' in html

    assert 'id="spec-modal-close"' in html
    assert 'function openSpecModal' in html
    assert 'function closeSpecModal' in html


def test_public_specs_markup_has_search_toolbar_and_mobile_2col_grid(test_setup):
    """Pastikan search bar ter-debounce, tombol clear, grid 2-kolom mobile, dan empty state tersedia di HTML."""
    app, client, _ = test_setup

    res = client.get("/spesifikasi")
    assert res.status_code == 200
    html = res.data.decode("utf-8")

    # Search bar & Clear button
    assert 'id="specs-search-input"' in html
    assert 'id="specs-search-clear"' in html

    # Grid 2 kolom mobile
    assert 'grid-cols-2' in html

    # Empty state container & reset action
    assert 'id="specs-empty-search"' in html
    assert 'id="specs-empty-query"' in html

    # Filter logic and debounce in JS
    assert 'debounce' in html
    assert 'applySpecsFilter' in html

