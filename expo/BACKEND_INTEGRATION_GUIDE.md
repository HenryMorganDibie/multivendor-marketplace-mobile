# Platform — Backend Integration Guide (for Henry)

This document is the single reference for connecting the Platform mobile app to
Firebase. The app already runs on a layered, backend-ready architecture; your job
is to swap the **repository** internals from mock/AsyncStorage reads to Firestore,
without touching services, contexts, or UI.

> **Golden rule:** Integrate at the **repository layer only**. Services, mappers,
> domain types, contexts, and screens should not need changes. If you find
> yourself editing a screen to make Firebase work, stop — the seam is in the
> repository.

---

## 1. Architecture overview

### Data flow

```
Screen / Context
      │  calls a service method (stable public API)
      ▼
Service            expo/services/*Service.ts
      │  delegates to a repository
      ▼
Repository         expo/services/repositories/*Repository.ts   ← YOU REPLACE THIS
      │  reads raw data (today: mock/AsyncStorage; tomorrow: Firestore)
      ▼
Mapper             expo/services/mappers/*Mapper.ts
      │  normalizes raw docs → domain types
      ▼
Domain types       expo/types/domain/*
```

- **Services** = the stable, public API the rest of the app calls. Leave the
  signatures unchanged.
- **Repositories** = the only place that knows *where* data lives. This is your
  integration surface. Every file carries `TODO(Henry)` markers where the
  Firestore call replaces the mock read.
- **Mappers** = pure functions that convert a raw document (`Record<string, unknown>`)
  into a domain type. They also translate enum vocabulary at the backend boundary
  (e.g. `pro+ ↔ pro_plus`). Reuse these as-is inside your Firestore reads.
- **Domain types** (`@/types/domain`) = the single import surface for shared types.

### Layer coverage today

| Layer | Folder | Count |
| --- | --- | --- |
| Services | `expo/services/` | 13 (order, chat, vendor, catalog, invoice, customOrder, auth, user, cart, notification, subscription, verification, support) |
| Repositories | `expo/services/repositories/` | 11 (auth, user, vendor, catalog, cart, order, chat, notification, subscription, verification, support) |
| Mappers | `expo/services/mappers/` | 10 (user, vendor, catalog, cart, order, chat, notification, subscription, verification, support) |

---

## 2. Service layer overview

Services are the app's public data API. Each wraps one or more repositories and
returns domain-shaped data. **Do not change these signatures** — screens and
contexts depend on them.

Key ones to know:

- `vendorService.getDiscoverable()` — canonical public-discovery list (applies the
  visibility rule, see §6). All home/explore/search vendor lists flow through this.
- `catalogService` — vendor storefront menu (items + categories).
- `orderService` — order creation + lifecycle reads; computes `paymentStatus`.
- `chatService` — conversations + messages.
- `notificationService.getForCurrentUser(role)` — per-user, per-role notifications.
- `subscriptionService.getSubscription()` — vendor plan/tier.
- `verificationService.getVerification()` — vendor KYC/KYB status.
- `authService` / `userService` — account + profile (NOT yet wired through reads).
- `cartService` / `supportService` — scaffolded, NOT yet wired through reads.

### Services you should leave unchanged

All of them. Services are the contract. Integrate underneath, in repositories.

---

## 3. Repository layer overview

Repositories are **your integration surface**. Today they read mock data or
AsyncStorage; you replace the body of each method with a Firestore call and pass
the result through the matching mapper.

Standard pattern to follow (already established in `vendorRepository`):

```ts
// BEFORE (today)
async getAll(): Promise<Vendor[]> {
  // TODO(Henry): replace with Firestore `vendors` query
  return mockVendors.map(vendorMapper.fromRaw);
}

// AFTER (your Firestore version — same return type)
async getAll(): Promise<Vendor[]> {
  const snap = await getDocs(collection(db, 'vendors'));
  return snap.docs.map((d) => vendorMapper.fromRaw({ id: d.id, ...d.data() }));
}
```

Notes:
- Keep the **return type identical** — always map through the mapper so the domain
  shape is preserved.
- Every repository file has `TODO(Henry)` comments marking the exact swap points.
- Convert Firestore `Timestamp`/`FieldValue` to ISO strings **inside the mapper**
  (or just before calling it), since domain types use ISO date strings.

---

## 4. Mapper layer overview

Mappers convert raw documents → domain types and translate enum vocabulary at the
boundary. Reuse them inside your Firestore reads.

