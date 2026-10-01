# app/services/tutorial/tutorial_service.py
import logging
import os
import re
import shutil
from flask import current_app
from app.repositories import TutorialRepository

logger = logging.getLogger(__name__)

import json

def _load_seed_data():
    """Membaca data seed tutorial dari file JSON."""
    json_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'data', 'seed_tutorials.json')
    json_path = os.path.normpath(json_path)
    if not os.path.exists(json_path):
        logger.warning(f"[TutorialService] File seed JSON tidak ditemukan: {json_path}")
        return []
    with open(json_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def move_temp_images(content):
    if not content:
        return content
    
    # regex to find all temp tutorial image URLs
    pattern = r'/static/assets/tutorials/temp/([a-fA-F0-9]+\.(?:png|jpg|jpeg|gif|webp))'
    filenames = re.findall(pattern, content)
    
    if not filenames:
        return content
        
    static_dir = os.path.join(current_app.root_path, 'static', 'assets', 'tutorials')
    temp_dir = os.path.join(static_dir, 'temp')
    
    os.makedirs(static_dir, exist_ok=True)
    
    for filename in filenames:
        temp_path = os.path.join(temp_dir, filename)
        perm_path = os.path.join(static_dir, filename)
        if os.path.exists(temp_path):
            try:
                shutil.move(temp_path, perm_path)
            except Exception as e:
                logger.warning(f"Gagal memindahkan gambar draf tutorial {filename}: {e}")
                
    return content.replace('/static/assets/tutorials/temp/', '/static/assets/tutorials/')

class TutorialService:
    @staticmethod
    def get_all():
        return TutorialRepository.get_all()

    @staticmethod
    def get_by_id(tutorial_id):
        return TutorialRepository.get_by_id(tutorial_id)

    @staticmethod
    def create(data):
        from app.utils.validators import validate_string_length, validate_integer_range
        clean_data = dict(data)
        clean_data["title"] = validate_string_length(data.get("title"), min_len=3, max_len=150, field_name="Judul Panduan", required=True)
        clean_data["category"] = validate_string_length(data.get("category"), min_len=2, max_len=50, field_name="Kategori Panduan", required=False) if data.get("category") else "Umum"
        clean_data["content"] = validate_string_length(data.get("content"), min_len=5, max_len=100_000, field_name="Isi Panduan", required=True)
        if "urutan" in data and data["urutan"] is not None:
            clean_data["urutan"] = validate_integer_range(data["urutan"], min_val=0, max_val=10000, field_name="Urutan Panduan")

        if "content" in clean_data and clean_data["content"]:
            clean_data["content"] = move_temp_images(clean_data["content"])
        return TutorialRepository.create(clean_data)

    @staticmethod
    def update(tutorial_id, data):
        from app.utils.validators import validate_string_length, validate_integer_range
        clean_data = dict(data)
        if "title" in data and data["title"] is not None:
            clean_data["title"] = validate_string_length(data["title"], min_len=3, max_len=150, field_name="Judul Panduan", required=True)
        if "category" in data and data["category"] is not None:
            clean_data["category"] = validate_string_length(data["category"], min_len=2, max_len=50, field_name="Kategori Panduan", required=False) if data["category"] else "Umum"
        if "content" in data and data["content"] is not None:
            clean_data["content"] = validate_string_length(data["content"], min_len=5, max_len=100_000, field_name="Isi Panduan", required=True)
        if "urutan" in data and data["urutan"] is not None:
            clean_data["urutan"] = validate_integer_range(data["urutan"], min_val=0, max_val=10000, field_name="Urutan Panduan")

        if "content" in clean_data and clean_data["content"]:
            clean_data["content"] = move_temp_images(clean_data["content"])
        return TutorialRepository.update(tutorial_id, clean_data)

    @staticmethod
    def delete(tutorial_id):
        return TutorialRepository.delete(tutorial_id)

    @staticmethod
    def get_all_categories():
        return TutorialRepository.get_all_categories()

    @staticmethod
    def delete_category(category_name):
        return TutorialRepository.delete_category(category_name)

    @staticmethod
    def export_to_json():
        """Mengekspor seluruh tutorial dari database ke app/data/seed_tutorials.json."""
        tutorials = TutorialRepository.get_all()
        export_data = []
        for t in tutorials:
            export_data.append({
                "title": t.title,
                "icon": t.icon,
                "category": t.category,
                "urutan": t.urutan,
                "content": t.content
            })
            
        target_dir = os.path.join(current_app.root_path, 'data')
        os.makedirs(target_dir, exist_ok=True)
        target_path = os.path.join(target_dir, 'seed_tutorials.json')
        
        with open(target_path, 'w', encoding='utf-8') as f:
            json.dump(export_data, f, ensure_ascii=False, indent=2)
            
        return len(export_data)

    @staticmethod
    def seed_initial_tutorials():
        """Seed tutorial default dari JSON — hanya menambahkan tutorial yang judulnya belum ada di database."""
        try:
            seed_data = _load_seed_data()
            if not seed_data:
                return

            existing_titles = {t.title for t in TutorialRepository.get_all()}
            added = 0
            for item in seed_data:
                if item.get("title") and item["title"] not in existing_titles:
                    TutorialRepository.create(item)
                    added += 1

            if added:
                logger.info(f"[TutorialService] Berhasil menambahkan {added} tutorial baru dari seed JSON.")
            else:
                logger.info("[TutorialService] Tidak ada tutorial baru untuk di-seed.")
        except Exception as e:
            logger.warning(f"[TutorialService] Gagal melakukan seeding tutorial: {e}")
