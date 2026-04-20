// src/shared/api/admin/emailVerification.js
// Client wrappers around the two verification Edge Functions.

import { invokeEdgeFunction } from "../core/invokeEdgeFunction";

/**
 * Ask the server to (re)send a verification email to the current user.
 * Caller must be authenticated (session attached by invokeEdgeFunction).
 * @returns {Promise<{ ok: boolean, alreadyVerified?: boolean }>}
 */
export async function sendEmailVerification() {
  const { data, error } = await invokeEdgeFunction("email-verification-send", { body: {} });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

/**
 * Confirm a verification token (anonymous — token is the capability).
 * @param {string} token
 * @returns {Promise<{ ok: true }>}
 */
export async function confirmEmailVerification(token) {
  const { data, error } = await invokeEdgeFunction("email-verification-confirm", {
    body: { token },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}
