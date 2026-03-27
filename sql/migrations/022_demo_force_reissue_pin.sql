-- Migration 022: Add p_force_reissue parameter to rpc_create_or_get_juror_and_issue_pin
--
-- Adds a p_force_reissue boolean DEFAULT false parameter.
-- When true, resets the juror's PIN for the semester and returns pin_plain_once,
-- so the caller always lands on the pin_reveal flow instead of the pin-entry flow.
-- Used exclusively by demo mode (VITE_DEMO_MODE=true) on the frontend.
--
-- The old 3-arg signature is dropped so existing callers that omit the 4th arg
-- continue to work via PostgreSQL's default-parameter resolution.

DROP FUNCTION IF EXISTS public.rpc_create_or_get_juror_and_issue_pin(uuid, text, text);
DROP FUNCTION IF EXISTS public.rpc_create_or_get_juror_and_issue_pin(uuid, text, text, boolean);

CREATE OR REPLACE FUNCTION public.rpc_create_or_get_juror_and_issue_pin(
  p_semester_id   uuid,
  p_juror_name    text,
  p_juror_inst    text,
  p_force_reissue boolean DEFAULT false
)
RETURNS TABLE (
  juror_id        uuid,
  juror_name      text,
  juror_inst      text,
  needs_pin       boolean,
  pin_plain_once  text,
  locked_until    timestamptz,
  failed_attempts integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
#variable_conflict use_column
DECLARE
  v_norm_name       text;
  v_norm_inst       text;
  v_juror_id        uuid;
  v_juror_name      text;
  v_juror_inst      text;
  v_pin             text;
  v_pin_hash        text;
  v_exists          boolean;
  v_constraint      text;
  v_locked_until    timestamptz;
  v_failed_attempts integer;
  v_pin_plain_once  text;
  v_secret          text;
  v_reveal_pending  boolean := false;
  v_tenant_id       uuid;
BEGIN
  v_norm_name := lower(regexp_replace(trim(coalesce(p_juror_name, '')), '\s+', ' ', 'g'));
  v_norm_inst := lower(regexp_replace(trim(coalesce(p_juror_inst, '')), '\s+', ' ', 'g'));

  PERFORM pg_advisory_xact_lock(hashtext(v_norm_name || '|' || v_norm_inst));

  -- Look up tenant_id from the semester (needed for juror_semester_auth rows)
  SELECT s.tenant_id INTO v_tenant_id
  FROM semesters s
  WHERE s.id = p_semester_id
    AND s.is_current = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'semester_inactive';
  END IF;

  IF v_norm_name = '' OR v_norm_inst = '' THEN
    RAISE EXCEPTION 'invalid juror identity';
  END IF;

  SELECT j.id, j.juror_name, j.juror_inst
    INTO v_juror_id, v_juror_name, v_juror_inst
  FROM jurors j
  WHERE lower(regexp_replace(trim(coalesce(j.juror_name, '')), '\s+', ' ', 'g')) = v_norm_name
    AND lower(regexp_replace(trim(coalesce(j.juror_inst, '')), '\s+', ' ', 'g')) = v_norm_inst
  ORDER BY j.id
  LIMIT 1;

  IF v_juror_id IS NULL THEN
    BEGIN
      INSERT INTO jurors (juror_name, juror_inst)
      VALUES (trim(p_juror_name), trim(p_juror_inst))
      RETURNING id, juror_name, juror_inst
      INTO v_juror_id, v_juror_name, v_juror_inst;
    EXCEPTION WHEN unique_violation THEN
      GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
      IF v_constraint = 'jurors_name_inst_norm_uniq' THEN
        SELECT j.id, j.juror_name, j.juror_inst
          INTO v_juror_id, v_juror_name, v_juror_inst
        FROM jurors j
        WHERE lower(regexp_replace(trim(coalesce(j.juror_name, '')), '\s+', ' ', 'g')) = v_norm_name
          AND lower(regexp_replace(trim(coalesce(j.juror_inst, '')), '\s+', ' ', 'g')) = v_norm_inst
        ORDER BY j.id
        LIMIT 1;
      ELSE
        RAISE;
      END IF;
    END;
  END IF;

  SELECT true INTO v_exists
  FROM juror_semester_auth a
  WHERE a.juror_id = v_juror_id
    AND a.semester_id = p_semester_id
  LIMIT 1;

  IF v_exists THEN
    SELECT a.locked_until, a.failed_attempts, a.pin_plain_once, a.pin_reveal_pending
      INTO v_locked_until, v_failed_attempts, v_pin_plain_once, v_reveal_pending
    FROM juror_semester_auth a
    WHERE a.juror_id = v_juror_id
      AND a.semester_id = p_semester_id
    LIMIT 1;

    -- Pending reveal takes priority: surface it regardless of force_reissue.
    IF v_reveal_pending THEN
      IF v_pin_plain_once IS NOT NULL AND v_pin_plain_once LIKE 'enc:%' THEN
        SELECT decrypted_secret INTO v_secret
        FROM vault.decrypted_secrets
        WHERE name = 'pin_secret'
        LIMIT 1;
        IF v_secret IS NULL OR v_secret = '' THEN
          RAISE EXCEPTION 'pin_secret_missing';
        END IF;
        v_pin_plain_once := pgp_sym_decrypt(
          decode(substring(v_pin_plain_once from 5), 'base64'),
          v_secret
        );
      END IF;
      IF v_pin_plain_once IS NULL THEN
        -- pin_plain_once missing despite pin_reveal_pending=true (data corruption).
        -- Generate a new PIN silently and log the recovery for admin forensics.
        PERFORM public._audit_log(
          'system', null::uuid, 'pin_recovery_regen',
          'juror_semester_auth', v_juror_id,
          format('pin_plain_once missing on reveal for juror %s — new PIN generated', v_juror_id),
          jsonb_build_object(
            'juror_id', v_juror_id,
            'semester_id', p_semester_id,
            'reason', 'pin_plain_once_null_on_reveal'
          )
        );
        v_pin := lpad((('x' || encode(gen_random_bytes(2), 'hex'))::bit(16)::int % 10000)::text, 4, '0');
        v_pin_hash := crypt(v_pin, gen_salt('bf'::text));
        v_pin_plain_once := v_pin;
        UPDATE juror_semester_auth
        SET pin_hash = v_pin_hash,
            failed_attempts = 0,
            locked_until = null,
            pin_reveal_pending = false,
            pin_plain_once = null
        WHERE juror_id = v_juror_id
          AND semester_id = p_semester_id;
      ELSE
        UPDATE juror_semester_auth
        SET failed_attempts = 0,
            locked_until = null,
            pin_reveal_pending = false,
            pin_plain_once = null
        WHERE juror_id = v_juror_id
          AND semester_id = p_semester_id;
      END IF;

      RETURN QUERY SELECT null::uuid, v_juror_name, v_juror_inst, false, v_pin_plain_once,
        null::timestamptz, 0;
      RETURN;
    END IF;

    -- Force-reissue: reset PIN, scores, and final_submitted_at so the caller
    -- gets a clean slate. Used by demo mode so each visitor starts fresh.
    IF p_force_reissue THEN
      v_pin      := lpad((('x' || encode(gen_random_bytes(2), 'hex'))::bit(16)::int % 10000)::text, 4, '0');
      v_pin_hash := crypt(v_pin, gen_salt('bf'::text));
      UPDATE juror_semester_auth
      SET pin_hash        = v_pin_hash,
          failed_attempts = 0,
          locked_until    = null,
          pin_reveal_pending = false,
          pin_plain_once  = null,
          edit_enabled    = false
      WHERE juror_id   = v_juror_id
        AND semester_id = p_semester_id;
      -- Clear all scores so the next demo user starts with a blank evaluation
      UPDATE scores
      SET criteria_scores    = NULL,
          comment            = NULL,
          final_submitted_at = NULL
      WHERE juror_id   = v_juror_id
        AND semester_id = p_semester_id;
      RETURN QUERY SELECT null::uuid, v_juror_name, v_juror_inst, false, v_pin,
        null::timestamptz, 0;
      RETURN;
    END IF;

    RETURN QUERY SELECT null::uuid, v_juror_name, v_juror_inst, true, null::text,
      v_locked_until, coalesce(v_failed_attempts, 0);
    RETURN;
  END IF;

  v_pin      := lpad((('x' || encode(gen_random_bytes(2), 'hex'))::bit(16)::int % 10000)::text, 4, '0');
  v_pin_hash := crypt(v_pin, gen_salt('bf'::text));

  INSERT INTO juror_semester_auth (juror_id, semester_id, pin_hash, tenant_id)
  VALUES (v_juror_id, p_semester_id, v_pin_hash, v_tenant_id)
  ON CONFLICT (juror_id, semester_id) DO NOTHING;

  IF NOT FOUND THEN
    RETURN QUERY SELECT null::uuid, v_juror_name, v_juror_inst, true, null::text,
      null::timestamptz, 0;
    RETURN;
  END IF;

  RETURN QUERY SELECT null::uuid, v_juror_name, v_juror_inst, false, v_pin,
    null::timestamptz, 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_create_or_get_juror_and_issue_pin(uuid, text, text, boolean)
  TO anon, authenticated;
