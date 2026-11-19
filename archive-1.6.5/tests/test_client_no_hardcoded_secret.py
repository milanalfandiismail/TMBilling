import pathlib

FILES = [
    "WarnetAgent/TMBillingTauri/src-tauri/src/utils/api.rs",
    "WarnetAgent/MGCTM/src/main.rs",
    "WarnetAgent/Deploy/write_config.ps1",
]

FORBIDDEN = ["TM2026QWERTY-api-key", "TMBillingSecretKey2026SecureObfuscation", "TM2026"]


def test_tidak_ada_kunci_hardcoded():
    for rel in FILES:
        text = pathlib.Path(rel).read_text(encoding="utf-8")
        for needle in FORBIDDEN:
            assert needle not in text, f"{needle} masih ada di {rel}"
