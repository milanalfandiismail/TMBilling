# E2E Terlihat — Playwright MCP (biner Rust)

E2E dijalankan sebagai user lewat browser Brave yang tampil di layar.

## Prasyarat

1. Biner: `cargo build --release --manifest-path app-rust/Cargo.toml`
2. MCP `playwright` aktif di `~/.config/opencode/opencode.json`, tanpa `--headless`.

## Start / stop

```powershell
.venv\Scripts\python.exe tests\e2e\rust\rust_sandbox.py --port 7017 --keep
```

Ctrl+C menghentikan server. `--keep` mempertahankan root `instance/e2e/mcp-rust/` (hapus manual bila selesai).
Cek cepat: `curl http://127.0.0.1:7017/api/health`.

## Hasil

`tests/e2e/mcp/results/<YYYY-MM-DD>/` (gitignored): `RESULTS.md` + `NN-<area>.png`.

Langkah klik + selector yang terbukti: `tests/e2e/mcp/mcp-walkthrough.md`.

## Status 2026-11-17

Login, 30 tab, 8 portal, dan money path (shift → sesi → POS → tutup sesi → tutup shift) lulus terhadap
biner Rust 2.0.0. Blocker B1-B3 dan bug timestamp UTC sudah diperbaiki pada commit yang sama.
