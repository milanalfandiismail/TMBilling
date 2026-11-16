//! Autentikasi kasir/admin: sesi login, throttle, dan bootstrap admin awal.

pub mod auth_kasir_service;
pub mod bootstrap;
pub mod login_throttle;

/// Error yang membawa status HTTP agar route tidak perlu menerjemahkan ulang.
#[derive(Debug)]
pub struct AuthError {
    pub status: u16,
    pub message: String,
}

impl AuthError {
    pub fn new(status: u16, message: impl Into<String>) -> Self {
        Self {
            status,
            message: message.into(),
        }
    }
}
