# P3 — Test Hardening Sprint (Audit Gap Closure)

After P0+P1+P2 (45 maddeden 23'ü kapatıldı), audit'in §3-§6'sında numaralandırılmamış 22 gap kaldı. P3 bunları 4 paralel grup olarak adresliyor.

## Verification of P0/P1/P2 (önemli not)

P0+P1+P2 sırasında bazı testler subagent self-graded olarak işaretlendi. Verification sonuçları:

| Bölge | Durum |
|---|---|
| P0-B edge tests (188→207) | ✅ Gerçek — harness gerçek handler çağırıyor |
| P0-E hook tests (938→953) | ✅ Gerçek — implementasyonla örtüşüyor |
| P1-6 E2E (5 spec) | ⚠️ Yazıldı, demo DB'sine karşı çalıştırılmadı |
| P1-11 perf N=8 | ⚠️ N=8 hiç çalıştırılmadı (yalnız N=2 doğrulandı) |
| **P2-13 visual baselines** | ❌ **16 baseline'ın tamamı login sayfasıydı.** `/demo/admin/*` rotalarına geçirildi, kötü PNG'ler silindi. `--update-snapshots` ile yeniden oluşturulmalı |

## P3 Scope

22 gap → 4 paralel grup. Her grup ayrı subagent.

Detaylı prompt: [`prompts/p3-master-prompt.md`](./prompts/p3-master-prompt.md)
