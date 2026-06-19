use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct NetworkInfo {
    pub ip: String,
    pub mac: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginResponse {
    pub status: String,
    pub member_name: String,
    pub group: String,
    pub remaining_seconds: u32,
}
