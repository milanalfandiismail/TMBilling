package com.tmbilling.tv

import android.app.Application
import com.tmbilling.tv.controller.AudioAlertManager
import com.tmbilling.tv.controller.TvInputController
import com.tmbilling.tv.data.network.ApiClient
import com.tmbilling.tv.data.pref.AppPreferences

class App : Application() {

    lateinit var preferences: AppPreferences
        private set
    lateinit var tvInputController: TvInputController
        private set
    lateinit var audioAlertManager: AudioAlertManager
        private set

    override fun onCreate() {
        super.onCreate()
        instance = this
        preferences = AppPreferences(this)
        tvInputController = TvInputController(this)
        audioAlertManager = AudioAlertManager(this)
        ApiClient.init(preferences)
    }

    companion object {
        lateinit var instance: App
            private set
    }
}
