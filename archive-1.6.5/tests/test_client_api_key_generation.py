import shutil
import subprocess
import sys
from pathlib import Path

DEFAULT = "TM2026QWERTY-api-key"


def test_gen_env_membuat_client_api_key_acak(tmp_path):
    repo = Path(__file__).resolve().parents[1]
    shutil.copy(repo / "install_scripts" / "gen_env.py", tmp_path / "gen_env.py")
    (tmp_path / ".env.example").write_text(
        "SECRET_KEY=ganti-dengan-rahasia-abang-yang-panjang-dan-unik\n"
        f"CLIENT_API_KEY={DEFAULT}\nDEBUG_MODE=True\n",
        encoding="utf-8",
    )
    subprocess.run([sys.executable, "gen_env.py"], cwd=tmp_path, check=True)
    env = (tmp_path / ".env").read_text(encoding="utf-8")
    assert DEFAULT not in env
    key_line = [l for l in env.splitlines() if l.startswith("CLIENT_API_KEY=")][0]
    assert len(key_line.split("=", 1)[1]) >= 32
