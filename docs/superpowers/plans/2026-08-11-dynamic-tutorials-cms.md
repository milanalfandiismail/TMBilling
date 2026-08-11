# Dynamic Tutorial & Documentation Manager (CMS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dynamic knowledge base & documentation manager (CMS) in TMBilling with offline CKEditor 5 rich-text editing capability for Admin users.

**Architecture:** A new domain model `SystemTutorial` (`app/models/tutorial/`), repository (`app/repositories/tutorial/`), service (`app/services/tutorial/`), and API routes (`app/routes/tutorial/`). Frontend uses local offline CKEditor 5 assets (`app/static/vendor/ckeditor/ckeditor.js`) in a dynamic subtab `#subtab-tutorials` under Kasir Settings.

**Tech Stack:** Python 3.13, Flask, Flask-SQLAlchemy, CKEditor 5 (Classic Local Build), Vanilla JS, Tailwind CSS.

## Global Constraints

- **Local Offline Assets:** CKEditor 5 MUST be served locally from `app/static/vendor/ckeditor/ckeditor.js` without any external CDN dependencies.
- **Role Protection:** Write operations (POST, PUT, DELETE) MUST be protected with `@admin_required`.
- **Centralized Exports:** Imports MUST use centralized module exports (`from app.models import SystemTutorial`, `from app.services import TutorialService`, `from app.repositories import TutorialRepository`).
- **No Automatic Git Push:** Wait for explicit user confirmation before committing and pushing. Commit messages MUST be in Bahasa Indonesia.

---

### Task 1: Vendor Assets & Local CKEditor 5 Setup

**Files:**
- Create: `app/static/vendor/ckeditor/ckeditor.js`

- [ ] **Step 1: Download or write local minified CKEditor 5 bundle**

Fetch or stage official standalone CKEditor 5 build to `app/static/vendor/ckeditor/ckeditor.js`.

- [ ] **Step 2: Verify local asset existence & size**

Run: `python -c "import os; assert os.path.exists('app/static/vendor/ckeditor/ckeditor.js'), 'Asset missing'"`
Expected: Asset file exists and is readable.

- [ ] **Step 3: Commit**

```bash
git add app/static/vendor/ckeditor/ckeditor.js
git commit -m "fitur: tambah aset lokal ckeditor 5 offline"
```

---

### Task 2: Database Model & Repository (`SystemTutorial`)

**Files:**
- Create: `app/models/tutorial/tutorial_model.py`
- Modify: `app/models/__init__.py`
- Create: `app/repositories/tutorial/tutorial_repository.py`
- Modify: `app/repositories/__init__.py`

- [ ] **Step 1: Create `SystemTutorial` Model**

Create `app/models/tutorial/tutorial_model.py`:
```python
from app.extensions import db
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
```

- [ ] **Step 2: Export `SystemTutorial` in `app/models/__init__.py`**

- [ ] **Step 3: Create `TutorialRepository`**

Create `app/repositories/tutorial/tutorial_repository.py`:
```python
from app.models import SystemTutorial
from app.extensions import db

class TutorialRepository:
    @staticmethod
    def get_all():
        return SystemTutorial.query.order_by(SystemTutorial.urutan.asc(), SystemTutorial.id.asc()).all()

    @staticmethod
    def get_by_id(tutorial_id):
        return SystemTutorial.query.get(tutorial_id)

    @staticmethod
    def create(data):
        t = SystemTutorial(
            title=data.get("title", "").strip(),
            icon=data.get("icon", "🌐").strip(),
            category=data.get("category", "Umum").strip(),
            content=data.get("content", "").strip(),
            urutan=int(data.get("urutan", 0))
        )
        db.session.add(t)
        db.session.commit()
        return t

    @staticmethod
    def update(tutorial_id, data):
        t = SystemTutorial.query.get(tutorial_id)
        if not t:
            return None
        if "title" in data: t.title = data["title"].strip()
        if "icon" in data: t.icon = data["icon"].strip()
        if "category" in data: t.category = data["category"].strip()
        if "content" in data: t.content = data["content"].strip()
        if "urutan" in data: t.urutan = int(data["urutan"])
        db.session.commit()
        return t

    @staticmethod
    def delete(tutorial_id):
        t = SystemTutorial.query.get(tutorial_id)
        if not t:
            return False
        db.session.delete(t)
        db.session.commit()
        return True
```

- [ ] **Step 4: Export `TutorialRepository` in `app/repositories/__init__.py`**

- [ ] **Step 5: Verify Model & Repository via Python test script**

Run: `python -c "from app import create_app; app=create_app(); ctx=app.app_context(); ctx.push(); from app.repositories import TutorialRepository; print(TutorialRepository.get_all())"`
Expected: List of tutorials (empty or initialized).

