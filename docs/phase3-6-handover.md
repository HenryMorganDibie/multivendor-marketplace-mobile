# Phase 3–6 handover

Everything checked, everything verifiable, and an honest account of what this
pass did and did not touch.

This covers the four phases already invoiced (₦295,000 total: Phase 3
₦130,000, Phase 4 ₦60,000, Phase 5 ₦55,000, Phase 6 ₦50,000). Unlike Phase 1–2,
no written proof-of-delivery existed for this work before now. This document
and `phase3-6-acceptance.md` are that proof, produced after the fact against
the real backend — not against a screen, and not against memory of what was
built.

Nothing in this document asks to be taken on trust. Every claim below has
either a test you can run and its real output, or a direct callable
invocation with its real returned data, captured verbatim in
`phase3-6-acceptance.md`.

## 1. Repositories and branches

| Repository | Branch | State |
|---|---|---|
| `this repo` | `henry/phase-1-registration` | 0 ahead/behind `origin` — the Phase 3–6 app code (InvoiceContext, VendorDashboardContext, growth-insights, the storefront lookup) is on this same branch and already pushed. Local working tree also has a further set of **uncommitted, in-progress edits** unrelated to this pass (mostly vendor settings screens and a few contexts) — not evaluated here; that is a separate, later commit for whoever is carrying that work. |
| `multivendor-marketplace-platform` | `main` | 0 ahead/behind `origin` — the Phase 3–6 Cloud Functions (`dashboardAnalytics.ts`, `dashboardInsights.ts`, `invoiceFunctions.ts`, `setVendorPublishStatus.ts`, the payment ledger) are already pushed. This pass adds two new files, untracked and **not committed by this pass** — see §7. |

There was no phase-3-6-specific branch to check out; the backend and mobile
code for these phases landed on the same branches Phase 1–2 used.

## 2. Test suites

| Suite | Checks | Result | New in this pass? |
|---|---|---|---|
| `scripts/phase3-ledger-tests.js` | 12 | All passing | No — pre-existing, run as instructed |
| `scripts/invoice-delivery-tests.js` | 15 | All passing | No — pre-existing, found and run for completeness |
| `scripts/phase4-storefront-tests.js` | 13 | All passing | **Yes** |
| `scripts/phase5-6-insights-tests.js` | 29 | All passing | **Yes** |

```bash
# terminal 1, from multivendor-marketplace-platform/
npx firebase-tools emulators:start --project demo-platform

# terminal 2, from multivendor-marketplace-platform/scripts/
npm install                          # first run only
node seed-demo-vendor.js             # phase3/invoice-delivery need the seeded vendor
node phase3-ledger-tests.js
node invoice-delivery-tests.js
node phase4-storefront-tests.js
node phase5-6-insights-tests.js
```

Each prints one line per check and exits non-zero if anything fails. All four
call the same Cloud Functions the app calls, against the emulator, signed in
as real (emulator) Firebase Auth accounts.

**A fifth existing script, not usable as-is:** `milestone4-acceptance-tests.js`
also exercises `downloadInvoicePdf`, `updateInvoiceBranding` and
`getPublicInvoice`, which would have covered "PDF generation with branding"
and "external share link" directly. Its own setup routine calls
`setVendorPublishStatus({isPublished:true})` before creating a catalog item —
the current publish gate (business name + category + one **approved** item)
rejects that order, so the script now fails before its first real check runs.
This is the test script's setup order being stale against the current publish
rule, not a backend defect: the same rule is exercised and confirmed correct
in `phase4-storefront-tests.js` checks 1–3. Rather than rewrite a script
outside this task's assignment, those two Phase 3 criteria were verified
directly (see `phase3-6-acceptance.md` §"PDF, branding and the external
link") with real, verbatim output. Fixing `milestone4-acceptance-tests.js`
itself is a five-minute reorder for whoever owns that suite, not done here to
keep this pass to its assigned scope.

## 3. Builds

**None produced in this pass.** The Phase 1–2 iOS Simulator and Android
builds in `docs/native-builds.md` predate the Phase 3–6 code and demonstrate
nothing about it. No new EAS build was requested or made here.

## 4. Recordings and screenshots

**None exist for Phase 3–6.** `maestro/phase3-6-acceptance.yaml` (the intended
client-facing UI flow) has not been run. `evidence/record-phase3-6.js` — a
Playwright script that drives the app's **web build against a real deployed
`platform-dev` environment** (not the emulator) and records a continuous
session — exists but requires `platform-dev` credentials and a running `expo
start --web` session, neither available in this pass. This is the same gap
named in the task: the UI-level flow still needs a connected device/emulator
(or, per its own setup notes, a real `platform-dev` deployment) to produce
actual screenshots, and that remains true after this pass. Everything in this
handover was verified at the backend-callable level, not the screen level.

## 5. Documentation

| File | Covers |
|---|---|
| `docs/phase3-6-acceptance.md` | Each criterion mapped to the test or direct call that proves it |
| `multivendor-marketplace-platform/scripts/phase4-storefront-tests.js` | New — storefront publish/unpublish gating and public resolution |
| `multivendor-marketplace-platform/scripts/phase5-6-insights-tests.js` | New — dashboard and Business Insights figures, fresh vs. active vendor |
| `maestro/phase3-6-acceptance.yaml` | The intended native flow — not run, see §4 |

---

## 6. What is still mock, hardcoded, disconnected, or otherwise worth knowing

This is the part worth reading carefully.

### The backend is solid where it was tested

All four Phase 3–6 acceptance criteria groups pass against the real emulator
backend — see the criterion table in `phase3-6-acceptance.md`. No hardcoded
figure reappeared anywhere checked: `getDashboardInsights` returns `null` for
every field a vendor with no data hasn't earned, and a vendor with real
orders gets real numbers that differ from the three exact historical
constants (`newCustomersThisWeek: 3`, `lowStockCount: 2`,
`avgResponseMinutes: 8`) named in `remaining-work.md`.

### The mobile app IS wired for these phases — verified against `expo/`, not the repo root

`this repo`'s own `README.md` states plainly: **"Everything real lives
inside `expo/`... always edit inside `expo/`, never the root-level copies, or
changes will silently diverge."** The repository root (`app/`, `contexts/`,
`data/`, etc.) is a near-duplicate the Rork platform's sync mechanism leaves
behind, and it lags badly — e.g. the root's `contexts/InvoiceContext.tsx` is
a 4.5&nbsp;KB stub untouched since before Phase 3 started, while
`expo/contexts/InvoiceContext.tsx` is 44&nbsp;KB and current. An earlier draft
of this investigation nearly reported the storefront share link as
unconnected mock data on the strength of the root copy alone; it is not — the
real (`expo/`) copy is correctly wired. **Every wiring claim below was checked
against `expo/`.** Anyone auditing this app later should do the same, or risk
the same false alarm.

