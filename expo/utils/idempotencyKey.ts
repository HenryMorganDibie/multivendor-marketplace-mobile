import * as Crypto from 'expo-crypto';

/**
 * One idempotency key per logical save operation, not per screen mount.
 *
 * Uses expo-crypto's Crypto.randomUUID() unconditionally -- no fallback.
 * expo-crypto (~15.0.9, matching this project's Expo SDK 54) is Expo's own
 * documented mechanism for a cryptographically secure RFC 4122 v4 UUID,
 * and supports every platform this app targets (Android, iOS, web, Expo
 * Go), so there is no remaining platform gap that would justify a weaker
 * fallback path. No Math.random(), no Date.now(), no bare
 * `globalThis.crypto` probing, no transitive `uuid` import, no hand-written
 * UUID algorithm.
 *
 * Kept as its own dedicated module (not merged into
 * services/paymentInstructionsService.ts) so idempotency/UUID generation
 * stays isolated from the Firebase transport concern, and so any future
 * idempotency-key behavior has one clear place to live.
 */
export function generateIdempotencyKey(): string {
  return Crypto.randomUUID();
}
