import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, storage } from '@/lib/firebase';

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Uploads a single catalog item photo to Storage and returns its download URL.
 *
 * add-item and edit both stored the picker's local uri (file://... or a
 * native asset id) directly in the photos array and sent that straight to
 * createCatalogItem/updateCatalogItem — never uploading anything. It rendered
 * fine in the same session, on the same device, because that local file
 * still existed, then vanished everywhere else: reopen the item, another
 * device, the storefront a customer sees. Same failure vendorMedia/logos and
 * /banners had before uploadStorefrontImage existed.
 */
export async function uploadCatalogItemPhoto(localUri: string): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in.');

  const token = await user.getIdTokenResult();
  const vendorId = token.claims.vendorId as string | undefined;
  if (!vendorId) throw new Error('Vendor ID could not be determined.');

  const response = await fetch(localUri);
  const blob = await response.blob();

  if (blob.size > MAX_BYTES) {
    throw new Error(`That photo is larger than ${MAX_BYTES / (1024 * 1024)}MB. Please choose a smaller one.`);
  }

  const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
  const path = `vendorMedia/${vendorId}/catalogItems/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

  const objectRef = ref(storage, path);
  await uploadBytes(objectRef, blob, { contentType: blob.type || 'image/jpeg' });

  return getDownloadURL(objectRef);
}

/** Already-uploaded photos are https URLs; only local picker uris need uploading. */
export function isUploadedPhotoUrl(uri: string): boolean {
  return uri.startsWith('https://') || uri.startsWith('http://');
}

export async function uploadCatalogItemPhotos(uris: string[]): Promise<string[]> {
  return Promise.all(
    uris.map((uri) => (isUploadedPhotoUrl(uri) ? Promise.resolve(uri) : uploadCatalogItemPhoto(uri)))
  );
}
