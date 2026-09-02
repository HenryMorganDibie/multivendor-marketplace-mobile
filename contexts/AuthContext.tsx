import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useSegments } from 'expo-router';
import { VendorPlan } from './VendorPlanContext';

type UserRole = 'customer' | 'vendor';

type AccountStatus = 'active' | 'pending_deletion' | 'deactivated' | 'frozen' | 'banned';

type VendorStatus = 'pending' | 'approved';

interface User {
  id: string;
  identifier: string;
  role: UserRole;
  status: AccountStatus;
  onboardingComplete?: boolean;
  vendorStatus?: VendorStatus;
  firstName?: string;
  lastName?: string;
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
}

interface RegistrationCheck {
  exists: boolean;
  role?: UserRole;
}

interface RegistrationData {
  identifier: string;
  password: string;
  role: UserRole;
  businessName?: string;
  username?: string;
  plan?: VendorPlan;
  fullName?: string;
  categoryId?: string;
  categoryName?: string;
  country?: string;
  state?: string;
  area?: string;
}

const AUTH_STORAGE_KEY = '@platform_auth_user';
const ACCOUNTS_DB_KEY = '@platform_accounts_db';
const ONBOARDING_KEY = '@platform_onboarding_seen';

interface AccountRecord {
  id: string;
  identifier: string;
  role: UserRole;
  password: string;
  status: AccountStatus;
  onboardingComplete?: boolean;
  businessName?: string;
  vendorStatus?: VendorStatus;
  firstName?: string;
  lastName?: string;
  username?: string;
  plan?: VendorPlan;
  fullName?: string;
  categoryId?: string;
  categoryName?: string;
  country?: string;
  state?: string;
  area?: string;
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

  const lastRedirectRef = useRef<string | null>(null);
  const segmentsKey = useMemo(() => segments.join('/'), [segments]);
  const firstSegment = useMemo(() => (segments[0] ?? '') as string, [segments]);

  useEffect(() => {
    if (authState.isLoading) return;

    const fullPath = segmentsKey;

    const safeReplace = (path: string) => {
      if (lastRedirectRef.current === path) return;
      lastRedirectRef.current = path;
      router.replace(path as any);
    };

    const publicRoutes = ['login', 'create-account', 'register', 'vendor-register', 'verify-otp', 'onboarding', 'complete-profile', 'vendor-setup-complete'];
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

    if (user.role !== 'customer' && user.role !== 'vendor') {
      safeReplace('/role-error');
      return;
    }

    if (isPublicRoute && firstSegment !== 'verify-otp' && firstSegment !== 'complete-profile') {
      if (user.role === 'customer') {
        safeReplace('/customer');
      } else if (user.role === 'vendor') {
        if (user.vendorStatus === 'pending') {
          safeReplace('/vendor/pending');
        } else {
          safeReplace('/vendor/(tabs)/dashboard');
        }
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
      }
      return;
    }

    lastRedirectRef.current = null;

    if (user.role === 'customer') {
      if (!user.firstName && firstSegment !== 'complete-profile') {
        safeReplace('/complete-profile');
        return;
      }

      if (user.firstName && firstSegment === 'complete-profile') {
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
  }, [authState.isAuthenticated, authState.isLoading, authState.user, segmentsKey, firstSegment, router]);

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

  const mockAuthenticateUser = useCallback(async (credentials: LoginCredentials): Promise<LoginResponse> => {
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
        vendorStatus: account.vendorStatus,
        firstName: account.firstName,
        lastName: account.lastName,
      },
    };
  }, [getAccountsDb]);

  const login = useCallback(async (credentials: LoginCredentials): Promise<LoginResponse> => {
    try {
      const response = await mockAuthenticateUser(credentials);

      if (!response.success) {
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
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
      setAuthState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        hasSeenOnboarding: true,
      });
      router.replace('/login' as any);
    } catch (error) {
      console.error('Logout error:', error);
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

      let generatedUsername: string | undefined;
      if (data.role === 'vendor') {
        if (data.plan === 'basic' || !data.username) {
          generatedUsername = `vendor_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
          console.log('[AUTH] Generated system username for Basic plan:', generatedUsername);
          
          if (data.plan === 'basic') {
            const AsyncStorageModule = await import('@react-native-async-storage/async-storage');
            const VENDOR_PLAN_STORAGE_KEY = '@platform_vendor_plan';
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
          const VENDOR_PLAN_STORAGE_KEY = '@platform_vendor_plan';
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

      const newAccount: AccountRecord = {
        id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        identifier: data.identifier,
        role: data.role,
        password: data.password,
        status: 'active',
        onboardingComplete: data.role === 'customer',
        businessName: data.businessName,
        vendorStatus: data.role === 'vendor' ? 'approved' : undefined,
        username: generatedUsername,
        plan: data.plan,
        fullName: data.fullName,
        categoryId: data.categoryId,
        categoryName: data.categoryName,
        country: data.country,
        state: data.state,
        area: data.area,
      };

      accounts.push(newAccount);
      await saveAccountsDb(accounts);

      if (data.role === 'vendor') {
        const vendorProfileKey = '@platform_vendor_profile';
        const vendorProfile = {
          id: newAccount.id,
          name: data.businessName || '',
          category: data.categoryName || '',
          categoryId: data.categoryId || '',
          email: data.identifier,
          fullName: data.fullName || '',
          country: data.country || '',
          state: data.state || '',
          region: data.state || '',
          city: data.area || '',
          area: data.state && data.area ? `${data.state}, ${data.area}` : data.state || '',
          isVerified: false,
          vendorStatus: 'ACTIVE' as const,
          username: generatedUsername || '',
          slug: generatedUsername || '',
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
        vendorStatus: newAccount.vendorStatus,
        firstName: newAccount.firstName,
        lastName: newAccount.lastName,
      };

      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));

      console.log('[AUTH] Registration successful for user:', user.id, 'role:', user.role);

      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');

      setAuthState({
        user,
        isLoading: false,
        isAuthenticated: true,
        hasSeenOnboarding: true,
      });

      return { success: true, user };
    } catch (error) {
      console.error('Registration error:', error);
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

  const updateUserProfile = useCallback(async (updates: Partial<Pick<User, 'firstName' | 'lastName'>>) => {
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

    setAuthState(prev => ({
      ...prev,
      user: updatedUser,
    }));
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
    redirectAfterLogin,
    updateUserProfile,
    markOnboardingComplete,
  }), [authState, login, logout, checkAccountExists, registerAccount, redirectAfterLogin, updateUserProfile, markOnboardingComplete]);
});
