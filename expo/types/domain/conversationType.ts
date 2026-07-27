/**
 * Conversation kind — single source of truth.
 *
 * The canonical union lives in `mocks/inboxData` and is re-exported here. The
 * backend models four primary conversation kinds; `custom_order` and `creator`
 * remain in the union for existing in-app flows and map onto `order` / `inquiry`
 * at the backend boundary.
 */
export type { ConversationType } from '@/mocks/inboxData';

/** The four backend-canonical conversation kinds. */
export type BackendConversationType = 'inquiry' | 'order' | 'ai' | 'support';
