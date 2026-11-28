package com.tmbilling.tv.data.model

import com.google.gson.annotations.SerializedName

/**
 * Model permintaan status client agent TMBilling (/api/v1/public/client/status)
 */
data class ClientStatusRequest(
    @SerializedName("ip_address") val ipAddress: String,
    @SerializedName("mac_address") val macAddress: String = "",
    @SerializedName("role") val role: String = "client"
)

/**
 * Model respons status client agent TMBilling (/api/v1/public/client/status)
 */
data class ClientStatusResponse(
    @SerializedName("status") val status: String, // "kosong", "aktif", "admin", "system"
    @SerializedName("pc_kode") val pcKode: String? = null,
    @SerializedName("message") val message: String? = null,
    @SerializedName("sisa_waktu") val sisaWaktu: Long? = null, // menit
    @SerializedName("sisa_detik") val sisaDetik: Long? = null, // detik
    @SerializedName("nama") val nama: String? = null,
    @SerializedName("grup") val grup: String? = null,
    @SerializedName("mulai") val mulai: String? = null,
    @SerializedName("is_afk") val isAfk: Boolean? = null,
    @SerializedName("shutdown_timer") val shutdownTimer: Long? = null,
    @SerializedName("polling_interval") val pollingInterval: Long? = null,
    @SerializedName("command") val command: Any? = null
)

/**
 * Model info konfigurasi warnet & QRIS pembayaran (/api/v1/public/client/warnet)
 */
data class WarnetConfigResponse(
    @SerializedName("title") val title: String? = null,
    @SerializedName("announcement") val announcement: String? = null,
    @SerializedName("qris_url") val qrisUrl: String? = null,
    @SerializedName("qris_path") val qrisPath: String? = null
)

/**
 * Model respons status workstation / station rental PS dari backend app-rust
 */
data class StationStatusResponse(
    @SerializedName("id") val id: Int,
    @SerializedName("nomor") val nomor: String,
    @SerializedName("nama") val nama: String?,
    @SerializedName("status") val status: String, // "kosong", "terpakai", "rusak", "maintenance"
    @SerializedName("tipe") val tipe: String?, // "PS4", "PS5", "PC", dsb
    @SerializedName("ip_address") val ipAddress: String?,
    @SerializedName("sesi_aktif") val sesiAktif: ActiveSessionInfo?,
    @SerializedName("server_time") val serverTime: Long?
)

data class ActiveSessionInfo(
    @SerializedName("id") val id: Int,
    @SerializedName("id_komputer") val idKomputer: Int,
    @SerializedName("id_member") val idMember: Int?,
    @SerializedName("username") val username: String?,
    @SerializedName("tipe_sesi") val tipeSesi: String, // "personal", "paket"
    @SerializedName("waktu_mulai") val waktuMulai: String,
    @SerializedName("waktu_selesai") val waktuSelesai: String?,
    @SerializedName("total_detik") val totalDetik: Long?,
    @SerializedName("sisa_detik") val sisaDetik: Long?,
    @SerializedName("tarif_per_jam") val tarifPerJam: Double?,
    @SerializedName("total_biaya") val totalBiaya: Double?
)

data class HeartbeatRequest(
    @SerializedName("station_id") val stationId: Int,
    @SerializedName("status") val status: String,
    @SerializedName("app_version") val appVersion: String,
    @SerializedName("hdmi_active") val hdmiActive: Boolean
)

data class HeartbeatResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("message") val message: String?,
    @SerializedName("server_time") val serverTime: Long
)

data class MemberLoginRequest(
    @SerializedName("station_id") val stationId: Int,
    @SerializedName("username") val username: String,
    @SerializedName("pin_or_password") val pinOrPassword: String,
    @SerializedName("durasi_menit") val durasiMenit: Int? = null
)

data class MemberLoginResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("message") val message: String?,
    @SerializedName("token") val token: String?,
    @SerializedName("sisa_saldo") val sisaSaldo: Double?,
    @SerializedName("sisa_waktu_detik") val sisaWaktuDetik: Long?
)

data class MemberLogoutRequest(
    @SerializedName("station_id") val stationId: Int,
    @SerializedName("id_sesi") val idSesi: Int
)

data class MemberLogoutResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("message") val message: String?
)

data class CommandSyncRequest(
    @SerializedName("station_id") val stationId: Int,
    @SerializedName("last_command_id") val lastCommandId: Long
)

data class CommandSyncResponse(
    @SerializedName("commands") val commands: List<AgentCommand>
)

data class AgentCommand(
    @SerializedName("id") val id: Long,
    @SerializedName("type") val type: String, // "LOCK", "UNLOCK", "SWITCH_HDMI", "RETURN_KIOSK", "REBOOT", "MESSAGE"
    @SerializedName("payload") val payload: String?,
    @SerializedName("created_at") val createdAt: Long
)
