package com.tmbilling.tv.ui.screens

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.tmbilling.tv.data.model.StationStatusResponse
import com.tmbilling.tv.data.model.WarnetConfigResponse
import com.tmbilling.tv.ui.theme.*
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun LockScreen(
    stationStatus: StationStatusResponse?,
    stationName: String,
    serverUrl: String,
    isServerConnected: Boolean,
    warnetConfig: WarnetConfigResponse? = null,
    hdmiLabel: String = "HDMI 1",
    onOpenSettings: () -> Unit,
    onSwitchToHdmi: () -> Unit = {}
) {
    val currentTime = remember { mutableStateOf("") }
    val currentDate = remember { mutableStateOf("") }

    LaunchedEffect(Unit) {
        val timeSdf = SimpleDateFormat("HH:mm 'WIB'", Locale("id", "ID"))
        val dateSdf = SimpleDateFormat("EEEE, dd MMM", Locale("id", "ID"))
        while (true) {
            val now = Date()
            currentTime.value = timeSdf.format(now)
            currentDate.value = dateSdf.format(now).uppercase()
            kotlinx.coroutines.delay(1000)
        }
    }

    val isSessionActive = stationStatus?.status == "terpakai" || stationStatus?.status == "aktif"
    val sisaDetik = stationStatus?.sesiAktif?.sisaDetik ?: 0L
    val totalDetik = stationStatus?.sesiAktif?.totalDetik ?: (sisaDetik.coerceAtLeast(1L))
    val sisaJam = sisaDetik / 3600
    val sisaMenit = (sisaDetik % 3600) / 60
    val sisaDetikMod = sisaDetik % 60
    val isNearEnd = isSessionActive && sisaDetik in 1..300

    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val pulseAlpha by infiniteTransition.animateFloat(
        initialValue = 0.4f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(1200, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulseAlpha"
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(VoidBlack)
    ) {
        // Subtle ambient radial glow
        Canvas(modifier = Modifier.fillMaxSize()) {
            drawCircle(
                color = if (isSessionActive) EmeraldAccent.copy(alpha = 0.04f) else Color(0x0A3B82F6),
                radius = size.width * 0.40f,
                center = Offset(size.width * 0.5f, size.height * 0.35f)
            )
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 48.dp, vertical = 28.dp),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            // ==============================================================
            // 1. TOP HEADER HUD BAR (TMBilling 3-Zone Clean Architecture)
            // ==============================================================
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Zone Kiri: TM White Badge + Brand + Station Code
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    // TM White Logo Badge (Dapat diklik remote D-Pad untuk Pengaturan Kiosk)
                    Box(
                        modifier = Modifier
                            .size(44.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color.White)
                            .clickable { onOpenSettings() },
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "TM",
                            color = Color.Black,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Black,
                            letterSpacing = (-0.5).sp
                        )
                    }

                    // TMBilling Text
                    Text(
                        text = "TMBilling",
                        color = TextPrimary,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 0.5.sp
                    )

                    // Station Pill (Misal: PS-01)
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = CardSurface,
                        border = androidx.compose.foundation.BorderStroke(1.dp, CardBorder)
                    ) {
                        Text(
                            text = stationName.trim().ifEmpty { "PS-01" },
                            color = TextSecondary,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 5.dp)
                        )
                    }
                }

                // Zone Kanan: Unified Status Capsule (Online Dot + Status + Date & Time)
                Surface(
                    shape = RoundedCornerShape(20.dp),
                    color = Color(0xFF121212),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF222222))
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .clip(CircleShape)
                                .background(
                                    if (isServerConnected) EmeraldAccent.copy(alpha = pulseAlpha)
                                    else ErrorRed.copy(alpha = pulseAlpha)
                                )
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = if (isServerConnected) "ONLINE" else "DISCONNECTED",
                            color = if (isServerConnected) EmeraldAccent else ErrorRed,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 0.8.sp
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "•",
                            color = TextMuted,
                            fontSize = 12.sp
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = if (currentDate.value.isNotEmpty() && currentTime.value.isNotEmpty()) {
                                "${currentDate.value} • ${currentTime.value}"
                            } else {
                                "Memuat waktu..."
                            },
                            color = TextSecondary,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // ==============================================================
            // 2. KONTEN TENGAH HERO (Standby vs Active Session vs Offline)
            // ==============================================================
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                contentAlignment = Alignment.Center
            ) {
                if (!isServerConnected && stationStatus == null) {
                    OfflineHeroCard(
                        serverUrl = serverUrl,
                        onOpenSettings = onOpenSettings
                    )
                } else if (isSessionActive) {
                    ActiveSessionHeroCard(
                        totalDetik = totalDetik,
                        sisaDetikRaw = sisaDetik,
                        isNearEnd = isNearEnd,
                        hdmiLabel = hdmiLabel,
                        onSwitchToHdmi = onSwitchToHdmi
                    )
                } else {
                    StandbyHeroCard(
                        stationCode = stationName.trim().ifEmpty { "PS-01" },
                        warnetConfig = warnetConfig,
                        onOpenSettings = onOpenSettings
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // ==============================================================
            // 3. BOTTOM FOOTER BAR (Clean v2.0 - Remote Shortcut Hint)
            // ==============================================================
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "TMBilling v2.0",
                    color = TextMuted,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                    letterSpacing = 0.5.sp,
                    modifier = Modifier.clickable { onOpenSettings() }
                )
                Text(
                    text = "Tekan MENU / INFO pada remote untuk Pengaturan Kiosk",
                    color = TextMuted.copy(alpha = 0.5f),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Normal
                )
            }
        }
    }
}

