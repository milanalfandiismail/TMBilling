//! Konstanta bersama; ejaan string wajib sama dengan versi Python.

pub const WRITE_LOCK_SLOW_SECONDS: f64 = 1.0;
pub const IDEMPOTENCY_TTL_SECONDS: u64 = 600;
pub const IDEMPOTENCY_MAX_KEYS: usize = 5000;
pub const HEARTBEAT_PERSIST_SECONDS: i64 = 30;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PcStatus {
    Kosong,
    Terpakai,
    Offline,
    Maintenance,
    Admin,
}

impl PcStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            PcStatus::Kosong => "kosong",
            PcStatus::Terpakai => "terpakai",
            PcStatus::Offline => "offline",
            PcStatus::Maintenance => "maintenance",
            PcStatus::Admin => "admin",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SesiType {
    Guest,
    Member,
    Admin,
}

impl SesiType {
    pub fn as_str(self) -> &'static str {
        match self {
            SesiType::Guest => "guest",
            SesiType::Member => "member",
            SesiType::Admin => "admin",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SesiStatus {
    Aktif,
    Selesai,
    Terkunci,
}

impl SesiStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            SesiStatus::Aktif => "aktif",
            SesiStatus::Selesai => "selesai",
            SesiStatus::Terkunci => "terkunci",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TransaksiJenis {
    BeliPaketGuest,
    TambahWaktuGuest,
    BeliPaketMember,
    TambahWaktuSesi,
    RefundGuest,
    RefundMember,
    TransaksiMenu,
}

impl TransaksiJenis {
    pub fn as_str(self) -> &'static str {
        match self {
            TransaksiJenis::BeliPaketGuest => "beli_paket_guest",
            TransaksiJenis::TambahWaktuGuest => "tambah_waktu_guest",
            TransaksiJenis::BeliPaketMember => "beli_paket_member",
            TransaksiJenis::TambahWaktuSesi => "tambah_waktu_sesi",
            TransaksiJenis::RefundGuest => "refund_guest",
            TransaksiJenis::RefundMember => "refund_member",
            TransaksiJenis::TransaksiMenu => "transaksi_menu",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PaymentMethod {
    Tunai,
    Qris,
    Transfer,
    Deposit,
}

impl PaymentMethod {
    pub fn as_str(self) -> &'static str {
        match self {
            PaymentMethod::Tunai => "Tunai",
            PaymentMethod::Qris => "QRIS",
            PaymentMethod::Transfer => "Transfer",
            PaymentMethod::Deposit => "Deposit",
        }
    }
}
