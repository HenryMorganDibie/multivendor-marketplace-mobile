import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useSegments, useGlobalSearchParams } from 'expo-router';
import { createUserWithEmailAndPassword, deleteUser, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth as firebaseAuth, db as firestore, callable } from '@/lib/firebase';
import { DEV_LOCAL_AUTH_ENABLED } from '@/constants/devAuth';
import { VendorPlan } from './VendorPlanContext';
import { mapRegistrationError, mapLoginError, type AuthErrorField } from '@/lib/auth/authErrors';

type UserRole = 'customer' | 'vendor' | 'admin';

type AccountStatus = 'active' | 'pending_deletion' | 'deactivated' | 'frozen' | 'banned';

type VendorStatus = 'pending' | 'approved';

type AuthProvider = 'google' | 'apple' | 'email';
type AcquisitionSource = 'field_sales' | 'vendor_referral' | 'organic';
type SignupChannel = 'mobile_vendor_app';

interface User {
  id: string;
  identifier: string;
  role: UserRole;
  status: AccountStatus;
  onboardingComplete?: boolean;
  onboardingCompleted?: boolean;
  vendorStatus?: VendorStatus;
  authProvider?: AuthProvider;
  firstName?: string;
  lastName?: string;
  lastInitial?: string;
  email?: string;
  countryCode?: string;
  countryName?: string;
  stateCode?: string;
  stateName?: string;
  areaId?: string;
  areaName?: string;
  referralCode?: string;
  acquisitionSource?: AcquisitionSource;
  signupChannel?: SignupChannel;
  createdAt?: string;
  referralRepId?: string;
  referralRepName?: string;
  referralAssignedCountry?: string;
  referralAssignedState?: string;
  referralAssignedArea?: string;
  referralStatus?: 'active' | 'inactive';
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasSeenOnboarding: boolean;
}

interface LoginCredentials {
  emailOrPhone: string;
  password?: string;
  otp?: string;
}

interface LoginResponse {
  success: boolean;
  user?: User;
  error?: string;
  /** Which input the message belongs to, so the screen can focus it. */
  errorField?: AuthErrorField;
}

interface RegistrationCheck {
  exists: boolean;
  role?: UserRole;
}

interface SignupLocation {
  countryCode: string;
  countryName: string;
  stateCode: string;
  stateName: string;
  areaId: string;
  areaName: string;
}

interface RegistrationData {
  identifier: string;
  password: string;
  role: UserRole;
  businessName?: string;
  username?: string;
  plan?: VendorPlan;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  businessDescription?: string;
  categoryId?: string;
  categoryName?: string;
  country?: string;
  state?: string;
  area?: string;
  location?: SignupLocation;
  referralCode?: string;
  acquisitionSource?: AcquisitionSource;
  signupChannel?: SignupChannel;
  createdAt?: string;
  referralRepId?: string;
  referralRepName?: string;
  referralAssignedCountry?: string;
  referralAssignedState?: string;
  referralAssignedArea?: string;
  referralStatus?: 'active' | 'inactive';
  isDiscoverable?: boolean;
}

const AUTH_STORAGE_KEY = '@the platform_auth_user';
const ACCOUNTS_DB_KEY = '@the platform_accounts_db';
const ONBOARDING_KEY = '@the platform_onboarding_seen';

interface AccountRecord {
  id: string;
  identifier: string;
  role: UserRole;
  password: string;
  status: AccountStatus;
  onboardingComplete?: boolean;
  onboardingCompleted?: boolean;
  authProvider?: AuthProvider;
  businessName?: string;
  vendorStatus?: VendorStatus;
  firstName?: string;
  lastName?: string;
  lastInitial?: string;
  email?: string;
  countryCode?: string;
  countryName?: string;
  stateCode?: string;
  stateName?: string;
  areaId?: string;
  areaName?: string;
  username?: string;
  plan?: VendorPlan;
  fullName?: string;
  phone?: string;
  categoryId?: string;
  categoryName?: string;
  country?: string;
  state?: string;
  area?: string;
  location?: SignupLocation;
  businessDescription?: string;
  referralCode?: string;
  acquisitionSource?: AcquisitionSource;
  signupChannel?: SignupChannel;
  createdAt?: string;
  referralRepId?: string;
  referralRepName?: string;
  referralAssignedCountry?: string;
  referralAssignedState?: string;
  referralAssignedArea?: string;
  referralStatus?: 'active' | 'inactive';
  isDiscoverable?: boolean;
}


/**
 * Builds a session from the only two sources that are authoritative: the
 * token's custom claims and the users/{uid} document. Both are written by the
 * backend and neither can be altered from a device.
 *
 * Returns a reason rather than throwing, because every failure here is a login
 * the user should be told about, not a crash.
 */
type RebuiltSession = { ok: true; user: User } | { ok: false; error: string };

const BLOCKED_STATUSES: AccountStatus[] = ['pending_deletion', 'deactivated', 'frozen', 'banned'];

/**
 * The built-in test logins. These exist only in the local mock store and have
 * no Firebase account, so the revalidation below must not sign them out for
 * failing a check that was never going to pass.
 */
const DEMO_ACCOUNT_IDS = new Set(['1', '2', '3']);

