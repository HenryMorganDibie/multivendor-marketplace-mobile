import { ref, uploadBytes } from 'firebase/storage';
import { auth, storage } from '@/lib/firebase';

/**
 * Uploads an invoice logo to the path the backend will accept.
 *
 * The Storage rules for this have been deployed since Milestone 4 and nothing
 * ever uploaded anything: the branding screen held a local file:// uri, so a
 * vendor's logo never left their phone and never reached the PDF renderer.
 *
 * updateInvoiceBranding refuses any logoUrl not under
 * invoiceBranding/{vendorId}/, and re-checks the stored object's real content
 * type and size rather than trusting what the client declared. The rules cap it
 * at 2MB and images only. So the path here is not a convention — it is the only
 * path that will be accepted, and both ends enforce it.
 *
 * Returns the storage path rather than a download URL. That is what the backend
 * stores and what the renderer resolves through the Admin SDK, which bypasses
 * Storage rules; a public download URL would make every vendor's logo readable
 * by anyone who guessed it.
 */
export async function uploadInvoiceLogo(localUri: string): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in.');

  const token = await user.getIdTokenResult();
  const vendorId = token.claims.vendorId as string | undefined;
  if (!vendorId) throw new Error('Vendor ID could not be determined.');

  // React Native has no File; fetching the local uri and taking the blob is the
  // supported way to hand a picked image to the Storage SDK.
  const response = await fetch(localUri);
  const blob = await response.blob();

  if (blob.size > 2 * 1024 * 1024) {
    throw new Error('That logo is larger than 2MB. Please choose a smaller image.');
  }

  // Extension from the blob's real type, not from the filename. A picker can
  // hand back a .jpg that is actually a PNG, and the rules check the object.
  const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
  const path = `invoiceBranding/${vendorId}/logo_${Date.now()}.${ext}`;

  await uploadBytes(ref(storage, path), blob, { contentType: blob.type || 'image/jpeg' });

  return path;
}
