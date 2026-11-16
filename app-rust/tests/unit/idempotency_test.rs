use tmbilling_server::utils::idempotency;

#[test]
fn klaim_tunggal_dan_bisa_dilepas() {
    idempotency::reset();
    assert!(idempotency::claim("req-1"), "klaim pertama harus lolos");
    assert!(!idempotency::claim("req-1"), "klaim kedua harus ditolak");
    idempotency::release("req-1");
    assert!(idempotency::claim("req-1"), "setelah release boleh lagi");
}

#[test]
fn kunci_kosong_selalu_lolos() {
    idempotency::reset();
    assert!(idempotency::claim(""));
    assert!(idempotency::claim(""));
}
