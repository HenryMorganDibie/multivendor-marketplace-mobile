# Phase 1 and Phase 2 handover

Everything delivered, everything verifiable, and an honest account of what is
still not connected.

Nothing in this document asks to be taken on trust. Every claim has either a
test you can run, a screenshot, or a commit.

## 1. Repositories and branches

| Repository | Branch | State |
|---|---|---|
| `this repo` | `henry/phase-1-registration` | Pushed, PR open |
| `multivendor-marketplace-platform` | `main` | Pushed |
| `multivendor-marketplace-platform (website/)` | `main` | Pushed |
| `multivendor-marketplace-platform (vendor-portal/)` | `main` | Pushed |

Pull request: **`YourOrg/this repo` #1**

Everything is in Platform-owned repositories under the `YourOrg` organisation.
Nothing exists only on a local machine. Working trees are clean in all four.

## 2. Test suites

| Suite | Checks | Result |
|---|---|---|
| `scripts/phase1-acceptance-tests.js` | 11 | All passing |
| `scripts/phase2-acceptance-tests.js` | 20 | All passing |
| `scripts/sales-counting-tests.js` | 6 | All passing |

```bash
# terminal 1, from multivendor-marketplace-platform/
npx firebase-tools emulators:start --project demo-platform

# terminal 2, from multivendor-marketplace-platform/scripts/
npm install                          # first run only
node seed-demo-vendor.js             # Phase 2 needs the seeded vendor
node phase1-acceptance-tests.js
node phase2-acceptance-tests.js
node sales-counting-tests.js
```

Each prints one line per check and exits non-zero if anything fails. They call
the same Cloud Functions the app calls.

## 3. Builds

Both produced under the `platform-technologies` Expo organisation. Neither needed
the Apple Developer Program or Google Play Console.

| Platform | Profile | Download |
|---|---|---|
| iOS Simulator | `ios-simulator-standalone` | `expo.dev/artifacts/eas/XM5AswEl5RMf-BVDFdpXVHN3DpQeZFMJBbLEKQ_J3ZA.tar.gz` |
| Android | `android-preview` | `expo.dev/artifacts/eas/Sa91bqnT7OGvvMNiMySlzog881-JvxVYrcqZQNeh-Hs.apk` |

Both have the JavaScript bundled, so they open without a development server.
Build profiles and commands are in `docs/native-builds.md`.

## 4. Recordings and screenshots

| Location | Contents |
|---|---|
| `docs/backend-proof/` | One continuous recording: a vendor registered through the app, then the database opened in the same session showing the records it created |
| `docs/phase1-evidence/` | Registration end to end, 11 screenshots |
| `docs/phase2-evidence/` | Each moderation state, 5 screenshots |
| `docs/native-evidence/android/` | Phase 1 on a real Android build, 8 screenshots |

## 5. Documentation

| File | Covers |
|---|---|
| `docs/phase1-phase2-acceptance.md` | Each acceptance criterion mapped to the test that proves it |
| `docs/native-builds.md` | Build profiles, exact commands, which store account each task needs |
| `docs/backend-proof/README.md` | Why the handover build cannot reach a backend on another machine |
| `docs/native-evidence/README.md` | What the native captures cover and what they do not |
| `maestro/` | The automated native flows |

---

## 6. What is still mock, hardcoded or disconnected

This is the part worth reading carefully. It is a complete answer, not a
flattering one.

### The headline number

The app has **56 React contexts**. **6** talk to Firebase:

`CatalogContext`, `ChatContext`, `CustomerSupportChatContext`, `InboxContext`,
`PromoContext`, `VendorSupportChatContext`.

The other 50 hold state in memory only. **123 files** still import from
`mocks/`, and **13 contexts** are seeded from mock data at startup:

`AbandonedCartContext`, `AppointmentReminderContext`, `ChangeRequestsContext`,
`ChatReadContext`, `DiscoveryContext`, `InvoiceContext`,
`OrderCompletionContext`, `OrdersContext`, `VendorFilterContext`,
`VendorRelationshipContext`, and others.

The backend exports **53 callable functions**. Most have no caller in the app.

### Specific items

**Orders are not wired.** `OrdersContext` seeds from `mocks/ordersData`. It is
now scoped so only the demo test logins receive that data and a real account
starts empty, which is why a new vendor's dashboard reads zero rather than
showing another vendor's trading history. But accepting, rejecting and
completing an order still does not reach the backend.

**Locations are hardcoded.** The app ships **16 countries** and **136 areas**
written into `constants/`, placed there in March. The Firestore catalogue has
**196 countries**, 59 state files and 1,304 area files. Nothing reads it.

**`resolveCountryCode` has two entries.** The pricing page offers six countries.
Four of them send a country code that cannot match a pricing record. This is a
live defect in Milestone 4 work and will be fixed at no charge.

**The Popular tag is computed in the app**, from a lifetime order counter, using
a top-20% rule. It does not match the definition agreed on 29 July: at least 10
completed internal orders in a rolling 30 days, top 3 per vendor. Two underlying
defects were fixed on 29 July — the counter previously only incremented for
items with inventory tracking enabled, and vendor-recorded external orders
counted as sales.

**No reversal path exists.** A completed order cannot be undone, so a reversed
sale cannot decrement the counter.

**Apple and Google sign-in are hidden** behind `SOCIAL_AUTH_ENABLED` in
`constants/authProviders.ts`. The buttons were wired to a placeholder that waited
900ms and fabricated a local account. Hidden, not deleted; the markup returns
when the real flow exists.

**The backend is not deployed.** It runs on the Firebase emulator. This is why
the handover builds show errors on any machine that is not running it, and why
the recording in `docs/backend-proof/` exists.

**26 pre-existing TypeScript errors** in the mobile app, none introduced by this
work and none in Phase 1 or Phase 2 code.

### Not started from the client's 29 July UI brief

Delivered: account-selection wording and check indicator, login password
show/hide, the trust row, "Log in" as the verb, "Terms of Use" consistently,
the highlight labels and the trimmed helper text.

Outstanding: progressive location reveal, location sheet loading and retry
states (which need the backend endpoints above), scroll to first invalid field,
the vendor onboarding information card, and the seven state captures on both
platforms.

---

## 7. Confirmation

No uncommitted Platform changes. No files that exist only on a local machine. All
four working trees clean, all branches pushed, all documentation and evidence in
the repositories listed above.
