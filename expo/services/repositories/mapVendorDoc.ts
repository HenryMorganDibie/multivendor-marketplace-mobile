import type { Vendor } from '@/mocks/vendorData';

/**
 * Turns a Firestore vendor document into the Vendor shape the app already uses.
 *
 * The customer-facing surfaces — home, explore, all-vendors, storefront — read
 * through this, so the translation lives here rather than in each screen.
 *
 * The two shapes disagree in a few places that matter:
 *
 *   - the backend keeps location under `location` or `businessLocation`
 *     depending on when the vendor registered; both are read, newest first
 *   - `isVerified` on the backend is the verification decision, which is what
 *     the app's `verified` badge means
 *   - the backend has no notion of "open now"; opening hours live on the vendor
 *     document and are evaluated here rather than stored
 */

type Timestampish = { toDate: () => Date } | { seconds: number } | string | null | undefined;

export function toIso(value: Timestampish): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  const seconds = (value as { seconds?: number }).seconds;
  return typeof seconds === 'number' ? new Date(seconds * 1000).toISOString() : undefined;
}

/**
 * Whether the vendor is open right now, from their own opening hours.
 *
 * Absent hours mean open rather than closed: a vendor who has not filled this
 * in yet is still trading, and hiding them until they configure a schedule
 * would punish them for an unfinished profile.
 */
function isOpenNow(hours: Record<string, { open?: string; close?: string; closed?: boolean }> | undefined): boolean {
  if (!hours) return true;
  const now = new Date();
  const day = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
  const today = hours[day];
  if (!today || today.closed) return false;
  if (!today.open || !today.close) return true;

  const minutes = now.getHours() * 60 + now.getMinutes();
  const [oh, om] = today.open.split(':').map(Number);
  const [ch, cm] = today.close.split(':').map(Number);
  const openAt = oh * 60 + (om || 0);
  const closeAt = ch * 60 + (cm || 0);

  // A closing time earlier than the opening time means it runs past midnight.
  return closeAt < openAt
    ? minutes >= openAt || minutes <= closeAt
    : minutes >= openAt && minutes <= closeAt;
}

/**
 * Derives the legacy uppercase gate status (VendorStatusGate, and
 * vendorMapper.isDiscoverable's fallback path) from the two real backend
 * fields. accountState wins over verification, matching what a vendor
 * actually experiences: a suspended account is suspended regardless of
 * verification standing.
 */
function toGateVendorStatus(
  accountState: string | undefined,
  verificationStatus: string | undefined,
): 'ACTIVE' | 'UNVERIFIED' | 'SUSPENDED' | 'DEACTIVATED' {
  if (accountState === 'suspended') return 'SUSPENDED';
  if (accountState === 'deactivated' || accountState === 'frozen') return 'DEACTIVATED';
  return verificationStatus === 'approved' ? 'ACTIVE' : 'UNVERIFIED';
}

