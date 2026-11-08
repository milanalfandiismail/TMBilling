# Baseline All-Core 2026-11-08

| Metric | Value |
|---|---|
| pytest serial | 105.01 s / 491 passed |
| bili proxy CPU in 15 s | 0.38 s |
| bili proxy one-core share | 2.5 % |
| logical cores | 16 |
| bili requests | 843 |
| bili cached tokens | 72361088 |

## Decision

Bili proxy CPU share is below 10% of one core, so no image/JSON worker pool is added in this plan. Task 2 only sets the libuv threadpool. Revisit worker threads when profiling shows a CPU-bound path above 10%.
