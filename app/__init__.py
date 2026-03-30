# app/__init__.py - SEDERHANA TANPA JWT

from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import os

db = SQLAlchemy()

def create_app():
    app = Flask(__name__, template_folder='templates')
    
    # Enable CORS
    CORS(app, resources={r"/*": {"origins": "*"}})

    app.config["SECRET_KEY"] = "warnet-secret-key"
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///warnet.db"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    db.init_app(app)

    # Register blueprints
    from app.routes.auth     import auth_bp
    from app.routes.kasir    import kasir_bp
    from app.routes.paket    import paket_bp
    from app.routes.layout   import layout_bp
    from app.routes.session  import session_bp



    app.register_blueprint(auth_bp,    url_prefix="/auth")
    app.register_blueprint(kasir_bp,   url_prefix="/kasir")
    app.register_blueprint(paket_bp,   url_prefix="/paket")
    app.register_blueprint(layout_bp,  url_prefix="/layout")
    app.register_blueprint(session_bp, url_prefix="/session")


    with app.app_context():
        db.create_all()

    return app