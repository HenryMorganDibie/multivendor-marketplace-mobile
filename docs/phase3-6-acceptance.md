# Phase 3–6 acceptance

Every acceptance criterion, the test or direct call that proves it, and how
to run that yourself.

Nothing here asks you to take a claim on trust. The suites run against the
real backend through the same callable functions the app uses. Where no
persistent script covers a criterion, the exact call and its real returned
data are given below instead of a screenshot of a screen.

## How to run the tests

Two terminals.

```bash
# 1. Backend, from platform-backend/
npx firebase-tools emulators:start --project demo-platform

# 2. Tests, from platform-backend/scripts/
npm install                # first time only
node seed-demo-vendor.js   # phase3-ledger and invoice-delivery need this vendor
node phase3-ledger-tests.js
node invoice-delivery-tests.js
node phase4-storefront-tests.js
node phase5-6-insights-tests.js
```

Each prints one line per check and exits non-zero if any fail.
`phase4-storefront-tests.js` and `phase5-6-insights-tests.js` register their
own throwaway vendors and do not depend on the seed having run.

For the native run, once a device/emulator and a `platform-dev` deployment are
available (neither was in this pass — see the handover doc §4):

```bash
maestro test maestro/phase3-6-acceptance.yaml
```

## Criterion by criterion

| # | Phase | Criterion | Proven by | Status |
|---|---|---|---|---|
| 1 | 3 | Invoice can be created and edited | `invoice-delivery-tests.js` 1–4 | Passing |
| 2 | 3 | Invoice delivered into internal chat, with server-assembled figures | `invoice-delivery-tests.js` 8–14 | Passing |
| 3 | 3 | Recording a payment | `phase3-ledger-tests.js` 2–7 | Passing |
| 4 | 3 | Reversing a payment | `phase3-ledger-tests.js` 8–10 | Passing |
| 5 | 3 | Revenue reads the ledger once, never double-counts an order+invoice | `phase3-ledger-tests.js` 1 | Passing |
| 6 | 3 | External share link works with no account, and branding travels with it | Direct call, see below | Passing |
| 7 | 3 | PDF generation carries real branding | Direct call, see below | Passing |
| 8 | 4 | Publishing is gated on the real backend, not the client | `phase4-storefront-tests.js` 1–3 | Passing |
| 9 | 4 | Publish/unpublish actually changes what an unauthenticated caller can read | `phase4-storefront-tests.js` 4, 6, 8–10 | Passing |
| 10 | 4 | The share link resolves to the correct real vendor, never another one, with no account | `phase4-storefront-tests.js` 7, 11, 12 | Passing |
| 11 | 5 | Business Insights figures come from this vendor's own orders, not another's or invented | `phase5-6-insights-tests.js` 22–28 | Passing |
| 12 | 5 | Facets with no tracking infrastructure stay honestly absent, not fabricated | `phase5-6-insights-tests.js` 29 | Passing |
| 13 | 6 | Dashboard insight carousel: absence for a vendor with nothing yet | `phase5-6-insights-tests.js` 1–9 | Passing |
| 14 | 6 | Dashboard insight carousel: real figures for an active vendor, isolated from other vendors | `phase5-6-insights-tests.js` 11–21 | Passing |
| 15 | 6 | The three historical hardcoded figures do not reappear | `phase5-6-insights-tests.js` 3, 4, 7, 12, 13, 16 | Passing |
| 16 | 3–6 | Works on iOS and Android (native UI flow) | Not run this pass | **Not covered — see below** |

### 1–2 — invoice create, edit, chat delivery

`invoice-delivery-tests.js` (pre-existing, not written by this pass) covers
the behaviour a vendor would notice: an undelivered draft can have its items
and total changed (check 1); a **sent but unpaid** invoice can still be
revised, and revising a delivered invoice stamps `revisionCount` and
`revisedAt` so the customer's copy shows it changed (checks 2, 2.1); anything
with a payment against it refuses all edits (check 4); a draft nobody has
seen deletes outright, a delivered or paid one refuses deletion and only
accepts cancellation (checks 5–7).

Delivery: `sendInvoiceInChat` posts an actual message of type `invoice` into
the conversation, assembled server-side from the stored invoice rather than
anything the client supplied (checks 8–10); the invoice is bound to the
conversation afterwards so "Open chat" has something to open (check 11);
sending the same invoice twice does not duplicate the card (check 12); a
vendor cannot send another vendor's invoice or post into a conversation that
isn't theirs (checks 13–14).

### 3–5 — payment, reversal, no double counting