| Mapper | Key responsibility | Boundary translation |
| --- | --- | --- |
| `vendorMapper` | vendor / menuItem / category normalization + `isDiscoverable` rule | legacy `vendorStatus` → `verificationStatus`/`accountState` fallback |
| `catalogMapper` | menu (items + categories) passthrough | — |
| `orderMapper` | order normalization, ensures `items` array | `backendPaymentStatus()` → unpaid/partially_paid/paid |
| `chatMapper` | chat/message normalization | `chatType` → 4 canonical conversation kinds |
| `notificationMapper` | per-record normalization | — |
| `subscriptionMapper` | plan record → `Subscription` | `toBackendTier`/`fromBackendTier` (`pro+ ↔ pro_plus`) |
| `verificationMapper` | verification record normalization | defaults `retryAllowed` to `true` |
| `userMapper` / `cartMapper` / `supportMapper` | scaffolded passthroughs | — |

Each mapper exposes `fromRaw()` (raw → domain) and `toRaw()` (domain → raw, for
writes). Use `fromRaw` on reads, `toRaw` when you persist.

---

## 5. Domain types

Import shared types **only** from `@/types/domain` (`expo/types/domain/index.ts`),
never from contexts/mocks directly. The index re-exports one canonical definition
per concept.

- Status/role enums: `userRole`, `vendorStatus`, `verificationStatus`,
  `orderStatus`, `paymentStatus`, `subscriptionTier`, `conversationType`,
  `notificationType`, `countryStatus`.
- Entities: `Vendor`, `MenuItem`, `Category`, `AddOn` (catalog); `Order`,
  `OrderItem`, `OrderEvent`, `OrderSnapshot`, `PaymentRecord`, `OrderSource`
  (orders); `Chat`, `ChatMessage`, `MessageType` (chat); `CartItem`, `VendorCart`
  (cart).
- Payloads: `CreateOrderPayload`, `VendorMenuData`.

---

## 6. Firebase collection mapping

Suggested Firestore layout. The `TODO(Henry)` markers in each repository reference
these collection names.

| Domain | Firestore path | Repository | Mapper |
| --- | --- | --- | --- |
| Vendors | `vendors/{vendorId}` | `vendorRepository` | `vendorMapper.fromRaw` |
| Menu items | `vendors/{vendorId}/menuItems/{itemId}` | `catalogRepository` | `catalogMapper` / `vendorMapper.menuItemFromRaw` |
| Categories | `vendors/{vendorId}/categories/{categoryId}` | `catalogRepository` | `vendorMapper.categoryFromRaw` |
| Orders | `orders/{orderId}` | `orderRepository` | `orderMapper.fromRaw` |
| Conversations | `conversations/{conversationId}` | `chatRepository` | `chatMapper.fromRaw` |
| Messages | `conversations/{conversationId}/messages/{messageId}` | `chatRepository` | `chatMapper.messageFromRaw` |
| Notifications | `users/{userId}/notifications/{notificationId}` | `notificationRepository` | `notificationMapper.fromRaw` |
| Subscriptions | `vendorSubscriptions/{vendorId}` | `subscriptionRepository` | `subscriptionMapper.fromRaw` |
| Verification | `vendors/{vendorId}.verification` (or subdoc) | `verificationRepository` | `verificationMapper.fromRaw` |
| Users / profiles | `users/{userId}` | `userRepository` / `authRepository` | `userMapper.fromRaw` |
| Carts | `users/{userId}/cart` | `cartRepository` | `cartMapper.fromRaw` |
| Support threads | `supportThreads/{threadId}` | `supportRepository` | `supportMapper.fromRaw` |

> Timestamps: store as Firestore `Timestamp`, convert to ISO strings when mapping
> into domain types (the app expects ISO date strings everywhere).

---

## 7. Vendor status mapping

Two **independent** axes (do not collapse them):

**Verification status** — `Vendor.verificationStatus`:

| App value | Meaning |
| --- | --- |
| `not_started` | no submission yet |
| `pending_review` | submitted, awaiting review |
| `retry_required` | needs resubmission |
| `approved` | verified |
| `rejected` | denied |

**Account state** — `Vendor.accountState`:

| App value | Meaning |
| --- | --- |
| `active` | normal |
| `suspended` | temporarily blocked |
| `deactivated` | turned off |
| `frozen` | locked (e.g. billing/compliance hold) |

**Canonical `VendorStatus`** (UPPERCASE) used by the gate/discovery:
`ACTIVE | UNVERIFIED | WAITLISTED | SUSPENDED | DEACTIVATED`. Use
`normalizeVendorStatusValue(raw)` to coerce loose strings.

**Discovery rule** (`vendorMapper.isDiscoverable`) — a vendor appears in public
discovery (home/explore/search) **only** when:
`verificationStatus === 'approved'` **AND** `accountState === 'active'` **AND**
`isDiscoverable !== false`.

