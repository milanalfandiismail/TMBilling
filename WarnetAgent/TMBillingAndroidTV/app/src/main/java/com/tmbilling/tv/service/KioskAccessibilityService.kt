package com.tmbilling.tv.service

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.util.Log
import android.view.KeyEvent
import android.view.accessibility.AccessibilityEvent
import com.tmbilling.tv.ui.KioskActivity

/**
 * Layanan Aksesibilitas untuk mengamankan tombol remote TV saat kiosk dalam keadaan terkunci.
 * Menelan tombol Home, App Switch, Back, dan Settings agar user/pemain tidak keluar dari mode Kiosk.
 * Tombol volume tetap diizinkan agar pemain PS dapat mengatur tingkat volume suara TV.
 * Dilengkapi pencegatan pergantian window sistem (Home Launcher) dan remote shortcut (MENU / INFO).
 */
class KioskAccessibilityService : AccessibilityService() {

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null || !isLocked || emergencyUnlocked) return

        // Intersep perpindahan window jika user mencoba keluar ke launcher bawaan TV melalui tombol Home sistem
        if (event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            val pkgName = event.packageName?.toString() ?: return

            // Izinkan paket aplikasi kita sendiri
            if (pkgName == packageName) return

            // Izinkan paket sistem sementara jika sengaja dibuka oleh admin (Settings / Uninstaller)
            if (allowTemporarySystemPackage && isAllowedAdminPackage(pkgName)) return

            // Jika jendela berpindah ke aplikasi lain atau launcher bawaan Android TV saat kiosk terkunci
            Log.w(TAG, "Mencegat peralihan window ke: $pkgName. Memaksa KioskActivity kembali ke depan.")
            val intent = Intent(this, KioskActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            }
            startActivity(intent)
        }
    }

    override fun onInterrupt() {}

    override fun onKeyEvent(event: KeyEvent?): Boolean {
        if (event == null) return false

        // Jika emergency unlocked diaktifkan oleh admin (via Emergency PIN), izinkan semua tombol
        if (emergencyUnlocked) {
            return super.onKeyEvent(event)
        }

        // ==============================================================
        // SHORTCUT REMOTE: Tombol MENU, INFO, atau SETTINGS
        // Membuka modal pengaturan kiosk secara instan tanpa tombol janggal di UI
        // ==============================================================
        when (event.keyCode) {
            KeyEvent.KEYCODE_MENU,
            KeyEvent.KEYCODE_INFO,
            KeyEvent.KEYCODE_PROG_RED -> {
                if (event.action == KeyEvent.ACTION_UP) {
                    Log.d(TAG, "Shortcut remote ditekan (Key: ${event.keyCode}). Membuka modal pengaturan.")
                    val intent = Intent(this, KioskActivity::class.java).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                        putExtra(KioskActivity.EXTRA_OPEN_SETTINGS, true)
                    }
                    startActivity(intent)
                }
                return true
            }
        }

        // Jika kiosk sedang terkunci (baik saat Standby maupun Sesi Aktif)
        if (isLocked) {
            when (event.keyCode) {
                // IZINKAN VOLUME SUARA: Pemain PS tetap bebas mengatur suara TV
                KeyEvent.KEYCODE_VOLUME_UP,
                KeyEvent.KEYCODE_VOLUME_DOWN,
                KeyEvent.KEYCODE_VOLUME_MUTE -> {
                    return false
                }

                // BLOKIR 100% TOMBOL NAVIGASI & KELUAR
                KeyEvent.KEYCODE_HOME,
                KeyEvent.KEYCODE_APP_SWITCH,
                KeyEvent.KEYCODE_BACK,
                KeyEvent.KEYCODE_SETTINGS,
                KeyEvent.KEYCODE_TV_INPUT,
                KeyEvent.KEYCODE_GUIDE,
                KeyEvent.KEYCODE_ALL_APPS,
                KeyEvent.KEYCODE_WINDOW -> {
                    if (event.action == KeyEvent.ACTION_UP) {
                        Log.d(TAG, "Mencegat dan memblokir tombol: ${event.keyCode}. Mempertahankan Kiosk.")
                        val intent = Intent(this, KioskActivity::class.java).apply {
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                        }
                        startActivity(intent)
                    }
                    return true // Telan event tombol agar OS Android TV tidak berpindah ke Launcher bawaan
                }
            }
        }

        return super.onKeyEvent(event)
    }

    private fun isAllowedAdminPackage(pkgName: String): Boolean {
        return pkgName.contains("settings", ignoreCase = true) ||
                pkgName.contains("packageinstaller", ignoreCase = true) ||
                pkgName.contains("permissioncontroller", ignoreCase = true) ||
                pkgName.contains("intentresolver", ignoreCase = true) ||
                pkgName == "android"
    }

    companion object {
        private const val TAG = "KioskAccessibility"

        @Volatile
        var isLocked: Boolean = true

        @Volatile
        var emergencyUnlocked: Boolean = false

        @Volatile
        var allowTemporarySystemPackage: Boolean = false
    }
}
