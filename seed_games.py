"""Script Seeding Data Katalog Game & Aplikasi untuk TMBilling Kasir.

Bersifat 100% idempoten & aman:
- Mengecek keberadaan kategori master dan menambahkannya jika belum ada.
- Menambahkan 15 item default (10 game + 5 aplikasi) tanpa menimpa data buatan user.

Usage:
    python seed_games.py
"""

import sys
import os

# Pastikan root workspace ada di sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from app import create_app
from app.models.base.base import db
from app.models.game.game import Game
from app.models.game.game_kategori import GameKategori

app = create_app()

DEFAULT_CATEGORIES = [
    "FPS / Shooter",
    "MOBA",
    "Battle Royale",
    "RPG / Open World",
    "Casual & Party",
    "Emulator",
    "Utility / Software",
]

DEFAULT_ITEMS = [
    # 10 GAME POPULER WARNET
    {
        "nama": "Valorant",
        "tipe": "game",
        "kategori": "FPS / Shooter",
        "exe_path": r"C:\Riot Games\Riot Client\RiotClientServices.exe",
        "argumen": "--launch-product=valorant --launch-patchline=live",
        "aktif": True,
    },
    {
        "nama": "Dota 2",
        "tipe": "game",
        "kategori": "MOBA",
        "exe_path": r"C:\Program Files (x86)\Steam\steam.exe",
        "argumen": "-applaunch 570 -novid",
        "aktif": True,
    },
    {
        "nama": "Counter-Strike 2",
        "tipe": "game",
        "kategori": "FPS / Shooter",
        "exe_path": r"C:\Program Files (x86)\Steam\steam.exe",
        "argumen": "-applaunch 730 -novid",
        "aktif": True,
    },
    {
        "nama": "Point Blank",
        "tipe": "game",
        "kategori": "FPS / Shooter",
        "exe_path": r"D:\Games\PointBlank\PointBlank.exe",
        "argumen": "",
        "aktif": True,
    },
    {
        "nama": "Grand Theft Auto V",
        "tipe": "game",
        "kategori": "RPG / Open World, Casual & Party",
        "exe_path": r"D:\Games\Grand Theft Auto V\PlayGTAV.exe",
        "argumen": "",
        "aktif": True,
    },
    {
        "nama": "Mobile Legends: Bang Bang",
        "tipe": "game",
        "kategori": "MOBA, Emulator",
        "exe_path": r"C:\LDPlayer\LDPlayer9\dnplayer.exe",
        "argumen": "package=com.mobile.legends",
        "aktif": True,
    },
    {
        "nama": "Genshin Impact",
        "tipe": "game",
        "kategori": "RPG / Open World",
        "exe_path": r"D:\Games\Genshin Impact\launcher.exe",
        "argumen": "",
        "aktif": True,
    },
    {
        "nama": "PUBG: Battlegrounds",
        "tipe": "game",
        "kategori": "Battle Royale, FPS / Shooter",
        "exe_path": r"C:\Program Files (x86)\Steam\steam.exe",
        "argumen": "-applaunch 578080",
        "aktif": True,
    },
    {
        "nama": "EA SPORTS FC 24",
        "tipe": "game",
        "kategori": "Casual & Party",
        "exe_path": r"D:\Games\EA SPORTS FC 24\FC24.exe",
        "argumen": "",
        "aktif": True,
    },
    {
        "nama": "Roblox",
        "tipe": "game",
        "kategori": "Casual & Party",
        "exe_path": r"C:\Users\Default\AppData\Local\Roblox\RobloxPlayerLauncher.exe",
        "argumen": "",
        "aktif": True,
    },

    # 5 APLIKASI ESENSIAL WARNET
    {
        "nama": "Discord",
        "tipe": "aplikasi",
        "kategori": "Utility / Software",
        "exe_path": r"C:\Users\Default\AppData\Local\Discord\Update.exe",
        "argumen": "--processStart Discord.exe",
        "aktif": True,
    },
    {
        "nama": "Steam",
        "tipe": "aplikasi",
        "kategori": "Utility / Software",
        "exe_path": r"C:\Program Files (x86)\Steam\steam.exe",
        "argumen": "",
        "aktif": True,
    },
    {
        "nama": "Google Chrome",
        "tipe": "aplikasi",
        "kategori": "Utility / Software",
        "exe_path": r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        "argumen": "",
        "aktif": True,
    },
    {
        "nama": "Spotify",
        "tipe": "aplikasi",
        "kategori": "Utility / Software",
        "exe_path": r"C:\Users\Default\AppData\Roaming\Spotify\Spotify.exe",
        "argumen": "",
        "aktif": True,
    },
    {
        "nama": "OBS Studio",
        "tipe": "aplikasi",
        "kategori": "Utility / Software",
        "exe_path": r"C:\Program Files\obs-studio\bin\64bit\obs64.exe",
        "argumen": "",
        "aktif": True,
    },
]


def run_seed():
    """Menjalankan proses seeding aman untuk game dan kategori."""
    with app.app_context():
        print("[INFO] Memeriksa & melakukan seeding katalog Game & Aplikasi...")

        # 1. Pastikan Kategori Default Lengkap
        added_cat = 0
        for cat_name in DEFAULT_CATEGORIES:
            exists = GameKategori.query.filter_by(nama=cat_name).first()
            if not exists:
                db.session.add(GameKategori(nama=cat_name))
                added_cat += 1
        if added_cat > 0:
            db.session.commit()
            print(f"[OK] {added_cat} kategori baru berhasil ditambahkan.")
        else:
            print("[INFO] Semua kategori master default sudah tersedia.")

        # 2. Tambahkan Item Game/Aplikasi (Idempoten per Nama)
        added_items = 0
        skipped_items = 0
        for item in DEFAULT_ITEMS:
            existing_game = Game.query.filter_by(nama=item["nama"]).first()
            if not existing_game:
                new_game = Game(
                    nama=item["nama"],
                    tipe=item["tipe"],
                    kategori=item["kategori"],
                    exe_path=item["exe_path"],
                    argumen=item["argumen"],
                    aktif=item["aktif"],
                    operator_id="system_seed"
                )
                db.session.add(new_game)
                added_items += 1
            else:
                skipped_items += 1

        if added_items > 0:
            db.session.commit()
            print(f"[OK] Berhasil menambahkan {added_items} game/aplikasi ke database!")
        if skipped_items > 0:
            print(f"[INFO] {skipped_items} item sudah ada di database (dilewati agar aman).")

        total_games = Game.query.filter_by(tipe="game").count()
        total_apps = Game.query.filter_by(tipe="aplikasi").count()
        print(f"[SELESAI] Total aktif di database: {total_games} Game, {total_apps} Aplikasi.")


if __name__ == "__main__":
    run_seed()
