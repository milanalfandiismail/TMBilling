package com.tmbilling.tv.ui

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.tmbilling.tv.App
import com.tmbilling.tv.data.network.ApiClient
import com.tmbilling.tv.data.network.DiscoveredServer
import com.tmbilling.tv.data.network.ServerScanner
import com.tmbilling.tv.receiver.KioskDeviceAdminReceiver
import com.tmbilling.tv.service.BillingPollingService
import com.tmbilling.tv.service.KioskAccessibilityService
import com.tmbilling.tv.ui.screens.LockScreen
import com.tmbilling.tv.ui.screens.TvButton
import com.tmbilling.tv.ui.theme.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch

class KioskActivity : ComponentActivity() {

    private lateinit var devicePolicyManager: DevicePolicyManager
    private lateinit var adminComponent: ComponentName
    private val isDefaultLauncherFlow = MutableStateFlow(false)
    private val isAccessibilityEnabledFlow = MutableStateFlow(false)

    companion object {
        const val EXTRA_OPEN_SETTINGS = "EXTRA_OPEN_SETTINGS"
        val openSettingsRequest = MutableStateFlow(false)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        devicePolicyManager = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        adminComponent = ComponentName(this, KioskDeviceAdminReceiver::class.java)

        setupKioskWindow()
        startBillingService()
        enableLockTaskMode()

        if (intent?.getBooleanExtra(EXTRA_OPEN_SETTINGS, false) == true) {
            openSettingsRequest.value = true
        }

        setContent {
            TMBillingTVTheme {
                val stationStatus by BillingPollingService.stationStateFlow.collectAsState()
                val isServerConnected by BillingPollingService.isServerConnectedFlow.collectAsState()
                val warnetConfig by BillingPollingService.warnetConfigFlow.collectAsState()
                val prefs = App.instance.preferences
                val tvInputController = remember { com.tmbilling.tv.controller.TvInputController(this@KioskActivity) }

                var currentStationName by remember { mutableStateOf(prefs.stationCode.ifEmpty { prefs.stationName }) }
                var currentServerUrl by remember { mutableStateOf(prefs.serverUrl) }
                var currentHdmiInput by remember { mutableStateOf(prefs.defaultHdmiInput) }

                // Auto-buka dialog konfigurasi jika belum pernah dikonfigurasi
                var showSettingsDialog by remember { mutableStateOf(!prefs.isConfigured) }
                val startUnlocked = !prefs.isConfigured

                // Dengarkan request pembukaan dialog dari remote shortcut (MENU / INFO)
                val requestOpen by openSettingsRequest.collectAsState()
                LaunchedEffect(requestOpen) {
                    if (requestOpen) {
                        showSettingsDialog = true
                        openSettingsRequest.value = false
                    }
                }

                // Blokir tombol Back (Predictive Back API 33+/16) agar tidak keluar ke Android TV Launcher
                BackHandler(
                    enabled = !showSettingsDialog &&
                        KioskAccessibilityService.isLocked &&
                        !KioskAccessibilityService.emergencyUnlocked
                ) {
                    // Sengaja dikosongkan agar layar tetap terkunci di Kiosk
                }

                LockScreen(
                    stationStatus = stationStatus,
                    stationName = currentStationName,
                    serverUrl = currentServerUrl,
                    isServerConnected = isServerConnected,
                    warnetConfig = warnetConfig,
                    hdmiLabel = tvInputController.formatHdmiDisplayLabel(currentHdmiInput),
                    onOpenSettings = { showSettingsDialog = true },
                    onSwitchToHdmi = {
                        val defaultHdmi = prefs.defaultHdmiInput
                        BillingPollingService.setHdmiActive(true)
                        val switched = tvInputController.switchToHdmi(defaultHdmi)
                        if (!switched) {
                            BillingPollingService.setHdmiActive(false)
                            Toast.makeText(
                                this@KioskActivity,
                                "Port ${tvInputController.formatHdmiDisplayLabel(defaultHdmi)} tidak tersedia di perangkat ini",
                                Toast.LENGTH_SHORT
                            ).show()
                        }
                    }
                )

                if (showSettingsDialog) {
                    AdminSettingsDialog(
                        isInitialSetup = startUnlocked,
                        tvInputController = tvInputController,
                        onDismiss = {
                            showSettingsDialog = false
                            currentStationName = prefs.stationCode.ifEmpty { prefs.stationName }
                            currentServerUrl = prefs.serverUrl
                            currentHdmiInput = prefs.defaultHdmiInput
                        }
                    )
                }
            }
        }
    }

