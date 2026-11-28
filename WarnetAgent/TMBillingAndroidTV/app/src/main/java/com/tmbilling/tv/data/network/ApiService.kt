package com.tmbilling.tv.data.network

import com.tmbilling.tv.data.model.*
import retrofit2.Response
import retrofit2.http.*

interface ApiService {

    @GET("/api/health")
    suspend fun checkHealth(): Response<Map<String, Any>>

    @GET("/api/v1/public/client/warnet")
    suspend fun getWarnetConfig(): Response<WarnetConfigResponse>

    @POST("/api/v1/public/client/status")
    suspend fun getClientStatus(
        @Body request: ClientStatusRequest
    ): Response<ClientStatusResponse>

    @GET("/api/v1/workstation/status/{stationId}")
    suspend fun getStationStatus(
        @Path("stationId") stationId: Int
    ): Response<StationStatusResponse>

    @POST("/api/v1/agent/heartbeat")
    suspend fun sendHeartbeat(
        @Body request: HeartbeatRequest
    ): Response<HeartbeatResponse>

    @POST("/api/v1/agent/member-login")
    suspend fun memberLogin(
        @Body request: MemberLoginRequest
    ): Response<MemberLoginResponse>

    @POST("/api/v1/agent/member-logout")
    suspend fun memberLogout(
        @Body request: MemberLogoutRequest
    ): Response<MemberLogoutResponse>

    @POST("/api/v1/agent/sync-commands")
    suspend fun syncCommands(
        @Body request: CommandSyncRequest
    ): Response<CommandSyncResponse>
}
