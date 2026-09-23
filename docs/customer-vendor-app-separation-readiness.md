# Customer/Vendor App Separation — Readiness Audit

**Prepared for:** Founder
**Question asked:** Does the current architecture prevent a future split of the single mobile app into separate Customer and Vendor apps? Not being done for MVP — this is a readiness check and a going-forward discipline, not a migration plan.
**Scope:** live `expo/` tree only (per the earlier duplicate-tree finding — root-level `app/`, `contexts/`, etc. are stale platform-export copies and were not part of this audit).

## Short answer

**No, nothing found here blocks a future split**, and the codebase is already in better shape for it than expected — most of the separation Founder is asking the team to "keep doing" is already the dominant pattern, not something starting from zero. There is one real gap (app packaging/deep-link identity) and one concrete piece of role-mixed state worth unwinding (`InboxContext`), detailed below.

---

## 1. What's already properly separated

**Contexts (50 total in `expo/contexts/`):** the large majority are already cleanly role-scoped by naming and content:
- **15 `Vendor*`-prefixed contexts** (`VendorPlanContext`, `VendorContext`, `VendorAutoAcceptContext`, `VendorAwayMessageContext`, `VendorChatModeContext`, `VendorCustomerNotesContext`, `VendorDraftContext`, `VendorFilterContext`, `VendorFulfillmentContext`, `VendorNotificationContext`, `VendorPickupContext`, `VendorPushNotificationContext`, `VendorQuietHoursContext`, `VendorRelationshipContext`, `VendorSupportChatContext`) — vendor-only state, nothing a customer-only app would need.
- **5 `Customer*`-prefixed contexts** (`CustomerContext`, `CustomerDraftContext`, `CustomerNotificationContext`, `CustomerPushNotificationContext`, `CustomerSupportChatContext`) — same, customer-only.
- **~30 domain-shared contexts with no role-branching found** (`ThemeContext`, `SearchContext`, `FavoritesContext`, `CartContext`, `ChatContext`, `CatalogContext`, `OrdersContext`, `InvoiceContext`, `ReviewsContext`, `VerificationContext`, etc.) — checked directly for role-conditional logic (`role === 'vendor'`, `isVendor`, etc.) and found none. These are legitimately shared, not accidentally mixed — a chat system, a catalog, an order record all inherently involve both sides of a transaction, and a future two-app split would still want both apps talking to the same underlying domain logic here, not a duplicated copy per app.

**Navigation:** `app/customer/` and `app/vendor/` are **already separate route trees** (24 files under `customer/`, a comparable tree under `vendor/`), and `app/_layout.tsx` registers `"customer"` and `"vendor"` as distinct top-level `Stack.Screen` entries. This is the routing-layer separation a future split needs, already in place — it isn't something to build, only to keep intact.

**Services (`expo/services/`):** organized entirely by domain (order, cart, catalog, chat, invoice, subscription, etc.), not by role — appropriate, since these are the Service → Repository → Mapper data-access layer both a future Customer app and Vendor app would call identically against the same backend.

## 2. What actually mixes both roles

- **`InboxContext` — the one clear example.** A single provider holds `customerInbox` and `vendorInbox` state side by side (`useState<InboxSnapshot[]>` for each, separate `customerPage`/`vendorPage` pagination) and is always instantiated regardless of which role is using the app. This is exactly the "large if customer/vendor" pattern to avoid going forward — it should become two contexts (or one shared low-level chat-subscription hook wrapped by two thin role-specific providers), not one provider owning both roles' state.
- **`AuthContext` (34 role-branch references)** — expected and correct to stay shared. Role detection has to happen somewhere before routing to the right tree; this is the one context whose entire job *is* knowing the role, not a mixing problem.
- **Two chat-embedded components** (`PaymentRequestCard.tsx`, `CatalogItemBubble.tsx`) branch on role internally — lower priority than `InboxContext`: a chat message rendered differently depending on whether the viewer is the sender or recipient side of a conversation is inherent to shared chat UI, not sloppy architecture. Worth a second look during a real split, not urgent now.

No other context or the 54 files checked in `components/` showed role-branching beyond these.

## 3. What should be refactored gradually

- Split `InboxContext` into `VendorInboxContext`/`CustomerInboxContext` (or a shared subscription hook + two thin providers) the next time it's touched for feature work — no need for a dedicated migration project, just don't add to it as-is.
- No other refactor is urgent based on this audit. The existing `Vendor*`/`Customer*` naming convention is already the right pattern — the ask going forward is discipline to keep using it, not a structural fix.

## 4. Can auth, push tokens, and deep links support two separate apps later?

**Auth — yes, and this is a real strength, not just "not blocking."** Role is **exclusive and permanent per account**: `completeRegistration` in the backend explicitly rejects re-finalizing a role once set (`"Account role has already been finalized and cannot be changed via this function"`), and a default Firebase Auth custom claim of `role: "customer"` is set on every new user, changed to `"vendor"` only through that one registration path. A single account is never simultaneously both. This means a future split doesn't need to solve dual-role complexity — each app can simply check the account's role and deny/redirect on mismatch, which is exactly what `app/role-error.tsx` already does today for the single-app case.

**Push notification tokens — fine as-is.** Stored at `users/{uid}/pushTokens/{tokenId}`, not role-namespaced — but since a `uid` is already role-exclusive (per above), there's no ambiguity to resolve. A Customer app and Vendor app registering tokens under their respective users' subcollections would work with zero backend schema change.

**Deep links / app identity — the one real gap.** Today there is exactly **one** app bundle serving both roles: a single `bundleIdentifier`/`package` (`com.platform.app`) and a single `scheme` (`rork-app`) in `app.json`. Splitting into two real apps means two app store listings, two bundle identifiers, and a deep-link strategy that doesn't exist yet for cross-role links — e.g. a vendor sharing an invoice or storefront link that a customer opens needs to resolve to the *Customer* app, not the Vendor app that generated it, which requires either universal links/app associations configured per-role or a lightweight resolver. This isn't a code-quality problem to fix now — it's packaging and deployment work that hasn't been started, and won't need to until the split is actually decided.

## Going-forward rule (per Founder's request)

Keep customer screens/state/services and vendor screens/state/services separated, following the `Vendor*`/`Customer*` naming convention already dominant in this codebase. Place genuinely reusable logic (domain services, shared UI primitives, auth) in shared modules, as already done. Don't introduce new role-mixed contexts or large `if (role === ...)` components where two smaller, separate ones would be cleaner — `InboxContext` is the one existing exception to unwind when next touched, not a pattern to repeat.
