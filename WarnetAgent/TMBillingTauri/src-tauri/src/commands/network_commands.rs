use crate::models::NetworkInfo;

#[tauri::command]
pub fn get_network_info() -> Result<NetworkInfo, String> {
    let ip_address = local_ip_address::local_ip()
        .map(|ip| ip.to_string())
        .unwrap_or_else(|_| "127.0.0.1".to_string());
        
    let mac_address = mac_address::get_mac_address()
        .map(|mac| mac.map(|addr| addr.to_string()).unwrap_or_else(|| "00:00:00:00:00:00".to_string()))
        .unwrap_or_else(|_| "00:00:00:00:00:00".to_string());
    
    Ok(NetworkInfo {
        ip: ip_address,
        mac: mac_address,
    })
}
