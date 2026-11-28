package com.tmbilling.tv.data.network

import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.net.InetSocketAddress
import java.net.NetworkInterface
import java.net.Socket
import java.util.concurrent.TimeUnit

data class DiscoveredServer(
    val ip: String,
    val port: Int = 7015,
    val url: String = "http://$ip:$port",
    val latencyMs: Long = 0,
    val serverName: String = "TMBilling Server"
)

/**
 * Scanner otomatis subnet lokal untuk mendeteksi TMBilling Server pada port 7015
 */
object ServerScanner {
    private const val TAG = "ServerScanner"
    const val DEFAULT_PORT = 7015

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(1, TimeUnit.SECONDS)
        .readTimeout(1, TimeUnit.SECONDS)
        .build()

    /**
     * Dapatkan daftar IP lokal perangkat TV (WiFi / Ethernet)
     */
    fun getLocalIpAddresses(): List<String> {
        val ips = mutableListOf<String>()
        try {
            val interfaces = NetworkInterface.getNetworkInterfaces() ?: return ips
            for (intf in interfaces) {
                if (intf.isLoopback || !intf.isUp) continue
                for (addr in intf.inetAddresses) {
                    if (!addr.isLoopbackAddress && addr.address.size == 4) {
                        addr.hostAddress?.let { ips.add(it) }
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Gagal membaca IP lokal", e)
        }
        return ips
    }

    /**
     * Scan subnet lokal secara asinkronus untuk mencari server TMBilling di port 7015
     */
    suspend fun scanLocalSubnet(onProgress: (Int, Int) -> Unit = { _, _ -> }): List<DiscoveredServer> =
        withContext(Dispatchers.IO) {
            val discovered = mutableListOf<DiscoveredServer>()
            val localIps = getLocalIpAddresses()

            // Kumpulkan kandidat IP prioritas tinggi
            val candidateIps = linkedSetOf<String>()
            // 1. Emulator Gateway
            candidateIps.add("10.0.2.2")
            // 2. IP Server lokal yang diketahui
            candidateIps.add("10.10.10.25")
            // 3. Subnet gateway umum
            candidateIps.add("192.168.1.1")
            candidateIps.add("192.168.0.1")

            // 4. Masukkan seluruh rentang IP subnet aktif perangkat
            for (localIp in localIps) {
                val lastDot = localIp.lastIndexOf('.')
                if (lastDot > 0) {
                    val subnetPrefix = localIp.substring(0, lastDot + 1)
                    for (host in 1..254) {
                        candidateIps.add("$subnetPrefix$host")
                    }
                }
            }

            // Batasi scan maksimal 260 host agar sangat cepat
            val ipList = candidateIps.take(260)
            val total = ipList.size
            var scannedCount = 0

            // Jalankan parallel async probe dengan coroutine
            val jobs = ipList.map { ip ->
                async {
                    val start = System.currentTimeMillis()
                    val isPortOpen = probePort(ip, DEFAULT_PORT, timeoutMs = 250)
                    if (isPortOpen) {
                        val latency = System.currentTimeMillis() - start
                        val isHealthy = checkHealth(ip, DEFAULT_PORT)
                        if (isHealthy) {
                            DiscoveredServer(
                                ip = ip,
                                port = DEFAULT_PORT,
                                latencyMs = latency,
                                serverName = "TMBilling Server (Aktif)"
                            )
                        } else {
                            DiscoveredServer(
                                ip = ip,
                                port = DEFAULT_PORT,
                                latencyMs = latency,
                                serverName = "Port 7015 Terbuka"
                            )
                        }
                    } else null
                }
            }

            for (job in jobs) {
                val result = job.await()
                if (result != null) {
                    discovered.add(result)
                }
                scannedCount++
                onProgress(scannedCount, total)
            }

            discovered
        }

    private fun probePort(ip: String, port: Int, timeoutMs: Int): Boolean {
        return try {
            Socket().use { socket ->
                socket.connect(InetSocketAddress(ip, port), timeoutMs)
                true
            }
        } catch (e: Exception) {
            false
        }
    }

    private fun checkHealth(ip: String, port: Int): Boolean {
        return try {
            val request = Request.Builder()
                .url("http://$ip:$port/api/health")
                .build()
            httpClient.newCall(request).execute().use { response ->
                response.isSuccessful
            }
        } catch (e: Exception) {
            false
        }
    }
}
