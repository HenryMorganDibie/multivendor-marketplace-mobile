# Full Frontend/Backend Contract Audit v3 — rork-platform vs multivendor-marketplace-platform

Goal: 100% confidence before integration begins. This supersedes the plan-gating audit (still valid,
see `docs/frontend-backend-gating-audit.md`) by covering *everything else* — callable wiring status,
Firestore paths, enums, auth model, timestamps, pagination, error handling. Every item below was
directly verified by reading both repos' source, not inferred.

**Baseline fact, confirmed by direct grep: zero of the backend's ~91 exported callables/triggers are
actually wired to the frontend.** The 7 name collisions found (blockUser, checkUsernameAvailability,
createInvoice, sendChatMessage→sendChatMessagePush, submitPaymentProof, unblockUser, updateOrderStatus)
are all locally-implemented mock/AsyncStorage functions that happen to share a name — not real calls.
This matches the frontend README's own disclosure. So most "field mismatch" questions are moot until
wiring starts — but the *shape* of the frontend's local models already diverges from what the backend
will require, and that's fixable now before it's baked into more screens.

---

## 🔴 Severity 1 — blocks integration outright, must be resolved before any wiring work starts

### 1. Auth identity model — most foundational gap
- **Backend**: identifies callers via real Firebase Auth (`request.auth.uid`) plus **custom claims**
  `request.auth.token.role` and `request.auth.token.vendorId` for vendor-scoped actions.
  (`multivendor-marketplace-platform/functions/src/orders/createOrder.ts:29,122-123`, `paymentProofs.ts:14-15`,
  `completeRegistration.ts:30,211`)
- **Frontend**: `AuthContext.tsx` fabricates its own local IDs — `id: \`user_${Date.now()}_${Math.random()...}\`` (lines 657, 903) and `vendor_${Date.now()}_${random}` (line 610). Confirmed: zero Firebase Auth SDK usage, no custom claims, no `getIdTokenResult` anywhere in the file.
- **Impact**: every backend callable that checks `request.auth.token.role`/`vendorId` will reject
  frontend calls until real Firebase Auth sign-in + custom-claims propagation exists. The backend
  even has a claims-refresh callable already (`getClaimsVersion`, `index.ts`) with no frontend
  counterpart at all. This blocks *every other* item below in practice — nothing else matters until
  this is solved.

### 2. PaymentStatus enum — no overlap at all with backend
- **Backend** (`types2.ts:117-119`): `"UNPAID" | "PROOF_SUBMITTED" | "PROOF_ACCEPTED" | "PROOF_REJECTED" | "PROOF_LOCKED"` — a payment-*proof-review* workflow (customer uploads proof image, vendor accepts/rejects, 2-strike lockout via `submitPaymentProof`/`reviewPaymentProof` in `orders/paymentProofs.ts`).
- **Frontend**: `'payment_pending' | 'partially_received' | 'payment_received'`
  (`mocks/ordersData.ts:21`, `types/domain/paymentStatus.ts:11`) — a simple paid/unpaid/partial model
  with **no concept of proof submission, review, rejection, or lockout at all**.
- Frontend's own boundary translator (`utils/orderDisplay.ts:82-108`, `services/mappers/orderMapper.ts:38-39`) assumes the backend uses `'unpaid'|'partially_paid'|'paid'` — which is **also wrong**, that's not the real backend enum either. Two layers of wrong assumption stacked on each other.
- **Impact**: the entire payment-proof submission/review/lockout flow (a real, already-built backend feature) has **no UI representation anywhere in the frontend**. This isn't a naming fix — it's a missing feature screen (proof upload, vendor review UI, "locked after 2 rejections" messaging).

### 3. Firestore collection paths — 4 of 6 domains checked don't match
| Domain | Frontend assumes (`BACKEND_INTEGRATION_GUIDE.md` + repo `TODO(Henry)` comments) | Backend actually uses | 
|---|---|---|
| Chat | `conversations/{id}` + `messages` subcollection (guide:160-161, `chatRepository.ts:11`) | `chatThreads/{chatId}` (top-level) — `createCommerceConversation.ts:110`, `sendChatMessage.ts:150,188`, `chatReadAndDrafts.ts:17`, `awayMessage.ts:40` |
| Notifications | `users/{uid}/notifications/{id}` subcollection (guide:162, `notificationRepository.ts:13`) | top-level `notifications` collection + `recipientUid` field — `notificationFunctions.ts:45,91,201` |
| Support | `supportThreads/{id}` (guide:167) | `supportTickets` collection, linked to `chatThreads` via `chatId` — `supportTicketFunctions.ts:50,103,149,218` |
| Verification | `vendors/{vendorId}.verification` subdoc (guide:164) | separate top-level `vendorVerification` collection keyed by `vendorId` — `vendorModeration.ts:31-32,103-104,186-187` |
| Subscriptions | `vendorSubscriptions/{vendorId}` (guide:163) | ✅ matches — `subscriptionFunctions.ts:128,164` |
| Orders | `orders/{orderId}` (guide:159) | ✅ matches — `createOrder.ts:70,155` |

- **Impact**: if the integration guide is followed literally for chat/notifications/support/verification, every read against real Firestore data will silently return **empty results** (wrong path = no error, just nothing found) — the worst kind of bug to debug later. Fix the guide before anyone starts wiring a repository from it.

