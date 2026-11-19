from pathlib import Path

SRC = Path(__file__).resolve().parents[1] / "app/static/js/kasir/modules/settings/migration.js"

SETUP_FUNCS = ("_setupDropzone", "_setupSearch", "_setupResizeListener", "_setupModalEvents")


def _source():
    return SRC.read_text(encoding="utf-8")


def test_init_tidak_memasang_listener():
    source = _source()
    start = source.index("async init() {")
    body = source[start:source.index("    },", start)]
    for name in SETUP_FUNCS:
        assert name + "(" not in body


def test_dom_ready_memasang_listener_sekali():
    source = _source()
    block = source[source.index("document.addEventListener('DOMContentLoaded'"):]
    for name in SETUP_FUNCS:
        assert block.count(name + "()") == 1
