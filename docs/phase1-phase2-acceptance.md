# Phase 1 and Phase 2 acceptance

Every acceptance criterion, the test or evidence that proves it, and how to run
that yourself.

Nothing here asks you to take a claim on trust. The suites run against the real
backend through the same callable functions the app uses, and the screenshots
come from driving the real app.

## How to run the tests

Two terminals.

```bash
# 1. Backend, from multivendor-marketplace-platform/
npx firebase-tools emulators:start --project demo-platform

# 2. Tests, from multivendor-marketplace-platform/scripts/
npm install          # first time only
node phase1-acceptance-tests.js
node phase2-acceptance-tests.js
```

Each prints one line per check and exits non-zero if any fail.

For the native run, from `this repo/`:

```bash
maestro test maestro/phase1-vendor-registration.yaml
```

## Criterion by criterion

| # | Criterion | Proven by | Status |
|---|---|---|---|
| 1 | Registration creates a real Firebase Auth account | Phase 1 tests 1, 11 | Passing |
| 2 | Correct user and vendor records created | Phase 1 tests 1, 3 | Passing |
| 3 | Basic plan and temporary username assigned | Phase 1 tests 2, 3 | Passing |
| 4 | Legal consent versions and timestamps stored | `legalAcceptance` on the user record | Built, verified end to end |
| 5 | Setup progress calculated from real backend data | Phase 1 tests 5, 6, 7, 8, 9 | Passing |
| 6 | New-vendor dashboard free of mock data | Fixed; verified on a fresh account | Passing |
| 7 | Category names shown, never ids or timestamps | Phase 2 setup requires a real category | Passing |
| 8 | Pending and rejected items unreachable by customers | Phase 2 tests 2, 12c | Passing |
| 9 | Approved items stay live while a revision is reviewed | Phase 2 tests 6, 7, 6b | Passing |
| 10 | Rejected revisions preserve the approved version | Phase 2 tests 9, 9b | Passing |
| 11 | Material and operational edits follow the right rules | Phase 2 tests 6, 10 | Passing |
| 12 | Works on iOS and Android | Both builds succeed; Android flow captured | Partial, see below |

### 1, 2, 3 — the account is real

Phase 1 test 1 registers a vendor with no business name and no chosen username,
then reads back `users/{uid}` and `vendors/{vendorId}`. Test 2 confirms the
system assigned a temporary username. Test 3 confirms the vendor role and that
`resolveEffectivePlan` returns Basic. Test 11 confirms a second registration on
the same email is rejected.

### 4 — legal consent

`completeRegistration` writes `users/{uid}.legalAcceptance`: the published
version of the Terms and the Privacy Policy, whichever agreement applies to the
role, the exact consent wording that was on screen, and a server timestamp.

Versions are read on the server, never accepted from the client, so a client
cannot claim a version it was not shown. An unpublished document records `null`
rather than defaulting to `1`: nobody can have agreed to a version that did not
exist, and inventing one would make the record worse than useless.

The record is written once and never updated, so publishing a new version of a
document leaves every existing acceptance untouched.

Verified by publishing Terms at version 3, registering through the app, and
reading the record back: `termsVersion: 3`, the vendor agreement field present
rather than the customer one, consent wording stored, server `acceptedAt`.

### 5 — setup progress

`getVendorOnboardingStatus` computes the checklist from the vendor's actual
records. Tests 6 to 9 cover the rules that matter: an incomplete vendor cannot
publish but can still register; a missing payment method deliberately does not
block publication; an item still under review does not count toward the publish
requirement; and an unverified vendor can publish but is excluded from
discovery.

### 6 — no mock data on a new dashboard

This one was wrong and is now fixed. The dashboard derived pending orders,
today's orders, completed orders and revenue from a seeded mock module, so a new
vendor saw another vendor's trading history and customer names. The insight
carousel was worse: `newCustomersThisWeek: 3`, `lowStockCount: 2` and
`avgResponseMinutes: 8` were hardcoded, so an account with no customers was told
it had gained three.

Orders are now scoped to the signed-in account, and the three invented figures
are gone. Verified by registering a fresh vendor and reading the dashboard:
orders today 0, pending 0, best seller "No sales yet", today's revenue ₦0, no
demo customer names, none of the invented insights.

### 8 to 11 — moderation

Phase 2's twenty checks cover the whole lifecycle plus four security properties
worth calling out:

- a vendor cannot approve their own item, directly or by injecting
  `moderationStatus` through `updateCatalogItem`
- a pending item is refused by the cart, not only hidden from browsing, because
  server-side code runs with admin privileges and bypasses Firestore rules
- a proposed revision is stored in a private subcollection outside the
  customer-readable document
- Firestore rules deny public reads of that subcollection

### 12 — iOS and Android

Both builds succeed, neither needs a paid store account, and both are under
Platform's Expo organisation. See `docs/native-builds.md`.

Phase 1 is captured on a real Android build in `docs/native-evidence/android/`,
including the two negative checks that matter most: no placeholder social
buttons on login, and no business name or category on the signup form.

**What is not covered natively:** the captures stop at submission. Completing
registration against a local Firebase emulator from inside the Android emulator
would not automate reliably on a Windows machine also running Metro, the
Firebase suite and two web dev servers, with Android intermittently raising its
own "System UI isn't responding" dialog. That is an environment limit, not an
app defect, and the account-creation path is covered by the suites above and by
the end-to-end web evidence in `docs/phase1-evidence/`.

iOS Simulator captures need macOS to drive, so they come from your Mac.

## Issues found and fixed along the way

Native-only, none able to surface in a web preview:

1. Nine packages behind their SDK requirement
2. Two versions of `expo-location` in the tree, which would have failed the
   native build outright
3. Duplicate `expo-constants` and `expo-font`
4. `.env` is gitignored and EAS honours `.gitignore`, so no Firebase config
   reached the build and the app would have thrown before rendering

`expo-doctor` now reports 18 of 18 checks passing, from two failing.

Found while verifying other things:

- Subscription payments displayed at a hundredth of their value, because the API
  sent major units while the portal divided by 100 like the minor-unit fields
  beside it
- The vendor chat list crashed on a cold load
- State and area were collected at customer registration and then discarded
- Customers were asked for their location twice
- The app said "Terms of Service" in five places while registration said
  "Terms of Use"

## Evidence index

| Folder | Contents |
|---|---|
| `docs/phase1-evidence/` | Registration end to end, 11 screenshots |
| `docs/phase2-evidence/` | Each moderation state, 5 screenshots |
| `docs/native-evidence/android/` | Phase 1 on a real Android build, 8 screenshots |
| `docs/native-builds.md` | Build profiles, commands, what needs which account |
| `multivendor-marketplace-platform/scripts/` | Both acceptance suites |
| `maestro/` | The native flows |
