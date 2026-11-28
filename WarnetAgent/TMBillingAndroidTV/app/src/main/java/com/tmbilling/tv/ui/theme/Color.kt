package com.tmbilling.tv.ui.theme

import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color

// ==========================================
// Palet Warna Resmi TMBilling Dark Matte (OLED / TV 1080p)
// Sesuai dengan Tema Utama Web & Kiosk TMBilling Chamber Noir
// ==========================================

// Backgrounds & Surfaces (Matte Obsidian Black)
val VoidBlack = Color(0xFF050505)            // Hitam pekat dasar TMBilling
val DarkBackground = Color(0xFF050505)       // Background container utama
val DarkSurface = Color(0xFF0C0C0C)          // Surface card utama TMBilling
val CardSurface = Color(0xFF111111)          // Kartu inner
val CardSurfaceHover = Color(0xFF181818)     // Kartu saat difokuskan D-Pad
val CardSurfaceLight = Color(0xFF1C1C1C)     // Input field background
val GlassSurface = Color(0xFF0F0F0F)         // Surface glassmorphism matte

// Borders & Dividers
val CardBorder = Color(0xFF1C1C1C)           // Border tipis netral
val CardBorderHover = Color(0xFF333333)      // Border saat hover
val CardBorderActive = Color(0xFF34D399)     // Border aktif / terfokus (TMBilling Emerald)
val GlassBorder = Color(0xFF1E1E1E)          // Border container

// TMBilling Brand Colors (Core Electric Blue & Emerald Accent)
val TMBillingBlue = Color(0xFF2563EB)        // Biru primer TMBilling
val TMBillingBlueBright = Color(0xFF3B82F6)  // Biru terang untuk fokus/highlight
val TMBillingBlueDark = Color(0xFF1D4ED8)    // Biru gelap
val CyanPrimary = Color(0xFF34D399)          // Alias aksen aktif -> Emerald
val CyanNeonGlow = Color(0x3334D399)         // Soft glow halus
val PlayStationBlue = Color(0xFF1D4ED8)      // Aksen biru konsol
val NeonPurple = Color(0xFF8B5CF6)           // Aksen esports ungu
val GoldAccent = Color(0xFFF59E0B)           // Badge VIP / Priority

// Status Colors (High Contrast WCAG AAA)
val NeonGreen = Color(0xFF34D399)            // Status Aktif / Online (TMBilling Emerald)
val EmeraldAccent = Color(0xFF34D399)        // Emerald 400
val EmeraldBadgeBg = Color(0xFF064E3B)       // Background badge sesi aktif
val WarningAmber = Color(0xFFF59E0B)         // Status Peringatan Sisa Waktu (< 5 min)
val ErrorRed = Color(0xFFEF4444)             // Status Locked / Terputus (Crimson)
val StatusOffline = ErrorRed                 // Dot indikator offline
val StatusOfflineBg = Color(0x22EF4444)      // Background capsule merah
val StatusOnlineBg = Color(0x2210B981)       // Background capsule hijau
val FocusBorder = Color(0xFFFFFFFF)          // Border fokus D-Pad (High contrast putih)
val FocusWhite = Color(0xFFFFFFFF)
val TextOnWhite = Color(0xFF000000)

// Typography (Tingkat Kontras Tinggi untuk Layar TV 10 Kaki)
val TextPrimary = Color(0xFFFFFFFF)          // Putih murni 100% kontras
val TextSecondary = Color(0xFFD1D5DB)        // Abu-abu terang (Tailwind Gray 300)
val TextMuted = Color(0xFF94A3B8)            // Abu-abu sedang (Tailwind Slate 400)
val TextDisabled = Color(0xFF64748B)         // Abu-abu redup (Slate 500)
val TextOnBlue = Color(0xFFFFFFFF)           // Teks di atas tombol biru primer
val TextOnCyan = Color(0xFF050505)           // Teks di atas aksen emerald

// Focus State untuk Remote TV
val FocusRingColor = Color(0xFFFFFFFF)       // Ring fokus D-pad 2.5dp putih terang
val FocusBackground = Color(0xFFFFFFFF)      // Background tombol saat aktif putih

// Gradients Elegan & Bersih
val BackgroundGradient = Brush.verticalGradient(
    colors = listOf(
        Color(0xFF080808),
        Color(0xFF050505),
        Color(0xFF050505)
    )
)

val HeroCardGradient = Brush.verticalGradient(
    colors = listOf(
        Color(0xFF0E0E0E),
        Color(0xFF0A0A0A)
    )
)

val ActiveSessionGradient = Brush.verticalGradient(
    colors = listOf(
        Color(0xFF0D0D0D),
        Color(0xFF080808)
    )
)
