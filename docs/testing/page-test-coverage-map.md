# VERA — Sayfa Bazlı Test Kapsam Haritası

**Tarih:** 2026-04-28
**Kapsam:** Tüm admin / auth / jury sayfaları için unit + E2E test envanteri
**Notasyon:**
- ✅ gerçek doğrulama (DB assertion, real flow)
- ⚠️ yüzeysel (sadece render veya mock-tautology)
- ❌ test yok
- **(N)** unit test dosya sayısı

---

## AUTH

| Sayfa | Unit | E2E | ✅ Bakılan | ❌ Bakılmayan |
|---|---|---|---|---|
| **Landing** | (1) `LandingPage.test` + showcase slides | ❌ | Render, slide rotation | CTA tıklama→/login akışı, JSONB content rendering |
| **Login** | (1) `LoginScreen.test` | `admin-login.spec.ts` | Render, doğru/yanlış kredensiyel, remember-me toggle | Rate-limit davranışı, MFA, gerçek 2 başarısız sonrası |
| **Register** | (2) `RegisterScreen` + `TenantSearchDropdown` | `tenant-application.spec.ts` (kısmen) | Tenant search dropdown render | Anonymous tenant submission → admin approval → user creation full chain (sadece approve/reject) |
| **ForgotPassword** | (1) `ForgotPasswordScreen.test` | `forgot-password.spec.ts` | ✅ Email gönderme, recovery link → reset → login | — |
| **ResetPassword** | (1) `ResetPasswordScreen.test` | `password-reset.spec.ts` | ✅ Eski şifre fail, yeni şifre login, recovery flow | Şifre policy validation client-side |
| **InviteAccept** | (1) `InviteAcceptScreen.test` | `invite-accept.spec.ts` (auth + admin) | ✅ Action_link açılıyor, name+pass submit, storage key derivation | Membership role assignment doğrulama |
| **CompleteProfile** (Google OAuth post) | (1) `CompleteProfileScreen.test` | ❌ | Render | OAuth → CompleteProfile → membership creation full path |
| **VerifyEmail / Banner** | (2) `VerifyEmailScreen` + `EmailVerifyBanner` | ❌ | Banner render, dismiss | Real Supabase verify flow, grace period expiry |
| **GraceLock** | (1) `GraceLockScreen.test` | ❌ | Render lock state | Grace period expiry → real lockout |
| **PendingReview** | (1) `PendingReviewScreen.test` | ❌ | Pending state render | Approval polling, redirect after approval |
| **AuthProvider** | (4) `AuthProvider.test` + `googleOAuth` + `sessionRefresh` + `useAuth` | `google-oauth.spec.ts` | ✅ OAuth init, session refresh, expired injected session, login persistence | Multi-tab session sync, real Google OAuth provider response |
| **AuthGuard** | (1) `AuthGuard.test` | ❌ | Redirect logic when unauthenticated | — |

**Auth özet:** Render-level unit testler güçlü; E2E'de critical paths sağlam. Ana eksikler: real OAuth full chain, multi-tab session, anonymous tenant application complete flow, email verify real path.

---

## JURY

