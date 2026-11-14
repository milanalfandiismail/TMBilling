"""Batas keamanan dekode gambar untuk semua jalur unggah."""
from PIL import Image

MAX_IMAGE_PIXELS = 40_000_000
Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS


def reject_oversized(img):
    if img.width * img.height > MAX_IMAGE_PIXELS:
        raise ValueError("Gambar terlalu besar (maksimum 40 megapiksel)")

