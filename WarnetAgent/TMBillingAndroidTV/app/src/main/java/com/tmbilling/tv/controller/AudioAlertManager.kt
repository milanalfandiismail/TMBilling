package com.tmbilling.tv.controller

import android.content.Context
import android.speech.tts.TextToSpeech
import android.util.Log
import java.util.Locale

class AudioAlertManager(context: Context) : TextToSpeech.OnInitListener {

    private var tts: TextToSpeech? = TextToSpeech(context, this)
    private var isReady = false

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            val result = tts?.setLanguage(Locale("id", "ID"))
            if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                Log.w(TAG, "Bahasa Indonesia tidak tersedia di TTS TV, fallback ke Default Locale.")
                tts?.setLanguage(Locale.getDefault())
            }
            isReady = true
            Log.i(TAG, "TextToSpeech berhasil diinisialisasi.")
        } else {
            Log.e(TAG, "Inisialisasi TextToSpeech gagal.")
        }
    }

    fun speak(text: String) {
        if (!isReady || text.isBlank()) return
        try {
            tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "ALERT_${System.currentTimeMillis()}")
        } catch (e: Exception) {
            Log.e(TAG, "Gagal memutar audio TTS", e)
        }
    }

    fun alertSessionStarted() {
        speak("Selamat bermain. Sesi rental PlayStation telah dimulai.")
    }

    fun alertTimeWarning(minutesRemaining: Int) {
        speak("Perhatian. Waktu bermain Anda tersisa $minutesRemaining menit lagi.")
    }

    fun alertSessionExpired() {
        speak("Waktu bermain Anda telah habis. Terima kasih telah menyewa di sini.")
    }

    fun shutdown() {
        tts?.stop()
        tts?.shutdown()
        tts = null
    }

    companion object {
        private const val TAG = "AudioAlertManager"
    }
}
