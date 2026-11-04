"""Regresi aturan zero-thrash frontend kasir (AGENTS.md §5).

Dashboard kasir tidak boleh memakai animasi loop tak berujung atau
`backdrop-blur-*`, karena setiap keyframe infinite memaksa GPU/browser
melakukan composite pass terus-menerus saat idle.

Task 14 menemukan dua sisa `animate-in` (kelas mati tanpa keyframes di
`tailwind.config.js`, tetapi tetap melanggar aturan) dan menghapusnya.
Test ini menjaga agar pola tersebut tidak masuk kembali.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

FORBIDDEN_TOKENS = (
    "animate-pulse",
    "animate-ping",
    "animate-bounce",
    "animate-in",
    "animate-modal-in",
    "backdrop-blur",
    "hover:brightness",
    "pulse-",
    "fade-in",
    "zoom-in",
)

SCAN_DIRS = (
    ROOT / "app" / "templates" / "kasir",
    ROOT / "app" / "static" / "js" / "kasir",
)
SCAN_SUFFIXES = (".html", ".js")


def collect_violations() -> list:
    """Kembalikan `path:line -> token` untuk setiap pelanggaran yang ditemukan."""
    violations = []
    for base in SCAN_DIRS:
        for path in sorted(base.rglob("*")):
            if not path.is_file() or path.suffix not in SCAN_SUFFIXES:
                continue
            text = path.read_text(encoding="utf-8", errors="replace")
            for lineno, line in enumerate(text.splitlines(), 1):
                hits = [token for token in FORBIDDEN_TOKENS if token in line]
                if hits:
                    rel = path.relative_to(ROOT).as_posix()
                    violations.append(f"{rel}:{lineno} -> {', '.join(hits)}")
    return violations


def test_frontend_kasir_bebas_kelas_animasi_terlarang():
    violations = collect_violations()
    assert violations == [], (
        "kelas animasi/blur terlarang ditemukan di frontend kasir:\n" + "\n".join(violations)
    )


def test_skeleton_kasir_tanpa_kelas_animate():
    skeleton = ROOT / "app" / "static" / "js" / "kasir" / "core" / "skeleton.js"
    text = skeleton.read_text(encoding="utf-8")
    assert "animate-" not in text, "skeleton dashboard harus statis (tanpa kelas animate-*)"