- UNVERIFIED → hidden from discovery, reachable by **direct link only**
  (`getVendorByUsername` uses `canAccessViaDirectLink`, deliberately separate).
- WAITLISTED / SUSPENDED / DEACTIVATED / frozen → hidden everywhere public.

> Once Firestore vendors carry native `verificationStatus` + `accountState`
> fields, the legacy `vendorStatus`-string fallback inside `isDiscoverable` can be
> removed (marked `TODO(Henry)`).

---

## 8. Verification status mapping

`verificationService.getVerification()` returns a `VerificationRecord`:

```
status: not_started | pending_review | retry_required | approved | rejected
type: individual | business        (VerificationType)
submittedAt?, reviewedAt?, referenceId?, rejectionReason?
retryAllowed (defaults true when absent)
requiresKYB, kybCompleted
providerData (opaque KYC/KYB provider payload — preserved untouched)
```

`TODO(Henry)`: map the KYC/KYB provider payload + `vendors/{vendorId}.verification`
into this shape. Keep `providerData` as a passthrough block. The vendor dashboard
verification banner already reads through this path.

---

## 9. Subscription mapping

`subscriptionService.getSubscription()` returns:

```
tier: basic | standard | pro | pro+      (internal label)
brandingEnabled, cancellationScheduled, cancellationDate, founderPricingEligible
```

**Critical:** the app uses internal label `pro+`; the backend stores `pro_plus`.
Always translate at the boundary using:

- `subscriptionMapper.toBackendTier(tier)` → `pro+` → `pro_plus`
- `subscriptionMapper.fromBackendTier(tier)` → `pro_plus` → `pro+`

(These wrap `toBackendPlanTier` / `fromBackendPlanTier` from the domain layer.)
Store the internal label in `toRaw`, OR store `pro_plus` and convert on read — pick
one and be consistent. Recommend storing backend-canonical `pro_plus` in Firestore
and converting via `fromBackendTier` in the repository.

---

## 10. Order lifecycle mapping

Two independent axes, mirrored from the backend:

**Order progress** — `Order.status` (`OrderStatus`):
`requested → accepted → confirmed → in_progress → completed`, plus terminal
`rejected | cancelled | expired`.

**Payment progress** — `Order.paymentStatus` (`PaymentStatus`), internal values
kept for legacy reasons but translated at the boundary:

| Internal (`PaymentStatus`) | Backend (`BackendPaymentStatus`) |
| --- | --- |
| `payment_pending` | `unpaid` |
| `partially_received` | `partially_paid` |
| `payment_received` | `paid` |

Use `orderMapper.backendPaymentStatus(order)` (wraps `toBackendPaymentStatus` in
`utils/orderDisplay`) whenever you write payment state to Firestore.

`TODO(Henry)`: map `orders/{orderId}` documents, converting Firestore timestamps
on `OrderEvent`/`PaymentRecord` to ISO strings inside `orderMapper.fromRaw`.

---

## 11. Internal vs external order mapping

`Order.orderSource` (`OrderSource`) = `internal | external`:

- `internal` — placed inside the Platform app by a customer.
- `external` — logged manually by the vendor (WhatsApp, Instagram, walk-in, phone).
  Carries an optional `externalReference` (e.g. "Instagram", "Phone call").

Legacy value `'platform'` normalizes to `'internal'` via `normalizeOrderSource()` at
the data boundary — call it when reading any document that may still carry the old
value. `Order.completedBy` (`CompletionSource = vendor | system`) records who
completed the order.

---

## 12. Chat / conversation mapping

`Chat.chatType` normalizes (via `chatMapper` / `normalizeChatType`) to four
canonical kinds:

| Canonical (`ConversationType`) | Use |
| --- | --- |
| `pre_order_inquiry` | customer asking before ordering |
| `order_chat` | conversation tied to an order |
| `ai_help` | AI assistant thread |
| `support` | Platform support thread |

Backend-canonical names (`BackendConversationType`): `inquiry | order | ai | support`.
Legacy `custom_order` / `creator` kinds collapse onto `order` / `inquiry` at the
boundary.

`TODO(Henry)`: map `conversations/{conversationId}` + the `messages` subcollection
through `chatMapper.fromRaw` / `chatMapper.messageFromRaw`.

---

## 13. Areas already migrated (read path flows through the stack)

These read paths already go `screen/context → service → repository → mapper`:

- **Vendor discovery** — all public lists (`getAllVendors`, `getVendorsByCategory`,
  `getOpenNowVendors`, `getVendorsNearYou`) via `vendorService.getDiscoverable()`.
- **Vendor storefront menu** — `getVendorMenu` via `catalogService`.
- **Vendor verification banner/status** — `VerificationContext` load path via
  `verificationService`.
