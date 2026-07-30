# Full audit

Every repository, counted rather than remembered, so that what is left is known
in one place and nothing arrives piecemeal again.

Two questions are answered for each item: **is it done**, and **is it already
paid for**. The second matters as much as the first.

## Method

Numbers come from the repositories directly. Callables were counted from
`functions/src/index.ts` and matched against every `callable('name')` in the app.
Mock usage separates type imports, which are legitimate because the types happen
to live in those files, from imports of actual mock data.

## Headline

| | |
|---|---|
| Callables the backend exposes | **87** |
| Callables the app calls | **23** |
| Never called, and correctly so (triggers, webhooks, scheduled) | 13 |
| Never called, admin-only, belongs to the unbuilt Admin Portal | 6 |
| **Never called, genuinely app-facing** | **53** |
| Contexts in the app | 56 |
| Contexts reading the backend | 12 |
| Files importing real mock data | 79 |
| Automated checks passing | 85 across 8 suites |

## The 53, and who owes them

This is the important table. Each one is a callable the backend exposes,
documented in `frontend-contracts.md`, that no screen in the app calls.

### Inside an agreed frontend phase — not billable separately

| Callable | Phase |
|---|---|
| `changeUsername`, `checkUsernameAvailability` | 8 — Username cooldown, ₦20k |
| `createQuickReply`, `updateQuickReply`, `deleteQuickReply`, `saveChatDraft`, `clearChatDraft` | 7 — Chat action sheets and Quick Note, ₦40k |
| `getBusinessAnalytics` | 5 — Business Insights, ₦55k |
| `updateInvoiceBranding` | 3 — Invoice ledger, ₦130k |
| `setVendorPublishStatus` | 4 — Storefront sharing, ₦60k |

Doing these is doing those phases. No new quote.

### Belongs to the web portal, which was delivered

`getVendorPortalAccess`, `getVendorBillingHistory`, `getSiteContentDraft`,
`saveSiteContentDraft`, `publishSiteContent`, `submitContactForm`,
`joinWaitlist`, `getPublicSubscriptionOfferings`.

These are called by `web/`, not by the mobile app, and correctly so. Not a gap.

### Backend delivered and paid; the app was never wired to it

This is the largest group, and the one that sits in **no milestone and no
phase**.

| Area | Callables | Backend milestone |
|---|---|---|
| Subscriptions on mobile | `createSubscriptionCheckout`, `cancelSubscription`, `reactivateSubscription`, `getSubscriptionStatus`, `getVendorSubscriptionOfferings` | 4 |
| Ratings | `submitRating`, `getVendorRatings` | 4 |
| Chat, blocks, notifications | `createCommerceConversation`, `createAiHelpThread`, `blockUser`, `unblockUser`, `markNotificationRead`, `registerPushToken` | 3 |
| Support tickets | `assignSupportTicket`, `resolveSupportTicket` | 3 |
| Orders beyond the core | `getOrderDetails`, `getReceipt`, `createExternalOrder`, `submitDeliveryContact`, `reviewPaymentProof`, `handleChangeRequest` | 2 |
| Verification and OTP | `sendEmailOtp`, `verifyEmailOtp`, `sendPhoneOtp`, `verifyPhoneOtp`, `recordVerificationDocument`, `submitVendorVerification`, `getClaimsVersion` | 1 |
| Vendor settings | `updateVendorSettings`, `updateVendorChatSettings`, `updateVendorPickupSettings` | 1–3 |

**Why this is not already covered.** Each milestone delivered the Cloud
Functions and a document describing how to call them.
`docs/frontend-contracts.md` opens by saying it *"describes every callable Cloud
Function exposed by the backend across Milestones 1–4: required auth state,
request payload, response payload, error codes"* — a specification written for
whoever implements the frontend. The backend README lists it under **"Frontend
integration contracts"**. A contract is what the two sides agree; it is not one
side's implementation.

The eight frontend phases cover eight specific areas. They do not cover
subscriptions on mobile, ratings, blocks, notifications, verification, OTP, or
vendor settings.

**The honest counter-argument**, worth stating before it is put: the app was
always intended to use the backend, so someone was always going to write this.
That is true. What follows from it is that it should be agreed and priced before
it is built, not discovered afterwards — which is the entire purpose of this
document.

## Frontend state

Twelve of fifty-six contexts read the backend. The other forty-four mostly need
nothing: they hold local interface state, which is what they should hold.

### Still serving mock data

| Context | Screens using it | Status |
|---|---|---|
| `VendorContext` | **83** | In no phase. The largest single item left |
| `InvoiceContext` | 21 | Phase 3, priced |
| `ChatReadContext` | 6 | Phase 7, priced |
| `ChangeRequestsContext` | 3 | Orders-adjacent |
| `OrderCompletionContext` | 0 | No consumers |
| `AbandonedCartContext` | 0 | No consumers |
| `DiscoveryContext` | 0 | No consumers |
| `AppointmentReminderContext` | 0 | No consumers |

`VendorContext` is the one that would be a genuine surprise later. Eighty-three
files read it: the vendor's own profile, settings, hours, policies and
storefront details across the whole vendor app.

**Four contexts have no consumers at all.** Nothing imports them. Wiring them
would be building something nothing calls; they should be deleted or left until
a screen needs them. Listed so that their absence is a decision.

### Mock data still reaching screens

79 files import real mock data, not just types. The heaviest are `mockVendor`
(272 references), `mockVendors` (64), `mockOrders` (52) and `mockMenuItems` (20).
`mockOrders` and `mockVendors` are now scoped to the demo logins; the rest still
reach real screens.

## Verification, which is further behind than it looks

`VerificationContext` carries seven TODOs pointing at REST endpoints that do not
exist in this backend — `POST /api/admin/vendors/:vendorId/approve` and
similar. The real backend exposes callables, not REST. The KYC/KYB provider is
also unconnected: `providerApplicantId` and `providerVerificationId` are written
as empty strings with a comment saying a provider will populate them.

So vendor verification currently cannot complete end to end, regardless of what
the screens show. This is not in any phase.

## Deployment

Nothing is deployed. Everything runs against a local emulator, which is why a
build handed to someone else renders the interface but cannot complete a
registration. Milestone 6, priced at ₦250,000, not started, and blocked on
Firebase project access with billing enabled.

## What is already paid for and finished

Phase 1 and Phase 2, ₦80,000 each, 31 checks between them.

## Delivered at no charge

The location catalogue's 1,304 area files, its validator and importer; the
location endpoints, rules, registration validation and app wiring; the order
wiring; vendor discovery; rate limiting across fourteen write endpoints;
registration recovery; and eleven live defects found and fixed, listed in
`docs/remaining-work.md`.

## Summary of what is not paid for

| Item | Status |
|---|---|
| Phases 3–8 | ₦355,000, agreed, not started |
| Milestone 5, Admin Portal | ₦350,000, agreed, not started |
| Milestone 6, hardening and deployment | ₦250,000, agreed, not started |
| Wiring the app to Milestones 1–4 | **In no milestone and no phase** |
| `VendorContext`, 83 screens | **In no phase** |
| Verification end to end, including the KYC provider | **In no phase** |
| Apple and Google sign-in | Quoted, not approved |
| Popular tag to the agreed specification | Quoted, not approved |
