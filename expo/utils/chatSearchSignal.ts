/**
 * Module-level signal for cross-screen chat search activation.
 *
 * Problem solved: when the vendor-info screen triggers search, a naive
 * `router.replace` remounts the chat screen fresh — losing already-loaded
 * messages and showing the empty state. Using `router.back()` + this signal
 * returns to the already-mounted chat screen (which has messages) and tells
 * it to activate search via `useFocusEffect`.
 *
 * Backend migration note: replace with a lightweight context or navigation
 * state once the app moves to real-time data; the module-level approach is
 * safe here because only one chat screen is mounted at a time.
 */

let pendingVendorId: string | null = null;

/**
 * Signal that the in-chat search overlay should open for the given vendorId.
 * Call this before `router.back()` so the chat screen picks it up when it
 * regains focus.
 */
export function signalChatSearchActivation(vendorId: string): void {
  pendingVendorId = vendorId;
}

/**
 * Consume the pending search signal for a specific vendorId.
 * Returns `true` (and clears the signal) if a search was pending for this
 * vendor. Call inside `useFocusEffect` in the chat screen.
 */
export function consumeChatSearchSignal(vendorId: string): boolean {
  if (pendingVendorId === vendorId) {
    pendingVendorId = null;
    return true;
  }
  return false;
}
