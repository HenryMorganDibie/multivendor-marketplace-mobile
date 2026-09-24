# Multi-Vendor Marketplace — Mobile App

A cross-platform (iOS / Android / Web) app for the marketplace: customers discover and order from vendors, vendors manage their catalog/orders/invoices/subscriptions, and there's an in-app admin surface. Built with Expo + Expo Router on top of the [Rork](https://rork.com) platform.

**Backend:** [`multivendor-marketplace-platform`](https://github.com/HenryMorganDibie/multivendor-marketplace-platform) — Firebase (Firestore, Cloud Functions, Auth, Storage). Most of the app is wired to it for real; see [Backend integration status](#backend-integration-status) below for exactly what's live versus what's still local-only, screen by screen.

**Brand color:** `#FF7A28`, defined in `expo/constants/colors.ts` and `expo/constants/theme.ts` — used consistently across every screen and the web build, rather than a second orange creeping in somewhere.

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
│   ├── backend/         # A small tRPC/Hono API (separate from the Firebase backend — see note below)
│   ├── BACKEND_INTEGRATION_GUIDE.md   # ⭐ Read before wiring anything to Firebase
│   └── README.md        # Generic Expo/Rork run & deploy instructions
├── app/, components/, contexts/, ...   # ⚠️ Root-level duplicates, see below
└── backend/             # ⚠️ Root-level duplicate of expo/backend/
```

**Everything real lives inside `expo/`.** `rork.json` declares it explicitly, and it's the only directory with a `package.json`/`app.json` — nothing at the repo root is independently runnable.

The root-level `app/`, `components/`, `contexts/`, etc. are a near-duplicate of `expo/`'s contents, a known artifact of the Rork platform's own sync/export mechanism rather than anything maintained by hand — always edit inside `expo/`, never the root-level copies, or changes silently diverge between the two trees.

There's also a small tRPC/Hono API at `expo/backend/` (routes for abandoned-cart nudges, appointment reminders, notifications) — a lightweight app-side API layer, separate and unrelated to the Firebase backend. Don't confuse the two when reading code that imports from `@/backend`.

---

## Tech stack

- **Expo SDK 54** + **Expo Router 6** (file-based routing, all platforms from one codebase)
- **React 19.1** / **React Native 0.81.5**
- **TypeScript**
- **tRPC + Hono** — the small app-side API mentioned above (not the Firebase backend)
- **React Query** (`@tanstack/react-query`) — server state
- **Zustand** — client state (used alongside the context-per-domain pattern)
- **AsyncStorage** — local persistence (today's stand-in for Firestore where a domain isn't wired yet)
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

See `expo/README.md` for the full run/build/deploy instructions (App Store, Google Play, web hosting) — that's generic Expo/Rork platform documentation and is accurate as-is.

---

## Architecture: Service → Repository → Mapper

This is the pattern every domain (vendors, orders, chat, invoices, subscriptions, etc.) follows, and it's the reason swapping a domain from local storage to a real backend is a scoped, low-risk change rather than a rewrite:

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

**The rule this depends on:** integrate at the repository layer only. If wiring a real backend to a domain requires touching a screen or a context, the seam is in the wrong place — the fix is in the repository, not the call site. Every repository file has a `TODO` comment marking the exact swap point.

13 services / 11 repositories / 10 mappers exist today, covering vendor, catalog, cart, order, chat, notification, subscription, verification, support, auth, and user domains. Full coverage table and the Firestore collection-path mapping repositories are expected to target: see `expo/BACKEND_INTEGRATION_GUIDE.md` §1–6.

### What's routed through the full stack, read and write

Auth (real Firebase Auth, not a local session), vendor discovery and storefront, cart pricing (the backend prices the basket, not the client), placing an order and the order lifecycle, chat send and receive, catalog (create/update/moderation/category management), vendor verification, ratings, payment-proof submission, invoices, and subscriptions. Order-status changes and verification decisions trigger real in-app notifications, not just a local toast.

### What's still local-only or unmerged

- **External Orders** — recording a basic order (customer name, catalog items, pickup/delivery) is real and live, with a proper draft lifecycle (drafts never enter analytics/revenue/inventory until real submission) and idempotent submission (a stable submission id survives a crash or lost response between backend success and local cleanup). Manual/custom line items, delivery/service fees, discounts, tax, and screenshot attachments are still blocked with an honest "not supported yet" message, since the backend doesn't accept them yet.
- **Partner Program** — a complete, production-quality frontend (customer and vendor sides) exists on an unmerged branch, with no backend behind it yet.
- **Admin console** — a separate project; its backend hasn't started.

## Backend integration status

Most of the app talks to the real backend now — see the lists above for what's live versus local-only. Worth knowing before assuming from the UI: a screen looking finished visually doesn't guarantee it's wired to anything real, so it's worth checking the relevant repository/service file rather than assuming from appearance alone.

A few frontend/backend contract details worth knowing:

- **Plan tier naming:** the app's internal label is `'pro+'`; the backend stores `'pro_plus'`. Always translate at the boundary — never let one leak into the other.
- **Invoice branding fields** are aligned with the backend's real callable contract: `footerText` (not `footerNote`), an extensible `templateId` string rather than an entitlement name, and business address is deliberately **not** part of the invoice-branding contract — many vendors operate from home, and a private/verification address should never appear on a public invoice by default.
- **Document branding tier gating** matches the backend's real feature matrix: brand color, thank-you message, and footer text are available from the mid tier; premium templates, seasonal themes, QR code, and print layout remain top-tier only.
- **No backend schema yet for multi-country/multi-currency pricing or launch-sale pricing**, both already built into the frontend (11 countries, 4 pricing bands, regular/launch price pairs). The backend currently stores a single flat price per plan — flagging this so it's not discovered mid-integration if that pricing strategy gets built out.
- **Username-management fields live inside the subscription context** even though username changes are an unrelated backend concern — worth separating out during a future pass so the subscription context doesn't own unrelated state.

## Apple & Google native in-app purchases

**Apple (iOS): built and live.** `react-native-iap` wired into the plan-upgrade screen replaces a hosted checkout page on iOS entirely — App Store guidelines require a digital subscription like this to go through StoreKit, not an external checkout URL. Flow: fetch the vendor's real UUID purchase token (StoreKit requires `appAccountToken` to be a UUID; an internal database id isn't one) → hand off to StoreKit's native purchase sheet → on success, verify the transaction directly against Apple's API and activate the plan immediately rather than waiting on an async server notification → always finish the transaction regardless of outcome, or an unfinished one replays on every future launch. Web and Android are unaffected.

**Google (Android): built, deliberately gated off.** Mirrors the Apple flow structurally, with one real simplification — Google's account-id field has no UUID format requirement, so the vendor id is passed directly, no token-minting step needed. Deliberately doesn't fire unconditionally the way iOS does: gated behind a feature flag, off until real Play Console products exist. Falls through to the existing hosted-checkout path until then, rather than routing Android into an unconfigured native flow and silently breaking subscribing on Android.

`ITSAppUsesNonExemptEncryption: false` is declared in `app.json` (standard HTTPS/TLS only, no proprietary cryptography) — required before a real App Store submission is accepted.

This is the mobile-side counterpart to the backend's own Apple/Google subscription scaffolding — see that repo's README for the server side.

## Notable fixes & hardening

A representative sample of real defects found and fixed across the project — grouped by area rather than by commit, mostly through direct review and full-app audit passes rather than a single planned sweep.

**Chat & messaging** took the most individual passes of any area. Real vendor/customer chats didn't reliably appear in the inbox for a while — a subscription effect closed over the current user at mount time, before auth had resolved, so the role check permanently disagreed with which side a conversation should insert into; fixed by reading auth state through a ref that stays current instead. Alongside that: messages sending twice on order-chat screens, duplicate-row races in the inbox, real commerce chats misfiling as pre-order inquiries, customers unable to start a conversation from a cold deep link, and archived chats reading from demo fixtures instead of the real inbox.

**Catalog & ratings.** Add-on groups couldn't be saved at all — a field-name mismatch between the app's shape and the backend's, with no translation layer on either side. Toggling a catalog item's visibility spammed the moderation queue with fake pending revisions on every toggle, since the update payload always re-sent every field whether it changed or not. Category rename was a pure local state update that reverted on the next snapshot, never actually persisted.

**Orders & dashboards.** Checkout showed a lower total than the customer was actually charged. A status check referenced a transition the backend's real state machine never actually writes, so a legitimate action button could never appear for any order. External orders were invisible to every dashboard aggregate metric, since recording one wrote to the real backend but the dashboard only read the old local store.

**Auth & privacy.** Several device-local caches were persisted under a single device-global storage key with no user id in it — on a shared device, one account signing in right after another signed out could briefly render, or overwrite, the previous account's cached profile, cart, and saved contact details. Every one of those caches now keys its storage by the current user id and resets in memory the instant the authenticated identity changes.

**Settings & storefront.** Password & security settings were fully fake for customers — no validation, no real call, a false success message. Profile photo change was a dead tap behind a fully built UI, now wired to real storage.

**Infrastructure.** The web build now auto-deploys on every push to `main` that touches the app (hosting only, deliberately — backend deploys remain a manual, reviewed step, never automatic).

## Branding

Primary color `#FF7A28` is used consistently across buttons, focus states, active tab indicators, and links — see `expo/constants/colors.ts` for the full palette (semantic tokens for text, surface, border, status colors) and `expo/constants/theme.ts` for the same tokens as reusable style objects. Prefer these tokens over hardcoding hex values in new screens.

Document (invoice/receipt) branding is plan-gated separately from the app's own theming — see `expo/constants/documentBranding.ts`.
