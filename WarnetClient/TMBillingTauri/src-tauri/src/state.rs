use std::sync::atomic::{AtomicBool, AtomicU32};

pub static GLOBAL_HOOK_ENABLED: AtomicBool = AtomicBool::new(true);
pub static SESSION_ACTIVE: AtomicBool = AtomicBool::new(false);
pub static IS_ADMIN_MODE: AtomicBool = AtomicBool::new(false);
pub static IS_EMERGENCY_MODE: AtomicBool = AtomicBool::new(false);
pub static REMAINING_SECONDS: AtomicU32 = AtomicU32::new(0);
