/**
 * Notification types — single source of truth.
 *
 * Notifications are per-user, and the two audiences have distinct event sets.
 * Both canonical unions are re-exported from their owning contexts, and
 * {@link NotificationType} is the union of both for code that handles either.
 */
export type { VendorNotificationType } from '@/contexts/VendorNotificationContext';
export type { CustomerNotificationType } from '@/contexts/CustomerNotificationContext';
export type { NotificationDomain } from '@/contexts/VendorNotificationContext';

import type { VendorNotificationType } from '@/contexts/VendorNotificationContext';
import type { CustomerNotificationType } from '@/contexts/CustomerNotificationContext';

/** Any notification type across both audiences. */
export type NotificationType = VendorNotificationType | CustomerNotificationType;
