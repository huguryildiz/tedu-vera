-- sql/migrations/027_public_auth_flags_rpc.sql
-- =============================================================================
-- Public auth flags RPC: exposes only the three public-facing authentication
-- toggles (googleOAuth, emailPassword, rememberMe) from security_policy so the
-- login screen can hide disabled methods for anonymous users.
--
-- Why a new RPC: rpc_admin_get_security_policy requires super_admin and returns
-- the full policy JSONB (including CC notification flags, PIN lockout cooldown,
-- etc.). The login screen needs only the three public auth flags and must be
-- callable by anon. This function is read-only, SECURITY DEFINER, and returns
-- only the safe subset.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.rpc_public_auth_flags()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_policy JSONB;
BEGIN
  SELECT policy INTO v_policy FROM security_policy WHERE id = 1;
  IF NOT FOUND THEN
    RETURN json_build_object(
      'googleOAuth', true,
      'emailPassword', true,
      'rememberMe', true
    );
  END IF;
  RETURN json_build_object(
    'googleOAuth',   COALESCE((v_policy->>'googleOAuth')::BOOLEAN, true),
    'emailPassword', COALESCE((v_policy->>'emailPassword')::BOOLEAN, true),
    'rememberMe',    COALESCE((v_policy->>'rememberMe')::BOOLEAN, true)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_public_auth_flags() TO anon, authenticated;