- [ ] **Step 6: Commit**

```bash
git add app/models/tutorial/ app/models/__init__.py app/repositories/tutorial/ app/repositories/__init__.py
git commit -m "fitur: tambah model SystemTutorial dan TutorialRepository"
```

---

### Task 3: Service Layer & Combined Initial Seed Data (`TutorialService`)

**Files:**
- Create: `app/services/tutorial/tutorial_service.py`
- Modify: `app/services/__init__.py`
- Modify: `app/__init__.py`

- [ ] **Step 1: Create `TutorialService` with combined initial seed**

Create `app/services/tutorial/tutorial_service.py` containing methods `get_all()`, `get_by_id(id)`, `create(data)`, `update(id, data)`, `delete(id)`, and `seed_initial_tutorials()`.

Initial seed MUST include:
1. **Panduan Setup Cloudflare Tunnel & Remote VNC (Websockify Route)** (Category: `Cloudflare & VNC`)
2. **Panduan Remote Desktop LAN via Tailscale / ZeroTier** (Category: `Jaringan`)

- [ ] **Step 2: Register `TutorialService` in `app/services/__init__.py`**

- [ ] **Step 3: Call `TutorialService.seed_initial_tutorials()` on App boot in `app/__init__.py`**

- [ ] **Step 4: Verify seed data execution**

Run: `python -c "from app import create_app; app=create_app(); ctx=app.app_context(); ctx.push(); from app.services import TutorialService; print(len(TutorialService.get_all()))"`
Expected: `>= 2` seed tutorials.

- [ ] **Step 5: Commit**

```bash
git add app/services/tutorial/ app/services/__init__.py app/__init__.py
git commit -m "fitur: tambah TutorialService dan seeding panduan awal cloudflare & vnc"
```

---

### Task 4: REST API Endpoints (`tutorial_routes.py`)

**Files:**
- Create: `app/routes/tutorial/tutorial_routes.py`
- Modify: `app/routes/__init__.py`
- Modify: `app/__init__.py`

- [ ] **Step 1: Create API Endpoints**

Implement:
- `GET /api/v1/kasir/tutorials`
- `POST /api/v1/kasir/tutorials` (`@login_required`, `@admin_required`)
- `PUT /api/v1/kasir/tutorials/<int:id>` (`@login_required`, `@admin_required`)
- `DELETE /api/v1/kasir/tutorials/<int:id>` (`@login_required`, `@admin_required`)

- [ ] **Step 2: Register Blueprint `tutorial_api_bp` in `app/routes/__init__.py` and `app/__init__.py`**

Prefix: `/api/v1/kasir/tutorials`

- [ ] **Step 3: Verify API endpoints using Flask test client**

Run audit test script confirming HTTP 200 responses.

- [ ] **Step 4: Commit**

```bash
git add app/routes/tutorial/ app/routes/__init__.py app/__init__.py
git commit -m "fitur: tambah endpoint REST API tutorial management"
```

---

### Task 5: Frontend UI Sub-Tab & CKEditor 5 Modal Integration

**Files:**
- Modify: `app/templates/kasir/tabs/settings.html`
- Modify: `app/templates/kasir/components/sidebar.html`
- Modify: `app/static/js/kasir/app.js`
- Modify: `app/static/js/kasir/modules/settings/index.js`

- [ ] **Step 1: Add CKEditor 5 local script tag to `settings.html`**

- [ ] **Step 2: Add Sub-Tab `#subtab-tutorials` in `settings.html`**

Include:
- Category Filter Tabs (Semua, Cloudflare & VNC, Jaringan, Umum)
- **`➕ Tambah Panduan Baru`** button (Admin only)
- Dynamic Grid Container `#tutorials-grid-container`
- Modal Editor `#modal-tutorial-editor` with title, icon, category, urutan inputs and CKEditor 5 container `#tutorial-editor-container`.

- [ ] **Step 3: Add `📚 Panduan & Dokumentasi` sidebar navigation item in `sidebar.html` and register in `app.js`**

- [ ] **Step 4: Implement JS Functions in `settings/index.js`**

Functions:
- `loadTutorials()`
- `filterTutorialCategory(cat)`
- `openTutorialEditor(id)`
- `saveTutorial()`
- `deleteTutorial(id)`

- [ ] **Step 5: Test UI rendering and CSS compilation**

Run: `npm run build:css` and verify Flask app factory boot.

- [ ] **Step 6: Commit**

```bash
git add app/templates/kasir/ app/static/ js/ css/
git commit -m "fitur: integrasi UI subtab dokumentasi dan ckeditor 5 editor"
```
