# Peripheral & Hardware Baseline Discrepancy Monitoring with Smart CCTV Reference Windows

**Version:** 1.1  
**Date:** 2026-09-23  
**Status:** Approved Specification  
**Authors:** TMBilling Architecture Team  

---

## 1. Overview & Objectives

In internet gaming cafes (warnet / esports arenas), hardware theft occurs across two distinct asset categories:
1. **Internal Hardware Components**: CPU, Motherboard, GPU/VGA, RAM sticks, and Storage Drives (HDD/SSD). These are internal to the PC chassis and typically swapped or stolen when PCs are powered off during maintenance or overnight hours.
2. **External Peripherals**: Gaming Headsets (USB/Audio), Keyboards, and Mice. These are frequently unplugged or swapped while PCs are actively in session or by customers walking away.

This specification unifies **Internal Hardware Checker** and **Peripheral Monitoring** into a server-driven, zero-intrusive surveillance workflow featuring **Smart CCTV Reference Windows**, a **5-Minute Disconnect Grace Period**, and **Fully Responsive UI across all Tailwind Breakpoints (sm, md, lg, xl, 2xl)**.

---

## 2. Core Architecture & Philosophy

### 2.1 Server-Centric & Zero-Intrusive Client Design
- **No Player Distractions**: The client PC (via `WarnetAgent` / `TMBilling_Monitor`) does not show warning popups, lock screens, or error dialogs to the customer when a peripheral is disconnected or swapped.
- **Server Authority**: All discrepancy evaluations, 5-minute grace timers, baseline verifications, and CCTV timestamp calculations are executed strictly on the Flask Server and Kasir Admin Dashboard.
- **Passive Offline Handling**: When a PC shuts down normally, the server enters a passive monitoring state. No false mismatch alerts or disconnect timers are triggered while a PC is offline.

---

## 3. Telemetry & Peripheral Tracking Specification

### 3.1 Telemetry Payload Schema (`POST /api/v1/public/monitor/`)
The `TMBilling_Monitor` agent gathers hardware telemetry and peripheral device states via Windows SetupAPI / WMI / HID APIs:

```json
{
  "IpAddress": "192.168.1.101",
  "MacAddress": "00:1A:2B:3C:4D:5E",
  "CpuUsage": 12.5,
  "CpuTemp": 48.0,
  "GpuTemp": 52.0,
  "TotalRam": "16 GB",
  "NicSpeed": "1.0 Gbps",
  "Motherboard": "ASUS PRIME B660M-A",
  "CpuName": "Intel Core i5-12400F",
  "GpuName": "NVIDIA GeForce RTX 3060",
  "ActiveWindow": "VALORANT",
  "ProcessList": [],
  "HardwareSerials": {
    "MotherboardSerial": "MB-12345678",
    "CpuId": "BFEBFBFF00090672",
    "GpuPnpId": "PCI\\VEN_10DE&DEV_2503&SUBSYS_888810DE",
    "RamSerials": ["RAM1_8589934592", "RAM2_8589934592"],
    "DiskSerials": ["Samsung SSD 980 500GB_S5GXNF0T123456"]
  },
  "Peripherals": {
    "Mouse": "USB\\VID_1532&PID_0084 (Razer DeathAdder Essential)",
    "Keyboard": "USB\\VID_046D&PID_C31C (Logitech Keyboard)",
    "Headset": "USB\\VID_0951&PID_16A4 (HyperX Cloud II Wireless)"
  }
}
```

### 3.2 Database Schema Enhancements (`HardwareMonitor`)

Table: `hardware_monitor`
- `peripherals_baseline` (`Text`, nullable): JSON snapshot of registered baseline peripherals (`Mouse`, `Keyboard`, `Headset`).
- `peripherals_current` (`Text`, nullable): JSON snapshot of latest detected peripherals.
- `peripherals_mismatch` (`Boolean`, default `False`): Flag set to `True` when a peripheral is missing or swapped beyond grace period.
- `peripherals_mismatch_desc` (`Text`, nullable): Description of missing/swapped peripherals.
- `peripherals_mismatch_time` (`DateTime`, nullable): Disconnect timestamp for CCTV reference.
- `peripherals_disconnect_tracker` (`Text`, nullable): JSON tracking pending disconnect timers:
  `{"Headset": {"disconnected_at": "2026-09-29T23:55:00Z", "baseline_val": "HyperX Cloud II"}}`

---

## 4. Discrepancy & CCTV Logic

### 4.1 Internal Hardware: Time Range Estimation (Off-State Swap)
When internal hardware (CPU, Motherboard, GPU, RAM, Disk) changes:
- Internal components cannot be physically unseated without shutting down the PC.
- **Reference Window**: The theft occurred between the **last shutdown time** (`PCUptimeLog.last_seen` before the shutdown) and the **first boot time** when the mismatch was detected.
- **Kasir Display**:
  - If spanned across dates: *"Cek CCTV dari tanggal 29 Sep 23:00 s/d 30 Sep 08:00 (rentang PC mati)"*
  - If single date: *"Cek CCTV pada tanggal 29 Sep dari jam 23:00 s/d 23:45 (rentang PC mati)"*