// ==============================================================
// HERO CARD: STANDBY / LOCKED (2-Column Layout + Dynamic QRIS)
// ==============================================================
@Composable
fun StandbyHeroCard(
    stationCode: String,
    warnetConfig: WarnetConfigResponse?,
    onOpenSettings: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(IntrinsicSize.Max),
        horizontalArrangement = Arrangement.spacedBy(28.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Kartu Kiri: Panduan & Pengaturan (Weight 1.35)
        Surface(
            modifier = Modifier
                .weight(1.35f)
                .fillMaxHeight()
                .border(1.dp, CardBorder, RoundedCornerShape(20.dp))
                .shadow(16.dp, RoundedCornerShape(20.dp), spotColor = Color.Black),
            shape = RoundedCornerShape(20.dp),
            color = DarkSurface
        ) {
            Column(
                modifier = Modifier
                    .padding(horizontal = 36.dp, vertical = 28.dp),
                verticalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    // Status Pill
                    Surface(
                        shape = RoundedCornerShape(20.dp),
                        color = Color(0xFF161616),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF262626))
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 5.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(7.dp)
                                    .clip(CircleShape)
                                    .background(WarningAmber)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "STANDBY • MENUNGGU AKTIVASI",
                                color = TextSecondary,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 1.sp
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    // Station Name
                    Text(
                        text = stationCode.uppercase(),
                        color = TextPrimary,
                        fontSize = 34.sp,
                        fontWeight = FontWeight.ExtraBold,
                        letterSpacing = 1.sp
                    )

                    Spacer(modifier = Modifier.height(6.dp))

                    Text(
                        text = "Silakan hubungi kasir atau scan QRIS di samping untuk memulai sesi rental di stasiun ini.",
                        color = TextSecondary,
                        fontSize = 14.sp,
                        lineHeight = 20.sp
                    )

                    Spacer(modifier = Modifier.height(20.dp))

                    // 3-Step Guide Card
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = CardSurface,
                        border = androidx.compose.foundation.BorderStroke(1.dp, CardBorder),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            StepGuideItem(number = "1", text = "Hubungi Kasir / Pesan Paket Rental")
                            StepGuideItem(number = "2", text = "Kasir Mengaktifkan Timer Stasiun")
                            StepGuideItem(number = "3", text = "Layar Otomatis Beralih ke Game (HDMI)")
                        }
                    }
                }
            }
        }

        // Kartu Kanan: Dynamic QRIS Server Box (Weight 0.85)
        Surface(
            modifier = Modifier
                .weight(0.85f)
                .fillMaxHeight()
                .border(1.dp, CardBorder, RoundedCornerShape(20.dp))
                .shadow(16.dp, RoundedCornerShape(20.dp), spotColor = Color.Black),
            shape = RoundedCornerShape(20.dp),
            color = DarkSurface
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Text(
                    text = "PEMBAYARAN QRIS",
                    color = TextPrimary,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp
                )

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    text = "Scan untuk Pembayaran Cepat",
                    color = TextSecondary,
                    fontSize = 12.sp
                )

                Spacer(modifier = Modifier.height(14.dp))

                // QR Container Frame (Ukuran 170dp presisi agar footer kasir tidak terpotong)
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = Color.White,
                    modifier = Modifier.size(170.dp)
                ) {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        if (!warnetConfig?.qrisUrl.isNullOrBlank()) {
                            AsyncImage(
                                model = warnetConfig?.qrisUrl,
                                contentDescription = "QRIS Kasir TMBilling",
                                modifier = Modifier
                                    .fillMaxSize()
                                    .padding(8.dp),
                                contentScale = ContentScale.Fit
                            )
                        } else {
                            // Fallback jika backend belum set gambar QRIS
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.Center
                            ) {
                                Text(
                                    text = "QRIS",
                                    color = Color.Black,
                                    fontSize = 24.sp,
                                    fontWeight = FontWeight.Black
                                )
                                Text(
                                    text = "TMBilling",
                                    color = Color.DarkGray,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Kasir Status Tag
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = Color(0xFF141414),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF242424))
                ) {
                    Text(
                        text = "Kasir: Online • Otomatis Terhubung",
                        color = EmeraldAccent,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp)
                    )
                }
            }
        }
    }
}

