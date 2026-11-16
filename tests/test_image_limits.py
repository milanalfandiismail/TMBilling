import pytest
from PIL import Image

from app.utils.images import MAX_IMAGE_PIXELS, reject_oversized


class Fake:
    def __init__(self, w, h):
        self.width, self.height = w, h


def test_batas_dipasang_di_pillow():
    assert MAX_IMAGE_PIXELS == 40_000_000
    assert Image.MAX_IMAGE_PIXELS == MAX_IMAGE_PIXELS


def test_tepat_batas_lolos():
    reject_oversized(Fake(8000, 5000))


def test_di_atas_batas_ditolak():
    with pytest.raises(ValueError, match="terlalu besar"):
        reject_oversized(Fake(8000, 5001))

