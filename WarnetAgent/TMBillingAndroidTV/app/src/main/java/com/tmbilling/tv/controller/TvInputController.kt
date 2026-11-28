package com.tmbilling.tv.controller

import android.content.Context
import android.content.Intent
import android.media.tv.TvContract
import android.media.tv.TvInputInfo
import android.media.tv.TvInputManager
import android.util.Log

class TvInputController(private val context: Context) {

    private val tvInputManager = context.getSystemService(Context.TV_INPUT_SERVICE) as? TvInputManager

    /**
     * Dapatkan daftar semua port input TV yang tersedia (HDMI 1, HDMI 2, AV, dll)
     */
    fun getAvailableInputs(): List<TvInputInfo> {
        val manager = tvInputManager ?: return emptyList()
        return try {
            manager.tvInputList.filter { it.type == TvInputInfo.TYPE_HDMI || it.isPassthroughInput }
        } catch (e: Exception) {
            Log.e(TAG, "Gagal mengambil daftar TV Input", e)
            emptyList()
        }
    }

    /**
     * Ambil label ramah pengguna dari TvInputInfo (misal: "HDMI 1", "PlayStation 5")
     */
    fun getFriendlyLabel(inputInfo: TvInputInfo): String {
        val loaded = try {
            val custom = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.N) {
                inputInfo.loadCustomLabel(context)?.toString()?.trim()
            } else {
                null
            }
            custom?.takeIf { it.isNotBlank() } ?: inputInfo.loadLabel(context)?.toString()?.trim()
        } catch (e: Exception) {
            null
        }
        return if (!loaded.isNullOrBlank()) {
            loaded
        } else {
            inputInfo.id.substringAfterLast("/").ifEmpty { inputInfo.id }
        }
    }

    /**
     * Format label singkat untuk tombol UI Active Session (misal: "HDMI 1", "HDMI 2")
     */
    fun formatHdmiDisplayLabel(preferredInput: String): String {
        if (preferredInput.isBlank()) return "HDMI 1"
        val presetRegex = Regex("^HDMI\\s*([1-4])$", RegexOption.IGNORE_CASE)
        val presetMatch = presetRegex.matchEntire(preferredInput.trim())
        if (presetMatch != null) {
            return "HDMI ${presetMatch.groupValues[1]}"
        }
        val matched = getAvailableInputs().firstOrNull { it.id == preferredInput }
        if (matched != null) {
            return getFriendlyLabel(matched)
        }
        return preferredInput.substringAfterLast("/").ifEmpty { preferredInput }
    }

    /**
     * Petakan preset human-readable ("HDMI 1".."HDMI 4") ke hardware TvInputInfo.id nyata jika tersedia
     */
    fun resolveHdmiInputId(preferredInput: String): String {
        return resolveHdmiInputIdFromList(preferredInput, getAvailableInputs().map {
            it.id to getFriendlyLabel(it)
        })
    }

    /**
     * Beralih secara terprogram ke port HDMI konsol PlayStation
     */
    fun switchToHdmi(inputId: String): Boolean {
        val resolvedId = resolveHdmiInputId(inputId)
        if (resolvedId.isBlank()) {
            Log.w(TAG, "Input ID kosong, tidak dapat beralih ke HDMI.")
            return false
        }
        return try {
            val uri = TvContract.buildChannelUriForPassthroughInput(resolvedId)
            val intent = Intent(Intent.ACTION_VIEW, uri).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            Log.i(TAG, "Berhasil meluncurkan intent beralih ke HDMI: $resolvedId (dari: $inputId)")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Gagal beralih ke port HDMI: $resolvedId (dari: $inputId)", e)
            false
        }
    }

    /**
     * Kembalikan aplikasi Kiosk ke layar depan (foreground) dan tutupi tampilan HDMI
     */
    fun bringKioskToFront() {
        try {
            val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            }
            if (intent != null) {
                context.startActivity(intent)
                Log.i(TAG, "Kiosk berhasil dipanggil kembali ke layar depan.")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Gagal memanggil Kiosk ke depan", e)
        }
    }

    companion object {
        private const val TAG = "TvInputController"

        /**
         * Resolusi murni untuk memetakan preset HDMI 1..4 ke daftar (inputId, label) perangkat TV.
         * Dapat diuji langsung di JVM unit test tanpa Context Android.
         */
        internal fun resolveHdmiInputIdFromList(
            preferredInput: String,
            availableInputs: List<Pair<String, String>>
        ): String {
            val trimmed = preferredInput.trim()
            if (trimmed.isBlank()) return ""
            if (availableInputs.any { it.first == trimmed }) return trimmed

            val presetMatch = Regex("^HDMI\\s*([1-4])$", RegexOption.IGNORE_CASE).matchEntire(trimmed)
            if (presetMatch != null && availableInputs.isNotEmpty()) {
                val portNum = presetMatch.groupValues[1].toInt()
                val byLabelOrId = availableInputs.firstOrNull { (id, label) ->
                    label.contains("HDMI $portNum", ignoreCase = true) ||
                        label.contains("HDMI$portNum", ignoreCase = true) ||
                        id.contains("HW$portNum", ignoreCase = true) ||
                        id.endsWith("/$portNum") ||
                        id.contains("HDMI$portNum", ignoreCase = true)
                }
                if (byLabelOrId != null) return byLabelOrId.first
                if (portNum in 1..availableInputs.size) {
                    return availableInputs[portNum - 1].first
                }
            }
            return trimmed
        }
    }
}