@Composable
fun StepGuideItem(number: String, text: String) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Box(
            modifier = Modifier
                .size(20.dp)
                .clip(CircleShape)
                .background(Color(0xFF222222)),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = number,
                color = TextSecondary,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold
            )
        }
        Text(
            text = text,
            color = TextSecondary,
            fontSize = 13.sp,
            fontWeight = FontWeight.Medium
        )
    }
}

// ==============================================================
// HERO CARD: ACTIVE SESSION (100% Centered Indonesian Duration)
// ==============================================================
@Composable
fun ActiveSessionHeroCard(
    totalDetik: Long,
    sisaDetikRaw: Long,
    isNearEnd: Boolean,
    hdmiLabel: String = "HDMI 1",
    onSwitchToHdmi: () -> Unit
) {
    val timerColor = if (isNearEnd) WarningAmber else EmeraldAccent

    Surface(
        modifier = Modifier
            .fillMaxWidth(0.68f)
            .border(
                width = 1.dp,
                color = if (isNearEnd) WarningAmber.copy(alpha = 0.5f) else Color(0xFF222222),
                shape = RoundedCornerShape(24.dp)
            )
            .shadow(24.dp, RoundedCornerShape(24.dp), spotColor = Color.Black),
        shape = RoundedCornerShape(24.dp),
        color = DarkSurface
    ) {
        Column(
            modifier = Modifier
                .padding(horizontal = 48.dp, vertical = 36.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Subtitle: SISA WAKTU BERMAIN
            Text(
                text = "SISA WAKTU BERMAIN",
                color = TextSecondary,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 2.sp
            )

            Spacer(modifier = Modifier.height(14.dp))

            // Format Durasi Bahasa Indonesia Ramah Layar TV (misal: "1 Jam 30 Menit", "45 Menit")
            val displayDuration = formatDisplayDuration(sisaDetikRaw)
            val durationFontSize = when {
                displayDuration.length > 14 -> 58.sp
                displayDuration.length > 10 -> 68.sp
                else -> 78.sp
            }
            Text(
                text = displayDuration,
                color = timerColor,
                fontSize = durationFontSize,
                fontWeight = FontWeight.ExtraBold,
                fontFamily = FontFamily.SansSerif,
                letterSpacing = 0.5.sp,
                maxLines = 1,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(22.dp))

            // Progress Bar
            val progressFraction = if (totalDetik > 0) {
                (sisaDetikRaw.toFloat() / totalDetik.toFloat()).coerceIn(0f, 1f)
            } else 1f

            Box(
                modifier = Modifier
                    .fillMaxWidth(0.85f)
                    .height(6.dp)
                    .clip(RoundedCornerShape(3.dp))
                    .background(CardSurface)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth(progressFraction)
                        .fillMaxHeight()
                        .clip(RoundedCornerShape(3.dp))
                        .background(timerColor)
                )
            }

            Spacer(modifier = Modifier.height(32.dp))

            // Primary HDMI Switch Button (Dynamic HDMI Label)
            TvButton(
                text = "🎮  MASUK KE GAME ($hdmiLabel)",
                onClick = onSwitchToHdmi,
                isSecondary = false
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = "Tekan OK pada remote untuk membuka tampilan konsol game",
                color = TextMuted,
                fontSize = 11.sp
            )
        }
    }
}