`phase3-ledger-tests.js`, already reviewed and run as instructed, unmodified.
The headline check (1) creates a completed order, raises an invoice from it
carrying the order's id, records one payment, and confirms
`getVendorRevenue` moved by exactly the payment amount — not twice. Checks
2–3 prove idempotency (a retried `recordPayment` with the same key returns
`alreadyRecorded: true` and writes one row). Checks 4–7 prove partial and
overpayment are recorded with a derived balance and status, never refused.
Checks 8–10 prove a reversal keeps the original row (a correction, not a
deletion) and refuses to reverse more than remains. Checks 11–12 prove
`updateInvoiceStatus` can no longer set `"paid"` by hand, and a vendor cannot
touch another vendor's invoice.

### 6–7 — external link and PDF branding

No persistent script currently exercises these two callables successfully.
`milestone4-acceptance-tests.js` does, but its own setup order predates the
current publish gate and now fails before reaching them (see the handover
doc §2). Verified directly instead, against the seeded demo vendor, in this
pass:

```
updateInvoiceBranding({ brandColor: "#1A2B3C", thankYouMessage: "Thanks for your business!" })
  → { success: true }

downloadInvoicePdf({ invoiceId: <demo vendor's unpaid invoice> })
  → fileName "P3D-....pdf", 1580 bytes, first 5 bytes "%PDF-"

getPublicInvoice({ shareToken: <that invoice's real shareToken> })   // called from a
                                                                       // client that never signed in
  → success: true, shareToken NOT present in the returned invoice object,
    branding.brandColor "#1A2B3C", branding.thankYouMessage "Thanks for your business!"

getPublicInvoice({ shareToken: <the demo vendor's cancelled invoice's token> })
  → denied, code "failed-precondition"  (cancelled invoices revoke the public link)
```

This confirms: the link needs no account (a second Firebase app instance
that never authenticated made the call and got real data back), branding
travels with the invoice rather than requiring a separate authenticated
fetch, the `shareToken` itself is stripped from the response, and a
cancelled invoice's link is revoked rather than still serving content — all
four are real behaviours of `getPublicInvoice` in
`platform-backend/functions/src/invoices/invoiceFunctions.ts`, not assumptions.

### 8–10 — storefront publish, unpublish, and the share link

`phase4-storefront-tests.js`, written for this pass. Three things proven,
not just observed on a screen:

**Eligibility is real, not client-trusted** (checks 1–3): calling
`setVendorPublishStatus({isPublished:true})` directly against a vendor
missing business details/category/an approved item is refused with
`failed-precondition` — there is no way to reach a published state by
skipping the UI, because the server re-derives eligibility itself from
`resolveOnboardingStatus`. Once the same vendor genuinely has a business
name, category and one **approved** catalog item, the identical call
succeeds.

**Publish/unpublish actually changes public readability** (checks 4, 6, 8–10):
a published-but-unverified vendor is confirmed still not discoverable
(`isDiscoverable: false`) — publishing and being discoverable are different
flags, computed by the `onVendorWrite` trigger from `isPublished && isVerified
&& vendorStatus === 'active' && countryOpen`. Once verified, the same
already-published vendor becomes discoverable, and an unauthenticated read —
by username query or direct `vendorId` `getDoc` — is refused before that
point and succeeds after. Unpublishing flips it back, and the same
unauthenticated read is refused again.

**The share link resolves to the correct real vendor, not another one**
(checks 7, 11, 12): the unauthenticated lookup returns exactly one document,
whose id and `businessName` match the vendor that was actually published — and
a second, separate, never-published vendor's username never resolves,
proving the mechanism discriminates rather than returning "any vendor."

A concrete Firestore behaviour surfaced while writing this: a bare
`where("username","==",x)` query from an unauthenticated client is **denied
outright**, independent of whether the target document would actually pass
the security rule. Firestore's list-query rule check validates the query's
own filters, not the real data of whatever document would be returned — so a
query has to restate all three of `isDiscoverableVendor()`'s own conditions
(`verificationStatus == 'approved'`, `vendorStatus == 'active'`,
`isDiscoverable == true`) alongside the lookup field before Firestore will
run it at all. This is not a defect: the app's real, current implementation
(`expo/services/repositories/vendorRepository.ts`) already does exactly
this, with a comment explaining why. `phase4-storefront-tests.js`'s own
lookup helper had to be corrected to the same shape mid-development — first
written with just the username filter, which failed every case including
ones that should have succeeded, until the query was corrected to match what
the rule actually requires.

Role check, not incidental: a signed-in customer (not a vendor at all) is
refused `setVendorPublishStatus` outright (check 13).

### 11–12 — Business Insights

`phase5-6-insights-tests.js` checks 22–29, against a Pro-plan vendor with two
completed orders (₦170.00 combined) from two distinct customers, and a
second, entirely separate vendor holding one ₦9,999.99 order that must never
surface in the first vendor's numbers. It never does: `revenueTrend`'s entry
for today sums to exactly 17,000 (kobo) — the first vendor's total, not
1,016,999 — `topCustomers` contains exactly the first vendor's two customers
and never the second vendor's, and `ordersBySource.internal` counts 3, not 4.
`repeatCustomerAnalytics` and `customerGrowth` are both genuinely computed
(no `dataPending`) with the right distinct-customer counts, while
`conversionFunnel`, `storefrontPerformance` and `customerSourceBreakdown`
stay `dataPending: true` — there is no storefront-visit tracking to compute
them from, and the code says so rather than inventing a number. A Basic-plan
vendor is refused `getBusinessAnalytics` entirely with `permission-denied`,
not answered with empty data (check 10).