| Sayfa/Adım | Unit | E2E | ✅ Bakılan | ❌ Bakılmayan |
|---|---|---|---|---|
| **JuryGate** (token verify) | — | `happy-path.spec.ts` | ✅ Token → identity navigation | Geçersiz/expired token error mesajları |
| **IdentityStep** | (1) `IdentityStep.test` | ✅ happy-path | Form submission → PIN | Validation rules detaylı (length, allowed chars) |
| **PeriodStep** | (1) `PeriodStep.test` | ❌ | Render, period select | Period switch → state reset |
| **PinStep** | (1) `PinStep.test` | ✅ happy-path + `lock.spec.ts` | ✅ 3 fail → lockout, doğru PIN → progress | Concurrent PIN attempt collision |
| **PinRevealStep** | (1) `PinRevealStep.test` | ❌ | Reveal animation | Reveal → DB activated_at write doğrulama |
| **LockedStep** | (2) `LockedStep.test` + `pinReset.test` (P-C W2) | ✅ `lock.spec.ts` | ✅ Lockout countdown, PIN reset orchestration (closure bug fix dahil) | — |
| **ProgressStep** | (1) `ProgressStep.test` | ✅ `resume.spec.ts` | ✅ Welcome Back, reload sonrası DB state restore | — |
| **EvalStep** | (3) `EvalStep` + `EvalSmallComponents` + `useJuryAutosave` | ✅ `evaluate.spec.ts` (8 test) | ✅ onBlur → DB row, visibilitychange save, dedup, all-complete banner, back nav | Dirty unsaved navigation warning, mobile touch input |
| **DoneStep** | (1) `DoneStep.test` | ✅ `final-submit-and-lock.spec.ts` | ✅ final_submitted_at set, re-submit engeli | — |
| **ArrivalStep** | (1) `ArrivalStep.test` | ❌ | Render | Arrival → progress transition trigger |
| **JuryGuard** | (1) `JuryGuard.test` | implicit (all jury specs) | Redirect logic | — |
| **Edit mode** (admin trigger) | — | ✅ `edit-mode.spec.ts` | ✅ Admin enable → juror edit, edit window expiry | — |
| **useJuryState** (orchestrator) | (2) `.test` + `errorPropagation` | ✅ tüm jury E2E | ✅ Step transitions, error propagation, DB persistence | Network kesintisi → resume davranışı |
| **Concurrent jury** | — | ✅ `concurrent-jury.spec.ts` | ✅ N=8 paralel, 10.4s wall-clock | — |

**Jury özet:** Projedeki **en sağlam** test alanı. Real DB persistence, real reload, real concurrent flow. Tek eksik: offline/network hatası senaryoları.

---

## ADMIN — Veri/Listeleme Sayfaları

| Sayfa | Unit | E2E | ✅ Bakılan | ❌ Bakılmayan |
|---|---|---|---|---|
| **Overview** | (1) `OverviewPage.test` | ✅ `overview-kpi.spec.ts` (9 test) | ✅ KPI sayısal doğrulama (Active Jurors, Projects, Completion %, Average Score), breakdown bars, Live Feed sıralaması, Top Projects | Period switching UI, real-time update via WS |
| **Periods** ⭐ | (12) helpers + table + cells + drawers + 3 modals + lockEnforcement + completionStrip | ✅ `periods.spec.ts` (6 test) + `unlock-request.spec.ts` | ✅ CRUD, publish→is_locked=true, close→`period_closed` RPC, unlock request flow | Period CRUD validation rules (date overlap, duplicate name) |
| **Projects** | (6) ProjectsPage + helpers + lockEnforcement + drawer + modal | ✅ `projects.spec.ts` + `projects-import.spec.ts` | CRUD, CSV import | Project-juror assignment matrix doğrulama, advisor field rules |
| **Jurors** ⭐ | (10) JurorsPage + table + 3 drawers/modals + helpers + lockEnforcement + responsiveTableMode | ✅ `jurors-crud.spec.ts` + `juror-batch-import.spec.ts` + ✅ `score-edit-request.spec.ts` (2 test) | ✅ CRUD, batch import, PIN reset → DB, ✅ EnableEditingModal reopen → DB `edit_enabled=true`, modal validation (reason < 5 chars → disabled) | Juror→project assignment, audit trail for reopen |
| **Criteria** ⭐ | (12) Manager + form + 3 drawers + helpers + filter + saveBar + coverageBar | ⚠️ `criteria.spec.ts` (4 test, sadece drawer) | Drawer açılıyor, save | **Weight redistribution math, rubric band CRUD, outcome mapping persistence** |
| **Outcomes** | (6) page + table + drawer + modals + helpers + export | ⚠️ `outcomes.spec.ts` (3 test, drawer only) | Drawer açılıyor | **Outcome→criterion mapping persist + cascade attainment recompute** |
| **Organizations** | (4) page + switcher + drawer + manage | ✅ `organizations-crud.spec.ts` | ✅ Create/edit/delete + validation | Membership role assignment, owner transfer |
| **Heatmap** | (6) page + 3 hooks + mobileSort + mobileList | ✅ `heatmap.spec.ts` (5 test) | ✅ Cell state, averages, deliberately-break | XLSX export (heatmap-specific) sayısal doğrulama |
| **Rankings** | (1) `RankingsPage.test` | ✅ `rankings-export.spec.ts` (header check) + `scoring-correctness.spec.ts` | ✅ Export header, weight-based ranking math, XLSX = DB sum | Tie-breaker rules, ranking with missing scores |