With that said, confirmed wired to the real backend in `expo/`:

- `contexts/InvoiceContext.tsx` — ten real callables: `createInvoice`,
  `duplicateInvoice`, `updateInvoice`, `updateInvoiceStatus`,
  `downloadInvoicePdf`, `deleteInvoice`, `getPublicInvoice`,
  `sendInvoiceInChat`, `recordPayment`, `reversePayment`.
- `contexts/InvoiceBrandingContext.tsx` and `lib/invoices/uploadInvoiceLogo.ts`
  — `updateInvoiceBranding`.
- `contexts/VendorOnboardingContext.tsx` — `setVendorPublishStatus`.
- `lib/storefront/shareStorefront.ts` — builds the real
  `https://example.com/store/{username}` link and refuses to share one for a
  vendor that isn't published.
- `services/repositories/vendorRepository.ts` — resolves a vendor by username
  or slug through a Firestore query that **correctly restates all three of the
  security rule's own conditions** (`verificationStatus == 'approved'`,
  `vendorStatus == 'active'`, `isDiscoverable == true`) alongside the lookup
  field. Its own comment explains why: a query that only filters on the
  lookup field is rejected outright by Firestore, regardless of the target
  document's actual data — see the note on this in
  `phase3-6-acceptance.md`. This is exactly right, and it's why
  `phase4-storefront-tests.js` had to be corrected mid-writing to use the same
  shape.
- `contexts/VendorDashboardContext.tsx` — `getVendorDashboard`.
- `app/vendor/growth-insights.tsx` — `getBusinessAnalytics` via
  `lib/analytics/useBusinessAnalytics.ts`, with a local-only fallback for the
  demo logins and the moment before the first server response. Storefront
  visits and conversion rate are rendered as absent (`null`), matching the
  backend's `dataPending`, not the `orders * 12 + 47` invented figure the code
  comments describe having removed.
- `app/vendor/(tabs)/dashboard/index.tsx` — `getDashboardInsights`.

Not checked in this pass beyond what's listed above: the rest of the
Business Insights screen's charts/breakdowns, and the "AI Insights" /
"Smart Insights" card content on `growth-insights.tsx`, which is a separate,
explicitly-mock, out-of-phase AI feature (`aiInsightsLimit` is a "gate
reserved, enforced in a future AI phase" per the plan-limits code) — not part
of what Phases 5–6 were priced for.

### A real gap found in `seed-demo-vendor.js`, not in the product

The seed script's own comment says it will "Verify + publish so the
storefront/plan screens look real," but the code only verifies — it never
calls `setVendorPublishStatus`. Worse, it couldn't succeed if it tried: the
seed never gives the demo vendor a catalog item, and publishing requires one
approved item. Right now, fresh off `seed-demo-vendor.js`, `demo.vendor@
example.com` is verified and has an active Pro plan but is **not published**
and **not discoverable**. This is a seed-script gap (confirmed by
`phase4-storefront-tests.js`, which works around it by building its own
vendor fixtures rather than relying on the demo vendor for the publish path),
not a defect in `setVendorPublishStatus` or the discoverability rule — both
are proven correct by the same test.

### The Firestore list-query behaviour worth remembering

Documented in `phase3-6-acceptance.md` in detail: an unauthenticated,
single-field `where("username","==",x)` query against `vendors` is **denied
outright by Firestore, regardless of the target document's real field
values**, because the query alone can't prove to the rules engine that every
possible result would pass `isDiscoverableVendor()`. Restating the rule's own
three conditions as explicit filters is what makes it work. The app already
does this correctly (see above); this cost real debugging time while writing
`phase4-storefront-tests.js` and is recorded here so it doesn't cost anyone
else that time again.

### Repo housekeeping, not code

Both `multivendor-marketplace-platform` and `this repo` currently have local,
**uncommitted** changes beyond what this pass added — pre-existing before this
session started, not diagnosed here, and not this task's to resolve. See §1
and §7.

---

## 7. Confirmation

This pass did not commit or push anything, per instruction — Henry reviews
and commits separately. What exists on disk right now, uncommitted:

- `multivendor-marketplace-platform/scripts/phase4-storefront-tests.js` (new)
- `multivendor-marketplace-platform/scripts/phase5-6-insights-tests.js` (new)
- `this repo/docs/phase3-6-handover.md` (this file, new)
- `this repo/docs/phase3-6-acceptance.md` (new)

No app code was modified to make any test pass. Where a script's own
assumption about a response shape was wrong, the script was corrected (see
the Firestore list-query note above); where a real gap was found
(`seed-demo-vendor.js`, `milestone4-acceptance-tests.js`'s setup order), it is
reported above rather than patched.