### 13–15 — dashboard insight carousel

`phase5-6-insights-tests.js` checks 1–21. A brand-new vendor gets `null` for
every figure it hasn't earned — `newCustomersThisWeek`, `lowStockCount`,
`outOfStockCount`, `bestSellerName`/`bestSellerCount`, `avgResponseMinutes` —
and `0` (not `null`, not absent) for counts that are genuinely zero, like
`pendingPaymentCount` and `ordersToday`. An active vendor with two low-stock
fixtures, one accepted-unpaid order and a catalog item with a real
`orderCount` gets `pendingPaymentCount: 1`, `newCustomersThisWeek: 2`,
`lowStockCount: 1`, `outOfStockCount: 1`, and a best seller matching its own
catalogue — while a second vendor's much larger, distinctive order and
catalogue item never appear in any of it. `avgResponseMinutes` stays `null`
even for the active vendor: nothing computes it yet, and the code says so in
a comment rather than guessing.

Checks 3, 4, 7 (fresh vendor) and 12, 13, 16 (active vendor) specifically
assert against the three exact historical constants named in
`remaining-work.md` — `newCustomersThisWeek: 3`, `lowStockCount: 2`,
`avgResponseMinutes: 8` — deliberately choosing fixture data that produces
*different* real numbers (2 and 1, not 3 and 2) so a regression back to a
hardcoded value could not coincidentally look like a correct computation.

`getVendorDashboard`'s own revenue figure is also proven ledger-backed, not
order-derived, independently of `phase3-ledger-tests.js`: check 21 records a
new ₦123.45 payment and confirms `todayRevenue` moves by exactly that amount
on the very next call — this endpoint has its own `sumLedger` read
(`dashboardAnalytics.ts`), separate code from `getVendorRevenue`, so it needed
its own proof rather than inheriting Phase 3's.

### 16 — native UI flow

**Not covered by this pass, stated directly.** `maestro/phase3-6-acceptance.yaml`
describes the full client-facing flow — branding, invoice create/edit/send,
external link, payment, reversal, PDF, storefront publish/share, dashboard,
Business Insights, the honest "Conversion" empty state — in the order the
states actually allow. It has not been run. `evidence/record-phase3-6.js`,
the Playwright driver for it, needs a **real deployed `platform-dev`**
environment and vendor credentials, not the local emulator this pass used;
neither was available here. Everything in this document was verified at the
callable level, against the emulator, signed in as real (emulator) accounts
— which is real proof that the backend and the wired frontend paths behave
correctly, but it is not the same evidence as a recorded device session, and
this document does not claim it is.

## Issues found along the way

1. **`seed-demo-vendor.js`** claims in a comment that it verifies and
   publishes the demo vendor; it only verifies. It also never gives the demo
   vendor a catalog item, so publishing it would fail even if attempted — the
   current publish gate requires one approved item. Confirmed by
   `phase4-storefront-tests.js`, which builds its own vendor fixtures rather
   than relying on the demo vendor for the publish path.
2. **`milestone4-acceptance-tests.js`**'s setup calls
   `setVendorPublishStatus({isPublished:true})` before creating a catalog
   item — the reverse of what the current publish gate requires — so the
   whole script now fails in its setup step before any of its ~100+ checks
   run. Not a backend defect: the same gate is proven correct in
   `phase4-storefront-tests.js`. This script needs its setup reordered by
   whoever owns it; not done here, to keep this pass to its assigned scope.
3. **Firestore's list-query rule evaluation** denies a query outright when
   it can't prove every possible result would pass the security rule from the
   query's own filters alone — it does not fall back to checking the actual
   returned document's data the way a single-document `get()` does. Cost real
   time while writing `phase4-storefront-tests.js`'s lookup helper; documented
   above and in the handover doc so it doesn't cost anyone else that time.

## Evidence index

| Location | Contents |
|---|---|
| `platform-backend/scripts/phase3-ledger-tests.js` | Pre-existing, unmodified, run for this pass |
| `platform-backend/scripts/invoice-delivery-tests.js` | Pre-existing, run for this pass |
| `platform-backend/scripts/phase4-storefront-tests.js` | New this pass |
| `platform-backend/scripts/phase5-6-insights-tests.js` | New this pass |
| `maestro/phase3-6-acceptance.yaml` | The intended native flow — not run, see §16 above |
| `platform-mobile/docs/phase3-6-handover.md` | Repo/branch state, what's wired, what isn't, what was found |
