import { Share } from 'react-native';

/**
 * Sharing a storefront.
 *
 * The share used to send "Check out my catalog on the platform!" with no link in it
 * at all, so a vendor posting it to WhatsApp gave their customers a sentence
 * and nothing to tap. This builds the real link and refuses to share one that
 * would not work.
 */

/**
 * Where a shared storefront lives.
 *
 * A web address rather than a deep link, because a link is pasted into
 * WhatsApp, Instagram and SMS where most recipients do not have the app. The
 * web page handles opening the app if it is installed.
 */
const STOREFRONT_BASE_URL = 'https://the platform.com/store';

export function storefrontUrl(username: string): string {
  return `${STOREFRONT_BASE_URL}/${username.trim().toLowerCase().replace(/^@/, '')}`;
}

export type ShareRefusalReason =
  | 'no_username'
  | 'not_published'
  | 'not_discoverable_but_shareable';

export interface StorefrontShareability {
  canShare: boolean;
  reason?: ShareRefusalReason;
  message?: string;
}

/**
 * Whether a storefront is worth sharing yet.
 *
 * Publication is the real gate, not verification. An unverified vendor is
 * deliberately allowed to publish and share their own link — they simply do not
 * appear in discovery until verified. Blocking sharing on verification would
 * stop a new business trading at all while they wait, which is the opposite of
 * what progressive onboarding is for.
 */
export function checkShareable(vendor: {
  username?: string | null;
  isPublished?: boolean;
  isDiscoverable?: boolean;
}): StorefrontShareability {
  if (!vendor.username) {
    return {
      canShare: false,
      reason: 'no_username',
      message: 'Choose your storefront username before sharing.',
    };
  }

  if (!vendor.isPublished) {
    return {
      canShare: false,
      reason: 'not_published',
      message: 'Publish your storefront first. Customers cannot open an unpublished link.',
    };
  }

  return { canShare: true };
}

/**
 * Opens the share sheet with a real link.
 *
 * The message names the business, because a bare URL pasted into a chat tells
 * the recipient nothing about what they are opening.
 */
export async function shareStorefront(vendor: {
  username?: string | null;
  businessName?: string | null;
  isPublished?: boolean;
}): Promise<{ shared: boolean; reason?: ShareRefusalReason }> {
  const check = checkShareable(vendor);
  if (!check.canShare) {
    return { shared: false, reason: check.reason };
  }

  const url = storefrontUrl(vendor.username!);
  const name = vendor.businessName?.trim();

  const message = name
    ? `${name} on the platform — browse and order directly.\n${url}`
    : `My storefront on the platform — browse and order directly.\n${url}`;

  try {
    const result = await Share.share({
      message,
      // iOS shows url separately; Android folds it into the message, which is
      // why it appears in both rather than only one.
      url,
      title: name ?? 'My the platform storefront',
    });
    return { shared: result.action === Share.sharedAction };
  } catch (error) {
    console.error('[Storefront] Share failed:', error);
    return { shared: false };
  }
}

/**
 * Sharing a single item rather than the whole storefront.
 *
 * Deep-links to the item on the storefront page, so a vendor answering "how
 * much is the meat pie" sends the item rather than the whole catalogue.
 */
export function itemUrl(username: string, itemId: string): string {
  return `${storefrontUrl(username)}?item=${encodeURIComponent(itemId)}`;
}

export async function shareItem(
  vendor: { username?: string | null; businessName?: string | null; isPublished?: boolean },
  item: { id: string; name: string; price?: number; currency?: string }
): Promise<{ shared: boolean; reason?: ShareRefusalReason }> {
  const check = checkShareable(vendor);
  if (!check.canShare) return { shared: false, reason: check.reason };

  const url = itemUrl(vendor.username!, item.id);
  const message = `${item.name} — ${vendor.businessName ?? 'on the platform'}\n${url}`;

  try {
    const result = await Share.share({ message, url, title: item.name });
    return { shared: result.action === Share.sharedAction };
  } catch (error) {
    console.error('[Storefront] Item share failed:', error);
    return { shared: false };
  }
}
