import os

from build_release import missing_required, stale_css


def test_missing_required_melaporkan_berkas_hilang(tmp_path):
    hilang = missing_required(tmp_path)
    assert 'run.py' in hilang
    assert 'install_scripts/verify_versions.py' in hilang


def test_stale_css_saat_sumber_lebih_baru(tmp_path):
    css = tmp_path / 'app/static/css'
    css.mkdir(parents=True)
    (css / 'tailwind.css').write_text('a', encoding='utf-8')
    (css / 'input.css').write_text('b', encoding='utf-8')
    os.utime(css / 'tailwind.css', (1, 1))
    (tmp_path / 'tailwind.config.js').write_text('c', encoding='utf-8')
    assert stale_css(tmp_path) is True


def test_css_baru_tidak_dianggap_basi(tmp_path):
    css = tmp_path / 'app/static/css'
    css.mkdir(parents=True)
    (css / 'input.css').write_text('b', encoding='utf-8')
    (css / 'tailwind.css').write_text('a', encoding='utf-8')
    (tmp_path / 'tailwind.config.js').write_text('c', encoding='utf-8')
    os.utime(tmp_path / 'tailwind.config.js', (1, 1))
    assert stale_css(tmp_path) is False
