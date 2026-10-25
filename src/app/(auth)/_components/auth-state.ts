// Shared shape returned by the L-01 server actions to their forms (useActionState).
export interface AuthActionState {
  /** One inline error above the form (L-01). */
  error?: string | null;
  /** A confirmation shown in place of the form (reset request, sign-up awaiting confirmation). */
  notice?: string | null;
}

export const initialAuthState: AuthActionState = { error: null, notice: null };
