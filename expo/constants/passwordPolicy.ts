/**
 * The password rule, in one place, with per-requirement state for the UI.
 *
 * It was "at least 8 characters", stated only as a placeholder and enforced only
 * on the client — Firebase's own floor is six, so a shorter password would have
 * been accepted by anything calling Auth directly.
 *
 * Twelve characters and all five requirements, per the agreed policy. Worth
 * recording the tradeoff: requiring every character class is the rule that
 * produces `Password123!` on most accounts, because people satisfy it in the
 * most predictable way available. A long passphrase is stronger than a short
 * string with a symbol bolted on. The policy is the client's call and this
 * implements it as specified; `PASSWORD_MIN_CLASSES` is where a three-of-five
 * variant would be configured if that is ever revisited.
 *
 * Requirements come back as a list with a tri-state, not a boolean, because a
 * password field that only says "too weak" after submission is how people end
 * up on their fourth attempt. Untouched means grey: showing five red crosses to
 * someone who has not typed anything reads as failure before they have started.
 */

export const PASSWORD_MIN_LENGTH = 12;

/** All five must be met. Kept explicit so the policy is one number to change. */
export const PASSWORD_MIN_CLASSES = 4;

/**
 * `pending` renders grey, `met` green, `unmet` red.
 *
 * `pending` is not the same as `unmet`: it means the person has not typed yet,
 * so there is nothing to be wrong about.
 */
export type RequirementState = 'pending' | 'met' | 'unmet';

export interface PasswordRequirement {
  id: string;
  label: string;
  state: RequirementState;
}

export interface PasswordCheck {
  valid: boolean;
  requirements: PasswordRequirement[];
  /** Set only once something has been typed, for the field-level error slot. */
  error: string | null;
}

export function checkPassword(password: string): PasswordCheck {
  const touched = password.length > 0;

  const rules: { id: string; label: string; ok: boolean }[] = [
    { id: 'length', label: `At least ${PASSWORD_MIN_LENGTH} characters`, ok: password.length >= PASSWORD_MIN_LENGTH },
    { id: 'upper', label: 'One uppercase letter', ok: /[A-Z]/.test(password) },
    { id: 'lower', label: 'One lowercase letter', ok: /[a-z]/.test(password) },
    { id: 'number', label: 'One number', ok: /\d/.test(password) },
    {
      id: 'symbol',
      label: 'One special character',
      // A negated class rather than a hand-written list, so £ or é still count.
      // A rule that rejects a symbol nobody thought of looks broken.
      ok: /[^A-Za-z0-9\s]/.test(password),
    },
  ];

  const requirements: PasswordRequirement[] = rules.map((r) => ({
    id: r.id,
    label: r.label,
    state: r.ok ? 'met' : touched ? 'unmet' : 'pending',
  }));

  const valid = rules.every((r) => r.ok);

  // The checklist is already on screen showing exactly what is missing, so the
  // error line stays generic rather than repeating it.
  const error = touched && !valid ? 'Password does not meet the requirements below.' : null;

  return { valid, requirements, error };
}

export const PASSWORD_POLICY_SUMMARY = `${PASSWORD_MIN_LENGTH}+ characters`;
