import os
import re

def test_vnc_clipboard_no_pointerdown_presync():
    """Memastikan pointerdown tidak lagi memicu preSync yang menghapus clipboard file/folder remote."""
    js_path = os.path.join("app", "static", "js", "kasir", "modules", "remote", "vnc_client.js")
    with open(js_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Pastikan tidak ada event listener pointerdown yang menjalankan preSync clipboard
    assert "container.addEventListener('pointerdown', this._boundPreSync)" not in content
    assert "window.addEventListener('focus', this._boundPreSync)" not in content

def test_vnc_clipboard_no_auto_copy_to_host():
    """Memastikan event clipboard dari remote tidak otomatis membajak clipboard host atau memicu toast."""
    js_path = os.path.join("app", "static", "js", "kasir", "modules", "remote", "vnc_client.js")
    with open(js_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Cari blok rfb.addEventListener('clipboard'
    clip_listener_match = re.search(r"this\.rfb\.addEventListener\('clipboard',\s*\(e\)\s*=>\s*\{([\s\S]*?)\}\);", content)
    assert clip_listener_match is not None, "Listener rfb 'clipboard' tidak ditemukan"
    clip_body = clip_listener_match.group(1)
    
    # copyTextToHost tidak boleh dipanggil otomatis di dalam listener rfb (abaikan komentar)
    code_without_comments = re.sub(r"//.*", "", clip_body)
    assert "this.copyTextToHost(" not in code_without_comments

    # onClipboard callback di VNCClient.connect tidak boleh memunculkan toast otomatis
    vnc_connect_match = re.search(r"onClipboard:\s*\(text\)\s*=>\s*\{([\s\S]*?)\}", content)
    assert vnc_connect_match is not None
    assert "Toast.info" not in vnc_connect_match.group(1)

def test_vnc_clipboard_native_paste_passthrough():
    """Memastikan Ctrl+V standar tidak dibajak agar file/folder di remote dapat dipaste secara native."""
    js_path = os.path.join("app", "static", "js", "kasir", "modules", "remote", "vnc_client.js")
    with open(js_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Pastikan shortcut eksplisit host paste menggunakan Shift atau Alt (Ctrl+Shift+V / Alt+V)
    assert "isV && (e.shiftKey || e.altKey)" in content
    
    # Pastikan jika isV biasa, ia return (tidak memanggil stopImmediatePropagation atau handlePastedText)
    assert "Biarkan noVNC meneruskan sinyal Ctrl+V asli" in content

def test_vnc_modal_no_auto_toast():
    """Memastikan modal detail PC juga tidak memunculkan toast otomatis saat copy di remote."""
    js_path = os.path.join("app", "static", "js", "kasir", "modules", "dashboard", "dashboard_detail_modal.js")
    with open(js_path, "r", encoding="utf-8") as f:
        content = f.read()

    modal_clip_match = re.search(r"onClipboard:\s*\(text\)\s*=>\s*\{([\s\S]*?)\}", content)
    assert modal_clip_match is not None
    assert "Toast.info" not in modal_clip_match.group(1)

def test_vnc_template_shortcut_hint():
    """Memastikan template tab remote server menyajikan panduan shortcut Ctrl+C/V dan Ctrl+Shift+V."""
    tpl_path = os.path.join("app", "templates", "kasir", "tabs", "remote_server.html")
    with open(tpl_path, "r", encoding="utf-8") as f:
        content = f.read()

    assert "Ctrl+Shift+V" in content
    assert "Ctrl+C" in content
    assert "Ctrl+V" in content