    private fun setupKioskWindow() {
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            )
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false)
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_FULLSCREEN or
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            )
        }
    }

    private fun startBillingService() {
        val serviceIntent = Intent(this, BillingPollingService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent)
        } else {
            startService(serviceIntent)
        }
    }

    private fun enableLockTaskMode() {
        try {
            if (devicePolicyManager.isDeviceOwnerApp(packageName)) {
                devicePolicyManager.setLockTaskPackages(adminComponent, arrayOf(packageName))
                startLockTask()
            }
        } catch (e: Exception) {
            // Abaikan jika belum menjadi device owner
        }
    }

    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        if (KioskAccessibilityService.isLocked &&
            !KioskAccessibilityService.emergencyUnlocked &&
            !KioskAccessibilityService.allowTemporarySystemPackage &&
            !BillingPollingService.isHdmiActiveFlow.value
        ) {
            val intent = Intent(this, KioskActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            }
            startActivity(intent)
        }
    }

    override fun onResume() {
        super.onResume()
        KioskAccessibilityService.allowTemporarySystemPackage = false
        BillingPollingService.setHdmiActive(false)
        isDefaultLauncherFlow.value = checkIsDefaultLauncher()
        isAccessibilityEnabledFlow.value = checkIsAccessibilityEnabled()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (!hasFocus && KioskAccessibilityService.isLocked) {
            setupKioskWindow()
        }
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (intent?.getBooleanExtra(EXTRA_OPEN_SETTINGS, false) == true) {
            openSettingsRequest.value = true
        }
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        // Shortcut Remote: MENU, INFO, atau tombol merah untuk membuka modal pengaturan
        if (keyCode == KeyEvent.KEYCODE_MENU || keyCode == KeyEvent.KEYCODE_INFO || keyCode == KeyEvent.KEYCODE_PROG_RED) {
            openSettingsRequest.value = true
            return true
        }

        // Blokir tombol keluar saat kiosk terkunci
        if (KioskAccessibilityService.isLocked && !KioskAccessibilityService.emergencyUnlocked) {
            if (keyCode == KeyEvent.KEYCODE_BACK || keyCode == KeyEvent.KEYCODE_HOME) {
                return true
            }
        }
        return super.onKeyDown(keyCode, event)
    }

    private fun checkIsDefaultLauncher(): Boolean {
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val roleManager = getSystemService(android.app.role.RoleManager::class.java)
                roleManager?.isRoleHeld(android.app.role.RoleManager.ROLE_HOME) == true
            } else {
                val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
                val resolveInfo = packageManager.resolveActivity(intent, android.content.pm.PackageManager.MATCH_DEFAULT_ONLY)
                resolveInfo?.activityInfo?.packageName == packageName
            }
        } catch (e: Exception) {
            false
        }
    }

    private fun checkIsAccessibilityEnabled(): Boolean {
        return try {
            val expectedComponent = ComponentName(this, KioskAccessibilityService::class.java).flattenToString()
            val enabledServices = android.provider.Settings.Secure.getString(
                contentResolver,
                android.provider.Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
            ) ?: return false
            enabledServices.split(':').any {
                it.equals(expectedComponent, ignoreCase = true) ||
                    it.equals("$packageName/${KioskAccessibilityService::class.java.name}", ignoreCase = true) ||
                    it.equals("$packageName/.service.KioskAccessibilityService", ignoreCase = true)
            }
        } catch (e: Exception) {
            false
        }
    }

    private fun openAccessibilitySettings() {
        KioskAccessibilityService.allowTemporarySystemPackage = true
        var opened = false
        // 1. Coba ACTION_ACCESSIBILITY_SETTINGS standar
        try {
            val intent = Intent(android.provider.Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            startActivity(intent)
            opened = true
        } catch (_: Exception) {
        }

        // 2. Fallback khusus Android TV Leanback Settings jika ada
        if (!opened) {
            try {
                val tvSettingsIntent = Intent("android.settings.ACCESSIBILITY_SETTINGS").apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                startActivity(tvSettingsIntent)
                opened = true
            } catch (_: Exception) {
            }
        }

        // 3. Fallback ke Pengaturan Sistem TV Umum
        if (!opened) {
            try {
                startActivity(Intent(android.provider.Settings.ACTION_SETTINGS).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                })
                opened = true
            } catch (e2: Exception) {
                Toast.makeText(this, "Gagal membuka pengaturan: ${e2.message}", Toast.LENGTH_SHORT).show()
            }
        }

        if (opened) {
            Toast.makeText(
                this,
                "Buka menu 'Aksesibilitas' lalu aktifkan layanan 'TMBilling TV'",
                Toast.LENGTH_LONG
            ).show()
        }
    }

    private fun requestSetDefaultLauncher() {
        KioskAccessibilityService.allowTemporarySystemPackage = true
        try {
            // Android 10+ (API 29+): Gunakan RoleManager resmi untuk ROLE_HOME
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val roleManager = getSystemService(android.app.role.RoleManager::class.java)
                if (roleManager != null && roleManager.isRoleAvailable(android.app.role.RoleManager.ROLE_HOME)) {
                    if (!roleManager.isRoleHeld(android.app.role.RoleManager.ROLE_HOME)) {
                        val intent = roleManager.createRequestRoleIntent(android.app.role.RoleManager.ROLE_HOME)
                        startActivity(intent)
                        return
                    } else {
                        Toast.makeText(this, "TMBilling sudah menjadi Launcher Utama TV!", Toast.LENGTH_SHORT).show()
                        return
                    }
                }
            }

            // Fallback 1: ACTION_HOME_SETTINGS
            try {
                startActivity(Intent(android.provider.Settings.ACTION_HOME_SETTINGS))
                return
            } catch (_: Exception) {
            }

            // Fallback 2: Munculkan chooser Home Launcher
            val homeIntent = Intent(Intent.ACTION_MAIN).apply {
                addCategory(Intent.CATEGORY_HOME)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            startActivity(Intent.createChooser(homeIntent, "Pilih TMBilling TV sebagai Beranda / Home TV"))
        } catch (e: Exception) {
            try {
                startActivity(Intent(android.provider.Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS))
            } catch (e2: Exception) {
                Toast.makeText(this, "Silakan pilih TMBilling di Pengaturan > Aplikasi Default > Beranda TV", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun safeUninstallApp() {
        KioskAccessibilityService.allowTemporarySystemPackage = true
        try {
            // Lepas Device Admin jika aktif agar OS mengizinkan uninstallation tanpa error/silent block
            if (::devicePolicyManager.isInitialized && devicePolicyManager.isAdminActive(adminComponent)) {
                devicePolicyManager.removeActiveAdmin(adminComponent)
            }
        } catch (e: Exception) {
            // Lanjutkan percobaan uninstaller
        }

        var started = false
        // 1. Coba ACTION_UNINSTALL_PACKAGE resmi
        try {
            @Suppress("DEPRECATION")
            val uninstallIntent = Intent(Intent.ACTION_UNINSTALL_PACKAGE).apply {
                data = android.net.Uri.parse("package:$packageName")
                putExtra(Intent.EXTRA_RETURN_RESULT, true)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            startActivity(uninstallIntent)
            started = true
        } catch (_: Exception) {
        }

        // 2. Fallback ACTION_DELETE
        if (!started) {
            try {
                val deleteIntent = Intent(Intent.ACTION_DELETE).apply {
                    data = android.net.Uri.parse("package:$packageName")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                startActivity(deleteIntent)
                started = true
            } catch (_: Exception) {
            }
        }

        // 3. Fallback terakhir: Buka App Info halaman detail pengaturan (user bisa klik Hapus Instalasi di situ)
        if (!started) {
            try {
                val detailsIntent = Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = android.net.Uri.parse("package:$packageName")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                startActivity(detailsIntent)
                Toast.makeText(this, "Pilih 'Copot Pemasangan' pada halaman pengaturan aplikasi ini", Toast.LENGTH_LONG).show()
            } catch (eFinal: Exception) {
                Toast.makeText(this, "Gagal membuka menu uninstall: ${eFinal.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    @Composable
    fun AdminSettingsDialog(
        isInitialSetup: Boolean,
        tvInputController: com.tmbilling.tv.controller.TvInputController,
        onDismiss: () -> Unit
    ) {
        val prefs = App.instance.preferences
        val coroutineScope = rememberCoroutineScope()
        var pinInput by remember { mutableStateOf("") }
        var isUnlocked by remember { mutableStateOf(isInitialSetup) }

        var serverUrl by remember { mutableStateOf(prefs.serverUrl) }
        var stationIdStr by remember { mutableStateOf(prefs.stationId.toString()) }
        var stationName by remember { mutableStateOf(prefs.stationCode.ifEmpty { prefs.stationName }) }
        var secretKey by remember { mutableStateOf(prefs.secretKey) }
        var hdmiInputStr by remember { mutableStateOf(prefs.defaultHdmiInput) }
        var emergencyPinInput by remember { mutableStateOf(prefs.emergencyPin) }

        // State Auto Scan Server IP
        var isScanning by remember { mutableStateOf(false) }
        var scanProgress by remember { mutableStateOf(0) }
        var discoveredServers by remember { mutableStateOf<List<DiscoveredServer>>(emptyList()) }

        // State Deteksi Input HDMI TV
        var availableTvInputs by remember { mutableStateOf(tvInputController.getAvailableInputs()) }
        var hdmiScanStatus by remember { mutableStateOf<String?>(null) }

        var isTestingConnection by remember { mutableStateOf(false) }
        var testResultText by remember { mutableStateOf<String?>(null) }
        var testSuccess by remember { mutableStateOf(false) }

        val textFieldColors = OutlinedTextFieldDefaults.colors(
            focusedTextColor = TextPrimary,
            unfocusedTextColor = TextPrimary,
            focusedContainerColor = CardSurface,
            unfocusedContainerColor = CardSurface,
            focusedBorderColor = TMBillingBlueBright,
            unfocusedBorderColor = CardBorder,
            focusedLabelColor = TMBillingBlueBright,
            unfocusedLabelColor = TextSecondary,
            cursorColor = TMBillingBlueBright
        )

        // usePlatformDefaultWidth = false memungkinkan tampilan 16:9 widescreen sejati di Android TV
        Dialog(
            onDismissRequest = onDismiss,
            properties = DialogProperties(usePlatformDefaultWidth = false)
        ) {
            if (!isUnlocked) {
                // ==============================================================
                // MODAL VERIFIKASI PIN ADMIN (Tersentralisasi & Jelas)
                // ==============================================================
                Surface(
                    modifier = Modifier
                        .width(460.dp)
                        .wrapContentHeight()
                        .border(1.dp, CardBorder, RoundedCornerShape(16.dp)),
                    shape = RoundedCornerShape(16.dp),
                    color = DarkSurface
                ) {
                    Column(
                        modifier = Modifier.padding(28.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = PlayStationBlue.copy(alpha = 0.2f),
                            border = androidx.compose.foundation.BorderStroke(1.dp, TMBillingBlueBright)
                        ) {
                            Text(
                                text = "KEAMANAN KIOSK",
                                color = TMBillingBlueBright,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 1.sp,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                            )
                        }

                        Spacer(modifier = Modifier.height(14.dp))

                        Text(
                            text = "VERIFIKASI PIN ADMIN",
                            color = TextPrimary,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.sp
                        )

                        Spacer(modifier = Modifier.height(6.dp))

                        Text(
                            text = "Masukkan PIN administrator untuk membuka pengaturan kiosk (Default: 8888).",
                            color = TextSecondary,
                            fontSize = 13.sp,
                            lineHeight = 18.sp,
                            modifier = Modifier.padding(horizontal = 8.dp)
                        )

                        Spacer(modifier = Modifier.height(20.dp))

                        OutlinedTextField(
                            value = pinInput,
                            onValueChange = { pinInput = it },
                            label = { Text("PIN Admin", color = TextSecondary) },
                            visualTransformation = PasswordVisualTransformation(),
                            singleLine = true,
                            colors = textFieldColors,
                            modifier = Modifier.fillMaxWidth()
                        )

                        Spacer(modifier = Modifier.height(24.dp))

                        Row(
                            horizontalArrangement = Arrangement.spacedBy(14.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            TvButton(
                                text = "Batal",
                                onClick = onDismiss,
                                isSecondary = true,
                                modifier = Modifier.weight(1f)
                            )
                            TvButton(
                                text = "Masuk",
                                onClick = {
                                    if (pinInput == prefs.adminPin || pinInput == prefs.emergencyPin) {
                                        isUnlocked = true
                                    } else {
                                        Toast.makeText(this@KioskActivity, "PIN salah!", Toast.LENGTH_SHORT).show()
                                    }
                                },
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }
                }
            } else {
                // ==============================================================
                // LANDSCAPE 16:9 DUAL-COLUMN SETUP CONSOLE
                // ==============================================================
                Surface(
                    modifier = Modifier
                        .fillMaxWidth(0.95f)
                        .fillMaxHeight(0.93f)
                        .border(1.dp, CardBorder, RoundedCornerShape(16.dp)),
                    shape = RoundedCornerShape(16.dp),
                    color = DarkSurface
                ) {
                    Column(modifier = Modifier.fillMaxSize()) {
                        // --- 1. TOP HEADER BAR WITH SHORTCUT HINT ---
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(CardSurface)
                                .padding(horizontal = 20.dp, vertical = 8.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Surface(
                                    shape = RoundedCornerShape(6.dp),
                                    color = Color.White
                                ) {
                                    Text(
                                        text = "TM",
                                        color = Color.Black,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Black,
                                        letterSpacing = (-0.5).sp,
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                    )
                                }
                                Spacer(modifier = Modifier.width(12.dp))
                                Text(
                                    text = if (isInitialSetup) "PANDUAN KONFIGURASI AWAL KIOSK" else "PENGATURAN KIOSK ANDROID TV",
                                    color = TextPrimary,
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.Bold,
                                    letterSpacing = 0.5.sp
                                )
                            }

                            Surface(
                                shape = RoundedCornerShape(6.dp),
                                color = Color(0xFF1E293B),
                                border = androidx.compose.foundation.BorderStroke(1.dp, TMBillingBlueBright.copy(alpha = 0.4f))
                            ) {
                                Text(
                                    text = "🎮 Shortcut Remote: Tombol MENU / INFO",
                                    color = Color(0xFF93C5FD),
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Medium,
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 5.dp)
                                )
                            }
                        }

                        Divider(color = CardBorder, thickness = 1.dp)

                        // --- 2. DUAL COLUMN CONTENT AREA ---
                        Row(
                            modifier = Modifier
                                .weight(1f)
                                .fillMaxWidth()
                                .padding(horizontal = 20.dp, vertical = 10.dp),
                            horizontalArrangement = Arrangement.spacedBy(20.dp)
                        ) {
                            // SISI KIRI: Form Input Server & Station (Weight 1.15)
                            Column(
                                modifier = Modifier
                                    .weight(1.15f)
                                    .fillMaxHeight()
                                    .verticalScroll(rememberScrollState()),
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Text(
                                    text = "IDENTITAS & KONEKSI SERVER",
                                    color = TMBillingBlueBright,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    letterSpacing = 1.sp
                                )

                                OutlinedTextField(
                                    value = serverUrl,
                                    onValueChange = { serverUrl = it },
                                    label = { Text("Alamat Server URL (http://ip:port)", color = TextSecondary) },
                                    modifier = Modifier.fillMaxWidth(),
                                    singleLine = true,
                                    colors = textFieldColors
                                )

                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    OutlinedTextField(
                                        value = stationIdStr,
                                        onValueChange = { stationIdStr = it },
                                        label = { Text("ID", color = TextSecondary) },
                                        modifier = Modifier.weight(0.6f),
                                        singleLine = true,
                                        colors = textFieldColors
                                    )
                                    OutlinedTextField(
                                        value = stationName,
                                        onValueChange = { stationName = it },
                                        label = { Text("Stasiun (PS-01)", color = TextSecondary) },
                                        modifier = Modifier.weight(1.2f),
                                        singleLine = true,
                                        colors = textFieldColors
                                    )
                                    OutlinedTextField(
                                        value = secretKey,
                                        onValueChange = { secretKey = it },
                                        label = { Text("Client Key", color = TextSecondary) },
                                        modifier = Modifier.weight(1.2f),
                                        singleLine = true,
                                        colors = textFieldColors
                                    )
                                }

                                // HDMI INPUT SELECTOR
                                Text(
                                    text = "PORT HDMI TV UNTUK PLAYSTATION",
                                    color = TMBillingBlueBright,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    letterSpacing = 1.sp
                                )

                                OutlinedTextField(
                                    value = hdmiInputStr,
                                    onValueChange = { hdmiInputStr = it },
                                    label = { Text("Target Port HDMI (cth: HDMI 1 atau ID Port)", color = TextSecondary) },
                                    modifier = Modifier.fillMaxWidth(),
                                    singleLine = true,
                                    colors = textFieldColors
                                )

                                // Quick HDMI Preset Pills
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    listOf("HDMI 1", "HDMI 2", "HDMI 3", "HDMI 4").forEach { preset ->
                                        val isSelected = hdmiInputStr.equals(preset, ignoreCase = true)
                                        Surface(
                                            shape = RoundedCornerShape(8.dp),
                                            color = if (isSelected) EmeraldAccent.copy(alpha = 0.2f) else CardSurface,
                                            border = androidx.compose.foundation.BorderStroke(
                                                1.dp,
                                                if (isSelected) EmeraldAccent else CardBorder
                                            ),
                                            modifier = Modifier
                                                .weight(1f)
                                                .clickable { hdmiInputStr = preset }
                                        ) {
                                            Box(
                                                modifier = Modifier.padding(vertical = 8.dp),
                                                contentAlignment = Alignment.Center
                                            ) {
                                                Text(
                                                    text = preset,
                                                    color = if (isSelected) EmeraldAccent else TextPrimary,
                                                    fontSize = 12.sp,
                                                    fontWeight = FontWeight.Bold
                                                )
                                            }
                                        }
                                    }
                                }

                                // Tombol Scan Port HDMI Hardware TV on-demand
                                TvButton(
                                    text = "🔄 Scan Port HDMI TV",
                                    onClick = {
                                        val scanned = tvInputController.getAvailableInputs()
                                        availableTvInputs = scanned
                                        hdmiScanStatus = if (scanned.isEmpty()) {
                                            "0 port HDMI hardware terdeteksi (normal di Emulator — gunakan preset HDMI 1–4)"
                                        } else {
                                            "Ditemukan ${scanned.size} port HDMI di TV ini"
                                        }
                                    },
                                    isSecondary = true,
                                    modifier = Modifier.fillMaxWidth()
                                )

                                if (hdmiScanStatus != null) {
                                    Text(
                                        text = hdmiScanStatus ?: "",
                                        color = if (availableTvInputs.isNotEmpty()) NeonGreen else TextSecondary,
                                        fontSize = 11.sp
                                    )
                                }

                                // Jika Android TV memiliki port HDMI hardware nyata yang terdeteksi
                                if (availableTvInputs.isNotEmpty()) {
                                    Text(
                                        text = "Port Terdeteksi di TV ini:",
                                        color = TextSecondary,
                                        fontSize = 11.sp
                                    )
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        availableTvInputs.take(3).forEach { inputInfo ->
                                            val label = tvInputController.getFriendlyLabel(inputInfo)
                                            TvButton(
                                                text = "📺 $label",
                                                onClick = { hdmiInputStr = inputInfo.id },
                                                isSecondary = (hdmiInputStr != inputInfo.id),
                                                modifier = Modifier.weight(1f)
                                            )
                                        }
                                    }
                                }

                                OutlinedTextField(
                                    value = emergencyPinInput,
                                    onValueChange = { emergencyPinInput = it },
                                    label = { Text("PIN Kiosk & Emergency (Custom)", color = TextSecondary) },
                                    modifier = Modifier.fillMaxWidth(),
                                    singleLine = true,
                                    colors = textFieldColors
                                )
                            }

                            // SISI KANAN: Auto-Scan Server, Preset, Diagnostik & Aksi Darurat (Weight 0.95)
                            Column(
                                modifier = Modifier
                                    .weight(0.95f)
                                    .fillMaxHeight()
                                    .verticalScroll(rememberScrollState()),
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Text(
                                    text = "AUTO SCAN & PRESET SERVER",
                                    color = TMBillingBlueBright,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    letterSpacing = 1.sp
                                )

                                // Tombol Auto Scan Subnet Lokal
                                TvButton(
                                    text = if (isScanning) "🔍 Memindai Jaringan ($scanProgress%)..." else "🔍 Auto Scan IP Server (Port 7015)",
                                    onClick = {
                                        if (!isScanning) {
                                            isScanning = true
                                            discoveredServers = emptyList()
                                            coroutineScope.launch {
                                                val found = ServerScanner.scanLocalSubnet { done, total ->
                                                    scanProgress = if (total > 0) (done * 100 / total) else 0
                                                }
                                                discoveredServers = found
                                                isScanning = false
                                                if (found.isEmpty()) {
                                                    Toast.makeText(this@KioskActivity, "Tidak ada server TMBilling ditemukan di port 7015", Toast.LENGTH_SHORT).show()
                                                } else {
                                                    Toast.makeText(this@KioskActivity, "Ditemukan ${found.size} server TMBilling!", Toast.LENGTH_SHORT).show()
                                                }
                                            }
                                        }
                                    },
                                    isSecondary = false,
                                    modifier = Modifier.fillMaxWidth()
                                )

                                // Tampilkan hasil Auto-Scan jika ditemukan
                                if (discoveredServers.isNotEmpty()) {
                                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                        discoveredServers.forEach { srv ->
                                            val isChosen = serverUrl == srv.url
                                            TvButton(
                                                text = "✓ ${srv.ip}:${srv.port} (${srv.latencyMs}ms)",
                                                onClick = {
                                                    serverUrl = srv.url
                                                },
                                                isSecondary = !isChosen,
                                                modifier = Modifier.fillMaxWidth()
                                            )
                                        }
                                    }
                                }

                                // Preset Cepat
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    TvButton(
                                        text = "🏠 Emulator (10.0.2.2)",
                                        onClick = { serverUrl = "http://10.0.2.2:7015" },
                                        isSecondary = true,
                                        modifier = Modifier.weight(1f)
                                    )
                                    TvButton(
                                        text = "💻 LAN (10.10.10.25)",
                                        onClick = { serverUrl = "http://10.10.10.25:7015" },
                                        isSecondary = true,
                                        modifier = Modifier.weight(1f)
                                    )
                                }

                                TvButton(
                                    text = "🔑 Set Secret Key 'TM2026'",
                                    onClick = { secretKey = "TM2026" },
                                    isSecondary = true,
                                    modifier = Modifier.fillMaxWidth()
                                )

                                Spacer(modifier = Modifier.height(2.dp))

                                Text(
                                    text = "DIAGNOSTIK KONEKSI",
                                    color = TMBillingBlueBright,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    letterSpacing = 1.sp
                                )

                                TvButton(
                                    text = if (isTestingConnection) "⏳ Menguji Jaringan..." else "⚡ Uji Koneksi ke Server",
                                    onClick = {
                                        if (!isTestingConnection) {
                                            isTestingConnection = true
                                            testResultText = "Menghubungi server $serverUrl..."
                                            coroutineScope.launch {
                                                val targetId = stationIdStr.toIntOrNull() ?: 1
                                                val result = ApiClient.testConnection(serverUrl, targetId, secretKey)
                                                isTestingConnection = false
                                                if (result.isSuccess) {
                                                    testSuccess = true
                                                    testResultText = "✅ Berhasil! Terhubung ke Server (Status Meja: ${result.getOrNull()?.status?.uppercase()})"
                                                } else {
                                                    testSuccess = false
                                                    testResultText = "❌ Gagal: ${result.exceptionOrNull()?.localizedMessage}"
                                                }
                                            }
                                        }
                                    },
                                    isSecondary = false,
                                    modifier = Modifier.fillMaxWidth()
                                )

                                if (testResultText != null) {
                                    Surface(
                                        shape = RoundedCornerShape(8.dp),
                                        color = if (testSuccess) StatusOnlineBg else StatusOfflineBg,
                                        border = androidx.compose.foundation.BorderStroke(
                                            1.dp,
                                            if (testSuccess) NeonGreen else ErrorRed
                                        ),
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Text(
                                            text = testResultText ?: "",
                                            color = if (testSuccess) NeonGreen else ErrorRed,
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Medium,
                                            lineHeight = 16.sp,
                                            modifier = Modifier.padding(10.dp)
                                        )
                                    }
                                }

                                Spacer(modifier = Modifier.height(2.dp))

                                Text(
                                    text = "AKSI DARURAT & SISTEM KIOSK",
                                    color = WarningAmber,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    letterSpacing = 1.sp
                                )

                                val isDefaultLauncher by isDefaultLauncherFlow.collectAsState()
                                val isAccessibilityEnabled by isAccessibilityEnabledFlow.collectAsState()
                                TvButton(
                                    text = if (isDefaultLauncher) "✅ Launcher Utama TV Aktif" else "🏠 Jadikan Launcher Utama TV",
                                    onClick = {
                                        requestSetDefaultLauncher()
                                    },
                                    isSecondary = true,
                                    modifier = Modifier.fillMaxWidth()
                                )

                                TvButton(
                                    text = if (isAccessibilityEnabled) "✅ Blokir Tombol Home Aktif" else "🛡 Aktifkan Blokir Tombol Home",
                                    onClick = {
                                        openAccessibilitySettings()
                                    },
                                    isSecondary = !isAccessibilityEnabled,
                                    modifier = Modifier.fillMaxWidth()
                                )

                                var isEmergencyUnlocked by remember { mutableStateOf(KioskAccessibilityService.emergencyUnlocked) }
                                TvButton(
                                    text = if (isEmergencyUnlocked) "🔒 Kunci Remote Kembali" else "🔓 Buka Kunci Remote Sementara",
                                    onClick = {
                                        KioskAccessibilityService.emergencyUnlocked = !KioskAccessibilityService.emergencyUnlocked
                                        isEmergencyUnlocked = KioskAccessibilityService.emergencyUnlocked
                                        Toast.makeText(
                                            this@KioskActivity,
                                            if (isEmergencyUnlocked) "Kunci remote dinonaktifkan sementara!" else "Kunci remote aktif kembali!",
                                            Toast.LENGTH_SHORT
                                        ).show()
                                    },
                                    isSecondary = true,
                                    modifier = Modifier.fillMaxWidth()
                                )

                                TvButton(
                                    text = "⚙ Buka Pengaturan Android TV",
                                    onClick = {
                                        try {
                                            KioskAccessibilityService.allowTemporarySystemPackage = true
                                            startActivity(Intent(android.provider.Settings.ACTION_SETTINGS))
                                        } catch (e: Exception) {
                                            Toast.makeText(this@KioskActivity, "Gagal membuka pengaturan: ${e.message}", Toast.LENGTH_SHORT).show()
                                        }
                                    },
                                    isSecondary = true,
                                    modifier = Modifier.fillMaxWidth()
                                )

                                TvButton(
                                    text = "🗑️ Copot / Uninstall Aplikasi",
                                    onClick = {
                                        safeUninstallApp()
                                    },
                                    isSecondary = true,
                                    modifier = Modifier.fillMaxWidth()
                                )
                            }
                        }

                        Divider(color = CardBorder, thickness = 1.dp)

                        // --- 3. BOTTOM ACTION BAR ---
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(CardSurface)
                                .padding(horizontal = 20.dp, vertical = 8.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "TMBilling Android TV Kiosk • DualSense Ready",
                                color = TextMuted,
                                fontSize = 12.sp
                            )

                            Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                                TvButton(
                                    text = "Batal",
                                    onClick = onDismiss,
                                    isSecondary = true
                                )

                                TvButton(
                                    text = "💾 Simpan & Terapkan",
                                    onClick = {
                                        prefs.serverUrl = serverUrl
                                        prefs.stationId = stationIdStr.toIntOrNull() ?: 1
                                        prefs.stationName = stationName.trim().ifEmpty { "PS-01" }
                                        prefs.stationCode = stationName.trim().ifEmpty { "PS-01" }
                                        prefs.secretKey = secretKey
                                        prefs.defaultHdmiInput = hdmiInputStr
                                        val finalPin = emergencyPinInput.ifBlank { "8888" }
                                        prefs.adminPin = finalPin
                                        prefs.emergencyPin = finalPin
                                        prefs.isConfigured = true

                                        ApiClient.resetClient(prefs)
                                        BillingPollingService.clearWarnetConfigCache()
                                        BillingPollingService.start(this@KioskActivity)
                                        Toast.makeText(this@KioskActivity, "Pengaturan berhasil disimpan!", Toast.LENGTH_SHORT).show()
                                        onDismiss()
                                    }
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
