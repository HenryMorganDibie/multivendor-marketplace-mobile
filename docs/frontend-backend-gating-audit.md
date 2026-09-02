# Frontend/Backend Plan-Gating Audit v3 (Independently Verified) — rork-the platform vs platform-backend

**Verification note:** This is the third pass of this audit. v2 independently re-checked every item from the original v1 audit against the actual source files in both repos and corrected three inaccuracies. v3 extends coverage beyond the original 12-item list: after v2 was sent, a deeper sweep checked every single row of the MVP_Features.pdf tables against the frontend for items that were never in the original audit at all — not just re-verifying claimed bugs, but actively searching for gaps the original audit missed entirely. Two such gaps were found and are added here as items #13 and #14. All numbers were cross-checked against `functions/src/subscriptions/planLimitsSeedData.ts` (`DEFAULT_PLAN_LIMITS`, confirmed as the real backend source of truth) and the official "MVP Features.pdf" spec — no discrepancies found beyond what's documented below.

Compares the vendor plan feature matrix against:
- **Backend**: `functions/src/subscriptions/planLimitsSeedData.ts` → `DEFAULT_PLAN_LIMITS` (source of truth, independently confirmed 100% match to spec by direct file read)
- **Frontend**: `rork-platform/expo/app/**` (screen-by-screen code review, independently re-verified)

Tiers: Basic → Standard → Pro → Pro+ (frontend label `pro+`, backend `pro_plus`)

---

## 1. Confirmed mismatches — wrong tier boundary enforced

| # | File | Issue | Spec (backend) | Frontend actually does |
|---|------|-------|------|------------------------|
| 1 | `app/vendor/catalog/add-item.tsx` (`getMaxPhotos()`, ~line 55-60) | Photos-per-item limit hardcoded, doesn't match spec | 2 / 5 / 10 / 15 (Basic/Std/Pro/Pro+) | 1 / 3 / 5 / 8 |
| 2 | `app/vendor/settings/auto-accept-orders.tsx` (line 16, `isPlanGated`) | Auto-accept orders available one tier too early | Pro+ only (`canAutoAcceptOrders` is `true` only for `pro_plus` in backend) | `isPlanGated = plan === 'basic' \|\| plan === 'standard'` — Pro is NOT gated, so Pro vendors can enable it when they shouldn't be able to |
| 4 | `app/vendor/growth-insights.tsx` (line ~1092) | AI Business Insights monthly limit uses wrong scale | 1 / 3 / 10 / 25 | `standard→1, pro→2, pro+→3` (basic locked to 0) — confirmed via direct code read |
| 6 | `app/vendor/chats/[orderId].tsx` (lines 514, 550) | Invoice/receipt generation from chat blocks Basic entirely | Basic gets 3 invoices/month (`invoicesPerMonth: 3` in backend — allowed, just capped) | `if (plan === 'basic') { Alert 'Upgrade Required' }` — Basic blocked outright at both cited lines, confirmed verbatim |

---

## 2. Corrected findings — original audit mischaracterized these

These two items are real bugs, but the **original audit described the wrong mechanism**. Re-verification against the actual code found different (and in both cases, worse) behavior than originally reported.

| # | File | What v1 audit claimed | What the code actually does | Why it matters |
|---|------|------------------------|------------------------------|-----------------|
| 3 | `app/vendor/(tabs)/dashboard/index.tsx` (KPI row, ~line 843-887) | "Best Seller/Revenue widgets excludes Standard — only unlocks at Pro/Pro+ (`isPro` check)" | **No gating exists at all.** The Best Seller / Revenue KPI cards render unconditionally in the `ScrollView`, with zero `plan` or `isPro` check anywhere nearby. (The `isPro` variable at line 181 gates a separate "Insights" section further down the page, not this KPI row.) | Backend says Standard+ (`canViewBestSellerWidget`/`canViewRevenueCard`: `true` from `standard` up). Actual bug: **Basic vendors also see this widget**, not just "Standard is wrongly excluded." The fix needs to *add* a `standard`-or-above gate, not *loosen* an existing Pro-only gate. |
| 11 | `app/vendor/settings/promotions.tsx`, `PromoContext.tsx` | "`activePromotionsLimit` not enforced — Basic/Standard shouldn't have promotions at all, currently unrestricted" | **Not unrestricted.** `PromoContext.tsx` has `const MAX_ACTIVE_PROMOTIONS = 3;` — a flat constant applied identically to every plan, with zero reference to the `plan` variable anywhere in the file. | Backend: Basic/Standard should get **0**, Pro should get **10**, Pro+ should get **25**. Actual effect: Basic/Standard vendors get 3 promotions they're not entitled to at all; Pro/Pro+ vendors are capped at 3 when they should get far more (10/25). This is a plan-blind flat cap, not an absence of any cap. |

