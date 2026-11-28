package com.tmbilling.tv.receiver

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class KioskDeviceAdminReceiver : DeviceAdminReceiver() {
    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)
        Log.i("KioskDeviceAdmin", "Device Administrator diaktifkan untuk mode Kiosk Lock.")
    }

    override fun onDisabled(context: Context, intent: Intent) {
        super.onDisabled(context, intent)
        Log.w("KioskDeviceAdmin", "Device Administrator dinonaktifkan.")
    }
}
