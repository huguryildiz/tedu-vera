-- ============================================================
-- 017_fix_notification_auth_secret_lookup.sql
-- Fix notification dispatch auth lookup so DB->Edge calls can
-- authenticate even when secrets are stored with uppercase names.
-- ============================================================

CREATE OR REPLACE FUNCTION public._dispatch_application_notification(
  p_type text, p_application_id uuid, p_recipient_email text, p_tenant_id uuid,
  p_applicant_name text DEFAULT NULL, p_tenant_short_label text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_url text;
  v_auth text;
  v_host text;
  v_applicant_email text;
BEGIN
  SELECT lower(trim(a.applicant_email))
    INTO v_applicant_email
  FROM tenant_admin_applications a
  WHERE a.id = p_application_id
  LIMIT 1;

  BEGIN
    v_url := current_setting('app.settings.supabase_url', true);
    IF v_url IS NULL OR trim(v_url) = '' THEN
      BEGIN
        SELECT decrypted_secret
          INTO v_url
        FROM vault.decrypted_secrets
        WHERE name IN ('supabase_url', 'SUPABASE_URL')
        ORDER BY created_at DESC
        LIMIT 1;
      EXCEPTION WHEN OTHERS THEN
        v_url := NULL;
      END;
    END IF;

    IF v_url IS NULL OR trim(v_url) = '' THEN
      BEGIN
        v_host := (current_setting('request.headers', true)::jsonb ->> 'host');
        IF v_host IS NOT NULL AND trim(v_host) <> '' THEN
          IF left(trim(v_host), 9) = 'localhost'
             OR left(trim(v_host), 9) = '127.0.0.1' THEN
            v_url := 'http://' || trim(v_host);
          ELSE
            v_url := 'https://' || trim(v_host);
          END IF;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        v_url := NULL;
      END;
    END IF;

    BEGIN
      v_auth := current_setting('app.settings.supabase_service_role_key', true);
      IF v_auth IS NULL OR trim(v_auth) = '' THEN
        SELECT decrypted_secret
          INTO v_auth
        FROM vault.decrypted_secrets
        WHERE name IN ('supabase_service_role_key', 'SUPABASE_SERVICE_ROLE_KEY')
        ORDER BY created_at DESC
        LIMIT 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_auth := NULL;
    END;

    IF v_url IS NOT NULL AND v_url <> '' THEN
      PERFORM net.http_post(url := v_url || '/functions/v1/notify-application',
        body := jsonb_build_object('type', p_type, 'application_id', p_application_id,
          'recipient_email', p_recipient_email, 'tenant_id', p_tenant_id,
          'applicant_name', p_applicant_name, 'applicant_email', v_applicant_email, 'tenant_name', p_tenant_short_label),
        headers := CASE
          WHEN v_auth IS NOT NULL AND trim(v_auth) <> '' THEN
            jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || trim(v_auth))
          ELSE
            jsonb_build_object('Content-Type', 'application/json')
        END);
    ELSE
      PERFORM public._audit_log('system', NULL, 'notification_failed', 'tenant_admin_application', p_application_id,
        'Notification skipped: supabase URL not resolved.',
        jsonb_build_object('type', p_type, 'tenant_id', p_tenant_id, 'recipient_email', p_recipient_email));
    END IF;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public._audit_log('system', NULL, 'notification_failed', 'tenant_admin_application', p_application_id,
      'Notification dispatch failed.',
      jsonb_build_object('type', p_type, 'tenant_id', p_tenant_id, 'recipient_email', p_recipient_email, 'error', SQLERRM));
  END;
END; $$;