### 4.2 Peripherals: 5-Minute Grace Period & Exact Timestamp (Live Disconnect)
When a peripheral (Mouse, Keyboard, Headset) is missing from telemetry while the PC is **Online**:
1. **Grace Period Initiation**: If a peripheral is not reported in `Peripherals`, record `disconnected_at = now_utc()` in `peripherals_disconnect_tracker`.
2. **Auto-Resolution (Plugged Back In &le; 5 Mins)**: If the peripheral reconnects within 300 seconds, clear the disconnect tracker. No alert is triggered.
3. **Theft Alert Trigger (&gt; 5 Mins)**: If missing for &gt; 300 seconds:
   - Set `peripherals_mismatch = True`.
   - Set `peripherals_mismatch_time = disconnected_at`.
   - **Kasir Display**:
     - *"Headset dicabut pukul 23:55 (> 5 menit lalu). Cek aktivitas CCTV jam 23:55 pada PC 01."*
4. **Offline Disconnect Fallback**: If a peripheral was unplugged while the PC was completely powered off, the first boot telemetry detects the absence immediately and falls back to the **Shutdown-to-Boot Time Range** CCTV format.

---

## 5. Kasir UI / UX Specification & Responsive Breakpoints

The **Hardware Checker** tab in the Kasir web dashboard displays two distinct verification panels for each PC:
1. **Internal Hardware Card**:
   - Badges: `🛡️ Terlindungi (Protected)` / `🚨 Hardware Tertukar / Hilang`
   - CCTV Box: Shows calculated shutdown-to-boot time window.
   - Component Specs Accordion: CPU, Mobo, GPU, RAM count, Disk list.
2. **Peripherals Card**:
   - Status: Mouse (🟢 Terhubung), Keyboard (🟢 Terhubung), Headset (🟢 Terhubung / 🔴 Dicabut 23:55)
   - CCTV Box: Shows exact disconnect timestamp or disconnect duration.
   - Action Button: **"Perbarui Baseline PC"** (Admin/Owner authorization with confirmation modal).

### 5.1 Responsive Layout Matrix across Tailwind Breakpoints (Mobile &rarr; 2XL)
Following [Tailwind CSS Responsive Design](https://tailwindcss.com/docs/responsive-design):

| Breakpoint | Min-Width | Layout Behavior & Component Flow |
| :--- | :--- | :--- |
| **Mobile (`< 640px`)** | Default | Single column (`grid-cols-1`). Cards stack vertically (`flex-col gap-3`). Peripheral items displayed as vertical stack with full-width action buttons. Text size optimized with truncate labels. |
| **`sm`** | `640px` | Card header aligns horizontally (`flex-row items-center justify-between`). Action buttons group compactly to the right (`sm:self-center`). Peripheral grid switches to 2-columns (`grid-cols-1 sm:grid-cols-2`). |
| **`md`** | `768px` | Baseline vs Current Specs Accordion renders side-by-side (`grid-cols-1 md:grid-cols-2 gap-4`). Peripherals display 3-column pill cards (`md:grid-cols-3`). |
| **`lg`** | `1024px` | Expanded desktop layout with persistent CCTV reference banners. Peripheral tooltips show full PNP device hardware strings. |
| **`xl`** | `1280px` | High-density dashboard grid. Two PC cards per row (`grid-cols-1 xl:grid-cols-2 gap-6`) or widescreen single-row cards with side-by-side Internal & Peripheral panels (`xl:flex-row`). |
| **`2xl`** | `1536px` | Ultra-wide / 4K POS monitor optimization. Maximum container constraints (`max-w-7xl mx-auto`), enlarged CCTV timestamp tags, and high-visibility status indicators. |

---

## 6. Verification & Test Plan

1. **Unit & Integration Tests**:
   - Test internal hardware mismatch calculation and time-range generation.
   - Test peripheral 5-minute disconnect grace period (reconnection before 5m clears; missing > 5m triggers alert).
   - Test PC offline state: Verify that stopping telemetry does not trigger false alerts.
   - Test single-date vs multi-date CCTV time string formatting.
2. **Frontend & Responsive Breakpoint Validation**:
   - Verify UI rendering of dual Internal Hardware and Peripherals sections across mobile viewport (375px), `sm` (640px), `md` (768px), `lg` (1024px), `xl` (1280px), and `2xl` (1536px).
   - Verify no horizontal scroll overflow or clipped buttons at any breakpoint.
   - Verify Update Baseline action clears mismatch flags and updates database.
