# the platform — Frontend (Mobile App)

A cross-platform (iOS / Android / Web) multi-vendor marketplace app: customers discover and order from vendors, vendors manage catalog/orders/invoices/subscriptions, and there's an in-app admin surface. Built with Expo + Expo Router on top of the [Rork](https://rork.com) platform.

**Backend:** [`the platform-backend`](https://github.com/the platformTech/the platform-backend) — Firebase (Firestore, Cloud Functions, Auth, Storage). This repo is currently **not wired to it yet** — see [Backend integration status](#backend-integration-status) below before assuming any screen reflects real data.

**Brand color:** `#FF7A28` — canonical the platform orange, defined in `expo/constants/colors.ts` and `expo/constants/theme.ts`. Use this consistently across the landing page and any new web interfaces; don't introduce a second orange.

---

## Repo layout — read this first

```
the platform-mobile/
├── rork.json          # Rork platform config — declares "expo" as the app path
├── expo/               # ⭐ THE ACTUAL APP — everything below lives here
│   ├── app/            # Screens (Expo Router, file-based routing)
│   ├── components/     # Shared UI components
│   ├── contexts/        # ~47 React contexts — app state, one per domain
│   ├── services/        # Service → Repository → Mapper layers (see below)
│   ├── constants/       # Colors, theme, pricing, plan-gating tables
│   ├── backend/         # A small tRPC/Hono API (separate from the platform-backend Firebase Functions — see note below)
│   ├── BACKEND_INTEGRATION_GUIDE.md   # ⭐ Read before wiring anything to Firebase
│   └── README.md        # Generic Expo/Rork run & deploy instructions
├── app/, components/, contexts/, ...   # ⚠️ Root-level duplicates, see below
└── backend/             # ⚠️ Root-level duplicate of expo/backend/
```

**Everything real lives inside `expo/`.** `rork.json` declares it explicitly (`"path": "expo"` for both the "the platform" and "the platform Vendor" app entries), and it's the only directory with a `package.json`/`app.json` — nothing at the repo root is independently runnable.

**The root-level `app/`, `components/`, `contexts/`, etc. are a near-duplicate of the contents of `expo/`**, committed in the same commits as their `expo/` counterparts (confirmed via `git log`). This is a known artifact of the Rork platform's sync/export mechanism, not something introduced or maintained by hand — **always edit inside `expo/`**, never the root-level copies, or changes will silently diverge between the two trees.

There is also a small **tRPC/Hono API** at `expo/backend/` (routes for abandoned-cart nudges, appointment reminders, notifications) — this is a lightweight app-side API layer, **separate and unrelated to `the platform-backend`** (the real Firebase backend). Don't confuse the two when reading code that imports from `@/backend`.

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

### What's already routed through the full stack (read paths)
Vendor discovery, vendor storefront menu, vendor verification status, notifications (read), subscription/plan tier (read). Swapping these repositories' internals to Firestore is a pure, isolated change.

### What's NOT yet routed (still reads mock/AsyncStorage/context state directly)
Cart, orders (list/detail), chat, support, auth — and **every write/mutation flow across the whole app** (place order, send message, upgrade plan, submit verification, etc. all still mutate local state directly). See `BACKEND_INTEGRATION_GUIDE.md` §14 for the full list and recommended integration order.

---

## Backend integration status

**Nothing in this app talks to `the platform-backend`/Firebase yet.** All data is mock data or AsyncStorage-persisted local state. This matters for anyone reviewing screens expecting real behavior — a screen looking "done" visually does not mean it's connected to anything real.

A few contract details worth knowing before wiring begins (from a joint review against `the platform-backend`'s actual Cloud Functions contracts, Feb 2026):

- **Plan tier naming:** the app's internal label is `'pro+'`; the backend stores `'pro_plus'`. Always translate at the boundary via `subscriptionMapper.toBackendTier`/`fromBackendTier` — never let `'pro+'` leak into a Firestore write or `'pro_plus'` leak into UI.
- **Invoice branding fields are now aligned with the backend's `updateInvoiceBranding` callable**: `footerText` (not `footerNote`), `templateId` as an extensible string (`'default' | 'classic' | 'modern' | ...`, not an entitlement name like `'premium'`), and `businessAddress` is deliberately **not** part of the invoice branding contract — many vendors operate from home, and a private/verification address must never appear on a public invoice by default. See `constants/documentBranding.ts`.
- **Document branding tier gating matches the backend feature matrix**: brand color, thank-you message, and footer text are all available from **Pro** (not Pro Plus — this was previously mismatched for footer text and has been corrected). Premium templates, seasonal themes, QR code, and print layout remain **Pro Plus** only.
- **The subscription domain model needs a larger rework when wiring happens**, not just a repository swap. Today's `Subscription` type (`tier`, `brandingEnabled`, `cancellationScheduled`, `cancellationDate`, `founderPricingEligible`) doesn't resemble the backend's `getSubscriptionStatus` response shape (`effectivePlan`, a ~25-field granular `planLimits` object, `subscription`, `reason`, `pendingDowngrade`, `recentEvents`). Budget real design time for this one, not a quick swap.
- **`subscriptionService.setTier()` currently lets the client freely set its own plan tier** with zero validation — correct for a local-storage scaffold, but this exact pattern must never survive into the real integration (a client-settable plan tier would be a critical billing-bypass bug). Plan changes must only ever result from a real payment provider webhook or an explicit backend admin action.
- **No backend schema exists yet for multi-country/multi-currency pricing or "founder" (launch-sale) pricing**, both of which are already built into the frontend (`constants/vendorPricing.ts` — 11 countries, 4 pricing bands, `regular`/`founder` price pairs). The backend currently only stores a single flat NGN price per plan. If this pricing strategy is confirmed, the backend schema needs new fields before real checkout can reflect it — flagging this so it isn't discovered mid-integration.
- **Username management fields live inside the subscription context** (`VendorPlanContext`/`VendorPlanData` bundles `username`, `systemGeneratedUsername`, `usernameChangeHistory` alongside plan data) even though username changes are an unrelated backend concern (`changeUsername`). Worth separating during integration so the subscription context doesn't own unrelated state.

If you find another frontend/backend contract mismatch while integrating, flag it and fix the design rather than silently working around it in a repository — that's the standing instruction from the last full contract review, and it's cheaper than debugging the inconsistency later.

---

## Branding

Primary color `#FF7A28` (`Colors.primary`) is used consistently across buttons, focus states, active tab indicators, and links — see `expo/constants/colors.ts` for the full palette (semantic tokens for text, surface, border, status colors, etc.) and `expo/constants/theme.ts` for the same tokens organized as reusable style objects. Use these tokens rather than hardcoding hex values in new screens.

Document (invoice/receipt) branding is plan-gated separately from the app's own theming — see `expo/constants/documentBranding.ts` and the Backend integration status section above.