⭐ = unit-bazlı en güçlü 3 alan (Periods 12, Criteria 12, Jurors 10) — ama büyük kısmı mock-tautology

---

## ADMIN — Kontrol/Raporlama Sayfaları

| Sayfa | Unit | E2E | ✅ Bakılan | ❌ Bakılmayan |
|---|---|---|---|---|
| **Analytics** | (3) page + useAnalyticsData + getOutcomeAttainmentTrends | ✅ `analytics.spec.ts` (5) + `outcome-attainment.spec.ts` (9) + `analytics-export-cells.spec.ts` (9 XLSX sheets) + `analytics-period-comparison.spec.ts` (3) | ✅ Attainment math, summary strip, period trend comparison, XLSX workbook tüm sheet içerikleri (Attainment Status/Rate/Gap, Outcome Achievement, Rubric Dist, Programme Averages, Heatmap, Juror Consistency, Coverage Matrix) | PDF export, chart render (visual snapshot), CI'da XLSX spec skip (env guard) |
| **Reviews** | (2) page + useReviewsFilters | ✅ `reviews.spec.ts` (filter: juror+project) + `reviews-edit-persist.spec.ts` (6 RPC tests) + `analytics-bias-outlier.spec.ts` (6 KPI tests) | ✅ Juror/project filter, σ>10 → highDisagreementCount, outlier >15 pts → outlierCount, coverage, avgScore, ✅ force-close edit mode → audit row, unlock-request audit, RBAC (anonymous → 403) | Feedback gönderme, score-filter (min/max), combined filter engine |
| **Audit Log** | (2) page + filters | ✅ `audit-log.spec.ts` (10) + ✅ `audit-event-coverage.spec.ts` (12 event types) | ✅ Filter UI, create/delete/login/token/project → DB, ✅ 12 distinct event_type: period.lock/unlock, outcome.created/updated/deleted, mapping.upsert/delete, token.generate, period.close, juror.edit_mode_enabled, juror.pin_unlocked_and_reset, admin.updated | Audit chain hash integrity, pagination, export |
| **Entry Control** | (2) page + JuryEntryControlPanel | ✅ `entry-tokens.spec.ts` (3 test) | ✅ Generate, revoke, cancel | Token expiry behavior, multi-period token management |
| **PIN Blocking** | (3) page + modal + hook | ✅ `pin-blocking.spec.ts` (4 test) | ✅ Unlock UI, admin unlock → DB reset, expired lockout accept | Bulk unlock, audit trail for unlock |
| **Setup Wizard** | (2) page + useSetupWizard | ⚠️ `setup-wizard.spec.ts` (6 test step nav) + ✅ `setup-wizard-submit.spec.ts` (1 test full) | ✅ 5 adım nav, full submit → setup_completed_at | Adım-adım data persistence (step 2 organization save, step 3 framework apply gerçek), validation per step |
| **Settings** | (5) page + useAdminTeam + LastActivity + ChangePass + useProfileEdit | ⚠️ `settings.spec.ts` (2 render) + ✅ `settings-save.spec.ts` (8 RPC tests) | ✅ security policy save → DB, PIN policy save + re-fetch, team CRUD (invite → membership row, cancel removes), change password → old fails/new works, RBAC (org_admin → rpc_admin_set_security_policy → rejected), persistence (fresh client re-reads saved value) | Organization config (display name, locale) save, audit trail for settings changes (⚠️ known backlog: security_policy.update no audit row yet) |
| **Export** | (1) `ExportPage.test` | implicit `rankings-export` | UI render | Full export ZIP file content, scheduling |