export function mapVendorDoc(id: string, data: Record<string, unknown>): Vendor {
  // businessLocation is the newer field; location is what older vendors have.
  const location = (data.businessLocation ?? data.location ?? {}) as Record<string, string>;

  const fulfillmentTypes = Array.isArray(data.fulfillmentTypes)
    ? (data.fulfillmentTypes as string[])
    : [];

  // vendorMapper.isDiscoverable (the gate behind Home/Explore/Search) checks
  // vendor.verificationStatus and vendor.accountState directly, with a
  // fallback onto vendor.vendorStatus === 'ACTIVE' (uppercase) for mock
  // data. None of these three were ever set here, so every real vendor's
  // verification/account state read as undefined and isDiscoverable()
  // always returned false — no real vendor, however verified, could ever
  // appear in public discovery. accountState and verificationStatus are a
  // direct passthrough: the backend's real enums already match these
  // fields' types exactly. isDiscoverable itself is also passed through
  // directly, since onVendorWrite already computes the authoritative
  // answer server-side (isPublished && isVerified && vendorStatus ===
  // 'active' && country active) — no need to re-derive it client-side too.
  const verificationStatus = (data.verificationStatus as Vendor['verificationStatus']) ?? undefined;
  const accountState = (data.vendorStatus as Vendor['accountState']) ?? undefined;

  return {
    id,
    slug: (data.slug as string) ?? (data.username as string) ?? id,
    username: (data.username as string) ?? '',
    // usernameReservation.ts's changeUsername already writes this via
    // arrayUnion; nothing here read it back, so the cooldown/yearly-limit
    // display (VendorPlanContext.getUsernameChangeEligibility) tracked
    // changes in a local, per-device AsyncStorage copy instead - it reset to
    // empty on reinstall or a new device, showing "eligible" even when the
    // server's own real history would still enforce the cooldown.
    usernameChangeHistory: Array.isArray(data.usernameChangeHistory)
      ? (data.usernameChangeHistory as { changedAt: Timestampish; oldUsername: string; newUsername: string }[]).map((c) => ({
          date: toIso(c.changedAt) ?? new Date(0).toISOString(),
          oldUsername: c.oldUsername,
          newUsername: c.newUsername,
        }))
      : undefined,
    name: (data.businessName as string) || (data.name as string) || '',
    category: (data.category as string) ?? '',
    categoryId: (data.categoryId as string) ?? undefined,

    rating: (data.ratingAverage as number) ?? 0,
    reviewCount: (data.ratingCount as number) ?? 0,

    region: location.stateName ?? (data.region as string) ?? '',
    city: location.areaName ?? (data.city as string) ?? '',
    area: location.areaName ?? (data.area as string) ?? '',
    countryCode: (data.countryCode as string) ?? location.countryCode ?? '',
    country: (data.country as string) ?? location.countryName ?? undefined,
    state: location.stateName ?? undefined,

    email: (data.email as string) ?? undefined,
    phone: (data.phoneNumber as string) ?? undefined,

    isVerified: data.isVerified === true,
    isDiscoverable: data.isDiscoverable === true,
    verificationStatus,
    accountState,
    vendorStatus: toGateVendorStatus(accountState, verificationStatus),
    logoImage: (data.logoUrl as string) ?? undefined,
    bannerImage: (data.coverImageUrl as string) ?? undefined,
    description: (data.description as string) ?? undefined,

    // Written by updateVendorStorefront. Missing here meant a vendor's saved
    // website/Instagram/TikTok never came back out of the document — the
    // storefront-appearance fields reset to empty on every load, and the
    // links never reached the customer-facing storefront.
    contactLinks: (data.contactLinks as Record<string, string | null> | undefined)
      ? {
          website: (data.contactLinks as Record<string, string | null>).website ?? undefined,
          instagram: (data.contactLinks as Record<string, string | null>).instagram ?? undefined,
          tiktok: (data.contactLinks as Record<string, string | null>).tiktok ?? undefined,
        }
      : undefined,

    fulfillmentTypes,
    // The booleans and the array say the same thing; both are kept because
    // different screens read different ones.
    pickup: fulfillmentTypes.includes('pickup'),
    delivery: fulfillmentTypes.includes('delivery'),
    shipping: fulfillmentTypes.includes('shipping'),

    // The sole canonical Business Hours representation (written by
    // updateVendorSettings.ts). Informational only -- nothing in this app
    // may derive a customer-facing Open Now/Closed state from it.
    weeklyHours: (data.weeklyHours as Vendor['weeklyHours']) ?? undefined,

    isOpenNow: isOpenNow(data.openingHours as Record<string, { open?: string; close?: string; closed?: boolean }> | undefined),

    taxEnabled: data.taxEnabled === true,
    taxRate: (data.taxRate as number) ?? 0,

    // Written by updateVendorSettings directly onto this document. Both were
    // declared on the Vendor type already (the mock data has always carried
    // them) but never read back out of a real document, so a vendor's saved
    // minimum order amount / policy vanished the moment the live listener's
    // next snapshot replaced local state with this mapper's output.
    minimumOrderAmount: (data.minimumOrderAmount as number) ?? undefined,
    policy: (data.policy as string) ?? undefined,

    // paymentInstructions/ownershipConfirmed etc. are deliberately NOT read
    // from this document anymore — this doc is publicly readable by any
    // discoverable/published vendor's storefront (see firestore.rules), and
    // Firestore rules cannot filter individual fields on a doc read. Those
    // fields now live in the private vendors/{vendorId}/settings/payment
    // subdoc (owner+admin read only) and are merged onto `vendor` by a
    // second listener in VendorContext, not by this mapper.

    createdAt: toIso(data.createdAt as Timestampish),
  };
}
