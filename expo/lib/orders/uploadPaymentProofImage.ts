import { ref, uploadBytes } from 'firebase/storage';
import { storage } from '@/lib/firebase';

/**
 * Uploads one locally-picked payment proof image to Storage.
 *
 * Mirrors uploadVerificationDocument.ts: React Native has no File, so the
 * picked image's local file:// uri is fetched and its blob taken, then
 * uploaded to the exact path storage.rules expects for this vendor/order.
 * submitPaymentProof only accepts a storagePath, never a raw device uri.
 */
export async function uploadPaymentProofImage(
  localUri: string,
  vendorId: string,
  orderId: string,
): Promise<{ storagePath: string }> {
  const response = await fetch(localUri);
  const blob = await response.blob();

  if (blob.size > 15 * 1024 * 1024) {
    throw new Error('That image is larger than 15MB. Please choose a smaller one.');
  }

  const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
  const storagePath = `paymentProofs/${vendorId}/${orderId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

  await uploadBytes(ref(storage, storagePath), blob, { contentType: blob.type || 'image/jpeg' });

  return { storagePath };
}
