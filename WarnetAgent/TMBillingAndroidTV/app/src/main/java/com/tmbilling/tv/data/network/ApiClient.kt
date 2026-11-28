package com.tmbilling.tv.data.network

import com.tmbilling.tv.data.model.StationStatusResponse
import com.tmbilling.tv.data.pref.AppPreferences
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

object ApiClient {

    private var retrofit: Retrofit? = null
    private var cachedBaseUrl: String = ""

    fun init(preferences: AppPreferences) {
        val baseUrl = preferences.serverUrl
        if (retrofit != null && cachedBaseUrl == baseUrl) {
            return
        }
        cachedBaseUrl = baseUrl

        val loggingInterceptor = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }

        val authInterceptor = Interceptor { chain ->
            val original = chain.request()
            val timestamp = (System.currentTimeMillis() / 1000).toString()
            val stationId = preferences.stationId.toString()
            val path = original.url.encodedPath
            val secretKey = preferences.secretKey

            val signaturePayload = "$stationId:$timestamp:$path"
            val signature = computeHmacSha256(signaturePayload, secretKey)

            val requestBuilder = original.newBuilder()
                .header("Accept", "application/json")
                .header("Content-Type", "application/json")
                .header("X-Client-Key", secretKey)
                .header("X-Station-ID", stationId)
                .header("X-Timestamp", timestamp)
                .header("X-Signature", signature)
                .method(original.method, original.body)

            chain.proceed(requestBuilder.build())
        }

        val okHttpClient = OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .addInterceptor(loggingInterceptor)
            .connectTimeout(5, TimeUnit.SECONDS)
            .readTimeout(10, TimeUnit.SECONDS)
            .writeTimeout(10, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .build()

        val fullUrl = if (baseUrl.endsWith("/")) baseUrl else "$baseUrl/"

        retrofit = Retrofit.Builder()
            .baseUrl(fullUrl)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    val apiService: ApiService
        get() = retrofit?.create(ApiService::class.java)
            ?: throw IllegalStateException("ApiClient belum diinisialisasi dengan AppPreferences.")

    fun resetClient(preferences: AppPreferences) {
        retrofit = null
        init(preferences)
    }

    suspend fun testConnection(
        testUrl: String,
        testStationId: Int,
        testSecretKey: String
    ): Result<StationStatusResponse> = withContext(Dispatchers.IO) {
        try {
            val fullUrl = if (testUrl.endsWith("/")) testUrl else "$testUrl/"
            val baseClient = OkHttpClient.Builder()
                .connectTimeout(5, TimeUnit.SECONDS)
                .readTimeout(5, TimeUnit.SECONDS)
                .build()

            val tempRetrofit = Retrofit.Builder()
                .baseUrl(fullUrl)
                .client(baseClient)
                .addConverterFactory(GsonConverterFactory.create())
                .build()

            val service = tempRetrofit.create(ApiService::class.java)

            // 1. Uji koneksi jaringan ke endpoint kesehatan TMBilling (/api/health)
            val healthResp = try {
                service.checkHealth()
            } catch (e: Exception) {
                return@withContext Result.failure(Exception("Gagal menghubungi $fullUrl: ${e.localizedMessage}"))
            }

            if (!healthResp.isSuccessful) {
                return@withContext Result.failure(Exception("Server merespons HTTP ${healthResp.code()} di /api/health"))
            }

            // 2. Verifikasi Client API Key (X-Client-Key) ke TMBilling backend
            if (testSecretKey.isNotBlank()) {
                val jsonMediaType = "application/json; charset=utf-8".toMediaTypeOrNull()
                val requestBody = "{\"ip_address\":\"10.0.2.2\",\"mac_address\":\"02:00:00:00:00:01\",\"role\":\"client\"}".toRequestBody(jsonMediaType)
                val authReq = Request.Builder()
                    .url(fullUrl + "api/v1/public/client/status")
                    .header("Accept", "application/json")
                    .header("Content-Type", "application/json")
                    .header("X-Client-Key", testSecretKey)
                    .post(requestBody)
                    .build()

                val authResp = baseClient.newCall(authReq).execute()
                if (authResp.code == 401) {
                    return@withContext Result.failure(Exception("HTTP 401: Secret Key '$testSecretKey' ditolak server (Kunci Salah)!"))
                }
                if (!authResp.isSuccessful) {
                    return@withContext Result.failure(Exception("HTTP ${authResp.code}: ${authResp.message}"))
                }

                val respBodyStr = authResp.body?.string() ?: ""
                val json = com.google.gson.JsonParser.parseString(respBodyStr).asJsonObject
                val pcKode = if (json.has("pc_kode") && !json.get("pc_kode").isJsonNull) json.get("pc_kode").asString else "PS-01"
                val serverStatus = if (json.has("status") && !json.get("status").isJsonNull) json.get("status").asString else "kosong"

                return@withContext Result.success(
                    StationStatusResponse(
                        id = testStationId,
                        nomor = pcKode,
                        nama = "Rental PS $pcKode",
                        status = serverStatus,
                        tipe = "PS5",
                        ipAddress = "10.0.2.2",
                        sesiAktif = null,
                        serverTime = System.currentTimeMillis() / 1000
                    )
                )
            }

            Result.success(
                StationStatusResponse(
                    id = testStationId,
                    nomor = "PS-$testStationId",
                    nama = "Rental PS $testStationId",
                    status = "online",
                    tipe = "PS5",
                    ipAddress = "10.0.2.2",
                    sesiAktif = null,
                    serverTime = System.currentTimeMillis() / 1000
                )
            )
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private fun computeHmacSha256(data: String, key: String): String {
        return try {
            val sha256HMAC = Mac.getInstance("HmacSHA256")
            val secretKeySpec = SecretKeySpec(key.toByteArray(Charsets.UTF_8), "HmacSHA256")
            sha256HMAC.init(secretKeySpec)
            val bytes = sha256HMAC.doFinal(data.toByteArray(Charsets.UTF_8))
            bytes.joinToString("") { "%02x".format(it) }
        } catch (e: Exception) {
            ""
        }
    }
}
