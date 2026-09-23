# Platform — Frontend (Mobile App)

A cross-platform (iOS / Android / Web) multi-vendor marketplace app: customers discover and order from vendors, vendors manage catalog/orders/invoices/subscriptions, and there's an in-app admin surface. Built with Expo + Expo Router on top of the [Rork](https://rork.com) platform.

**Backend:** [`multivendor-marketplace-platform`](https://github.com/HenryMorganDibie/multivendor-marketplace-platform) — Firebase (Firestore, Cloud Functions, Auth, Storage). Most of the app is now wired to it for real — see [Backend integration status](#backend-integration-status) below for exactly what's live versus what's still mock, screen by screen.

**Brand color:** `#FF7A28` — canonical Platform orange, defined in `expo/constants/colors.ts` and `expo/constants/theme.ts`. Use this consistently across the landing page and any new web interfaces; don't introduce a second orange.

---

## Payment Requests — current spec and contract

Payment Requests was built against a spec Founder wrote on 2026-08-31, quoted here for reference:

> For MVP, I don't want a manual admin approval workflow for payment methods. A vendor should be able to set one current payment method at a time: Bank transfer, or Cash. If they choose bank transfer, they enter their bank/payment instructions and confirm that the information is correct and belongs to them/their business. Once they save/confirm it, that becomes their active payment method and can be used immediately in payment requests. It does not need to sit in an admin queue waiting for a Platform team member to approve it. If they replace their payment method later, the new saved method becomes the current active method. We don't need a vendor-facing list of multiple saved methods for MVP. Also, I don't think we should call the method "approved" in the product if Platform isn't actually verifying ownership of the bank account. "Active," "confirmed," or "saved" would be more accurate. So for Send Payment Request, the vendor's current active payment method should be shown automatically. There doesn't need to be a payment-method picker if only one can be active at a time. One important thing: if the vendor hasn't set up a payment method yet and taps Send Payment Request, the app should tell them they need to set one up first and direct them to the appropriate setup screen rather than allowing a broken/no-op action. And just to keep the MVP distinction clear: recording/confirming that a customer has paid is separate from the vendor's saved payment method. Saving bank details does not itself mean Platform has verified or processed the customer's payment.

What's built follows this closely: no admin-approval queue, one active `paymentInstructions` value at a time, an ownership-confirmation checkbox on save, activates immediately, status labels read "Active"/"Confirmed" rather than "approved," Send Payment Request shows the current instructions automatically with no picker, and directs to the setup screen if none exists yet rather than a no-op. The one difference from the wording above is the "Bank transfer, or Cash" type choice — what's built is a single free-text field covering either, not a type selector.

Current contract: `updateVendorPaymentInstructions` accepts one field, free text, capped at 200 characters — no bank name, account number, or type flag. A redesign that adds structured fields or a type selector would need a matching backend change.

Separately, a structured "Payment Method" system (bank/cash type selection, an admin-approval change-request flow, change history — the `payment-methods.tsx`/`request-payment-change.tsx` screens) was priced independently at ₦120,000, later ₦165,000, shown to Founder but not yet agreed or paid. It's distinct scope from Payment Requests. See the "Payment requests & payment instructions" section in `multivendor-marketplace-platform`'s README for the full technical writeup, including the 2026-09-18 security fix.

---

## Repo layout — read this first

```
this repo/
├── rork.json          # Rork platform config — declares "expo" as the app path
├── expo/               # ⭐ THE ACTUAL APP — everything below lives here
│   ├── app/            # Screens (Expo Router, file-based routing)
│   ├── components/     # Shared UI components
│   ├── contexts/        # ~47 React contexts — app state, one per domain
│   ├── services/        # Service → Repository → Mapper layers (see below)
│   ├── constants/       # Colors, theme, pricing, plan-gating tables
│   ├── backend/         # A small tRPC/Hono API (separate from multivendor-marketplace-platform Firebase Functions — see note below)
│   ├── BACKEND_INTEGRATION_GUIDE.md   # ⭐ Read before wiring anything to Firebase
│   └── README.md        # Generic Expo/Rork run & deploy instructions
├── app/, components/, contexts/, ...   # ⚠️ Root-level duplicates, see below
└── backend/             # ⚠️ Root-level duplicate of expo/backend/
```

**Everything real lives inside `expo/`.** `rork.json` declares it explicitly (`"path": "expo"` for both the "Platform" and "Platform Vendor" app entries), and it's the only directory with a `package.json`/`app.json` — nothing at the repo root is independently runnable.

**The root-level `app/`, `components/`, `contexts/`, etc. are a near-duplicate of the contents of `expo/`**, committed in the same commits as their `expo/` counterparts (confirmed via `git log`). This is a known artifact of the Rork platform's sync/export mechanism, not something introduced or maintained by hand — **always edit inside `expo/`**, never the root-level copies, or changes will silently diverge between the two trees.

There is also a small **tRPC/Hono API** at `expo/backend/` (routes for abandoned-cart nudges, appointment reminders, notifications) — this is a lightweight app-side API layer, **separate and unrelated to `multivendor-marketplace-platform`** (the real Firebase backend). Don't confuse the two when reading code that imports from `@/backend`.

---

## Tech stack

- **Expo SDK 54** + **Expo Router 6** (file-based routing, all platforms from one codebase)
- **React 19.1** / **React Native 0.81.5**
- **TypeScript**
- **tRPC + Hono** — the small app-side API mentioned above (not the Firebase backend)
- **React Query** (`@tanstack/react-query`) — server state
- **Zustand** — client state (used alongside the context-per-domain pattern)
- **AsyncStorage** — local persistence (today's stand-in for Firestore; see integration guide)
- **Lucide React Native** — icons

Package manager is **Bun**, not npm/yarn (`bun i`, `bun run start`).

---

## Running it

```bash
cd expo
bun i
bun run start-web       # instant web preview, auto-reloading
# or
bun run start            # then press "i" for iOS Simulator, or scan the QR code with Expo Go
```

See `expo/README.md` for the full run/build/deploy instructions (App Store, Google Play, web hosting) — that content is generic Expo/Rork platform documentation and is accurate as-is, so it isn't duplicated here.

---

## Architecture: Service → Repository → Mapper

This is the pattern every domain (vendors, orders, chat, invoices, subscriptions, etc.) follows, and it's the reason backend integration is a scoped, low-risk swap rather than a rewrite:

```
Screen / Context
      │  calls a service method (stable public API — never changes)
      ▼
Service            expo/services/*Service.ts
      │  delegates to a repository
      ▼
Repository         expo/services/repositories/*Repository.ts   ← the ONLY integration surface
      │  reads raw data (today: mock/AsyncStorage; tomorrow: Firestore)
      ▼
Mapper             expo/services/mappers/*Mapper.ts
      │  normalizes raw docs → domain types, translates enum vocabulary at the boundary
      ▼
Domain types       expo/types/domain/*
```

**The golden rule** (from `BACKEND_INTEGRATION_GUIDE.md`): integrate at the repository layer only. If wiring Firebase requires touching a screen or context, the seam is in the wrong place — stop and fix the repository instead. Every repository file has `TODO(Henry)` comments marking the exact swap points.

13 services / 11 repositories / 10 mappers exist today, covering vendor, catalog, cart, order, chat, notification, subscription, verification, support, auth, and user domains. Full coverage table and the Firestore collection-path mapping the repositories are expected to target: see `expo/BACKEND_INTEGRATION_GUIDE.md` §1–6.

### What's routed through the full stack, read and write
Auth (real Firebase Auth, not a local session), vendor discovery and storefront, cart pricing (`repriceCart` — the backend prices the basket, not the client), placing an order (`createOrderFromCart`/`createExternalOrder`) and the order lifecycle (accept/reject/status), chat send and receive, catalog (create/update/moderation/category management, including real category deletion), vendor verification (submission and admin decisions), ratings, payment proof submission, invoices, and subscriptions (read). Order-status changes and verification decisions also trigger real in-app notifications now, not just a local toast.

**Since 2026-08-26**, most of what this section previously listed as still-mock has been wired for real: support tickets (contact support, feedback, verification support), category deletion, checkout/cart totals and add-on pricing, invoice payment recording, promotions display on cart/item/storefront, receipts (reading the real backend receipt instead of a fabricated one), payment requests (`sendPaymentRequestInChat`, dropped the fake mock payment-method picker for a real preview of the vendor's actual payment instructions), order-scoped delivery contact at checkout, business hours/weekly-hours persistence, storefront authoritative settings, and the customer/vendor real-time chat inbox (see Chat & messaging fixes below — this one took several passes). See "Fixes and hardening since 2026-08-26" further down for the full, dated list.

### What's still incomplete or unmerged

- **External Orders** — recording a basic order (customer name, catalog items, pickup/delivery) is real and live, and has since gained a proper Draft lifecycle (drafts never enter analytics/revenue/inventory until real submission) with idempotent submission (a stable `submissionId` survives a crash or lost response between backend success and local cleanup, confirmed against the real, live `createExternalOrder` server-side idempotency support). Manual/custom line items, delivery/service fee, discount, tax, fulfillment date/time, and screenshot attachments are still blocked at Save with an honest "not supported yet" message, because the backend doesn't accept them yet — that part of the gap is unchanged.
- **Partner Program** — a complete, production-quality frontend (customer + vendor) exists on the unmerged branch `claude/partner-program-mobile`, with zero backend behind it yet; see `docs/PARTNER_PROGRAM_MOBILE_HANDOFF.md` on that branch for the exact backend gap. Still unmerged as of this update.
- **Admin Console (Milestone 5)** — separate repo, backend not started; see `multivendor-marketplace-platform`'s README.
- **Invoice, Receipt, and Custom Order entry points from the chat action sheets** were deliberately hidden (not removed) 2026-09-15, per Founder: Custom Order requirements aren't finalized (revisit post-MVP), and the chat-based Invoice/Receipt flows aren't finalized either — standalone invoice functionality elsewhere in the app is unaffected. All handlers, destination screens, and backend remain in place, just unreachable from those two menus.

This list reflects what's been directly verified as of 2026-09-18, not an exhaustive line-by-line re-audit of every screen — if you find something here that's stale, it's worth a quick grep before trusting it either way. See `BACKEND_INTEGRATION_GUIDE.md` for the fuller per-repository breakdown, which predates most of the wiring above and is due its own refresh.

---

## Backend integration status

Most of the app now talks to `multivendor-marketplace-platform`/Firebase for real — see the two lists directly above for what's live versus what's still mock or unmerged. This matters for anyone reviewing screens expecting real behavior: a screen looking "done" visually still doesn't guarantee it's wired, so check the lists above (or grep for the relevant repository/service file) rather than assume from the UI alone.

A few contract details worth knowing before wiring begins (from a joint review against `multivendor-marketplace-platform`'s actual Cloud Functions contracts, Feb 2026). **Two of these have since been resolved** (noted inline) as subscriptions moved from a local-storage scaffold to reading the real backend — left in place rather than deleted, since the reasoning behind each is still worth knowing:

- **Plan tier naming:** the app's internal label is `'pro+'`; the backend stores `'pro_plus'`. Always translate at the boundary via `subscriptionMapper.toBackendTier`/`fromBackendTier` — never let `'pro+'` leak into a Firestore write or `'pro_plus'` leak into UI.
- **Invoice branding fields are now aligned with the backend's `updateInvoiceBranding` callable**: `footerText` (not `footerNote`), `templateId` as an extensible string (`'default' | 'classic' | 'modern' | ...`, not an entitlement name like `'premium'`), and `businessAddress` is deliberately **not** part of the invoice branding contract — many vendors operate from home, and a private/verification address must never appear on a public invoice by default. See `constants/documentBranding.ts`.
- **Document branding tier gating matches the backend feature matrix**: brand color, thank-you message, and footer text are all available from **Pro** (not Pro Plus — this was previously mismatched for footer text and has been corrected). Premium templates, seasonal themes, QR code, and print layout remain **Pro Plus** only.
- ~~**The subscription domain model needs a larger rework when wiring happens**, not just a repository swap.~~ **Resolved.** `VendorPlanContext.refreshSubscriptionStatus()` now reads the real `getSubscriptionStatus` response shape (`effectivePlan`, granular `planLimits`, `subscription`, `reason`, `pendingDowngrade`, `recentEvents`) for real.
- ~~**`subscriptionService.setTier()` currently lets the client freely set its own plan tier** with zero validation.~~ **Resolved.** `setTier()`/`setBackendTier()` have been removed entirely — a plan can now only ever change as a side effect of reading a real `vendorSubscriptions/{vendorId}` document, never a local write.
- **No backend schema exists yet for multi-country/multi-currency pricing or "founder" (launch-sale) pricing**, both of which are already built into the frontend (`constants/vendorPricing.ts` — 11 countries, 4 pricing bands, `regular`/`founder` price pairs). The backend currently only stores a single flat NGN price per plan. If this pricing strategy is confirmed, the backend schema needs new fields before real checkout can reflect it — flagging this so it isn't discovered mid-integration.
- **Username management fields live inside the subscription context** (`VendorPlanContext`/`VendorPlanData` bundles `username`, `systemGeneratedUsername`, `usernameChangeHistory` alongside plan data) even though username changes are an unrelated backend concern (`changeUsername`). Worth separating during integration so the subscription context doesn't own unrelated state.

If you find another frontend/backend contract mismatch while integrating, flag it and fix the design rather than silently working around it in a repository — that's the standing instruction from the last full contract review, and it's cheaper than debugging the inconsistency later.

---

## Apple & Google native in-app purchases

**Apple (iOS): built and live.** `react-native-iap` wired into `upgrade-plan.tsx` (`useApplePurchase.ts`) replaces `createSubscriptionCheckout`'s hosted payment page on iOS entirely — App Store guidelines require a digital subscription like this to go through StoreKit, not an external checkout URL. Flow: `getOrCreateAppleAppAccountToken` fetches the vendor's real UUID token (StoreKit requires `appAccountToken` to be a UUID; this app's own vendor ID isn't one) → `requestPurchase` hands off to StoreKit's native purchase sheet → on success, `verifyAppleTransaction` fetches the transaction directly from Apple by id and activates the plan immediately rather than waiting on Apple's async server notification → `finishTransaction` always runs regardless of that outcome, or an unfinished transaction replays on every future launch. Web and Android are unaffected. One flagged, unresolved compatibility note: `react-native-iap`'s own `package.json` declares a peer dependency on Expo ^57, this project is on Expo ~54 — installed with `--legacy-peer-deps`, type-checks and autolinks fine, but has not yet been run in an actual EAS build.

**Google (Android): built, deliberately gated off.** `useGooglePurchase.ts` mirrors the Apple flow structurally — one real simplification, Google's `obfuscatedAccountId` has no UUID format requirement, so the vendor ID is passed directly, no token-minting step needed. Deliberately does **not** fire unconditionally the way iOS unconditionally uses StoreKit: gated behind `GOOGLE_PURCHASE_CONFIGURED`, currently off, since the real Play Console products don't exist yet (Apple's do). Real Android vendors use the existing hosted-checkout path today — a live, in-use path via EAS's `android-dev`/`android-preview` build profiles, not a placeholder — and routing Android into an unconfigured native purchase flow would have silently broken subscribing on Android entirely the moment this shipped. Falls through to checkout until Founder creates the real Play Console products and the flag flips.

`ITSAppUsesNonExemptEncryption: false` is declared in `app.json` (standard HTTPS/TLS only, no proprietary cryptography) — required before a real App Store submission is accepted; the EAS build flagged its absence.

This is the mobile-side counterpart to `multivendor-marketplace-platform`'s Apple/Google subscription backend (also scaffolded, also blocked on the same store setup) — see that repo's README for the server side of this same integration.

## Fixes and hardening since 2026-08-26

Roughly 90 commits landed between this document's previous update and now. The headline items (backend wiring completion, payment requests, native IAP, External Orders drafts) are covered above; this section covers everything else, grouped by area rather than commit, found mostly through direct client review and several full-app audit passes rather than a single planned pass.

**Chat & messaging** took the largest number of individual passes of any area. Real vendor/customer chats never appeared in the Inbox at all for a while — `InboxContext`'s subscription effect closed over `user` at mount time, before Firebase Auth had resolved, so the role check permanently disagreed with which side a conversation should insert into; fixed by reading auth state through a ref that stays current. Alongside that: chat messages sending twice on both order-chat screens, every vendor pre-order message sending twice, duplicate-row races in the inbox, every real commerce chat misfiling as a pre-order inquiry, customers unable to start a conversation from a cold deep link, a messaging-a-new-vendor race (thread created before Auth was ready), three separate chat-thread ID/resolution defects, chat filter pills overflowing on narrow screens, short messages collapsing to a fixed narrow width, and archived chats reading from demo fixtures instead of the real inbox (later decoupled from live pagination entirely). Pickup-details address resolution across current/legacy vendor location schemas was also fixed twice (address source, then chat payload mapping).

**Catalog, ratings, and search.** Add-on groups could never be saved at all — a field-name mismatch between the app's shape and the backend's (`heading`/`isRequired`/`price` vs. `name`/`required`/`priceModifier`) that had no translation layer on either side. Hiding/showing a catalog item spammed the moderation queue with fake pending revisions on every toggle, since the update payload always re-sent every field, changed or not. Category rename was a pure local `setState` that never called the backend and reverted on the next snapshot — now wired for real. Username search matched almost any plain word (including the search screen's own suggested chips), returning "not found" for ordinary keyword searches. `hasRating` was never mapped from the real order document, so an already-rated order kept re-prompting and hard-failing against the backend's own duplicate guard; the vendor ratings breakdown page looked up the vendor's name in mock data, always missing for a real vendor. Vendor promotions never appeared on cart/item/preview screens despite the real backend already having them (Milestone 4 scope, not new).

**Orders, checkout, and dashboards.** Checkout showed a lower total than the customer was actually charged. Invoice payment recording used the wrong display units and rejected valid payment methods. `canMarkInProgress` checked for a status (`'confirmed'`) the backend's real transition map never actually writes, so the Mark In Progress button could never appear for any order, internal or external. The reject/cancel reason a vendor or customer provides is now read back onto the order instead of being silently dropped, and the invoice due date is now forwarded to `createInvoice` instead of being silently swallowed. External orders were invisible to every dashboard aggregate metric (Total Revenue, Total Orders, Platform vs. External) since Record External Order wrote to the real backend but the dashboard only read the old local store; Storefront Performance rendered a blank number and a bare "%" for Pro/Pro+ vendors instead of the honest "not tracked yet" message its sibling metric already showed. Plan comparison screens still showed external-order recording as Basic-unavailable after that gate had already been fixed elsewhere; invoice history showed the wrong retention duration for Basic and Pro; the cancel-subscription modal always said "Keep Pro+" regardless of the vendor's actual plan.

**Auth & privacy.** Device-local caches (`VendorContext`, `CartContext`, `VendorPlanContext`, `BlockedUsersContext`, `ContactCardsContext`) were persisted under a single device-global AsyncStorage key with no uid in it — on a shared device, one account signing in right after another signed out could briefly render, or overwrite, the previous account's cached vendor profile, cart, plan, blocked-users list, and saved contact cards (real name/phone/address). Every one of those contexts now keys its storage by the current uid and resets in-memory state the instant the authenticated identity changes, rather than waiting for a screen reload. Registration now collects a customer's full last name at signup instead of just an initial — this is what makes the matching `multivendor-marketplace-platform` fix (truncating a customer's name to first-name-plus-last-initial before a vendor ever sees it) actually protect something; previously it was accepting only an initial anyway, so there was nothing to truncate. `submitDeliveryContact` now treats a retry that hits an already-exists response as success rather than an error. Orphaned-account cleanup was reading a stale `currentUser` reference instead of the just-created user.

**Settings & storefront.** Password & Security was fully fake for customers — no validation, no Firebase call, a false success message. Change/Remove Photo on the customer profile was a dead tap behind a fully built action sheet, now wired to the real Storage path and a real `photoURL` field. `updateVendorStorefront`'s Website/Instagram/TikTok links, and business hours/weekly-hours persistence, are now wired to the matching real backend fields (see `multivendor-marketplace-platform`'s README for the server side).

**Deliberate MVP scope trims (Founder's calls, not gaps).** Invoice, Receipt, and Custom Order entry points were hidden from the chat action sheets pending finalized requirements (2026-09-15) — see "What's still incomplete" above; nothing was deleted. Ask Platform AI was hidden from the customer storefront for MVP.

**Infrastructure.** `platform-dev.web.app` now auto-deploys on every push to `main` that touches `expo/**` (hosting only, deliberately — backend Cloud Functions remain a manual, reviewed deploy step, never auto-deployed).

## Branding

Primary color `#FF7A28` (`Colors.primary`) is used consistently across buttons, focus states, active tab indicators, and links — see `expo/constants/colors.ts` for the full palette (semantic tokens for text, surface, border, status colors, etc.) and `expo/constants/theme.ts` for the same tokens organized as reusable style objects. Use these tokens rather than hardcoding hex values in new screens.

Document (invoice/receipt) branding is plan-gated separately from the app's own theming — see `expo/constants/documentBranding.ts` and the Backend integration status section above.