### 4. OrderStatus — frontend has one extra value the backend can never produce
- **Backend** (`types2.ts:112-115`): `"requested" | "accepted" | "confirmed" | "in_progress" | "completed" | "rejected" | "cancelled" | "expired"` (8 values).
- **Frontend** (`constants/orderStatus.ts:1-9`): same 8, **plus `'awaiting_customer_update'`**, used throughout `CUSTOMER_STATUS_LABELS`/`VENDOR_STATUS_LABELS`/`ORDER_STATUS_COLORS`.
- Backend does have a related real mechanism — `handleChangeRequest` / a separate `changeRequests` collection (`updateOrderStatus.ts:67,74`) — but it's modeled as a **sub-resource**, not a value of `order.status`. Frontend collapsed it into the status enum itself.
- **Impact**: any frontend code branching on `status === 'awaiting_customer_update'` is dead code against real backend data — no order document will ever carry that value. Needs reconciling with the `changeRequests` sub-resource model before wiring order screens.

---

## 🟠 Severity 2 — real structural gaps, won't block a first wiring pass but will break specific flows

### 5. Invoice contract — multiple field-shape mismatches (found via direct comparison of `createInvoice` in both repos)
| Concept | Backend (`invoiceFunctions.ts`, `types4.ts`) | Frontend (`contexts/InvoiceContext.tsx`) |
|---|---|---|
| Line items field name | `lineItems` | `items` |
| Tax / discount | **not modeled at all** in `InvoiceDoc` | `tax: number; discount: number;` — required fields with no backend home |
| Initial status | server always sets `"unpaid"` on create, ignoring any client-sent status | client explicitly sends `status: 'draft'` — backend has `"draft"` in its `InvoiceStatus` union (`types4.ts:237`) but `createInvoice` itself never uses it, so "draft" invoices as the frontend imagines them (saved, not yet finalized) may not be a real backend state — needs product clarification |
| ID | client generates its own `id: \`invoice_${Date.now()}_${random}\`` | backend uses Firestore auto-ID (`invoiceRef.id`) — client-generated IDs must never be treated as authoritative once wired |
| Public share field | frontend: `shareCode` (short, `generateShareCode()`, used in URL `platform.app/i/{shareCode}`) | backend: `shareToken` (32-char hex via `crypto.randomBytes(16)`) — different field name AND different format/length for the same concept; the public invoice URL scheme depends on this matching exactly |
| Return shape | frontend's `createInvoice()` returns the **full populated `Invoice` object** synchronously | backend's `createInvoice` callable returns only `{ success, invoiceId, invoiceNumber }` — repository layer will need an extra fetch to reconstruct the full object the rest of the app expects |
| `customerId` | frontend type has `customerId?: string` implying a real customer link | backend `createInvoice` always sets `customerId: null` — no request param accepts it | 

### 6. Error handling contract — frontend has zero error-code awareness
- Backend throws typed `HttpsError` with specific `.code` values throughout (`"unauthenticated"`, `"invalid-argument"`, `"not-found"`, `"permission-denied"`, `"failed-precondition"` — e.g. `paymentProofs.ts:14,17-20,23,25,29-31`).
- Frontend: confirmed zero occurrences of `.code ===`, `HttpsError`, or equivalent error-branching anywhere in `services/*.ts` or `contexts/*.tsx`.
- **Impact**: specific backend behaviors like the payment-proof 2-strike lockout (`failed-precondition` after 2 rejections) have no corresponding UI state — will fall through to a generic/no-op catch once wired.

### 7. Pagination — currently consistent, but only because neither side has one
- `listInvoices` returns the **entire** result set with no cursor/limit (`invoiceFunctions.ts:108-118`); frontend has no `hasMore`/`cursor`/`nextCursor` anywhere either. Not a live mismatch today, but flag before invoice volume grows — needs to be designed on both sides together, not independently.

### 8. Timestamps — anticipated correctly, just not yet implemented
- Backend uses `Firestore.Timestamp` / `FieldValue.serverTimestamp()` consistently. The frontend's own integration guide already correctly documents the need to convert to ISO strings in the mapper layer (`BACKEND_INTEGRATION_GUIDE.md:106-107,169-170`). No mapper currently does this conversion (expected — nothing's wired yet). **Not a defect, just an acknowledged TODO** — flagging so it isn't missed when repositories are actually built.

---

## Not yet exhaustively checked (honest gaps in this audit — flag rather than guess)

- Full field-by-field request/response diff for the ~84 unwired callables individually (would be low-value busywork right now since nothing calls them yet — the two structural blockers in §1/§2 apply to all of them regardless of individual parameter names).
- Chat message type / notification type union comparison beyond the collection-path check in §3.
- Rating/review status and moderation vocabularies.
- Vendor verification document field shape (only the collection *path* was checked, not the document's internal fields).

---

## Recommended order of fixes

1. **Auth model** (§1) — nothing else can be tested end-to-end until this exists. Needs real Firebase Auth + custom claims wiring in `AuthContext.tsx`, matched against the backend's `role`/`vendorId` claims and the `getClaimsVersion` refresh pattern.
2. **Fix `BACKEND_INTEGRATION_GUIDE.md`'s collection paths** (§3) — cheap, high-value, prevents every future repository file from being built against the wrong path.
3. **Reconcile PaymentStatus** (§2) and **OrderStatus's extra value** (§4) — these need a product conversation (does "awaiting customer update" become a UI-only derived state from `changeRequests`? does the proof-review flow get built as new screens?) before code changes.
4. **Invoice field alignment** (§5) — same treatment as the earlier branding fix: rename `items`→`lineItems`, decide what happens to `tax`/`discount` (add to backend, or drop from frontend model), rename `shareCode`→`shareToken` or decide which name wins, fix `createInvoice`'s return-shape assumption in the repository layer.
5. Everything else (§6-8) falls out naturally once the repository layer is actually being built against the real callables.