async function buildSessionFromBackend(uid: string, identifier: string): Promise<RebuiltSession> {
  const current = firebaseAuth.currentUser;
  if (!current) return { ok: false, error: 'Could not verify your session. Please try again.' };

  // Claims carry the role the backend assigned. A device cannot set these.
  const token = await current.getIdTokenResult(true);
  const claimRole = token.claims.role as UserRole | undefined;

  const snap = await getDoc(doc(firestore, 'users', uid));
  if (!snap.exists()) {
    // Authenticated but with no profile: registration never finished. Sending
    // them into the app would be the half-made account problem again.
    return { ok: false, error: 'Your account setup is incomplete. Please register again or contact support.' };
  }

  const data = snap.data() as Record<string, unknown>;
  let status = ((data.accountStatus as AccountStatus) ?? 'active');

  // Both deletion screens promise this: logging back in within the 90-day
  // grace period undoes the request. Attempted here, once, right at the
  // point a blocked pending_deletion account would otherwise be refused.
  if (status === 'pending_deletion') {
    try {
      const restore = callable<Record<string, never>, { restored: boolean }>('restoreAccountIfEligible');
      const res = await restore({});
      if (res.data.restored) {
        status = 'active';
      }
    } catch (error) {
      console.error('[AUTH] Could not check account-deletion restore eligibility:', error);
    }
  }

  if (BLOCKED_STATUSES.includes(status)) {
    return { ok: false, error: 'This account is currently unavailable. Please contact support.' };
  }

  const onboarding = (data.onboarding ?? {}) as { completed?: boolean };
  // Name lives under the nested `profile` map — the only place a client-side
  // write can put it, since firestore.rules' userUpdateAllowed() only
  // allowlists `profile`/`onboarding` (plus a few others) for self-writes on
  // users/{uid}, not top-level firstName/lastInitial fields. This used to be
  // read as data.firstName directly, which was always undefined here (that
  // field was never written to Firestore by anything), so every fresh
  // session — new device, cleared storage, a fully expired token — sent an
  // already-completed profile straight back to /complete-profile.
  const profile = (data.profile ?? {}) as { firstName?: string; lastInitial?: string; lastName?: string };

  return {
    ok: true,
    user: {
      id: uid,
      identifier,
      email: (data.email as string) ?? identifier,
      // The claim wins over the document: it is what every backend call is
      // actually authorised against.
      role: claimRole ?? ((data.role as UserRole) ?? 'customer'),
      status,
      firstName: profile.firstName,
      lastInitial: profile.lastInitial,
      lastName: profile.lastName,
      // Both spellings: other call sites in this file keep them in sync, and
      // the route guard's profileComplete check reads the 'Completed' one.
      onboardingComplete: onboarding.completed === true,
      onboardingCompleted: onboarding.completed === true,
      authProvider: 'email' as AuthProvider,
      vendorId: (data.vendorId as string) ?? undefined,
    } as User,
  };
}

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    hasSeenOnboarding: false,
  });

  const router = useRouter();
  const segments = useSegments();

  const redirectAfterLogin = useCallback((user: User) => {
    if (user.role === 'customer') {
      router.replace('/customer' as any);
    } else if (user.role === 'vendor') {
      if (user.vendorStatus === 'pending') {
        router.replace('/vendor/pending' as any);
      } else {
        router.replace('/vendor/(tabs)/dashboard' as any);
      }
    } else if (user.role === 'admin') {
      router.replace('/admin/moderation' as any);
    }
  }, [router]);

  const loadStoredAuth = useCallback(async () => {
    try {
      const [stored, onboardingSeen] = await Promise.all([
        AsyncStorage.getItem(AUTH_STORAGE_KEY),
        AsyncStorage.getItem(ONBOARDING_KEY),
      ]);
      
      const hasSeenOnboarding = onboardingSeen === 'true';
      
      if (stored) {
        const user: User = JSON.parse(stored);

        /**
         * The stored copy is a cache, not a credential.
         *
         * It used to be trusted outright at launch, so the app started
         * authenticated on the strength of a JSON file the device owns. An
         * account banned, frozen or deleted since the last launch carried on
         * working, and anything able to edit that file could change its own
         * role.
         *
         * So it is shown immediately, because making everyone wait on the
         * network to see their own app is worse, and then checked against
         * Firebase and the users document as soon as that resolves. The
         * onIdTokenChanged listener below does the checking; this only decides
         * what to show while it runs.
         */
        setAuthState({
          user,
          isLoading: false,
          isAuthenticated: true,
          hasSeenOnboarding: true,
        });
      } else {
        setAuthState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
          hasSeenOnboarding,
        });
      }
    } catch (error) {
      console.error('Failed to load auth state:', error);
      setAuthState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        hasSeenOnboarding: false,
      });
    }
  }, []);

  useEffect(() => {
    void loadStoredAuth();
  }, [loadStoredAuth]);

  /**
   * Revalidates the cached session against Firebase and the users document.
   *
   * The stored copy above is shown immediately so the app is usable at once,
   * but it is a file on the device and proves nothing. This is the check.
   *
   * Three outcomes end the session rather than continuing it: Firebase no
   * longer recognises the user, their users document has gone, or their account
   * status has become one that blocks access. An account banned, frozen or
   * deleted since the last launch used to keep working indefinitely, because
   * nothing ever looked again.
   *
   * Role comes from the token claim rather than the cached value, so a device
   * that edited its own stored role is corrected on the next launch.
   */
  useEffect(() => {
    const unsubscribe = firebaseAuth.onIdTokenChanged(async (fbUser) => {
      if (!fbUser) {
        // Signed out elsewhere, token revoked, or account deleted. Any cached
        // session is now meaningless.
        const cached = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
        if (cached && !DEMO_ACCOUNT_IDS.has((JSON.parse(cached) as User).id)) {
          await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
          setAuthState({ user: null, isLoading: false, isAuthenticated: false, hasSeenOnboarding: true });
        }
        return;
      }

      try {
        const token = await fbUser.getIdTokenResult();
        const snap = await getDoc(doc(firestore, 'users', fbUser.uid));

        if (!snap.exists()) {
          await signOut(firebaseAuth).catch(() => undefined);
          await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
          setAuthState({ user: null, isLoading: false, isAuthenticated: false, hasSeenOnboarding: true });
          return;
        }

        const data = snap.data() as Record<string, unknown>;
        const status = (data.accountStatus as AccountStatus) ?? 'active';

        if (BLOCKED_STATUSES.includes(status)) {
          await signOut(firebaseAuth).catch(() => undefined);
          await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
          setAuthState({ user: null, isLoading: false, isAuthenticated: false, hasSeenOnboarding: true });
          return;
        }

        const onboarding = (data.onboarding ?? {}) as { completed?: boolean };
        const profile = (data.profile ?? {}) as { firstName?: string; lastInitial?: string; lastName?: string };
        const refreshed = {
          id: fbUser.uid,
          identifier: fbUser.email ?? '',
          email: (data.email as string) ?? fbUser.email ?? '',
          role: (token.claims.role as UserRole) ?? ((data.role as UserRole) ?? 'customer'),
          status,
          firstName: profile.firstName,
          lastInitial: profile.lastInitial,
          lastName: profile.lastName,
          onboardingComplete: onboarding.completed === true,
          onboardingCompleted: onboarding.completed === true,
          authProvider: 'email' as AuthProvider,
          vendorId: (data.vendorId as string) ?? undefined,
        } as User;

        await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(refreshed));
        setAuthState({ user: refreshed, isLoading: false, isAuthenticated: true, hasSeenOnboarding: true });
      } catch (error) {
        // A network failure must not log anyone out: being offline is not the
        // same as being unauthorised, and the cached session stands until the
        // check can actually run.
        console.error('[AUTH] Could not revalidate the session:', error);
      }
    });

    return unsubscribe;
  }, []);

  const lastRedirectRef = useRef<string | null>(null);
  const segmentsKey = useMemo(() => segments.join('/'), [segments]);
  const firstSegment = useMemo(() => (segments[0] ?? '') as string, [segments]);

  /**
   * An explicit request to reach the sign-in screen while already signed in.
   *
   * Without this, an authenticated visitor was redirected off every public
   * route including /login (see the isPublicRoute block below), so there was
   * no way at all to sign in as somebody else: the session persists, the root
   * URL opens straight into the previous person's account, and /login bounced
   * back to it. On a shared computer the only workaround was clearing the
   * browser's cookies by hand.
   *
   * It has to be an opt-in flag rather than simply exempting /login, because
   * that redirect is also what carries a vendor off the login screen after a
   * successful sign-in (login.tsx defers to "the auth guard" for that).
   */
  const searchParams = useGlobalSearchParams<{ switchAccount?: string }>();
  const wantsAccountSwitch = searchParams?.switchAccount === '1';

  useEffect(() => {
    if (authState.isLoading) return;

    const fullPath = segmentsKey;

    const safeReplace = (path: string) => {
      if (lastRedirectRef.current === path) return;
      lastRedirectRef.current = path;
      router.replace(path as any);
    };

    // 'legal' must be public: the consent links sit on the registration screen,
    // so anyone reading the Terms, Privacy Policy or Vendor Agreement before
    // creating an account is by definition not signed in yet. Without it the
    // guard bounced them to login, which made the consent links look broken.
    /**
     * `forgot-password` and `i` were missing.
     *
     * Anyone resetting a password is by definition not signed in, so the guard
     * bounced them straight back to login — the button worked, the screen
     * mounted, and the guard redirected before it could be seen. It looked like
     * a dead button because nothing distinguishes "did nothing" from
     * "immediately undone".
     *
     * `i` is the public invoice link. An external customer with a share token
     * has no account and never will; sending them to a login screen makes the
     * link useless to exactly the person it was sent to.
     */
    // 'store' is a shared storefront link — the one route whose entire point
    // is being opened by someone who does not have an account yet. Missing
    // from this list, every such link bounced straight to /login before the
    // storefront page ever got a chance to render, for every vendor,
    // verified or not.
    const publicRoutes = ['login', 'create-account', 'register', 'verify-otp', 'onboarding', 'complete-profile', 'vendor-setup-complete', 'legal', 'forgot-password', 'i', 'invoice-view', 'store'];
    const isPublicRoute = publicRoutes.includes(firstSegment);

    if (!authState.isAuthenticated) {
      if (!isPublicRoute) {
        safeReplace('/login');
      } else {
        lastRedirectRef.current = null;
      }
      return;
    }

    if (!authState.user) {
      safeReplace('/login');
      return;
    }

    const user = authState.user;

    if (!user.role) {
      if (firstSegment !== 'create-account') {
        safeReplace('/create-account');
      } else {
        lastRedirectRef.current = null;
      }
      return;
    }

    if (user.role !== 'customer' && user.role !== 'vendor' && user.role !== 'admin') {
      safeReplace('/role-error');
      return;
    }

    const isDeliberateAccountSwitch =
      wantsAccountSwitch && (firstSegment === 'login' || firstSegment === 'create-account' || firstSegment === 'register');

    if (
      isPublicRoute
      && firstSegment !== 'verify-otp'
      && firstSegment !== 'complete-profile'
      && !isDeliberateAccountSwitch
    ) {
      if (user.role === 'customer') {
        safeReplace('/customer');
      } else if (user.role === 'vendor') {
        if (user.vendorStatus === 'pending') {
          safeReplace('/vendor/pending');
        } else {
          safeReplace('/vendor/(tabs)/dashboard');
        }
      } else if (user.role === 'admin') {
        safeReplace('/admin/moderation');
      }
      return;
    }

    const isVendorPath = fullPath.startsWith('vendor/');
    const isCustomerPath = fullPath.startsWith('customer/');
    const isLegacyTabsPath = fullPath === '' || firstSegment === '(tabs)';

    if (isLegacyTabsPath) {
      if (user.role === 'customer') {
        safeReplace('/customer');
      } else if (user.role === 'vendor') {
        if (user.vendorStatus === 'pending') {
          safeReplace('/vendor/pending');
        } else {
          safeReplace('/vendor/(tabs)/dashboard');
        }
      } else if (user.role === 'admin') {
        safeReplace('/admin/moderation');
      }
      return;
    }

    lastRedirectRef.current = null;

    if (user.role === 'customer') {
      // Location is collected by the dedicated country → state → area flow
      // (LocationSelectorModal) on the customer home screen, not here.
      // Requiring it here caused a duplicate location onboarding prompt.
      const profileComplete = !!user.onboardingCompleted
        && !!user.firstName;

      if (!profileComplete && firstSegment !== 'complete-profile') {
        safeReplace('/complete-profile');
        return;
      }

      if (profileComplete && firstSegment === 'complete-profile') {
        safeReplace('/customer');
        return;
      }

      if (isVendorPath) {
        safeReplace('/customer');
        return;
      }

      const customerAllowedRoutes = [
        'customer/(tabs)',
        'customer/store',
        'store/',
        '@',
        'customer/home',
        'customer/explore',
        'customer/chats',
        'customer/profile',
        'customer/notifications',
        'customer/vendors/',
        'customer/invite',
        'item/',
        'cart',
        'review-order',
        'orders',
        'order/',
        'chat/',
        'settings',
        'help-center',
        'archived-chats',
        'favorites',
        'report-vendor',
        'vendor-ratings/',
        'category/',
        'promotions',
        'global-cart',
        'custom-order-proposal/',
        'order-request/',
        'role-error',
        '+not-found',
        'complete-profile',
      ];

      const isAllowed = customerAllowedRoutes.some(route => fullPath.startsWith(route) || fullPath === route.replace('/', ''));

      if (!isAllowed && fullPath && !isPublicRoute) {
        safeReplace('/customer');
        return;
      }

      return;
    }

    if (user.role === 'vendor') {
      if (user.vendorStatus === 'pending') {
        const allowedPendingRoutes = ['vendor/pending', 'vendor/settings/verification', 'vendor-verification-required'];
        const isAllowedForPending = allowedPendingRoutes.some(route => fullPath.startsWith(route));

        if (!isAllowedForPending) {
          safeReplace('/vendor-verification-required');
          return;
        }
        return;
      }

      if (isCustomerPath) {
        safeReplace('/vendor/(tabs)/dashboard');
        return;
      }

      const vendorAllowedRoutes = [
        'vendor/(tabs)',
        'vendor/dashboard',
        'vendor/catalog',
        'vendor/orders',
        'vendor/chats',
        'vendor/settings',
        'vendor/custom-order',
        'vendor/invoice',
        'vendor/receipt',
        'vendor/chat',
        'vendor/send-payment-request',
        'vendor/notifications',
        'vendor/archived-chats',
        'vendor/customer-orders',
        'vendor/ratings',
        'vendor/growth-insights',
        'vendor/pending',
        'vendor/settings/select-username',
        'vendor-setup-complete',
        'role-error',
        '+not-found',
      ];

      const isAllowed = vendorAllowedRoutes.some(route => fullPath.startsWith(route));

      if (!isAllowed && fullPath && !isPublicRoute) {
        safeReplace('/vendor/(tabs)/dashboard');
        return;
      }

      return;
    }
  }, [authState.isAuthenticated, authState.isLoading, authState.user, segmentsKey, firstSegment, router, wantsAccountSwitch]);

  const getAccountsDb = useCallback(async (): Promise<AccountRecord[]> => {
    try {
      const stored = await AsyncStorage.getItem(ACCOUNTS_DB_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
      const defaultAccounts: AccountRecord[] = [
        {
          id: '1',
          identifier: 'customer@test.com',
          role: 'customer',
          password: 'password',
          status: 'active',
          // The vendor fixture below has always had this; the customer one did
          // not, so signing in as customer@test.com looked like a brand-new
          // account and was sent through Complete your profile and the whole
          // location flow on every single login.
          onboardingComplete: true,
        },
        {
          id: '2',
          identifier: 'vendor@test.com',
          role: 'vendor',
          password: 'password',
          status: 'active',
          onboardingComplete: true,
          vendorStatus: 'approved',
        },
      ];
      await AsyncStorage.setItem(ACCOUNTS_DB_KEY, JSON.stringify(defaultAccounts));
      return defaultAccounts;
    } catch {
      return [];
    }
  }, []);

  const saveAccountsDb = useCallback(async (accounts: AccountRecord[]): Promise<void> => {
    await AsyncStorage.setItem(ACCOUNTS_DB_KEY, JSON.stringify(accounts));
  }, []);

  /**
   * The local development login.
   *
   * Compares a plaintext password against an on-device store and accepts a
   * fixed OTP of 123456. Both are fine for demos and for reviewing screens
   * without a backend, and both would be serious in a shipped build: the OTP
   * accepts any phone number, and the device holds credentials it can read and
   * edit.
   *
   * Refused outright outside development. Not gated at the call site, because
   * there are several and one of them would eventually be missed.
   */
  const mockAuthenticateUser = useCallback(async (credentials: LoginCredentials): Promise<LoginResponse> => {
    if (!DEV_LOCAL_AUTH_ENABLED) {
      return { success: false, error: 'Incorrect email or password. Please try again.' };
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    const accounts = await getAccountsDb();
    const account = accounts.find(
      acc => acc.identifier.toLowerCase() === credentials.emailOrPhone.toLowerCase()
    );

    if (!account) {
      return {
        success: false,
        error: 'Incorrect login details',
      };
    }

    if (credentials.password && account.password !== credentials.password) {
      return {
        success: false,
        error: 'Incorrect login details',
      };
    }

    // Development only, and unreachable above unless DEV_LOCAL_AUTH_ENABLED.
    if (credentials.otp && credentials.otp !== '123456') {
      return {
        success: false,
        error: 'Invalid OTP code',
      };
    }

    return {
      success: true,
      user: {
        id: account.id,
        identifier: account.identifier,
        role: account.role,
        status: account.status,
        onboardingComplete: account.onboardingComplete,
        onboardingCompleted: account.onboardingCompleted,
        vendorStatus: account.vendorStatus,
        authProvider: account.authProvider ?? 'email',
        firstName: account.firstName,
        lastName: account.lastName,
        lastInitial: account.lastInitial,
        email: account.email ?? account.identifier,
        countryCode: account.countryCode,
        countryName: account.countryName,
        stateCode: account.stateCode,
        stateName: account.stateName,
        areaId: account.areaId,
        areaName: account.areaName,
        referralCode: account.referralCode,
        acquisitionSource: account.acquisitionSource,
        signupChannel: account.signupChannel,
        createdAt: account.createdAt,
        referralRepId: account.referralRepId,
        referralRepName: account.referralRepName,
        referralAssignedCountry: account.referralAssignedCountry,
        referralAssignedState: account.referralAssignedState,
        referralAssignedArea: account.referralAssignedArea,
        referralStatus: account.referralStatus,
      },
    };
  }, [getAccountsDb]);

  const login = useCallback(async (credentials: LoginCredentials): Promise<LoginResponse> => {
    try {
      // Authenticate against real Firebase Auth first. Registration creates the
      // account there, so login has to check there too — reading only the local
      // account store meant a vendor who registered could not sign in on a
      // second device, or after the app's storage was cleared, and any account
      // created outside this device (seeded, or by support) was invisible.
      let firebaseUid: string | null = null;
      try {
        const credential = await signInWithEmailAndPassword(
          firebaseAuth,
          credentials.emailOrPhone.trim(),
          credentials.password ?? '',
        );
        firebaseUid = credential.user.uid;
        // Pull a fresh token so role/vendorId custom claims are present before
        // any callable runs.
        await credential.user.getIdToken(true);
        console.log('[AUTH] Firebase sign-in succeeded:', firebaseUid);
      } catch (firebaseError: unknown) {
        const code = (firebaseError as { code?: string })?.code ?? '';

        /**
         * Definite answers stop here; only "we could not tell" falls through to
         * the local store, which exists so pre-existing test accounts keep
         * working during the migration.
         *
         * A disabled account, a rate limit or an unverified email are all real
         * answers about a real account. Falling through on those would hand the
         * person "incorrect email or password", which is both wrong and
         * unactionable — they would keep retrying a password that is correct
         * against an account that is locked.
         */
        if (/wrong-password|invalid-credential|user-disabled|too-many-requests|email-not-verified/.test(code)) {
          const mapped = mapLoginError(firebaseError);
          return { success: false, error: mapped.message, errorField: mapped.field };
        }
        console.log('[AUTH] Firebase sign-in unavailable, falling back to local store:', code);
      }

      const response = await mockAuthenticateUser(credentials);

      if (!response.success) {
        /**
         * Signed in to Firebase, but this device has no local profile — a second
         * device, or cleared storage.
         *
         * This used to invent one: role 'vendor', status 'active',
         * onboardingComplete true, all hardcoded, and it returned before the
         * blocked-status check below. So a customer signing in on a new phone
         * became a vendor, and a banned, frozen or deactivated account became an
         * active one. The session was built from nothing but the fact that a
         * password matched.
         *
         * The account's real state lives in users/{uid} and the token's claims,
         * both written by the backend and neither editable from a device. That
         * is what the session is built from now. If the document cannot be read,
         * the login fails and the Firebase session is closed rather than left
         * open behind a refusal.
         */
        if (firebaseUid) {
          const rebuilt = await buildSessionFromBackend(firebaseUid, credentials.emailOrPhone.trim());
          if (!rebuilt.ok) {
            await signOut(firebaseAuth).catch(() => undefined);
            return { success: false, error: rebuilt.error };
          }
          await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(rebuilt.user));
          await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
          setAuthState({ user: rebuilt.user, isLoading: false, isAuthenticated: true, hasSeenOnboarding: true });
          return { success: true, user: rebuilt.user };
        }
        return response;
      }

      const user = response.user!;

      const blockedStatuses: AccountStatus[] = ['pending_deletion', 'deactivated', 'frozen', 'banned'];
      if (blockedStatuses.includes(user.status)) {
        return {
          success: false,
          error: 'This account is currently unavailable. Please contact support.',
        };
      }

      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));

      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');

      setAuthState({
        user,
        isLoading: false,
        isAuthenticated: true,
        hasSeenOnboarding: true,
      });

      return { success: true, user };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: 'Something went wrong. Please try again.',
      };
    }
  }, [mockAuthenticateUser]);

  const logout = useCallback(async () => {
    try {
      // Ending the Firebase session is the part that actually logs someone out.
      // Clearing local storage alone left the Firebase session open: the next
      // person to open the app was still authenticated, still held valid claims,
      // and every callable and Firestore read would still have accepted them.
      // Signing out first means that even if the storage clear below fails, the
      // credentials are already dead.
      await signOut(firebaseAuth).catch((error) => {
        console.error('[AUTH] Firebase sign-out failed:', error);
      });

      /**
       * Clearing the cached session must not be able to block logout.
       *
       * On web AsyncStorage is localStorage, which can throw (private browsing,
       * storage restrictions). This had no catch of its own, so a throw here
       * skipped straight past setAuthState and router.replace into the outer
       * catch — Firebase's session may have actually ended, but the UI never
       * updated and the person never left the page. Tapping logout looked like
       * it did nothing.
       *
       * The Firebase sign-out above is what actually ends the session; this is
       * only tidying a local cache, so its failure is logged and ignored rather
       * than allowed to stop the rest of logout from happening.
       */
      try {
        await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
      } catch (storageError) {
        console.error('[AUTH] Could not clear cached session:', storageError);
      }

      setAuthState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        hasSeenOnboarding: true,
      });
      router.replace('/login' as any);
    } catch (error) {
      console.error('Logout error:', error);
      // Even here, the person tapped logout and expects to leave. Signing out
      // is best-effort above; make sure they still land on the login screen
      // rather than being stuck on a page that no longer matches their session.
      setAuthState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        hasSeenOnboarding: true,
      });
      router.replace('/login' as any);
    }
  }, [router]);

  const checkAccountExists = useCallback(async (identifier: string): Promise<RegistrationCheck> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const accounts = await getAccountsDb();
    const account = accounts.find(
      acc => acc.identifier.toLowerCase() === identifier.toLowerCase()
    );
    
    return {
      exists: !!account,
      role: account?.role,
    };
  }, [getAccountsDb]);

  const registerAccount = useCallback(async (data: RegistrationData): Promise<LoginResponse> => {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const accounts = await getAccountsDb();
      const existingAccount = accounts.find(
        acc => acc.identifier.toLowerCase() === data.identifier.toLowerCase()
      );

      if (existingAccount) {
        console.log('[AUTH] Registration blocked: account already exists with role', existingAccount.role);
        return {
          success: false,
          error: 'An account already exists with this email or phone number. Please log in.',
        };
      }

      console.log('[AUTH] Creating new account with role:', data.role);

      // ── Real backend account creation (Phase 1) ────────────────────────
      // Firebase Auth plus completeRegistration are the source of truth for
      // the account, the vendor record and the username. The local record
      // built further down still drives screens that haven't been migrated
      // off local state yet, but it no longer invents an account that only
      // exists on this device.
      let backendUsername: string | undefined;
      let backendVendorId: string | undefined;
      try {
        const credential = await createUserWithEmailAndPassword(
          firebaseAuth,
          data.identifier.trim(),
          data.password,
        );
        await credential.user.getIdToken(true);

        // users/{uid} is created by the onUserCreate auth trigger, which runs
        // asynchronously — completeRegistration rejects until it exists, so
        // wait for it rather than racing it.
        /**
         * No longer waited for.
         *
         * This polled Firestore for users/{uid} for up to ten seconds because
         * completeRegistration used to reject when the document was missing. It
         * does not any more — it writes the document itself when the trigger has
         * not arrived, so there is nothing to wait for.
         *
         * Worse, the wait was a direct Firestore read, which is exactly what
         * stalls on a network that blocks Firestore's streaming transport. On
         * such a connection registration sat for ten seconds and then behaved as
         * though something had gone wrong, while the account creation itself was
         * perfectly fine.
         */

        const complete = callable<Record<string, unknown>, { success: true; role: string; vendorId?: string; username?: string }>(
          'completeRegistration',
        );
        const completed = await complete({
          role: data.role,
          firstName: data.firstName,
          lastName: data.lastName,
          phoneNumber: data.phone,
          country: data.location?.countryName ?? data.country,
          countryCode: data.location?.countryCode,
          // Customer registration will not enable its button until state and
          // area are chosen, but these were never sent, so completeRegistration
          // stored profile.region / profile.area as null. The customer was made
          // to pick a location that was then thrown away, which matters for a
          // marketplace that sells itself on vendors near you.
          region: data.location?.stateName,
          area: data.location?.areaName,
          referralCode: data.referralCode,
        });

        backendVendorId = completed.data.vendorId;
        backendUsername = completed.data.username;

        // Pick up the role/vendorId custom claims the function just set,
        // otherwise the very next callable still sees an unroled user.
        await credential.user.getIdToken(true);
        console.log('[AUTH] Backend account created:', { vendorId: backendVendorId, username: backendUsername });
      } catch (backendError: unknown) {
        const message = backendError instanceof Error ? backendError.message : String(backendError);
        console.error('[AUTH] Backend registration failed:', message);

        // Don't leave a half-made account behind: an auth user with no vendor
        // record can never log in successfully and blocks the email forever.
        /**
         * The half-made account has to go, or the email is locked forever.
         *
         * The auth account is created before completeRegistration runs, so a
         * rejection here leaves an account that can sign in but has no role, no
         * vendor record and no profile. Retrying then fails with "email already
         * in use", which is how someone gets permanently unable to register with
         * their own address — and the second error looks unrelated to the first.
         *
         * A cleanup failure is now reported rather than swallowed, because the
         * consequence is a stuck email that only an admin can clear, and nobody
         * would know to look.
         */
        try {
          if (firebaseAuth.currentUser) await deleteUser(firebaseAuth.currentUser);
        } catch (cleanupError) {
          console.error('[AUTH] Could not clean up partial account:', cleanupError);
          return {
            success: false,
            field: 'email',
            error:
              'We could not finish creating your account. Please contact the platform Support before trying this email again.',
          } as never;
        }
        // The mapping also reports which field is at fault, so the screen can
        // attach the message to that input and focus it rather than showing a
        // banner and leaving the person hunting for what to change.
        const mapped = mapRegistrationError(backendError);
        return { success: false, error: mapped.message, errorField: mapped.field };
      }

      let generatedUsername: string | undefined = backendUsername;
      if (data.role === 'vendor') {
        if (data.plan === 'basic' || !data.username) {
          // Prefer the username the backend actually reserved. The local
          // fallback only applies if the backend didn't return one.
          generatedUsername = backendUsername ?? `vendor_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
          console.log('[AUTH] Vendor username:', generatedUsername);

          if (data.plan === 'basic') {
            const AsyncStorageModule = await import('@react-native-async-storage/async-storage');
            const VENDOR_PLAN_STORAGE_KEY = '@the platform_vendor_plan';
            await AsyncStorageModule.default.setItem(VENDOR_PLAN_STORAGE_KEY, JSON.stringify({
              plan: 'basic',
              businessCountry: 'Nigeria',
              brandingEnabled: false,
              cancellationScheduled: false,
              cancellationDate: null,
              username: generatedUsername,
              systemGeneratedUsername: generatedUsername,
              usernameSelectionPending: false,
            }));
            console.log('[AUTH] Initialized vendor plan context with system username');
          }
        } else {
          generatedUsername = data.username;
          console.log('[AUTH] Using user-selected username:', generatedUsername);
          
          const AsyncStorageModule = await import('@react-native-async-storage/async-storage');
          const VENDOR_PLAN_STORAGE_KEY = '@the platform_vendor_plan';
          await AsyncStorageModule.default.setItem(VENDOR_PLAN_STORAGE_KEY, JSON.stringify({
            plan: data.plan || 'standard',
            businessCountry: 'Nigeria',
            brandingEnabled: false,
            cancellationScheduled: false,
            cancellationDate: null,
            username: generatedUsername,
            systemGeneratedUsername: null,
            usernameSelectionPending: false,
          }));
          console.log('[AUTH] Initialized vendor plan context with user-selected username');
        }
      }

      const derivedFullName = data.fullName
        || [data.firstName, data.lastName].filter(Boolean).join(' ').trim()
        || undefined;

      const derivedLastInitial = data.lastName
        ? data.lastName.trim().charAt(0).toUpperCase() || undefined
        : undefined;

      const newAccount: AccountRecord = {
        id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        identifier: data.identifier,
        role: data.role,
        password: data.password,
        status: 'active',
        onboardingComplete: data.role === 'customer',
        onboardingCompleted: data.role === 'customer' ? true : undefined,
        authProvider: 'email',
        businessName: data.businessName,
        vendorStatus: data.role === 'vendor' ? 'approved' : undefined,
        username: generatedUsername,
        plan: data.plan,
        fullName: derivedFullName,
        firstName: data.firstName,
        lastName: derivedLastInitial ?? data.lastName,
        lastInitial: derivedLastInitial,
        email: data.identifier,
        phone: data.phone,
        categoryId: data.categoryId,
        categoryName: data.categoryName,
        country: data.location?.countryName ?? data.country,
        state: data.location?.stateName ?? data.state,
        area: data.location?.areaName ?? data.area,
        countryCode: data.location?.countryCode,
        countryName: data.location?.countryName,
        stateCode: data.location?.stateCode,
        stateName: data.location?.stateName,
        areaId: data.location?.areaId,
        areaName: data.location?.areaName,
        location: data.location,
        businessDescription: data.businessDescription,
        referralCode: data.role === 'vendor' ? data.referralCode : undefined,
        acquisitionSource: data.role === 'vendor' ? (data.acquisitionSource ?? 'organic') : undefined,
        signupChannel: data.role === 'vendor' ? (data.signupChannel ?? 'mobile_vendor_app') : undefined,
        createdAt: data.createdAt ?? new Date().toISOString(),
        referralRepId: data.role === 'vendor' ? data.referralRepId : undefined,
        referralRepName: data.role === 'vendor' ? data.referralRepName : undefined,
        referralAssignedCountry: data.role === 'vendor' ? data.referralAssignedCountry : undefined,
        referralAssignedState: data.role === 'vendor' ? data.referralAssignedState : undefined,
        referralAssignedArea: data.role === 'vendor' ? data.referralAssignedArea : undefined,
        referralStatus: data.role === 'vendor' ? data.referralStatus : undefined,
        isDiscoverable: data.role === 'vendor' ? false : undefined,
      };

      accounts.push(newAccount);
      await saveAccountsDb(accounts);

      if (data.role === 'vendor') {
        const vendorProfileKey = '@the platform_vendor_profile';
        const countryName = data.location?.countryName ?? data.country ?? '';
        const stateName = data.location?.stateName ?? data.state ?? '';
        const areaName = data.location?.areaName ?? data.area ?? '';
        const vendorProfile = {
          id: newAccount.id,
          name: data.businessName || '',
          category: data.categoryName || '',
          categoryId: data.categoryId || '',
          email: data.identifier,
          phone: data.phone || '',
          fullName: derivedFullName || '',
          description: data.businessDescription || '',
          country: countryName,
          countryCode: data.location?.countryCode || '',
          state: stateName,
          region: stateName,
          city: areaName,
          area: stateName && areaName ? `${stateName}, ${areaName}` : stateName,
          isVerified: false,
          isDiscoverable: false,
          vendorStatus: 'ACTIVE' as const,
          plan: data.plan || 'basic',
          username: generatedUsername || '',
          slug: generatedUsername || '',
          referralCode: newAccount.referralCode,
          acquisitionSource: newAccount.acquisitionSource ?? 'organic',
          signupChannel: newAccount.signupChannel ?? 'mobile_vendor_app',
          createdAt: newAccount.createdAt,
          referralRepId: newAccount.referralRepId,
          referralRepName: newAccount.referralRepName,
          referralAssignedCountry: newAccount.referralAssignedCountry,
          referralAssignedState: newAccount.referralAssignedState,
          referralAssignedArea: newAccount.referralAssignedArea,
          referralStatus: newAccount.referralStatus,
        };
        await AsyncStorage.setItem(vendorProfileKey, JSON.stringify(vendorProfile));
        console.log('[AUTH] Saved vendor profile to storage:', vendorProfile.name);
      }

      const user: User = {
        id: newAccount.id,
        identifier: newAccount.identifier,
        role: newAccount.role,
        status: newAccount.status,
        onboardingComplete: newAccount.onboardingComplete,
        onboardingCompleted: newAccount.onboardingCompleted,
        vendorStatus: newAccount.vendorStatus,
        authProvider: newAccount.authProvider,
        firstName: newAccount.firstName,
        lastName: newAccount.lastName,
        lastInitial: newAccount.lastInitial,
        email: newAccount.email,
        countryCode: newAccount.countryCode,
        countryName: newAccount.countryName,
        stateCode: newAccount.stateCode,
        stateName: newAccount.stateName,
        areaId: newAccount.areaId,
        areaName: newAccount.areaName,
        referralCode: newAccount.referralCode,
        acquisitionSource: newAccount.acquisitionSource,
        signupChannel: newAccount.signupChannel,
        createdAt: newAccount.createdAt,
        referralRepId: newAccount.referralRepId,
        referralRepName: newAccount.referralRepName,
        referralAssignedCountry: newAccount.referralAssignedCountry,
        referralAssignedState: newAccount.referralAssignedState,
        referralAssignedArea: newAccount.referralAssignedArea,
        referralStatus: newAccount.referralStatus,
      };

      if (data.role === 'customer' && data.location) {
        try {
          await AsyncStorage.setItem('@the platform_user_location', JSON.stringify({
            countryCode: data.location.countryCode,
            countryName: data.location.countryName,
            currencyCode: '',
            currencySymbol: '',
            regionId: data.location.stateCode,
            regionName: data.location.stateName,
            city: data.location.areaName,
            area: data.location.areaName,
            lastCountryChange: new Date().toISOString(),
            isOnboarded: true,
            hasCompletedInitialLocationSetup: true,
          }));
        } catch (locErr) {
          console.error('[AUTH] Failed to persist customer location:', locErr);
        }
      }

      /**
       * Local persistence must not be able to fail a registration that worked.
       *
       * By this point the Firebase account exists, completeRegistration has
       * run, and the role and claims are set — the account is real whatever
       * happens next. These writes only cache the session on this device.
       *
       * On web AsyncStorage is localStorage, which throws outright in Safari
       * private browsing. That threw into the outer catch and reported failure
       * for an account that had been created seconds earlier: the person was
       * told to try again, tried again, and was then told the email was already
       * taken. The account worked the whole time — logging in with the same
       * email proved it.
       *
       * A device that cannot cache the session is a degraded experience, not a
       * failed registration.
       */
      try {
        await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
        await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      } catch (storageError) {
        console.error('[AUTH] Could not cache session locally:', storageError);
      }

      console.log('[AUTH] Registration successful for user:', user.id, 'role:', user.role);

      setAuthState({
        user,
        isLoading: false,
        isAuthenticated: true,
        hasSeenOnboarding: true,
      });

      return { success: true, user };
    } catch (error) {
      console.error('Registration error:', error);

      /**
       * If the backend account was created, this is not a failed registration
       * no matter what threw afterwards. Reporting failure here is what sent
       * someone into the retry loop that ends at "email already in use".
       */
      if (firebaseAuth.currentUser) {
        console.warn('[AUTH] Post-registration step failed but the account exists — treating as success');
        setAuthState({
          user: firebaseAuth.currentUser as unknown as User,
          isLoading: false,
          isAuthenticated: true,
          hasSeenOnboarding: true,
        });
        return { success: true };
      }

      return {
        success: false,
        error: 'Something went wrong. Please try again.',
      };
    }
  }, [getAccountsDb, saveAccountsDb]);

  const userRef = useRef<User | null>(authState.user);
  useEffect(() => {
    userRef.current = authState.user;
  }, [authState.user]);

  type ProfileUpdate = Partial<Pick<User,
    | 'firstName'
    | 'lastName'
    | 'lastInitial'
    | 'email'
    | 'countryCode'
    | 'countryName'
    | 'stateCode'
    | 'stateName'
    | 'areaId'
    | 'areaName'
    | 'onboardingCompleted'
  >>;

  const updateUserProfile = useCallback(async (updates: ProfileUpdate) => {
    const currentUser = userRef.current;
    if (!currentUser) return;

    const updatedUser = { ...currentUser, ...updates };
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedUser));

    const accounts = await getAccountsDb();
    const accountIndex = accounts.findIndex(acc => acc.id === currentUser.id);
    if (accountIndex !== -1) {
      accounts[accountIndex] = { ...accounts[accountIndex], ...updates };
      await saveAccountsDb(accounts);
    }

    /**
     * This used to be local-only (AsyncStorage + the mock accounts array
     * above), never Firestore. buildSessionFromBackend reads firstName from
     * users/{uid}.profile — never wrote here — so onboardingCompleted (and
     * the display name) only ever "stuck" for the current in-memory
     * session; a fresh session (new device, cleared storage, an expired
     * token forcing re-auth) always read firstName as undefined and sent an
     * already-onboarded user straight back to /complete-profile.
     *
     * Nested under `profile`/`onboarding`, not top-level fields — that's
     * what firestore.rules' userUpdateAllowed() actually allowlists for a
     * user's self-write to their own users/{uid} doc.
     */
    if (firebaseAuth.currentUser) {
      const firestoreUpdates: Record<string, unknown> = {};
      if (updates.firstName !== undefined) firestoreUpdates['profile.firstName'] = updates.firstName;
      if (updates.lastInitial !== undefined) firestoreUpdates['profile.lastInitial'] = updates.lastInitial;
      if (updates.lastName !== undefined) firestoreUpdates['profile.lastName'] = updates.lastName;
      if (updates.onboardingCompleted !== undefined) firestoreUpdates['onboarding.completed'] = updates.onboardingCompleted;

      if (Object.keys(firestoreUpdates).length > 0) {
        try {
          await updateDoc(doc(firestore, 'users', currentUser.id), firestoreUpdates);
        } catch (error) {
          console.error('[AUTH] Failed to persist profile update to Firestore:', error);
        }
      }
    }

    // Keep the canonical customer location store in sync when location is updated.
    if (updates.countryCode && updates.stateCode) {
      try {
        await AsyncStorage.setItem('@the platform_user_location', JSON.stringify({
          countryCode: updates.countryCode,
          countryName: updates.countryName ?? '',
          currencyCode: '',
          currencySymbol: '',
          regionId: updates.stateCode,
          regionName: updates.stateName ?? '',
          city: updates.areaName ?? '',
          area: updates.areaName ?? '',
          lastCountryChange: new Date().toISOString(),
          isOnboarded: true,
          hasCompletedInitialLocationSetup: true,
        }));
      } catch (locErr) {
        console.error('[AUTH] Failed to persist updated customer location:', locErr);
      }
    }

    setAuthState(prev => ({
      ...prev,
      user: updatedUser,
    }));
  }, [getAccountsDb, saveAccountsDb]);

  interface SocialPrefill {
    firstName?: string;
    lastInitial?: string;
    email?: string;
  }

  /**
   * Mock Google / Apple sign-in for customers. Returning users with a complete
   * profile resolve as onboardingCompleted; new or partial profiles route to
   * Complete Profile via the auth guard.
   */
  /**
   * Placeholder social sign-in. Not a real one.
   *
   * It waits 900ms, invents a local account and grants an authenticated
   * session, without ever contacting Firebase. Whoever calls it is signed in
   * as a customer that exists only on this device.
   *
   * The buttons are already hidden behind SOCIAL_AUTH_ENABLED, so nothing
   * reaches this today. It is refused outside development anyway: a function
   * that hands out sessions for nothing should not be one hidden button away
   * from working, and the two flags will not always be changed together.
   */
  const socialLogin = useCallback(async (provider: 'google' | 'apple', prefill?: SocialPrefill): Promise<LoginResponse> => {
    if (!DEV_LOCAL_AUTH_ENABLED) {
      return { success: false, error: 'This sign-in method is not available yet.' };
    }
    try {
      await new Promise(resolve => setTimeout(resolve, 900));

      const identifier = (prefill?.email && prefill.email.trim())
        ? prefill.email.trim().toLowerCase()
        : `${provider}-customer@the platform.social`;

      const accounts = await getAccountsDb();
      let account = accounts.find(acc => acc.identifier.toLowerCase() === identifier.toLowerCase());

      if (!account) {
        account = {
          id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          identifier,
          role: 'customer',
          password: '',
          status: 'active',
          authProvider: provider,
          onboardingComplete: false,
          onboardingCompleted: false,
          email: identifier,
          firstName: prefill?.firstName,
          lastInitial: prefill?.lastInitial,
          lastName: prefill?.lastInitial,
        };
        accounts.push(account);
        await saveAccountsDb(accounts);
      }

      const user: User = {
        id: account.id,
        identifier: account.identifier,
        role: account.role,
        status: account.status,
        onboardingComplete: account.onboardingComplete,
        onboardingCompleted: account.onboardingCompleted,
        vendorStatus: account.vendorStatus,
        authProvider: provider,
        firstName: account.firstName,
        lastName: account.lastName,
        lastInitial: account.lastInitial,
        email: account.email ?? account.identifier,
        countryCode: account.countryCode,
        countryName: account.countryName,
        stateCode: account.stateCode,
        stateName: account.stateName,
        areaId: account.areaId,
        areaName: account.areaName,
        referralCode: account.referralCode,
        acquisitionSource: account.acquisitionSource,
        signupChannel: account.signupChannel,
        createdAt: account.createdAt,
        referralRepId: account.referralRepId,
        referralRepName: account.referralRepName,
        referralAssignedCountry: account.referralAssignedCountry,
        referralAssignedState: account.referralAssignedState,
        referralAssignedArea: account.referralAssignedArea,
        referralStatus: account.referralStatus,
      };

      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');

      setAuthState({
        user,
        isLoading: false,
        isAuthenticated: true,
        hasSeenOnboarding: true,
      });

      return { success: true, user };
    } catch (error) {
      console.error('[AUTH] Social login error:', error);
      return { success: false, error: 'Something went wrong. Please try again.' };
    }
  }, [getAccountsDb, saveAccountsDb]);

  const markOnboardingComplete = useCallback(async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    setAuthState(prev => ({
      ...prev,
      hasSeenOnboarding: true,
    }));
  }, []);

  return useMemo(() => ({
    ...authState,
    login,
    logout,
    checkAccountExists,
    registerAccount,
    socialLogin,
    redirectAfterLogin,
    updateUserProfile,
    markOnboardingComplete,
  }), [authState, login, logout, checkAccountExists, registerAccount, socialLogin, redirectAfterLogin, updateUserProfile, markOnboardingComplete]);
});
