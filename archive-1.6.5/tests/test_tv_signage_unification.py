import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import pytest
from app import create_app, db

@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client

def test_tv_main_route_returns_200(client):
    res = client.get('/tv')
    assert res.status_code == 200
    assert b'TVStaticSignage' in res.data or b'tv_static.js' in res.data
    assert b'glow-rose' in res.data
    assert b'Terpakai' in res.data
    assert b'Kosong' in res.data

def test_tv_static_aliases_return_200(client):
    res1 = client.get('/tv/static')
    assert res1.status_code == 200
    res2 = client.get('/tv-static')
    assert res2.status_code == 200

def test_tv_dynamic_redirects_to_tv(client):
    res = client.get('/tv/dynamic')
    assert res.status_code == 302
    assert res.headers.get('Location') == '/tv'

def test_tv_public_data_api(client):
    res = client.get('/api/v1/public/tv/data')
    assert res.status_code == 200
    json_data = res.get_json()
    assert json_data['success'] is True
    assert 'data' in json_data
    assert 'occupancy' in json_data['data']
    assert 'pc_list' in json_data['data']
    assert 'promos' in json_data['data']
