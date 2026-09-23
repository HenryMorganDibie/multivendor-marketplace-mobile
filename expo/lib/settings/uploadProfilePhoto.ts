import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, storage } from '@/lib/firebase';

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Uploads a customer/vendor profile photo to the path the real Storage
 * rules already allow (users/{userId}/*, deployed since Milestone 1 for
 * every signed-in user — allow create/update if uid() == userId, isImage(),
 * under 5MB). Nothing on the frontend had ever opened a picker for it: the
 * Settings → Profile photo action sheet's Take Photo/Choose Photo options
 * just logged to the console, same shape of gap as
 * uploadStorefrontImage.ts's logo/banner uploads before that was fixed.
 *
 * Returns a download URL, matching uploadStorefrontImage's contract —
 * users/{userId} is `allow read: if true` for the same reason storefront
 * media is: an avatar has to be loadable by whoever's viewing it (other
 * customers/vendors in chat, order lists), and there is no server-side
 * render step to resolve a private path through the Admin SDK.
 */
export async function uploadProfilePhoto(localUri: string): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in.');

  // React Native has no File; fetching the local uri and taking the blob is
  // the supported way to hand a picked image to the Storage SDK.
  const response = await fetch(localUri);
  const blob = await response.blob();

  if (blob.size > MAX_BYTES) {
    throw new Error('That image is larger than 5MB. Please choose a smaller one.');
  }

  // Extension from the blob's real type, not the filename — a picker can
  // hand back a .jpg that is actually a PNG, and the rules check the object
  // itself.
  const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
  const path = `users/${user.uid}/profile_${Date.now()}.${ext}`;

  const objectRef = ref(storage, path);
  await uploadBytes(objectRef, blob, { contentType: blob.type || 'image/jpeg' });

  return getDownloadURL(objectRef);
}