---

## 3. Confirmed — features exist but have zero plan enforcement

These screens/flows work identically regardless of vendor tier — no quota, no lock, no upgrade prompt. Independently re-verified: grep for `plan` in each file returned zero relevant matches.

| # | File(s) | Missing enforcement |
|---|---------|----------------------|
| 7 | `app/vendor/settings/minimum-order-amount.tsx` | Should be Standard+ only (`canSetMinimumOrderAmount`) — zero plan-related code in the file, available to everyone including Basic |
| 8 | `app/vendor/settings/business-policies.tsx` | Should be Standard+ only (`canSetBusinessPolicies`) — zero plan-related code in the file, available to everyone including Basic |
| 9 | `app/vendor/settings/create-invoice.tsx`, `invoices.tsx`, `send-invoice/[invoiceId].tsx` | No invoice-per-month quota (3/25/100/200), no invoice-history-window (30/180/548/1095 days), no PDF-download gate, no duplicate-invoice gate. Confirmed: `invoices.tsx` reads `plan` exactly once, only to drive `getBrandingUpgradePrompt()` — never for quota/history/PDF/duplicate logic. `create-invoice.tsx` has zero plan references at all. |
| 10 | Catalog screens generally | Catalog item **count** limit (10/30/100/250 — distinct from the photo-per-item limit in #1) isn't enforced anywhere. Confirmed: no `catalogItemLimit`, `MAX_ITEMS`, or equivalent constant exists anywhere in the catalog screens or `CatalogContext.tsx`. |
| 12 | `features/storefront/components/StorefrontCatalog.tsx`, `app/vendor/storefront-preview.tsx` ("Ask the platform AI" button) | `canShowAIButton` (false/true/true/true) and `aiRepliesPerMonth` (0/100/300/500) not enforced. Confirmed: the button text/CTA exists in both files with zero `plan` reference anywhere nearby. |

---

## 4. Confirmed correct — no action needed

| Item | File | Why it's fine |
|------|------|----------------|
| Business Analytics (all 9 metrics) | `app/vendor/growth-insights.tsx` (`isPro`, line 2044) | **Moved here from v1 audit's "mismatch" section after correction.** Frontend unlocks at Pro (`isPro = plan === 'pro' \|\| plan === 'pro+'`). Backend confirms: `canViewAdvancedAnalytics: true` for both `pro` and `pro_plus`. MVP_Features.pdf confirms: `Revenue Trend ❌ ❌ ✅ ✅` — Pro and Pro+ both checked, across all 9 metrics (Revenue Trend, Conversion Funnel, Customer Growth, Storefront Performance, Top Customers, Repeat Customer Analytics, Customer Source Breakdown, Orders by Source, Platform vs External Analytics). The v1 audit's claim that this "should be Pro+ only" was incorrect; frontend, backend, and spec all agree it unlocks at Pro. **No fix needed here — do not change this code.** |
| Auto-send pickup details | `app/vendor/settings/auto-send-pickup.tsx` | Correctly Pro+ only |
| Dashboard filter range (today/week/month/year) | `dashboard/index.tsx` lines 654-666 | Matches spec exactly per tier (`today`/`week`/`month`/`year` in backend `dashboardFilterRange`) |
| Invoice branding — logo, brand color, thank-you message, footer text, premium templates, print layout (6 of 8 sub-features) | `constants/documentBranding.ts` | **Corrected in v3 — see item #14 below.** These 6 fields match backend `DEFAULT_PLAN_LIMITS` exactly (Pro for brand color/thank-you/footer, Pro+ for premium templates and print layout). The remaining 2 of 8 sub-features (seasonal themes, QR code) do **not** exist on the frontend at all — moved to the confirmed-gaps list, not fully correct as originally stated. |
| Screenshot attachments on external orders (sub-feature only) | `app/vendor/orders/add-external.tsx` line 262 | Correctly Pro/Pro+ only. **Correction (v3):** the v2 note that base external-order access is "rightly ungated" was wrong — see item #13 below. This row now covers only the screenshot sub-feature gate, which is genuinely correct. |
| "Always-on" core features — Storefront, Vendor Verification, Customer Chat, Customer Ratings, base Orders access | `contexts/DiscoveryContext.tsx`, `VerificationContext.tsx`, `ChatContext.tsx`, `ReviewsContext.tsx`, `OrdersContext.tsx`, and related screens | Verified via full grep sweep — zero plan-gating code present anywhere in these, confirming they're correctly available to every tier as intended |

---

## 5. New gaps found in v3 — not in the original 12-item audit at all

These were found by working forward from the spec (checking every row of the MVP_Features.pdf tables against the frontend) rather than backward from a list of suspected bugs. Both were previously miscategorized as "confirmed correct" in earlier passes because a related sub-feature was checked but the base feature itself was not.

| # | File(s) | Issue | Spec (backend) | Frontend actually does |
|---|---------|-------|-----------------|--------------------------|
| 13 | `app/vendor/orders/index.tsx`, `app/vendor/orders/add-external.tsx` | Base access to external order creation has zero gating | `canAccessExternalOrders`: Standard+ only (`false` for `basic`) | No `plan` check anywhere on the navigation trigger (`orders/index.tsx` line 229, `router.push('/vendor/orders/add-external')` fires unconditionally) or at the top of `add-external.tsx`. `plan` is referenced exactly once in the whole screen (lines 261-262), only for the screenshot-attachment sub-feature. Any Basic vendor can currently create external orders — the entire feature, not just the screenshot part, was believed gated but isn't. |
| 14 | `constants/documentBranding.ts` | 2 of 8 invoice branding sub-features don't exist on the frontend at all | `canUseSeasonalThemes` and `canAddQrCode`: Pro+ only in backend | No `allowSeasonalThemes` or `allowQrCode` field exists anywhere in the `DocumentBranding` interface. Confirmed via full-repo search: zero references to seasonal themes or invoice/receipt QR codes anywhere in the frontend (the one QR-related match found, `invite-customers.tsx`, is an unrelated storefront-invite feature, not invoice branding). This isn't a wrong-tier bug like the others — the feature was never built on the frontend at all, so there's nothing to gate yet. |

---

## Summary of corrections from v1 → v2 → v3

**v1 → v2:**
- **1 item removed** from the "mismatch" list entirely: Business Analytics (#5 in v1) was a false positive. Frontend, backend, and the MVP spec all agree it unlocks at Pro. Moved to "confirmed correct."
- **2 items re-described**, not removed: Best Seller/Revenue widget (v1 #3) and Promotions limit (v1 #11) are both still real bugs, but the actual code does something different from — and in both cases more permissive/incorrect than — what v1 described.
- **9 items unchanged**, confirmed exactly as originally reported after independent re-verification.

**v2 → v3:**
- **2 items added** (#13, #14) that were never in the original 12-item list at all. Found by checking every row of the spec against the frontend, rather than only re-verifying items already suspected to be bugs.
- **2 "confirmed correct" claims narrowed**, not reversed: the invoice branding row and the external-orders row were each partially correct (a sub-feature was genuinely fine) but overstated as fully correct when a related base feature or set of fields was actually missing.

**Final count: 13 confirmed real issues** (4 wrong-tier-boundary bugs, 2 mischaracterized-but-real bugs, 5 zero-enforcement gaps, 2 newly found gaps), not 11 and not 12. One item (Business Analytics) should not be touched at all.

---

## Root cause

Every mismatch above traces back to one thing: the frontend has no single, shared plan-limits table. Each screen independently reimplements its own tier check (`plan === 'pro'`, hardcoded arrays like `[1,3,5,8]`, flat constants like `MAX_ACTIVE_PROMOTIONS = 3`, or nothing at all), so drift versus the backend's `DEFAULT_PLAN_LIMITS` was inevitable and will keep happening screen-by-screen unless fixed at the source.

## Proposed fix (not yet started — awaiting go-ahead)

Add `expo/constants/planLimits.ts` mirroring the backend's `PlanLimits` shape field-for-field (same pattern already used successfully for `documentBranding.ts`), with a single `getPlanLimits(plan): PlanLimits` function. Then wire each of the 13 confirmed items above to read from it instead of their own ad hoc logic — eliminating the possibility of frontend/backend drift going forward, since both sides trace back to the same feature matrix. Note that item #14 (seasonal themes / QR code) additionally requires building the missing UI, not just wiring a gate, since the feature doesn't exist on the frontend at all yet.
