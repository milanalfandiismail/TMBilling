import os
import re

def test_vnc_clipboard_no_pointerdown_presync():
    """Memastikan pointerdown tidak memicu preSync yang menghapus clipboard file/folder remote."""
    js_path = os.path.join("app", "static", "js", "kasir", "modules", "remote", "vnc_client.js")
    with open(js_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Pastikan tidak ada event listener pointerdown yang menjalankan preSync clipboard
    assert "container.addEventListener('pointerdown', this._boundPreSync)" not in content
    assert "window.addEventListener('focus', this._boundPreSync)" not in content

def test_vnc_clipboard_remote_to_host_sync():
    """Memastikan event clipboard dari remote otomatis menyinkronkan teks ke host clipboard."""
    js_path = os.path.join("app", "static", "js", "kasir", "modules", "remote", "vnc_client.js")
    with open(js_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Cari blok rfb.addEventListener('clipboard'
    clip_listener_match = re.search(r"this\.rfb\.addEventListener\('clipboard',\s*\(e\)\s*=>\s*\{([\s\S]*?)\}\);", content)
    assert clip_listener_match is not None, "Listener rfb 'clipboard' tidak ditemukan"
    clip_body = clip_listener_match.group(1)
    
    # copyTextToHost dipanggil dengan showToast=false untuk silent sync
    assert "this.copyTextToHost(text, false)" in clip_body

    # onClipboard callback di VNCClient.connect memunculkan Toast feedback
    assert "Toast.info('📋 Teks disalin dari Remote VNC')" in content

def test_vnc_clipboard_folder_guard_and_host_paste():
    """Memastikan Ctrl+V membedakan antara copy dalam remote (folder/file) dan paste dari host."""
    js_path = os.path.join("app", "static", "js", "kasir", "modules", "remote", "vnc_client.js")
    with open(js_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Pastikan flag _isRemoteFileFolder diinisialisasi dan diatur saat copy non-teks di remote
    assert "this._isRemoteFileFolder = false" in content
    assert "this._potentialCopyTimer" in content

    # Pastikan jika _isRemoteFileFolder aktif dan bukan explicit host paste, Ctrl+V di-return untuk native remote
    assert "if (!isExplicitHostPaste && this._isRemoteFileFolder)" in content

    # Pastikan jika paste dari host (ada text), ia menempelkan host text
    assert "this.handlePastedText(text)" in content

def test_vnc_modal_toast_feedback():
    """Memastikan modal detail PC juga memberikan Toast feedback saat teks disalin dari remote PC."""
    js_path = os.path.join("app", "static", "js", "kasir", "modules", "dashboard", "dashboard_detail_modal.js")
    with open(js_path, "r", encoding="utf-8") as f:
        content = f.read()

    modal_clip_match = re.search(r"onClipboard:\s*\(text\)\s*=>\s*\{([\s\S]*?)\}", content)
    assert modal_clip_match is not None
    assert "Toast.info" in modal_clip_match.group(1)

def test_vnc_template_shortcut_hint():
    """Memastikan template tab remote server menyajikan panduan shortcut Ctrl+C/V."""
    tpl_path = os.path.join("app", "templates", "kasir", "tabs", "remote_server.html")
    with open(tpl_path, "r", encoding="utf-8") as f:
        content = f.read()

    assert "Ctrl+C" in content
    assert "Ctrl+V" in content
