package com.tmbilling.tv.data.pref

import android.content.Context
import android.content.SharedPreferences

class AppPreferences(context: Context) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)

    var isConfigured: Boolean
        get() = prefs.getBoolean(KEY_IS_CONFIGURED, false)
        set(value) = prefs.edit().putBoolean(KEY_IS_CONFIGURED, value).apply()

    var serverUrl: String
        get() = prefs.getString(KEY_SERVER_URL, "http://10.0.2.2:7015") ?: "http://10.0.2.2:7015"
        set(value) = prefs.edit().putString(KEY_SERVER_URL, value.trimEnd('/')).apply()

    var secretKey: String
        get() = prefs.getString(KEY_SECRET_KEY, "") ?: ""
        set(value) = prefs.edit().putString(KEY_SECRET_KEY, value).apply()

    var stationCode: String
        get() = prefs.getString(KEY_STATION_CODE, "PS-01") ?: "PS-01"
        set(value) = prefs.edit().putString(KEY_STATION_CODE, value).apply()

    var clientIp: String
        get() = prefs.getString(KEY_CLIENT_IP, "10.0.2.2") ?: "10.0.2.2"
        set(value) = prefs.edit().putString(KEY_CLIENT_IP, value).apply()

    var macAddress: String
        get() = prefs.getString(KEY_MAC_ADDRESS, "02:00:00:00:00:01") ?: "02:00:00:00:00:01"
        set(value) = prefs.edit().putString(KEY_MAC_ADDRESS, value).apply()

    var stationId: Int
        get() = prefs.getInt(KEY_STATION_ID, 1)
        set(value) = prefs.edit().putInt(KEY_STATION_ID, value).apply()

    var stationName: String
        get() = prefs.getString(KEY_STATION_NAME, "PS-01") ?: "PS-01"
        set(value) = prefs.edit().putString(KEY_STATION_NAME, value).apply()

    var defaultHdmiInput: String
        get() = prefs.getString(KEY_DEFAULT_HDMI, "com.mediatek.tvinput/.hdmi.HDMIInputService/HW1") ?: ""
        set(value) = prefs.edit().putString(KEY_DEFAULT_HDMI, value).apply()

    var adminPin: String
        get() = prefs.getString(KEY_ADMIN_PIN, "8888") ?: "8888"
        set(value) = prefs.edit().putString(KEY_ADMIN_PIN, value).putString(KEY_EMERGENCY_PIN, value).apply()

    var emergencyPin: String
        get() = prefs.getString(KEY_EMERGENCY_PIN, adminPin) ?: adminPin
        set(value) = prefs.edit().putString(KEY_EMERGENCY_PIN, value).putString(KEY_ADMIN_PIN, value).apply()

    var pollIntervalSeconds: Int
        get() = prefs.getInt(KEY_POLL_INTERVAL, 3)
        set(value) = prefs.edit().putInt(KEY_POLL_INTERVAL, value).apply()

    var audioWarningEnabled: Boolean
        get() = prefs.getBoolean(KEY_AUDIO_WARNING, true)
        set(value) = prefs.edit().putBoolean(KEY_AUDIO_WARNING, value).apply()

    companion object {
        private const val PREF_NAME = "tmbilling_tv_prefs"
        private const val KEY_IS_CONFIGURED = "is_configured"
        private const val KEY_SERVER_URL = "server_url"
        private const val KEY_SECRET_KEY = "secret_key"
        private const val KEY_STATION_CODE = "station_code"
        private const val KEY_CLIENT_IP = "client_ip"
        private const val KEY_MAC_ADDRESS = "mac_address"
        private const val KEY_STATION_ID = "station_id"
        private const val KEY_STATION_NAME = "station_name"
        private const val KEY_DEFAULT_HDMI = "default_hdmi"
        private const val KEY_ADMIN_PIN = "admin_pin"
        private const val KEY_EMERGENCY_PIN = "emergency_pin"
        private const val KEY_POLL_INTERVAL = "poll_interval"
        private const val KEY_AUDIO_WARNING = "audio_warning"
    }
}
