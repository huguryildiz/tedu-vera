// src/shared/auth/AuthProvider.jsx
// ============================================================
// Phase C.4: React context provider for Supabase Auth + tenant
// membership state. Wraps the app and manages:
//   - supabase.auth.onAuthStateChange subscription
//   - Current user state (id, email)
//   - Tenant memberships (from rpc_admin_auth_get_session)
//   - Active tenant selection
//   - Loading state during session restoration
// ============================================================

import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, clearPersistedSession } from "@/shared/lib/supabaseClient";
import { invokeEdgeFunction } from "@/shared/api/core/invokeEdgeFunction";
import { getActiveOrganizationId, setActiveOrganizationId } from "@/shared/storage/adminStorage";
import { upsertProfile } from "@/shared/api/admin/profiles";
import { getSession, getMyJoinRequests, listOrganizationsPublic, getSecurityPolicy, getPublicAuthFlags, touchAdminSession } from "@/shared/api";
import { KEYS } from "@/shared/storage/keys";
import { DEMO_MODE } from "@/shared/lib/demoMode";
import { getAdminDeviceId, getAuthMethodLabelFromSession, parseUserAgent } from "@/shared/lib/adminSession";
import { toastStore } from "@/shared/lib/toastStore";
import { SecurityPolicyContext, DEFAULT_POLICY } from "./SecurityPolicyContext";

export const AuthContext = createContext(null);

