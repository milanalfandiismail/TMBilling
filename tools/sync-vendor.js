/**
 * tools/sync-vendor.js
 * 
 * Skrip otomatis untuk menyalin aset runtime vendor dari node_modules
 * ke app/static/vendor/ agar TMBilling 100% self-hosted & pure offline.
 */
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const NODE_MODULES = path.join(ROOT_DIR, 'node_modules');
const VENDOR_DIR = path.join(ROOT_DIR, 'app', 'static', 'vendor');

function copyFileSafe(src, dest) {
    if (!fs.existsSync(src)) {
        console.warn(`[WARN] File sumber tidak ditemukan: ${src}`);
        return false;
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    return true;
}

function copyDirSafe(src, dest) {
    if (!fs.existsSync(src)) {
        console.warn(`[WARN] Folder sumber tidak ditemukan: ${src}`);
        return false;
    }
    fs.mkdirSync(dest, { recursive: true });
    fs.cpSync(src, dest, { recursive: true });
    return true;
}

console.log('=== [TMBilling] Menyinkronkan Aset Vendor Lokal ===');

// 1. FontAwesome Free (v6.4.0)
const faSrc = path.join(NODE_MODULES, '@fortawesome', 'fontawesome-free');
const faDest = path.join(VENDOR_DIR, 'fontawesome');
if (fs.existsSync(faSrc)) {
    copyFileSafe(path.join(faSrc, 'css', 'all.min.css'), path.join(faDest, 'css', 'all.min.css'));
    copyDirSafe(path.join(faSrc, 'webfonts'), path.join(faDest, 'webfonts'));
    console.log('✓ FontAwesome 6 disalin ke app/static/vendor/fontawesome/');
} else {
    console.warn('[WARN] @fortawesome/fontawesome-free belum terpasang di node_modules');
}

// 2. QRCode.js (v1.0.0)
const qrSrc = path.join(NODE_MODULES, 'qrcodejs');
const qrDest = path.join(VENDOR_DIR, 'qrcode');
if (fs.existsSync(qrSrc)) {
    const qrFile = fs.existsSync(path.join(qrSrc, 'qrcode.min.js')) 
        ? path.join(qrSrc, 'qrcode.min.js') 
        : path.join(qrSrc, 'qrcode.js');
    copyFileSafe(qrFile, path.join(qrDest, 'qrcode.min.js'));
    console.log('✓ QRCode.js disalin ke app/static/vendor/qrcode/qrcode.min.js');
} else {
    console.warn('[WARN] qrcodejs belum terpasang di node_modules');
}

// 3. noVNC (v1.4.0)
const vncSrc = path.join(NODE_MODULES, '@novnc', 'novnc');
const vncDest = path.join(VENDOR_DIR, 'novnc');
if (fs.existsSync(vncSrc)) {
    copyDirSafe(path.join(vncSrc, 'core'), path.join(vncDest, 'core'));
    if (fs.existsSync(path.join(vncSrc, 'vendor'))) {
        copyDirSafe(path.join(vncSrc, 'vendor'), path.join(vncDest, 'vendor'));
    }
    console.log('✓ noVNC disalin ke app/static/vendor/novnc/');
} else {
    console.warn('[WARN] @novnc/novnc belum terpasang di node_modules');
}

console.log('=== [TMBilling] Sinkronisasi Aset Vendor Selesai ===\n');
