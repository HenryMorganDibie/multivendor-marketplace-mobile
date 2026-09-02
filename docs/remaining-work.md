# Remaining work

One complete view, so nothing arrives one piece at a time.

Counts come from the repositories rather than from memory: 56 contexts in
`expo/contexts/`, checked for whether they call the backend and how many files
consume them. Anything described as done has a test suite named beside it.

## Where things stand

**85 automated checks pass** across eight suites, all runnable independently:

| Suite | Checks | Covers |
|---|---|---|
| `phase1-acceptance-tests.js` | 11 | Registration, onboarding, plan, username |
| `phase2-acceptance-tests.js` | 20 | Catalog moderation, four security properties |
| `location-endpoint-tests.js` | 12 | The 196-country catalogue and its validation |
| `sales-counting-tests.js` | 6 | What counts as a sale |
| `rate-limit-tests.js` | 7 | Write endpoint ceilings |
| `orphan-recovery-tests.js` | 10 | Half-finished registrations |
| `orders-wiring-tests.js` | 11 | The order lifecycle through the backend |
| `vendor-discovery-tests.js` | 8 | Customer-facing vendor listing |

```bash
# from platform-backend/, in one terminal
npx firebase-tools emulators:start --project demo-platform

# from platform-backend/scripts/, in another
node phase1-acceptance-tests.js      # and the seven others
```

## Frontend wiring

Twelve of the fifty-six contexts read the backend. **The other forty-four
mostly need nothing**: they hold local interface state — drafts, modals,
filters, toggles — which is what they should hold. Only the ten below still
serve real data from mock files.

### Still on mock data

| Context | Screens using it | Where it belongs |
|---|---|---|
| `VendorContext` | **83** | Not in any phase |
| `InvoiceContext` | 21 | **Phase 3**, priced |
| `ChatReadContext` | 6 | **Phase 7**, priced |
| `ChangeRequestsContext` | 3 | Orders-adjacent |
| `OrderCompletionContext` | 0 | Orders-adjacent |
| `AbandonedCartContext` | 0 | Orders-adjacent |
| `DiscoveryContext` | 0 | — |
| `AppointmentReminderContext` | 0 | — |

**`VendorContext` is the largest single item left.** Eighty-three files read it:
the vendor's own profile, settings, business hours, policies and storefront
details across the whole vendor app. It is not inside any of the eight phases,
and it is the one thing on this list that would be a genuine surprise later.

**Four contexts have no consumers at all** — `Discovery`, `AppointmentReminder`,
`OrderCompletion` and `AbandonedCart`. Nothing imports them. Wiring them would
be building something nothing calls, so the honest options are to delete them or
to leave them until a screen needs them. They are listed here so their absence
from any plan is a decision rather than an oversight.

## The eight frontend phases

| Phase | Price | Status |
|---|---|---|
| 1. Registration and onboarding | ₦80,000 | Done, paid, 11/11 |
| 2. Catalog moderation | ₦80,000 | Done, paid, 20/20 |
| 3. Invoice ledger and mobile wiring | ₦130,000 | Not started |
| 4. Storefront sharing | ₦60,000 | Not started |
| 5. Business Insights | ₦55,000 | Not started |
| 6. Dashboard Insight engine | ₦50,000 | **Partly done** |
| 7. Chat action sheets and Quick Note | ₦40,000 | Not started |
| 8. Username cooldown | ₦20,000 | Not started |

**₦355,000 remaining**, already agreed. No new quotes needed for any of it.

Phase 6 is partly delivered: the insight carousel's invented figures —
`newCustomersThisWeek: 3`, `lowStockCount: 2`, `avgResponseMinutes: 8`, all
hardcoded — were removed during Phase 1, since an account with no customers
being told it had gained three was a Phase 1 acceptance failure. What remains is
the engine that produces real ones.

## Delivered at no charge

Work that was outside the phases and has not been invoiced:

- The 1,304 area and city files in the location catalogue, plus the validator
  and the Firestore importer
- The location endpoints, the security rules on those collections, server-side
  validation at registration, and the app-side wiring
- The order wiring: live listener, repricing through the backend, status
  transitions, payment proofs
- Vendor discovery reading real vendors instead of mock records
- Rate limiting across fourteen write endpoints
- Registration recovery: resumable completion, the orphan sweep, admin cleanup

## Defects found and fixed, unbilled

Each of these was live:

| What | Why it mattered |
|---|---|
| Subscription payments displayed at a hundredth of their value | Every figure in billing history was wrong |
| Sales only counted for inventory-tracked items, which is off by default | The Popular tag was silently wrong for every service and made-to-order vendor |
| Vendor-recorded external orders counted as real sales | A vendor could manufacture their own Popular tag from numbers nobody verified |
| `resolveCountryCode` held two of 196 countries | Four of the six countries on the pricing page could never match a price |
| A vendor list query constrained one of the three fields its rule tests | Firestore refuses the whole query, so customer discovery would have been empty for everyone |
| `completeRegistration` rejected every retry | A part-failed signup was a permanent dead end with its email occupied forever |
| Two versions of `expo-location` in the tree | Would have failed the first native build outright |
| No Firebase config reached the build | The app would have thrown before rendering a single screen |
| The vendor chat list crashed on cold load | — |
| Registration collected state and area, then discarded them | Customers were asked for their location twice |
| "Terms of Service" in five places against "Terms of Use" at signup | Nobody could tell whether they were the same document |

## Not started, and not in any phase

Named here so they are not a surprise later.

**`VendorContext`**, above. Eighty-three screens.

**Deployment.** Nothing is deployed. The app runs against a local emulator,
which is why a build handed to someone else renders the interface but cannot
complete a registration. This is Milestone 6, priced at ₦250,000, and needs the
Firebase project access and billing enabled.

**Apple and Google sign-in.** The buttons are hidden because they were wired to a
placeholder that fabricated a local account. Quoted at ₦85,000 for the original
scope; the additional acceptance items added afterwards were quoted separately.

**The Popular tag to the agreed specification** — a rolling thirty-day window,
top three per vendor, backend-configurable thresholds, and reversing a sale when
a completed order is undone. There is no way to reverse a completed order today,
which is the bulk of that work.

**Native store release.** TestFlight, Play internal track, production signing
and store verification all need the paid Apple and Google accounts.

## What is genuinely blocked

| Blocked on | What it stops |
|---|---|
| Firebase project access and billing | Any deployment, and therefore any independent testing |
| Apple Developer Program | TestFlight, Sign in with Apple, production push |
| Google Play Console | Internal track, Play signing, Play Integrity |
| A written decision on Phases 3-8 | All remaining priced frontend work |
