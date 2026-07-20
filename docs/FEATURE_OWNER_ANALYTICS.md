# Owner Analytics Dashboard (Fitur 15)

## Understanding Summary
- **Apa:** Halaman Analytics/KPI khusus owner dengan role administrator
- **Kenapa:** Owner bisa ambil keputusan bisnis berdasarkan data, bukan feeling
- **Untuk siapa:** User dengan role `administrator` saja
- **7 KPI:** Grafik pendapatan, heatmap jam sibuk, revenue per PC, trend member vs churn, top 5 paket, pendapatan per kasir/shift, tingkat refund
- **Rentang data:** 7 hari terakhir, load sekali, refresh manual
- **Database:** SQLite + index di kolom tanggal

## Assumptions
- Chart.js via static file (offline-ready), bukan CDN
- Halaman terpisah dari dashboard kasir, route `/owner/analytics`
- Hanya role administrator yang bisa akses
- SQLite mampu handle 50rb+ record dengan index

## Architecture
- Backend: Service layer aggregation → 1 endpoint JSON
- Frontend: Halaman HTML + Chart.js render 7 chart
- Route: `GET /owner/analytics` (halaman) + `GET /api/owner/analytics-data` (JSON)

## 7 KPI Cards
1. **Pendapatan billing vs kantin** — Grouped bar chart, per hari
2. **Heatmap jam sibuk** — Bar chart horizontal, 24 jam
3. **Revenue per PC** — Bar chart, top 20 PC
4. **Trend member baru vs churn** — Line chart, per hari
5. **Top 5 paket terlaris** — Doughnut chart
6. **Pendapatan per kasir/shift** — Stacked bar chart
7. **Tingkat refund & pembatalan** — Doughnut chart

## Files
### Baru
- `app/routes/owner/__init__.py`
- `app/routes/owner/analytics_routes.py`
- `app/services/owner/analytics_service.py`
- `app/templates/kasir/owner/analytics.html`
- `app/static/js/kasir/modules/owner/analytics.js`
- `app/static/js/lib/chart.umd.min.js`

### Diubah
- `app/static/js/kasir/core/api.js` — endpoint owner
- `app/static/js/kasir/app.js` — module analytics
- `app/templates/kasir/components/sidebar.html` — tab owner
- `app/templates/kasir/base.html` — include Chart.js
- `app/routes/__init__.py` — register blueprint

## Database Index
- `transaksi.dibuat_pada`
- `transaksi_menu.tanggal`
- `sesi.mulai_pada`, `sesi.selesai_pada`
- `member.dibuat_pada`, `member.kadaluarsa_pada`

## Decision Log
| Keputusan | Alternatif | Alasan |
|-----------|-----------|--------|
| Halaman terpisah | Tab di dashboard | Private, role-based |
| Chart.js static file | CDN | Offline-ready |
| Load sekali + refresh manual | Auto-refresh | Data analytics statis |
| Backend aggregation | Frontend aggregation | SQLite lebih cepat |
| 7 hari terakhir | 30 hari / custom | Ringan, cukup lihat trend |
| Route `/owner/analytics` | `/analytics` | Prefix grouping |
| Index kolom tanggal | Tanpa index | Query 50rb record |

---
*TMBilling v1.4.4*
