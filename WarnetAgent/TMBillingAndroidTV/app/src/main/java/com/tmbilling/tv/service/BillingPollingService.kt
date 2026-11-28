package com.tmbilling.tv.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.tmbilling.tv.App
import com.tmbilling.tv.data.model.*
import com.tmbilling.tv.data.network.ApiClient
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class BillingPollingService : Service() {

    private val serviceJob = SupervisorJob()
    private val serviceScope = CoroutineScope(Dispatchers.IO + serviceJob)

    private var previousStatus: String = "kosong"
    private var warned5Min = false
    private var warned1Min = false

    override fun onCreate() {
        super.onCreate()
        startForegroundNotification()
        startPollingLoop()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun startForegroundNotification() {
        val channelId = "billing_service_channel"
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Layanan Kiosk Billing PS",
                NotificationManager.IMPORTANCE_LOW
            )
            notificationManager.createNotificationChannel(channel)
        }

        val notification: Notification = NotificationCompat.Builder(this, channelId)
            .setContentTitle("TMBilling Kiosk Service")
            .setContentText("Sinkronisasi sesi PS aktif di latar belakang.")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()

        startForeground(1001, notification)
    }

    private fun startPollingLoop() {
        serviceScope.launch {
            val app = App.instance
            while (isActive) {
                try {
                    val clientReq = ClientStatusRequest(
                        ipAddress = app.preferences.clientIp,
                        macAddress = app.preferences.macAddress,
                        role = "client"
                    )

                    val clientResponse = try {
                        ApiClient.apiService.getClientStatus(clientReq)
                    } catch (e: Exception) {
                        null
                    }

                    if (clientResponse != null && clientResponse.isSuccessful && clientResponse.body() != null) {
                        val body = clientResponse.body()!!
                        val isSessionActive = body.status == "aktif" || body.status == "terpakai"
                        val stationCodeFromServer = body.pcKode?.trim()?.ifEmpty { null } ?: app.preferences.stationCode
                        if (!body.pcKode.isNullOrBlank() && app.preferences.stationCode != body.pcKode) {
                            app.preferences.stationCode = body.pcKode
                            app.preferences.stationName = body.pcKode
                        }

                        val sesiInfo = if (isSessionActive) {
                            ActiveSessionInfo(
                                id = 1,
                                idKomputer = app.preferences.stationId,
                                idMember = null,
                                username = body.nama ?: "Player PS",
                                tipeSesi = "paket",
                                waktuMulai = body.mulai ?: "",
                                waktuSelesai = null,
                                totalDetik = null,
                                sisaDetik = body.sisaDetik ?: ((body.sisaWaktu ?: 0L) * 60L),
                                tarifPerJam = null,
                                totalBiaya = null
                            )
                        } else null

                        val stationStatus = StationStatusResponse(
                            id = app.preferences.stationId,
                            nomor = stationCodeFromServer,
                            nama = stationCodeFromServer,
                            status = if (isSessionActive) "terpakai" else "kosong",
                            tipe = "Console",
                            ipAddress = app.preferences.clientIp,
                            sesiAktif = sesiInfo,
                            serverTime = System.currentTimeMillis() / 1000
                        )

                        _stationStateFlow.value = stationStatus
                        _isServerConnectedFlow.value = true
                        _lastErrorFlow.value = null
                        handleStateTransition(stationStatus)

                        // Ambil info warnet & QRIS jika belum dimuat
                        if (_warnetConfigFlow.value == null) {
                            try {
                                val warnetRes = ApiClient.apiService.getWarnetConfig()
                                if (warnetRes.isSuccessful && warnetRes.body() != null) {
                                    val raw = warnetRes.body()!!
                                    val normalizedQrisUrl = normalizeQrisUrl(
                                        serverUrl = app.preferences.serverUrl,
                                        qrisUrl = raw.qrisUrl,
                                        qrisPath = raw.qrisPath
                                    )
                                    _warnetConfigFlow.value = raw.copy(qrisUrl = normalizedQrisUrl)
                                }
                            } catch (we: Exception) {
                                Log.w(TAG, "Gagal mengambil konfigurasi warnet/qris: ${we.message}")
                            }
                        }
                    } else {
                        // Fallback ke getStationStatus jika server lama
                        val stationId = app.preferences.stationId
                        val legacyResponse = ApiClient.apiService.getStationStatus(stationId)
                        if (legacyResponse.isSuccessful && legacyResponse.body() != null) {
                            val body = legacyResponse.body()!!
                            _stationStateFlow.value = body
                            _isServerConnectedFlow.value = true
                            _lastErrorFlow.value = null
                            handleStateTransition(body)
                        } else {
                            _isServerConnectedFlow.value = false
                            _lastErrorFlow.value = "HTTP ${legacyResponse.code()}: ${legacyResponse.message()}"
                        }
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Gagal polling status workstation: ${e.message}")
                    _isServerConnectedFlow.value = false
                    _lastErrorFlow.value = e.message ?: "Koneksi terputus"
                }

                val intervalMs = (app.preferences.pollIntervalSeconds.coerceAtLeast(1)) * 1000L
                delay(intervalMs)
            }
        }
    }

    private fun handleStateTransition(statusResponse: StationStatusResponse) {
        val currentStatus = statusResponse.status
        val app = App.instance
        val defaultHdmi = app.preferences.defaultHdmiInput

        // Transisi: dari kosong ke terpakai (Billing Baru Dibuka)
        if (currentStatus == "terpakai" && previousStatus != "terpakai") {
            Log.i(TAG, "Sesi dimulai! Beralih otomatis ke HDMI: $defaultHdmi")
            warned5Min = false
            warned1Min = false

            if (app.preferences.audioWarningEnabled) {
                app.audioAlertManager.alertSessionStarted()
            }

            if (defaultHdmi.isNotBlank()) {
                val success = app.tvInputController.switchToHdmi(defaultHdmi)
                _isHdmiActiveFlow.value = success
            }
        }

        // Pengecekan Peringatan Sisa Waktu
        val sisaDetik = statusResponse.sesiAktif?.sisaDetik
        if (currentStatus == "terpakai" && sisaDetik != null) {
            val sisaMenit = sisaDetik / 60
            if (sisaMenit in 4..5 && !warned5Min) {
                warned5Min = true
                if (app.preferences.audioWarningEnabled) {
                    app.audioAlertManager.alertTimeWarning(5)
                }
            } else if (sisaMenit in 0..1 && sisaDetik <= 60 && !warned1Min) {
                warned1Min = true
                if (app.preferences.audioWarningEnabled) {
                    app.audioAlertManager.alertTimeWarning(1)
                }
            }
        }

        // Transisi: dari terpakai ke kosong (Waktu Habis / Kasir Stop Sesi)
        if (currentStatus != "terpakai" && previousStatus == "terpakai") {
            Log.i(TAG, "Sesi selesai! Menarik kembali Kiosk ke layar depan.")
            if (app.preferences.audioWarningEnabled) {
                app.audioAlertManager.alertSessionExpired()
            }

            app.tvInputController.bringKioskToFront()
            _isHdmiActiveFlow.value = false
            warned5Min = false
            warned1Min = false
        }

        previousStatus = currentStatus
        KioskAccessibilityService.isLocked = !KioskAccessibilityService.emergencyUnlocked
    }

    override fun onDestroy() {
        super.onDestroy()
        serviceJob.cancel()
    }

    companion object {
        private const val TAG = "BillingPollingService"

        fun start(context: Context) {
            val intent = Intent(context, BillingPollingService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun setHdmiActive(active: Boolean) {
            _isHdmiActiveFlow.value = active
        }

        fun clearWarnetConfigCache() {
            _warnetConfigFlow.value = null
        }

        internal fun normalizeQrisUrl(serverUrl: String, qrisUrl: String?, qrisPath: String?): String? {
            val baseUrl = serverUrl.trimEnd('/')
            return when {
                !qrisPath.isNullOrBlank() -> {
                    val cleanPath = if (qrisPath.startsWith("/")) qrisPath else "/$qrisPath"
                    "$baseUrl$cleanPath"
                }
                !qrisUrl.isNullOrBlank() &&
                    (qrisUrl.contains("127.0.0.1") || qrisUrl.contains("localhost")) -> {
                    qrisUrl.replace(Regex("^https?://[^/]+"), baseUrl)
                }
                else -> qrisUrl
            }
        }

        private val _stationStateFlow = MutableStateFlow<StationStatusResponse?>(null)
        val stationStateFlow: StateFlow<StationStatusResponse?> = _stationStateFlow.asStateFlow()

        private val _isHdmiActiveFlow = MutableStateFlow(false)
        val isHdmiActiveFlow: StateFlow<Boolean> = _isHdmiActiveFlow.asStateFlow()

        private val _isServerConnectedFlow = MutableStateFlow(false)
        val isServerConnectedFlow: StateFlow<Boolean> = _isServerConnectedFlow.asStateFlow()

        private val _lastErrorFlow = MutableStateFlow<String?>(null)
        val lastErrorFlow: StateFlow<String?> = _lastErrorFlow.asStateFlow()

        private val _warnetConfigFlow = MutableStateFlow<com.tmbilling.tv.data.model.WarnetConfigResponse?>(null)
        val warnetConfigFlow: StateFlow<com.tmbilling.tv.data.model.WarnetConfigResponse?> = _warnetConfigFlow.asStateFlow()
    }
}
