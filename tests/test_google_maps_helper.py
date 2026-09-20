# tests/test_google_maps_helper.py

import pytest
from app.utils.helpers import parse_google_maps_info


def test_parse_iframe_embed():
    iframe_code = '<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1000!2d106.8!3d-6.2" width="600" height="450" style="border:0;" allowfullscreen="" loading="lazy"></iframe>'
    res = parse_google_maps_info(iframe_code)
    assert res["is_valid"] is True
    assert res["embed_url"].startswith("https://www.google.com/maps/embed")
    assert "106.8" in res["embed_url"]
    assert res["nav_url"] is not None


def test_parse_direct_embed_url():
    url = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1000!2d106.8!3d-6.2"
    res = parse_google_maps_info(url)
    assert res["is_valid"] is True
    assert res["embed_url"] == url
    assert res["nav_url"] is not None


def test_parse_share_link():
    share_url = "https://maps.app.goo.gl/abcdef123456"
    res = parse_google_maps_info(share_url)
    assert res["is_valid"] is True
    assert res["nav_url"] == share_url
    assert res["embed_url"] is None  # Share links cannot be embedded directly without place embed


def test_parse_regular_place_url():
    place_url = "https://www.google.com/maps/place/Monas/@-6.1753924,106.8271528,17z"
    res = parse_google_maps_info(place_url)
    assert res["is_valid"] is True
    assert res["nav_url"] == place_url


def test_parse_empty_input_returns_invalid():
    res = parse_google_maps_info("")
    assert res["is_valid"] is False
    assert res["embed_url"] is None
    assert res["nav_url"] is None


def test_parse_whitespace_only_returns_invalid():
    res = parse_google_maps_info("   \n\t ")
    assert res["is_valid"] is False
    assert res["embed_url"] is None
    assert res["nav_url"] is None


def test_parse_none_returns_invalid():
    res = parse_google_maps_info(None)
    assert res["is_valid"] is False
    assert res["embed_url"] is None
    assert res["nav_url"] is None


def test_parse_xss_injection_rejected():
    malicious = '<script>alert("xss")</script><iframe src="javascript:alert(1)"></iframe>'
    res = parse_google_maps_info(malicious)
    assert res["is_valid"] is False
    assert res["embed_url"] is None