// ==============================================================
// HERO CARD: OFFLINE / MENGHUBUNGKAN KE SERVER
// ==============================================================
@Composable
fun OfflineHeroCard(
    serverUrl: String,
    onOpenSettings: () -> Unit
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth(0.72f)
            .border(1.dp, ErrorRed.copy(alpha = 0.4f), RoundedCornerShape(20.dp)),
        shape = RoundedCornerShape(20.dp),
        color = DarkSurface
    ) {
        Column(
            modifier = Modifier
                .padding(horizontal = 36.dp, vertical = 28.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Surface(
                shape = RoundedCornerShape(20.dp),
                color = StatusOfflineBg,
                border = androidx.compose.foundation.BorderStroke(1.dp, ErrorRed.copy(alpha = 0.4f))
            ) {
                Text(
                    text = "MENGHUBUNGKAN KE SERVER TMBILLING...",
                    color = ErrorRed,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp,
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 5.dp)
                )
            }

            Spacer(modifier = Modifier.height(14.dp))

            Text(
                text = "Belum Terhubung ke Server",
                color = TextPrimary,
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(6.dp))

            Text(
                text = "Mencoba menghubungi $serverUrl.\nPastikan service backend TMBilling (app-rust) telah berjalan di komputer host.",
                color = TextSecondary,
                fontSize = 13.sp,
                textAlign = TextAlign.Center,
                lineHeight = 18.sp
            )

            Spacer(modifier = Modifier.height(14.dp))

            Surface(
                shape = RoundedCornerShape(8.dp),
                color = CardSurface,
                border = androidx.compose.foundation.BorderStroke(1.dp, CardBorder)
            ) {
                Text(
                    text = "💡 Emulator: Gunakan http://10.0.2.2:7015  •  LAN: Gunakan IP Server:7015",
                    color = EmeraldAccent,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                )
            }

            Spacer(modifier = Modifier.height(20.dp))

            TvButton(
                text = "Buka Pengaturan Server",
                onClick = onOpenSettings,
                isSecondary = false
            )
        }
    }
}

// ==============================================================
// HELPER: FORMAT SISA WAKTU MENJADI TEKS RAMAH SERVER (Human-Friendly)
// ==============================================================
fun formatDisplayDuration(sisaDetik: Long): String {
    val totalMinutes = if (sisaDetik > 0) (sisaDetik + 59) / 60 else 0L
    if (totalMinutes <= 0) return "Selesai"

    val jam = totalMinutes / 60
    val menit = totalMinutes % 60

    return when {
        jam > 0 && menit > 0 -> "$jam Jam $menit Menit"
        jam > 0 -> "$jam Jam"
        else -> "$menit Menit"
    }
}

// ==============================================================
// TOMBOL TV KHUSUS D-PAD (High Contrast White Focused 1:1 FigCraft)
// ==============================================================
@Composable
fun TvButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    isSecondary: Boolean = false
) {
    var isFocused by remember { mutableStateOf(false) }

    val scale by animateFloatAsState(
        targetValue = if (isFocused) 1.04f else 1.0f,
        animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy),
        label = "buttonScale"
    )

    val containerBg = when {
        isFocused -> Color.White
        isSecondary -> Color(0xFF1E1E1E)
        else -> Color.White
    }

    val textColor = when {
        isFocused -> Color.Black
        isSecondary -> Color.White
        else -> Color.Black
    }

    val borderColor = when {
        isFocused -> Color.White
        isSecondary -> Color(0xFF383838)
        else -> Color.White
    }

    Button(
        onClick = onClick,
        colors = ButtonDefaults.buttonColors(
            containerColor = containerBg,
            contentColor = textColor
        ),
        shape = RoundedCornerShape(10.dp),
        modifier = modifier
            .scale(scale)
            .onFocusChanged { isFocused = it.isFocused }
            .border(
                width = if (isFocused) 2.dp else 1.dp,
                color = borderColor,
                shape = RoundedCornerShape(10.dp)
            )
            .focusable()
    ) {
        Text(
            text = text,
            color = textColor,
            fontSize = if (isSecondary) 13.sp else 15.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.5.sp,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
        )
    }
}
