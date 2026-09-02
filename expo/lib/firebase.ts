import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeAuth, getAuth, connectAuthEmulator } from "firebase/auth";
// @ts-expect-error — getReactNativePersistence exists at runtime but isn't in the firebase/auth type defs yet
import { getReactNativePersistence } from "firebase/auth";
import { getFunctions, connectFunctionsEmulator, httpsCallable } from "firebase/functions";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { getFirestore, initializeFirestore, connectFirestoreEmulator } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

/**
 * Emulator mode — set EXPO_PUBLIC_USE_FIREBASE_EMULATOR=true to run against
 * the local Firebase Emulator Suite (`firebase emulators:start --project
 * demo-platform`), matching the same pattern the vendor portal uses.
 */
const USE_EMULATOR = process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR === "true";

const firebaseConfig = USE_EMULATOR
  ? { apiKey: "demo", projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "demo-platform" }
  : {
      apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    };

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Native needs explicit AsyncStorage-backed persistence or auth state is
// lost on every app restart; web falls back to the default browser
// persistence via plain getAuth().
export const auth = Platform.OS === "web"
  ? getAuth(firebaseApp)
  : (() => {
      try {
        return initializeAuth(firebaseApp, { persistence: getReactNativePersistence(AsyncStorage) });
      } catch {
        // initializeAuth throws if already called (Fast Refresh re-runs this module) — fall back to the existing instance.
        return getAuth(firebaseApp);
      }
    })();

export const functions = getFunctions(firebaseApp);
export const storage = getStorage(firebaseApp);
/**
 * Firestore, with long polling auto-detected.
 *
 * Its default transport is a streaming WebChannel connection. Plenty of real
 * networks refuse to carry it — corporate proxies, some mobile carriers, and
 * anything doing deep packet inspection — and the failure is silent for ten
 * seconds and then reads "Could not reach Cloud Firestore backend", with no
 * indication that the network rather than the app is the problem.
 *
 * That is what someone testing on their phone hits while the same build works
 * on a laptop on a different connection. Everything that reads Firestore
 * directly stalls: the users/{uid} lookup that registration waits on, the
 * session rebuild on login, and signing out.
 *
 * autoDetectLongPolling keeps the fast transport where it works and falls back
 * to long polling where it does not, rather than forcing the slower path on
 * everyone. initializeFirestore has to run before anything calls getFirestore,
 * which is why it is here and not at first use.
 */
export const db = (() => {
  try {
    return initializeFirestore(firebaseApp, { experimentalAutoDetectLongPolling: true });
  } catch {
    // Already initialised — Fast Refresh re-runs this module in development.
    return getFirestore(firebaseApp);
  }
})();

declare global {
  // eslint-disable-next-line no-var
  var __PlatformEmulatorConnected: boolean | undefined;
}
if (USE_EMULATOR && !globalThis.__PlatformEmulatorConnected) {
  const emulatorHost = Platform.OS === "android" ? "10.0.2.2" : "127.0.0.1";
  connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
  connectFunctionsEmulator(functions, emulatorHost, 5001);
  connectStorageEmulator(storage, emulatorHost, 9199);
  connectFirestoreEmulator(db, emulatorHost, 8080);
  globalThis.__PlatformEmulatorConnected = true;
}

export function callable<Req = Record<string, unknown>, Res = unknown>(name: string) {
  return httpsCallable<Req, Res>(functions, name);
}
