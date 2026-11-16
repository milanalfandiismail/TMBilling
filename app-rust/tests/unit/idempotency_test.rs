use tmbilling_server::utils::idempotency;

// Satu test: store bersifat proses-global, jadi dua test paralel akan saling `reset()`.
#[test]
fn klaim_tunggal_release_dan_kunci_kosong() {
    idempotency::reset();
    assert!(idempotency::claim("req-1"), "klaim pertama harus lolos");
    assert!(!idempotency::claim("req-1"), "klaim kedua harus ditolak");
    idempotency::release("req-1");
    assert!(idempotency::claim("req-1"), "setelah release boleh lagi");
    assert!(idempotency::claim(""));
    assert!(idempotency::claim(""));
}
