import { ref, uploadBytes } from 'firebase/storage';
import { auth, storage, callable } from '@/lib/firebase';

/** Matches ALLOWED_DOC_TYPES in functions/src/vendors/verificationSubmission.ts. */
export type VerificationDocumentType = 'business_info' | 'identity_document' | 'proof_of_address' | 'other';

/**
 * Uploads a verification document and records it with the backend.
 *
 * recordVerificationDocument has been deployed since P1-FB-005 and nothing
 * ever called it. The verification screens held the picked image's local
 * file:// URI in AsyncStorage and nothing more — the file never left the
 * device, so `vendorVerification/{vendorId}/documents` stayed empty and
 * submitVendorVerification's required-document check could never pass for
 * a real vendor.
 *
 * Two steps, mirroring uploadInvoiceLogo: upload to the exact Storage path
 * the backend and storage.rules expect, then call the callable so it can
 * read the file's real, server-verified metadata (not whatever the client
 * claims) before recording it.
 */
export async function uploadVerificationDocument(
  localUri: string,
  type: VerificationDocumentType,
): Promise<{ docId: string; storagePath: string }> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in.');

  const token = await user.getIdTokenResult();
  const vendorId = token.claims.vendorId as string | undefined;
  if (!vendorId) throw new Error('Vendor ID could not be determined.');

  // React Native has no File; fetching the local uri and taking the blob is
  // the supported way to hand a picked image to the Storage SDK.
  const response = await fetch(localUri);
  const blob = await response.blob();

  if (blob.size > 15 * 1024 * 1024) {
    throw new Error('That file is larger than 15MB. Please choose a smaller file.');
  }

  const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : blob.type.includes('pdf') ? 'pdf' : 'jpg';
  const storagePath = `verificationDocuments/${vendorId}/${type}_${Date.now()}.${ext}`;

  await uploadBytes(ref(storage, storagePath), blob, { contentType: blob.type || 'image/jpeg' });

  const record = callable<
    { type: VerificationDocumentType; storagePath: string },
    { success: true; docId: string }
  >('recordVerificationDocument');
  const res = await record({ type, storagePath });

  return { docId: res.data.docId, storagePath };
}
