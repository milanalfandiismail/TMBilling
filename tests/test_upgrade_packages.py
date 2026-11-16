import importlib.util
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("upgrade_packages", ROOT / "scripts" / "upgrade_packages.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


REQUIREMENTS = """Flask==3.1.3
Pillow>=12.0.0
# komentar
python-dotenv==1.2.4
"""


def test_rewrite_pins_only_touches_changed_exact_pins():
    text, changes = module.rewrite_pins(
        REQUIREMENTS,
        {"flask": "3.2.0", "pillow": "13.0.0", "python-dotenv": "1.2.4"},
    )
    assert changes == [("Flask", "3.1.3", "3.2.0")]
    assert "Flask==3.2.0" in text
    assert "Pillow>=12.0.0" in text
    assert "python-dotenv==1.2.4" in text


def test_rewrite_pins_keeps_crlf_line_endings():
    text, changes = module.rewrite_pins("Flask==3.1.3\r\n", {"flask": "3.2.0"})
    assert changes == [("Flask", "3.1.3", "3.2.0")]
    assert text == "Flask==3.2.0\r\n"


def test_requirement_names_skips_comments_and_options():
    names = module.requirement_names("-r base.txt\n# komentar\nFlask==3.1.3\n Pillow>=12.0.0\n")
    assert names == ["Flask", "Pillow"]
