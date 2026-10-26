// L-01 · Google sign-in. Shared by the "Continue with Google" action, /auth/callback and /signin.
// Client-safe: constants only.

import { SIGN_IN_PATH } from "./paths";

/** Where a Google sign-in lands when no E4-6 `next` was carried: the L-04 rent board. */
export const OAUTH_LANDING_PATH = "/rent";

/** Query parameter on /auth/callback naming the flow, so the reset flow keeps its own handling. */
export const OAUTH_FLOW_PARAM = "flow";
export const GOOGLE_FLOW = "google";

/** /signin?error=google: the only thing the URL carries; the real error is logged server-side. */
export const SIGN_IN_ERROR_PARAM = "error";
export const GOOGLE_ERROR_CODE = "google";
export const GOOGLE_ERROR_PATH = `${SIGN_IN_PATH}?${SIGN_IN_ERROR_PARAM}=${GOOGLE_ERROR_CODE}`;

/** E1-07 placement (inline, above the form), worded for sign-in; E1-07's "Could not save" does not fit. */
export const GOOGLE_ERROR_MESSAGE = "Could not sign in with Google. Try again.";
