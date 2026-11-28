package com.tmbilling.tv

import com.tmbilling.tv.controller.TvInputController
import com.tmbilling.tv.service.BillingPollingService
import com.tmbilling.tv.ui.screens.formatDisplayDuration
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class KioskLogicUnitTest {

    @Test
    fun formatDisplayDuration_indonesianHumanReadable() {
        assertEquals("Selesai", formatDisplayDuration(0))
        assertEquals("Selesai", formatDisplayDuration(-10))
        assertEquals("1 Menit", formatDisplayDuration(1))
        assertEquals("1 Menit", formatDisplayDuration(59))
        assertEquals("1 Menit", formatDisplayDuration(60))
        assertEquals("2 Menit", formatDisplayDuration(61))
        assertEquals("45 Menit", formatDisplayDuration(45 * 60))
        assertEquals("1 Jam", formatDisplayDuration(3600))
        assertEquals("1 Jam 30 Menit", formatDisplayDuration(5400))
        assertEquals("2 Jam", formatDisplayDuration(7200))
    }

    @Test
    fun resolveHdmiInputIdFromList_mapsPresetsAndExactIds() {
        val tvInputs = listOf(
            "com.mediatek.tvinput/.hdmi.HdmiInputService/HW1" to "HDMI 1 (PS5)",
            "com.mediatek.tvinput/.hdmi.HdmiInputService/HW2" to "HDMI 2",
            "com.mediatek.tvinput/.hdmi.HdmiInputService/HW3" to "HDMI 3"
        )

        assertEquals(
            "com.mediatek.tvinput/.hdmi.HdmiInputService/HW1",
            TvInputController.resolveHdmiInputIdFromList("HDMI 1", tvInputs)
        )
        assertEquals(
            "com.mediatek.tvinput/.hdmi.HdmiInputService/HW2",
            TvInputController.resolveHdmiInputIdFromList("hdmi 2", tvInputs)
        )
        assertEquals(
            "com.mediatek.tvinput/.hdmi.HdmiInputService/HW3",
            TvInputController.resolveHdmiInputIdFromList("com.mediatek.tvinput/.hdmi.HdmiInputService/HW3", tvInputs)
        )
        // Fallback index mapping when label does not contain HDMI N
        val unlabeledInputs = listOf(
            "vendor.tv/.Input/portA" to "Console A",
            "vendor.tv/.Input/portB" to "Console B"
        )
        assertEquals(
            "vendor.tv/.Input/portB",
            TvInputController.resolveHdmiInputIdFromList("HDMI 2", unlabeledInputs)
        )
        // Emulator with 0 hardware inputs keeps preset string cleanly
        assertEquals(
            "HDMI 1",
            TvInputController.resolveHdmiInputIdFromList("HDMI 1", emptyList())
        )
    }

    @Test
    fun normalizeQrisUrl_resolvesRelativeAndLocalhostAgainstServerUrl() {
        assertEquals(
            "http://10.0.2.2:7015/static/uploads/qris/qris_1.png",
            BillingPollingService.normalizeQrisUrl(
                serverUrl = "http://10.0.2.2:7015/",
                qrisUrl = "http://127.0.0.1:7015/static/uploads/qris/qris_1.png",
                qrisPath = "/static/uploads/qris/qris_1.png"
            )
        )
        assertEquals(
            "http://10.10.10.25:7015/static/uploads/qris/qris_1.png",
            BillingPollingService.normalizeQrisUrl(
                serverUrl = "http://10.10.10.25:7015",
                qrisUrl = "http://localhost:7015/static/uploads/qris/qris_1.png",
                qrisPath = null
            )
        )
        assertEquals(
            "https://cdn.example.com/qris.png",
            BillingPollingService.normalizeQrisUrl(
                serverUrl = "http://10.10.10.25:7015",
                qrisUrl = "https://cdn.example.com/qris.png",
                qrisPath = null
            )
        )
        assertNull(
            BillingPollingService.normalizeQrisUrl(
                serverUrl = "http://10.10.10.25:7015",
                qrisUrl = null,
                qrisPath = null
            )
        )
    }
}
