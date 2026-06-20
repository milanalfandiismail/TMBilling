from flask import Blueprint, jsonify
from app.services.plugins.base_plugin import BasePlugin

class HelloWorldPlugin(BasePlugin):
    
    @property
    def name(self) -> str:
        return "Hello World Plugin"
        
    def get_blueprints(self):
        bp = Blueprint('hello_world', __name__, url_prefix='/api/plugin/hello_world')
        
        @bp.route('/test', methods=['GET'])
        def test_endpoint():
            html = """
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>Hello World Plugin</title>
                <style>
                    body { font-family: 'Inter', sans-serif; background: #0a0a0a; color: #f5f5f5; margin: 0; padding: 40px; }
                    .card { background: #121212; border: 1px solid #262626; border-radius: 12px; padding: 32px; text-align: center; max-width: 500px; margin: 40px auto; }
                    .title { font-size: 24px; font-weight: bold; margin-bottom: 8px; color: #3b82f6; }
                    .subtitle { font-size: 14px; color: #a3a3a3; }
                    .btn { margin-top: 24px; padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; }
                    .btn:hover { background: #1d4ed8; }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="title">🌍 Hello from Plugin!</div>
                    <div class="subtitle">Ini adalah halaman UI ekstensi yang dirender dalam Iframe.</div>
                    <button class="btn" onclick="alert('JavaScript di dalam ekstensi ini bekerja mandiri tanpa merusak kasir utama!')">Test JavaScript</button>
                </div>
            </body>
            </html>
            """
            return html
            
        return [bp]
        
    def on_start(self, app):
        app.logger.info("👋 Hello World plugin has started successfully!")

    def get_menus(self):
        return [
            {
                "title": "Test Hello World",
                "url": "/api/plugin/hello_world/test",
                "icon": "🌍"
            }
        ]
