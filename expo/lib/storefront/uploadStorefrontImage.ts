import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, storage } from '@/lib/firebase';

export type StorefrontImageKind = 'logo' | 'banner';

/** Matches the Storage rules' underMb() caps for each path. */
const MAX_BYTES: Record<StorefrontImageKind, number> = {
  logo: 5 * 1024 * 1024,
  banner: 8 * 1024 * 1024,
};

const FOLDER: Record<StorefrontImageKind, string> = {
  logo: 'logos',
  banner: 'banners',
};

/**
 * Uploads a storefront logo or banner to the path the Storage rules allow.
 *
 * vendorMedia/{vendorId}/logos and /banners have had rules deployed since
 * Milestone 4 with nothing ever writing to them: the storefront-appearance
 * screen didn't open a picker at all — tapping "Upload Logo" assigned a
 * hardcoded Unsplash stock photo — so no vendor's real logo or banner had
 * ever left their phone.
 *
 * Returns a download URL rather than the storage path, unlike the invoice
 * logo. These two paths are `allow read: if true` because the images are
 * meant to be public: customers browsing a storefront have to be able to load
 * them, and there is no server-side render step to resolve a private path
 * through the Admin SDK. updateVendorStorefront still checks the URL points
 * at this bucket and this vendor's own prefix, so a vendor can't point their
 * storefront at an arbitrary image elsewhere on the internet.
 */
export async function uploadStorefrontImage(
  localUri: string,
  kind: StorefrontImageKind,
): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in.');

  const token = await user.getIdTokenResult();
  const vendorId = token.claims.vendorId as string | undefined;
  if (!vendorId) throw new Error('Vendor ID could not be determined.');

  // React Native has no File; fetching the local uri and taking the blob is
  // the supported way to hand a picked image to the Storage SDK.
  const response = await fetch(localUri);
  const blob = await response.blob();

  if (blob.size > MAX_BYTES[kind]) {
    const mb = MAX_BYTES[kind] / (1024 * 1024);
    throw new Error(`That image is larger than ${mb}MB. Please choose a smaller one.`);
  }

  // Extension from the blob's real type, not the filename — a picker can hand
  // back a .jpg that is actually a PNG, and the rules check the object itself.
  const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
  const path = `vendorMedia/${vendorId}/${FOLDER[kind]}/${kind}_${Date.now()}.${ext}`;

  const objectRef = ref(storage, path);
  await uploadBytes(objectRef, blob, { contentType: blob.type || 'image/jpeg' });

  return getDownloadURL(objectRef);
}
