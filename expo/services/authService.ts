import type { UserRole } from '@/types/domain';

/**
 * authService — single boundary for authentication & account lifecycle.
 *
 * SCAFFOLD ONLY. These functions describe the contract Henry will implement
 * against Firebase Auth (and the `users/{uid}` document). For now they return
 * context-shaped mock data sourced from AsyncStorage exactly the way
 * `contexts/AuthContext` already does, so screens can migrate to the service
 * without behaviour changes.
 *
 * Storage keys mirror AuthContext so this layer reads the same data the app
 * already persists. No screen imports this yet — wiring happens in a later step.
 *
 * TODO(Henry): replace the AsyncStorage reads/writes with Firebase Auth +
 * Firestore. Keep these signatures stable.
 */
import { authRepository } from '@/services/repositories/authRepository';

export type AccountStatus = 'active' | 'pending_deletion' | 'deactivated' | 'frozen' | 'banned';
export type AuthProvider = 'google' | 'apple' | 'email';

/** Authenticated user shape returned to the app. Mirrors AuthContext's `User`. */
export interface AuthUser {
  id: string;
  identifier: string;
  role: UserRole;
  status: AccountStatus;
  onboardingComplete?: boolean;
  onboardingCompleted?: boolean;
  vendorStatus?: 'pending' | 'approved';
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
  createdAt?: string;
}

export interface LoginCredentials {
  emailOrPhone: string;
  password?: string;
  otp?: string;
}

export interface AuthResult {
  success: boolean;
  user?: AuthUser;
  error?: string;
}

export interface AccountExistsResult {
  exists: boolean;
  role?: UserRole;
}

export const authService = {
  /** Returns the currently persisted session user, or null. */
  async getCurrentUser(): Promise<AuthUser | null> {
    return (await authRepository.getSession()) as AuthUser | null;
  },

  /** Email/phone + password (or OTP) login. TODO(Henry): Firebase Auth. */
  async login(credentials: LoginCredentials): Promise<AuthResult> {
    const accounts = await authRepository.getAccounts();
    const account = accounts.find(
      (acc) => acc.identifier?.toLowerCase() === credentials.emailOrPhone.toLowerCase(),
    );
    if (!account) {
      return { success: false, error: 'Incorrect login details' };
    }
    if (credentials.password && account.password !== credentials.password) {
      return { success: false, error: 'Incorrect login details' };
    }
    if (credentials.otp && credentials.otp !== '123456') {
      return { success: false, error: 'Invalid OTP code' };
    }
    return { success: true, user: account as AuthUser };
  },

  /** Mock social sign-in. TODO(Henry): Firebase OAuth providers. */
  async socialLogin(_provider: 'google' | 'apple'): Promise<AuthResult> {
    console.log('[authService] socialLogin scaffold called');
    return { success: false, error: 'Not implemented in scaffold' };
  },

  /** Whether an account already exists for an identifier. */
  async checkAccountExists(identifier: string): Promise<AccountExistsResult> {
    const accounts = await authRepository.getAccounts();
    const account = accounts.find(
      (acc) => acc.identifier?.toLowerCase() === identifier.toLowerCase(),
    );
    return { exists: !!account, role: account?.role };
  },

  /** Clears the persisted session. TODO(Henry): Firebase signOut. */
  async logout(): Promise<void> {
    await authRepository.clearSession();
  },
};