function isRecoverableAuthLockError(error) {
  const msg = String(error?.message || "");
  return (
    error?.name === "AbortError" &&
    (msg.includes("Lock broken by another request with the 'steal' option") ||
      msg.includes("was not released within"))
  );
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isJuryOrEvalPath(pathname) {
  const path = String(pathname || "");
  return (
    path === "/eval" ||
    path.startsWith("/jury") ||
    path === "/demo/eval" ||
    path.startsWith("/demo/jury")
  );
}

async function getSessionWithRetry(maxAttempts = 3) {
  let lastError;
  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      const result = await supabase.auth.getSession();
      const session = result.data?.session;

      // getSession() returns the cached token — it may already be expired.
      // Proactively refresh if the token expires within 30 s so that the
      // rest of the bootstrap flow (memberships, Realtime) uses a valid JWT.
      if (session?.expires_at && Date.now() / 1000 > session.expires_at - 30) {
        const refreshed = await supabase.auth.refreshSession();
        return refreshed;
      }

      return result;
    } catch (error) {
      lastError = error;
      if (!isRecoverableAuthLockError(error) || i === maxAttempts - 1) {
        throw error;
      }
      await wait(120 * (i + 1));
    }
  }
  throw lastError;
}

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [activeOrganizationId, setActiveOrganizationIdState] = useState(null);
  const [displayName, setDisplayName] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const [hasJoinRequest, setHasJoinRequest] = useState(false);
  const [loading, setLoading] = useState(true);
  const [policy, setPolicy] = useState(DEFAULT_POLICY);
  const [emailVerifiedAt, setEmailVerifiedAt] = useState(null);
  const [graceEndsAt, setGraceEndsAt] = useState(null);
  const mountedRef = useRef(true);
  const hasSessionRef = useRef(false);
  const currentUserIdRef = useRef(null);
  const policyLoadedRef = useRef(false);
  // Suppress the next USER_UPDATED newEmail re-application after an explicit cancel.
  const suppressEmailUpdateRef = useRef(false);
  const signingUpRef = useRef(false);

  // Fetch tenant memberships from the session RPC.
  const fetchMemberships = useCallback(async () => {
    try {
      const data = await getSession();
      return data || [];
    } catch (e) {
      console.error("fetchMemberships error:", e);
      return [];
    }
  }, []);

  // Process auth state change.
  const handleAuthChange = useCallback(async (_event, newSession) => {
    if (!mountedRef.current) return;

    if (signingUpRef.current && newSession?.user) {
      // During our atomic signup, AuthProvider owns the bootstrap — skip the
      // default "no memberships → profileIncomplete=true" branch that would
      // otherwise flash the CompleteProfileScreen for ~200 ms.
      setSession(newSession);
      setUser({
        id: newSession.user.id,
        email: newSession.user.email,
        newEmail: newSession.user.new_email ?? null,
        name:
          newSession.user.user_metadata?.name
          || newSession.user.user_metadata?.full_name
          || newSession.user.email,
        orgName: newSession.user.user_metadata?.orgName || "",
      });
      currentUserIdRef.current = newSession.user.id;
      hasSessionRef.current = true;
      return;
    }

    if (!newSession?.user) {
      setUser(null);
      setSession(null);
      setOrganizations([]);
      setActiveOrganizationIdState(null);
      currentUserIdRef.current = null;
      hasSessionRef.current = false;
      setLoading(false);
      return;
    }

    // TOKEN_REFRESHED and re-SIGNED_IN fire when returning to a browser tab.
    // If we already have a session for the SAME user, just update it — do NOT
    // show the full-screen loader or re-fetch memberships.
    // Guard on user ID: a different user signing in (e.g. after DemoAdminLoader
    // left a super_admin session) must always trigger a full membership re-fetch.
    const isSameUser = newSession?.user?.id === currentUserIdRef.current;
    if (_event !== "INITIAL_SESSION" && hasSessionRef.current && isSameUser) {
      setSession(newSession);
      // USER_UPDATED fires after updateUser() — sync newEmail into user state.
      // If new_email equals current email, the user cancelled the change (confirmation to self);
      // treat as no pending change.
      if (_event === "USER_UPDATED" && newSession?.user) {
        if (suppressEmailUpdateRef.current) {
          // User explicitly cancelled the pending email change — keep newEmail null
          // regardless of what Supabase still has in new_email on this event.
          suppressEmailUpdateRef.current = false;
        } else {
          const rawNew = newSession.user.new_email;
          const effectiveNew = (rawNew && rawNew !== newSession.user.email) ? rawNew : null;
          setUser((prev) => prev ? { ...prev, newEmail: effectiveNew } : prev);
        }
        // Note: we do NOT sync email_confirmed_at here — Supabase auto-sets it
        // on signup when "Confirm email" is OFF, so it cannot be used as a
        // verification signal. Verification state comes from profiles.email_verified_at.
      }
      return;
    }

    setLoading(true);
    setSession(newSession);
    setUser({
      id: newSession.user.id,
      email: newSession.user.email,
      newEmail: newSession.user.new_email ?? null,
      name:
        newSession.user.user_metadata?.name
        || newSession.user.user_metadata?.full_name
        || newSession.user.email,
      orgName: newSession.user.user_metadata?.orgName || "",
    });
    currentUserIdRef.current = newSession.user.id;
    const pathname = typeof window !== "undefined" ? window.location.pathname : "";
    const skipAdminBootstrap = isJuryOrEvalPath(pathname);
    const isInviteAcceptPath = pathname === "/invite/accept" || pathname.startsWith("/invite/accept?");

    // Skip fetchMemberships on /invite/accept to avoid a circular async deadlock:
    // _recoverAndRefresh fires SIGNED_IN inside initializePromise's lock chain;
    // fetchMemberships → getSession → supabase.auth.getUser() awaits initializePromise
    // → deadlock. InviteAcceptScreen only needs the session object, not memberships.
    if (isInviteAcceptPath) {
      setLoading(false);
      return;
    }

    // Fetch memberships — /demo authenticated users resolve their real role
    // against the demo Supabase project (same as prod flow).
    const memberships = await fetchMemberships();
    if (!mountedRef.current) return;
    let organizationList = memberships.map((m) => ({
      id: m.organization_id,
      code: m.organization?.code ?? null,
      name: m.organization?.name ?? null,
      setupCompletedAt: m.organization?.setup_completed_at ?? null,
      role: m.role,
    }));
    setOrganizations(organizationList);

    // profiles.email_verified_at is the authoritative source — getSession() fetches it
    // alongside memberships. Supabase auto-sets email_confirmed_at on signup when
    // "Confirm email" is OFF, so it cannot reliably indicate custom verification.
    setEmailVerifiedAt(memberships[0]?.email_verified_at ?? null);
    // grace_ends_at is on the tenant membership row (null for pre-migration / invite users).
    setGraceEndsAt(memberships[0]?.grace_ends_at ?? null);

    // Detect first-time user needing profile completion (any provider)
    const profileCompleted = newSession.user.user_metadata?.profile_completed;
    if (organizationList.length === 0 && !profileCompleted) {
      setProfileIncomplete(true);
    } else {
      setProfileIncomplete(false);
    }

    // Check for pending join requests when user has no active memberships
    if (organizationList.length === 0 && profileCompleted) {
      try {
        const joinReqs = await getMyJoinRequests();
        setHasJoinRequest(joinReqs.length > 0);
      } catch {
        setHasJoinRequest(false);
      }
    } else {
      setHasJoinRequest(false);
    }

    // Restore or pick active organization
    const savedOrganizationId = getActiveOrganizationId();
    const hasSaved = organizationList.some((o) => o.id === savedOrganizationId);
    const isSuper = organizationList.some((o) => o.role === "super_admin");
    const preferredDemoOrganization = organizationList.find((o) =>
      String(o.code || "").trim().toLowerCase() === "tedu-ee" ||
      String(o.name || "").trim().toLowerCase() === "tedu ee"
    );

    if (DEMO_MODE && preferredDemoOrganization) {
      setActiveOrganizationIdState(preferredDemoOrganization.id);
      setActiveOrganizationId(preferredDemoOrganization.id);
    } else if (isSuper && !preferredDemoOrganization) {
      // Super-admin: fetch all orgs to populate the switcher and pick active
      // (super_admin memberships have organization_id = NULL, so it won't be in organizationList)
      try {
        const allOrgs = await listOrganizationsPublic();
        const allOrgList = allOrgs.map((o) => ({
          id: o.id,
          code: o.code ?? null,
          name: o.name ?? null,
          setupCompletedAt: o.setup_completed_at ?? null,
          role: "super_admin",
        }));
        // Keep super-admin role visible even when there are no active orgs.
        // Without this fallback, organizations becomes [] and UI falls into
        // the pending gate despite an existing super_admin membership.
        const resolvedOrgList = allOrgList.length > 0
          ? allOrgList
          : [{ id: null, code: null, name: null, setupCompletedAt: null, role: "super_admin" }];
        if (mountedRef.current) setOrganizations(resolvedOrgList);
        const savedIsValid = allOrgList.some((o) => o.id === savedOrganizationId);
        const demoOrg = allOrgs.find((o) =>
          String(o.code || "").trim().toLowerCase() === "tedu-ee" ||
          String(o.name || "").trim().toLowerCase().includes("tedu")
        );
        const preferred = DEMO_MODE ? demoOrg : null;
        const picked = preferred ?? (savedIsValid ? { id: savedOrganizationId } : allOrgList[0]);
        if (picked?.id && mountedRef.current) {
          setActiveOrganizationIdState(picked.id);
          setActiveOrganizationId(picked.id);
        }
      } catch {}
    } else if (hasSaved) {
      setActiveOrganizationIdState(savedOrganizationId);
    } else if (isSuper && organizationList.length > 1) {
      // Super-admin: pick first non-null organization
      const firstOrganization = organizationList.find((o) => o.id != null);
      setActiveOrganizationIdState(firstOrganization?.id || null);
    } else if (organizationList.length > 0) {
      const firstOrganization = organizationList.find((o) => o.id != null);
      setActiveOrganizationIdState(firstOrganization?.id || null);
    } else {
      setActiveOrganizationIdState(null);
    }

    hasSessionRef.current = true;

    // Fetch security policy once for super admins only.
    // Non-admin/new OAuth users can hit RPC auth checks and return 400.
    const canReadPolicy = organizationList.some((o) => o.role === "super_admin");
    if (!skipAdminBootstrap && !policyLoadedRef.current && canReadPolicy) {
      policyLoadedRef.current = true;
      getSecurityPolicy()
        .then((p) => { if (mountedRef.current && p) setPolicy(p); })
        .catch(() => {});
    }

    if (!skipAdminBootstrap) {
      const displayNameFromUser =
        newSession.user.user_metadata?.name
        || newSession.user.user_metadata?.full_name
        || newSession.user.email;
      upsertProfile(displayNameFromUser).then((profile) => {
        if (mountedRef.current && profile?.display_name) {
          setDisplayName(profile.display_name);
        }
        if (mountedRef.current && profile?.avatar_url) {
          setAvatarUrl(profile.avatar_url);
        }
      }).catch(() => {});
    }

    setLoading(false);

    // Only clear persisted session when preference is explicitly false.
    // Missing key (legacy sessions) should not force logout.
    // Skip on jury/eval paths — clearing localStorage auth there fires a
    // SIGNED_OUT storage event that logs the admin out in other tabs.
    if (!skipAdminBootstrap) {
      try {
        if (localStorage.getItem(KEYS.ADMIN_REMEMBER_ME) === "false") {
          clearPersistedSession();
        }
      } catch {}
    }
  }, [fetchMemberships]);

  useEffect(() => {
    mountedRef.current = true;
    let bootstrapped = false;

    // Safety net: never keep app blocked behind auth loading forever.
    const bootstrapTimeout = setTimeout(() => {
      if (!mountedRef.current || bootstrapped) return;
      setLoading(false);
    }, 4000);

    const finishBootstrap = () => {
      bootstrapped = true;
      clearTimeout(bootstrapTimeout);
    };

    // Subscribe first so auth events are not missed while initial session loads.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      handleAuthChange(event, newSession).finally(() => {
        finishBootstrap();
      });
    });

    // Get initial session
    getSessionWithRetry()
      .then(({ data: { session: initialSession } }) => {
        return handleAuthChange("INITIAL_SESSION", initialSession);
      })
      .catch((error) => {
        if (isRecoverableAuthLockError(error)) {
          // Lock contention during startup should not crash initialization.
          return handleAuthChange("INITIAL_SESSION", null);
        }
        console.error("Initial session fetch failed:", error);
        return handleAuthChange("INITIAL_SESSION", null);
      })
      .finally(() => {
        if (!mountedRef.current) return;
        finishBootstrap();
      });

    return () => {
      mountedRef.current = false;
      clearTimeout(bootstrapTimeout);
      subscription.unsubscribe();
    };
  }, [handleAuthChange]);

  // Fetch the three public auth flags (googleOAuth, emailPassword, rememberMe)
  // from rpc_public_auth_flags so the login screen can hide disabled methods
  // for anonymous users. This runs independently of the super-admin policy
  // fetch because it uses an anon-callable RPC and does not depend on session.
  useEffect(() => {
    getPublicAuthFlags()
      .then((flags) => {
        if (!mountedRef.current || !flags) return;
        setPolicy((prev) => ({ ...prev, ...flags }));
      })
      .catch(() => {});
  }, []);

  const touchCurrentAdminSession = useCallback(async () => {
    if (!session?.user?.id || !session?.access_token) return;

    const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const { browser, os } = parseUserAgent(userAgent);
    const deviceId = getAdminDeviceId();
    const authMethod = getAuthMethodLabelFromSession(session, user);

    await touchAdminSession({
      deviceId,
      userAgent,
      browser,
      os,
      authMethod,
      signedInAt: session?.user?.last_sign_in_at || null,
      expiresAt: session?.expires_at || null,
      accessToken: session.access_token,
    });
  }, [session, user]);

  const sessionExpiredHandledRef = useRef(false);

  useEffect(() => {
    if (!session?.user?.id) {
      sessionExpiredHandledRef.current = false;
      return undefined;
    }

    const handleExpired = async () => {
      if (sessionExpiredHandledRef.current) return;
      const path = typeof window !== "undefined" ? window.location.pathname : "";
      if (isJuryOrEvalPath(path)) return;

      // Before concluding the session is dead, try refreshing — the token may
      // still be valid in memory even if localStorage was cleared by another tab.
      try {
        const { data } = await supabase.auth.refreshSession();
        if (data?.session) return; // session recovered; do nothing
      } catch {
        // refresh failed — fall through to sign-out
      }

      sessionExpiredHandledRef.current = true;
      toastStore.emit({
        type: "warning",
        message: "Session expired — please sign in again",
      });
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {}
      const target = path.startsWith("/demo") ? "/demo" : "/login";
      if (typeof window !== "undefined" && window.location.pathname !== target) {
        window.location.assign(target);
      }
    };

    const safeTouch = () => {
      if (typeof window !== "undefined" && isJuryOrEvalPath(window.location.pathname)) {
        return;
      }
      touchCurrentAdminSession().catch(() => {
        // Session touch is telemetry — failures are non-fatal. True session
        // expiry is handled by onAuthStateChange, not touch failures.
      });
    };

    safeTouch();
    const intervalId = setInterval(safeTouch, 5 * 60 * 1000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        safeTouch();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [session?.user?.id, touchCurrentAdminSession]);

  const setActiveOrganization = useCallback((organizationId) => {
    setActiveOrganizationIdState(organizationId);
    setActiveOrganizationId(organizationId);
  }, []);

  const signIn = useCallback(async (email, password, rememberMe = false, captchaToken = "") => {
    if (!policy.emailPassword) throw new Error("Email/password login is disabled.");
    try { localStorage.setItem(KEYS.ADMIN_REMEMBER_ME, String(rememberMe)); }
    catch {}
    const credentials = captchaToken
      ? { email, password, options: { captchaToken } }
      : { email, password };
    const { data, error } = await supabase.auth.signInWithPassword(credentials);
    if (error) {
      // Log failure before re-throwing — anon RPC, never blocks UI.
      import("@/shared/api").then(({ writeAuthFailureEvent }) => {
        writeAuthFailureEvent(email, "password").catch(() => {});
      }).catch(() => {});
      throw error;
    }
    // Session persistence is handled by handleAuthChange (see clearPersistedSession
    // call keyed off ADMIN_REMEMBER_ME). Clearing storage here races with
    // supabase-js finishing its own session write and leaves the client's
    // cached getSession() empty, so the first PostgREST query after sign-in
    // goes out unauthenticated and RLS returns 0 rows.
    return data;
  }, [policy.emailPassword]);

  const signInWithGoogle = useCallback(async (rememberMe = false) => {
    if (!policy.googleOAuth) throw new Error("Google sign-in is disabled.");
    // Persist preference before redirect (checked in handleAuthChange after redirect)
    try { localStorage.setItem(KEYS.ADMIN_REMEMBER_ME, String(rememberMe)); }
    catch {}
    // Preserve /demo namespace across the OAuth round-trip so the callback
    // resolves to the demo Supabase project (not prod). Without this, a user
    // starting from /demo/login is redirected to /admin and the Proxy
    // client switches to prod mid-flow — causing 401s against prod tables.
    const pathname = typeof window !== "undefined" ? window.location.pathname : "";
    const base = pathname.startsWith("/demo") ? "/demo" : "";
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // Route OAuth callback through /admin so AdminRouteLayout's
        // profileIncomplete gate renders CompleteProfileForm for first-time
        // Google users (Name + Org only, no password). Returning users with
        // a complete profile pass through directly to the admin panel.
        redirectTo: `${window.location.origin}${base}/admin`,
      },
    });
    if (error) throw error;
    return data;
  }, [policy.googleOAuth]);

  const completeProfile = useCallback(async ({ name, orgName }) => {
    // Update user metadata to mark profile as completed
    const { error: metaError } = await supabase.auth.updateUser({
      data: { profile_completed: true, name },
    });
    if (metaError) throw metaError;

    // Create new org — atomically create org + active membership
    const { data, error } = await supabase.rpc("rpc_admin_create_org_and_membership", {
      p_name: name,
      p_org_name: orgName,
    });
    if (error) throw error;
    if (data?.ok === false) throw new Error(data.error_code || "org_creation_failed");

    // Send email verification non-blocking (try/catch that only warns)
    try {
      const { sendEmailVerification } = await import("@/shared/api");
      await sendEmailVerification();
    } catch (e) {
      console.warn("verification email send failed (non-blocking):", e?.message);
    }

    // USER_UPDATED auth event does NOT re-fetch memberships (early-return branch in handleAuthChange).
    // Refresh explicitly so isPending becomes false immediately.
    const memberships = await fetchMemberships();
    if (mountedRef.current) {
      setOrganizations(
        memberships.map((m) => ({
          id: m.organization_id,
          code: m.organization?.code ?? null,
          name: m.organization?.name ?? null,
          setupCompletedAt: m.organization?.setup_completed_at ?? null,
          role: m.role,
        }))
      );
    }

    setProfileIncomplete(false);
  }, [fetchMemberships]);

  const signUp = useCallback(async (email, password, metadata = {}) => {
    signingUpRef.current = true;
    try {
      const pathname = typeof window !== "undefined" ? window.location.pathname : "";
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const base = pathname.startsWith("/demo") ? "/demo" : "";
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name: metadata.name, profile_completed: true },
          emailRedirectTo: `${origin}${base}/login`,
        },
      });
      if (error) throw error;
      if (!data?.session) throw new Error("signup_session_missing");

      const { data: rpcData, error: rpcErr } = await supabase.rpc(
        "rpc_admin_create_org_and_membership",
        { p_name: metadata.name, p_org_name: metadata.orgName }
      );
      if (rpcErr) throw rpcErr;
      if (rpcData?.ok === false) {
        const err = new Error(rpcData.error_code || "org_creation_failed");
        err.code = rpcData.error_code;
        throw err;
      }

      try {
        const { sendEmailVerification } = await import("@/shared/api");
        await sendEmailVerification();
      } catch (e) {
        console.warn("verification email send failed (non-blocking):", e?.message);
      }

      const memberships = await fetchMemberships();
      if (mountedRef.current) {
        setOrganizations(
          memberships.map((m) => ({
            id: m.organization_id,
            code: m.organization?.code ?? null,
            name: m.organization?.name ?? null,
            setupCompletedAt: m.organization?.setup_completed_at ?? null,
            role: m.role,
          }))
        );
        const firstOrgId = memberships[0]?.organization_id || null;
        if (firstOrgId) {
          setActiveOrganizationIdState(firstOrgId);
          setActiveOrganizationId(firstOrgId);
        }
        setProfileIncomplete(false);
        setEmailVerifiedAt(memberships[0]?.email_verified_at ?? null);
        setGraceEndsAt(memberships[0]?.grace_ends_at ?? null);
      }
      return data;
    } finally {
      signingUpRef.current = false;
    }
  }, [fetchMemberships]);

  const resetPassword = useCallback(async (email) => {
    // password-reset-email Edge Function writes auth.admin.password.reset.requested
    // server-side before returning — no client-side audit write needed.
    const { data, error } = await invokeEdgeFunction("password-reset-email", {
      body: { email },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
  }, []);

  const updatePassword = useCallback(async (password) => {
    const { data, error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    // password-changed-notify Edge Function writes auth.admin.password.changed
    // server-side (in the same request as the email notification).
    try {
      await invokeEdgeFunction("password-changed-notify", { body: {} });
    } catch (e) {
      console.error("Password change notification/audit failed:", e?.message || e);
    }
    return data;
  }, []);

  const reauthenticateWithPassword = useCallback(async (password) => {
    const email = String(user?.email || "").trim();
    if (!email) throw new Error("Session expired. Please sign in again.");
    if (!String(password || "").trim()) throw new Error("Current password is required.");

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const msg = String(error?.message || "").toLowerCase();
      if (msg.includes("invalid login credentials")) {
        throw new Error("Current password is incorrect.");
      }
      throw error;
    }
    return data;
  }, [user?.email]);

  const signOut = useCallback(async () => {
    // admin.logout is written server-side by the on-auth-event Database Webhook
    // (auth.sessions DELETE) — no client-side write needed.
    await supabase.auth.signOut({ scope: "local" });
    hasSessionRef.current = false;
    currentUserIdRef.current = null;
    setUser(null);
    setSession(null);
    setOrganizations([]);
    setActiveOrganizationIdState(null);
    setEmailVerifiedAt(null);
    setGraceEndsAt(null);
  }, []);

  const signOutAll = useCallback(async () => {
    // admin.logout is written server-side by the on-auth-event Database Webhook
    // (auth.sessions DELETE) — no client-side write needed.
    await supabase.auth.signOut({ scope: "global" });
    hasSessionRef.current = false;
    currentUserIdRef.current = null;
    setUser(null);
    setSession(null);
    setOrganizations([]);
    setActiveOrganizationIdState(null);
    setEmailVerifiedAt(null);
    setGraceEndsAt(null);
  }, []);

  // Refresh memberships (e.g., after approval)
  const refreshMemberships = useCallback(async () => {
    const memberships = await fetchMemberships();
    if (!mountedRef.current) return;
    const isSuperMember = memberships.some((m) => m.role === "super_admin");
    if (isSuperMember) {
      try {
        const allOrgs = await listOrganizationsPublic();
        const allOrgList = allOrgs.map((o) => ({
          id: o.id,
          code: o.code ?? null,
          name: o.name ?? null,
          setupCompletedAt: o.setup_completed_at ?? null,
          role: "super_admin",
        }));
        const resolvedOrgList = allOrgList.length > 0
          ? allOrgList
          : [{ id: null, code: null, name: null, setupCompletedAt: null, role: "super_admin" }];
        if (mountedRef.current) setOrganizations(resolvedOrgList);
      } catch {
        const organizationList = memberships
          .filter((m) => m.organization?.status !== "archived")
          .map((m) => ({
            id: m.organization_id,
            code: m.organization?.code ?? null,
            name: m.organization?.name ?? null,
            setupCompletedAt: m.organization?.setup_completed_at ?? null,
            role: m.role,
          }));
        if (mountedRef.current) setOrganizations(organizationList);
      }
    } else {
      const organizationList = memberships
        .filter((m) => m.organization?.status !== "archived")
        .map((m) => ({
          id: m.organization_id,
          code: m.organization?.code ?? null,
          name: m.organization?.name ?? null,
          setupCompletedAt: m.organization?.setup_completed_at ?? null,
          role: m.role,
        }));
      if (mountedRef.current) setOrganizations(organizationList);
    }
  }, [fetchMemberships]);

  const activeOrganization = useMemo(
    () => organizations.find((o) => o.id === activeOrganizationId) || null,
    [organizations, activeOrganizationId]
  );

  const isSuper = useMemo(
    () => organizations.some((o) => o.role === "super_admin"),
    [organizations]
  );

  const isPending = useMemo(
    () => !!user && organizations.length === 0,
    [user, organizations]
  );

  const refreshUser = useCallback(async () => {
    const { data: { user: freshUser } } = await supabase.auth.getUser();
    if (freshUser) {
      setUser((prev) => prev ? {
        ...prev,
        email: freshUser.email,
        newEmail: freshUser.new_email ?? null,
      } : prev);
    }
  }, []);

  const clearPendingEmail = useCallback(() => {
    suppressEmailUpdateRef.current = true;
    setUser((prev) => prev ? { ...prev, newEmail: null } : prev);
  }, []);

  const value = useMemo(() => ({
    user,
    session,
    organizations,
    activeOrganization,
    setActiveOrganization,
    displayName,
    setDisplayName,
    avatarUrl,
    setAvatarUrl,
    isSuper,
    isPending,
    hasJoinRequest,
    profileIncomplete,
    loading,
    signIn,
    signInWithGoogle,
    signUp,
    signOut,
    signOutAll,
    resetPassword,
    updatePassword,
    reauthenticateWithPassword,
    refreshMemberships,
    completeProfile,
    refreshUser,
    clearPendingEmail,
    emailVerified: !!emailVerifiedAt,
    emailVerifiedAt,
    isEmailVerified: !!emailVerifiedAt,
    graceEndsAt,
    refreshEmailVerified: async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from("profiles")
        .select("email_verified_at")
        .eq("id", user.id)
        .maybeSingle();
      const verifiedAt = data?.email_verified_at ?? null;
      setEmailVerifiedAt(verifiedAt);
      if (verifiedAt) setGraceEndsAt(null);
    },
  }), [user, session, organizations, activeOrganization, setActiveOrganization, displayName, setDisplayName,
       avatarUrl, setAvatarUrl, isSuper, isPending, hasJoinRequest, profileIncomplete, loading, signIn,
    signInWithGoogle, signUp, signOut, signOutAll, resetPassword, updatePassword, reauthenticateWithPassword, refreshMemberships, completeProfile, refreshUser, clearPendingEmail, emailVerifiedAt, graceEndsAt, user?.id]);

  const policyContextValue = useMemo(
    () => ({ policy, updatePolicy: setPolicy }),
    [policy]
  );

  return (
    <SecurityPolicyContext.Provider value={policyContextValue}>
      <AuthContext.Provider value={value}>
        {children}
      </AuthContext.Provider>
    </SecurityPolicyContext.Provider>
  );
}