- **Notifications (read)** — customer + vendor notification contexts load via
  `notificationService` (per-user, role-separated).
- **Subscription/plan tier (read)** — `VendorPlanContext.loadPlan()` via
  `subscriptionRepository`.

For these, swapping the repository internals to Firestore is the **only** change
needed.

---

## 14. Areas NOT yet migrated (still read mock/AsyncStorage directly)

These have full service/repository/mapper scaffolding but their **read paths are
not yet routed** through the stack. They still use mock data / context state /
AsyncStorage directly in screens or contexts:

- **Cart** — `CartContext` + cart screens read directly.
- **Orders** — order lists/details read mock + context directly (creation logic in
  `orderService` exists but screens aren't routed through it).
- **Chat** — conversations/messages read mock + context directly.
- **Support** — support chat reads context directly.
- **Auth** — `AuthContext` owns sign-in/session directly; `authService` /
  `userService` not yet wired.
- **Write/mutation flows everywhere** — all writes (place order, send message,
  mark read, upgrade plan, submit verification) still mutate context/AsyncStorage
  directly. Repository `toRaw`/write methods are scaffolded but not yet the source
  of truth.

Recommended integration order: vendor → catalog → verification → notifications →
subscription (all already routed, low-risk) first, then orders → chat → cart →
support → auth, then write flows last.

---

## 15. Conventions to preserve

- Integrate **only** in repositories. Never edit a screen/context to make Firebase
  work.
- Always map raw docs through the matching mapper — never return raw Firestore data.
- Convert timestamps to ISO strings in the mapper.
- Respect the boundary translations: `pro+ ↔ pro_plus`, internal ↔ backend payment
  status, legacy order source → `internal`, legacy chat types → 4 canonical kinds.
- Keep direct-link vendor lookup (`getVendorByUsername`) separate from discovery so
  UNVERIFIED vendors remain reachable by link.
- Follow the `TODO(Henry)` markers — they mark every exact swap point.

---

## 16. Invoice payments & revenue (double-counting rule)

Platform's dashboard revenue represents money the vendor has **confirmed
receiving**. Unpaid invoice totals are never counted as revenue. The rules:

| Invoice payment status | Revenue contribution |
| --- | --- |
| Pending Payment / Unpaid | ₦0 |
| Partially Paid | Sum of recorded payments only |
| Paid | Full amount received, capped at invoice total |
| Overdue | ₦0 unless partial payments were recorded |
| Cancelled / Voided | ₦0 |

Revenue is keyed off the **payment record date**, not the invoice issue date —
so recording a payment today on an invoice issued last week updates "Today's
Revenue", "Total Revenue" (Business Insights), and the "Revenue Trend" for
the period that contains the payment date.

### Payment records (Henry must persist)
Each recorded payment needs at minimum:
- `id` (stable, unique)
- `amount` (in the invoice's currency)
- `date` (ISO — drives revenue aggregation)
- `method` (optional: cash, transfer, card, pos, other)
- `note` (optional)
- `recordedAt`

The invoice document should expose a derived `paymentStatus`
(`unpaid` | `partially_paid` | `paid`) so the client never re-derives it from
the payments list. `InvoiceContext.resolvePaymentStatus` is the reference
implementation for the derivation.

### Double-counting rule (critical)
Standalone invoice payments may contribute to revenue. **If an invoice is
linked to an order** (`invoice.orderId` is set), the same payment MUST NOT be
 counted once through the invoice and again through the order. Use a single
payment/revenue record with linked source IDs (`orderId` + `invoiceId`) so
revenue aggregation deduplicates by payment id. The mock helper
`sumInvoiceRevenue(invoices, linkedOrderIds)` in `utils/invoiceRevenue.ts`
guards against this client-side; once the backend exposes a unified payment
record, that guard becomes redundant.

### Mock reference implementation
`utils/invoiceRevenue.ts` is the single source of truth for the rules above.
It exports:
- `getInvoiceRevenue(invoice)` — revenue from one invoice
- `sumInvoiceRevenue(invoices, linkedOrderIds?)` — total revenue with the
  double-count guard
- `getPaymentRevenueAmount(invoice, payment)` — a single payment's clamped
  contribution (for trend charts)
- `getInvoiceRevenueForDay(invoices, dateStr, linkedOrderIds?)` — revenue on
  a given calendar day (drives Today's Revenue)
- `getInvoiceRevenueForRange(invoices, start, end, linkedOrderIds?)` —
  revenue across a date range (drives Total Revenue + Revenue Trend)

Henry: when wiring the backend, replace these mock helpers with Firestore
aggregations that apply the same rules server-side.
