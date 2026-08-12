# app/models/tutorial/tutorial_model.py
from app.models.base.base import db
from datetime import datetime

class SystemTutorial(db.Model):
    __tablename__ = 'system_tutorials'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    icon = db.Column(db.String(50), default="🌐")
    category = db.Column(db.String(50), default="Umum")
    content = db.Column(db.Text, nullable=False)
    urutan = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "icon": self.icon,
            "category": self.category,
            "content": self.content,
            "urutan": self.urutan,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
