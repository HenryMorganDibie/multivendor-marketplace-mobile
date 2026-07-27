/**
 * DEVELOPMENT-ONLY route — the platform AI state preview tool.
 *
 * Reachable ONLY from the `__DEV__`-gated button in
 * `app/chat/ai/[vendorId].tsx`. In production, `__DEV__` is false, so the
 * button never renders and this route is never linked to. Expo Router still
 * discovers the file, but the screen is inert without the dev entry point.
 *
 * Henry (backend integration): delete this file and
 * `components/dev/AiStatePreview.tsx`, and remove the `__DEV__` block in
 * `app/chat/ai/[vendorId].tsx`. No other cleanup needed.
 */
export { default } from '@/components/dev/AiStatePreview';