---

## Toplu Değerlendirme

### Sayfa skorları

| Skor | Sayfalar |
|---|---|
| **9/10 (sağlam)** | Jury Eval, Periods, Audit Log (+ event coverage), Heatmap, Rankings (export math), Tenant Isolation (security), Overview (KPI math), Analytics (XLSX + math) |
| **7/10 (kısmen)** | Login, ForgotPassword, ResetPassword, Organizations, Jurors CRUD (+reopen), Projects CRUD, Setup Wizard submit, Pin Blocking, Entry Control, Outcome Attainment math, Settings (RPC persist), Reviews (KPI + audit) |
| **5/10 (yüzeysel)** | Setup Wizard (step persistence), Criteria (mapping), Outcomes (mapping), Tenant Application |
| **3/10 (çok zayıf)** | CompleteProfile (OAuth), VerifyEmail, Export (full ZIP), Landing |

### Konsolide eksikler

**1. "Drawer açılıyor"da kalan ekranlar** (en kritik):

- ~~**Settings**~~ — ✅ `settings-save.spec.ts` ile çözüldü (2026-04-28)
- ~~**Reviews** — feedback gönderme yok~~ — ✅ KPI + audit ile kısmen çözüldü; feedback gönderme hâlâ eksik
- **Criteria** — weight redistribute, rubric band CRUD, mapping save yok
- **Outcomes** — mapping persist + cascade attainment recompute yok

**2. Hesaplama doğrulaması eksik:**

- ~~Analytics chart content~~ — ✅ `analytics-export-cells.spec.ts` ile 9 XLSX sheet'in tüm hücre içerikleri doğrulanıyor (2026-04-28)
- ~~Period comparison trend~~ — ✅ `analytics-period-comparison.spec.ts` (2026-04-28)
- PDF export hiç test edilmiyor

**3. Workflow zincirleri test edilmiyor:**

- Anonymous register → admin approval → Auth user creation → first login → membership active (sadece approve/reject)
- Google OAuth → CompleteProfile → membership → admin shell (parça parça)
- Setup wizard step-step persistence (sadece son submit)
- ~~Score-edit-request lifecycle (backend henüz yok)~~ — ✅ `score-edit-request.spec.ts` reopen UI + DB assert tamamlandı (2026-04-28)

**4. Yan davranışlar:**

- Multi-tab session sync
- Network kesintisi → resume
- Audit log pagination + hash chain integrity
- Email verify gerçek SMTP path

---

## En Değerli 5 Ekleme (öncelik sırası)

İdeal seviyeye en hızlı yaklaştıran iş — toplam **~7 gün E2E iş**, infra değişimi gerektirmez:

1. ~~**Settings save → DB persist E2E**~~ ✅ Tamamlandı — `settings-save.spec.ts` (2026-04-28)

2. ~~**Analytics XLSX hücre içerik testi**~~ ✅ Tamamlandı — `analytics-export-cells.spec.ts` (2026-04-28)

3. **Criteria mapping persist E2E** (2 gün)
   Outcome ↔ criterion mapping save → cascade attainment doğrulama; weight redistribution math

4. **Reviews feedback gönderme E2E** (1 gün)
   `rpc_submit_jury_feedback` DB assertion; combined score+juror+comment filter engine

5. **Setup wizard step-step persistence** (2 gün)
   Her adım gerçekten DB'ye yazıyor mu (org create, framework assign, criteria save)

---

## Ek: Test dosya konumları (referans)

```
src/admin/features/<page>/__tests__/      # admin unit tests
src/jury/features/<step>/__tests__/        # jury unit tests
src/auth/features/<screen>/__tests__/      # auth unit tests
e2e/admin/<feature>.spec.ts                # admin E2E
e2e/jury/<flow>.spec.ts                    # jury E2E
e2e/auth/<flow>.spec.ts                    # auth E2E
e2e/security/*.spec.ts                     # tenant isolation, RBAC
sql/tests/rpcs/contracts/*.sql             # pgTAP RPC contracts
```
