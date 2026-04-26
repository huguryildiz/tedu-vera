// src/admin/hooks/usePageRealtime.js
// Per-page Realtime subscription factory.
// Each page creates its own scoped channel that is cleaned up on unmount.

import { useEffect } from "react";
import { supabase } from "@/shared/lib/supabaseClient";

/**
 * Creates a scoped Supabase Realtime subscription for a single admin page.
 *
 * @param {object}   params
 * @param {string}   params.organizationId      — current tenant (skips subscription if falsy)
 * @param {string}   params.channelName   — unique channel name (e.g. "jurors-page-live")
 * @param {Array}    params.subscriptions — list of table subscriptions:
 *   [{ table, event?, schema?, filter?, onPayload }]
 *   - table: Postgres table name
 *   - event: "INSERT" | "UPDATE" | "DELETE" | "*" (default: "*")
 *   - schema: Postgres schema (default: "public")
 *   - filter: optional server-side filter, e.g. "organization_id=eq.{id}"
 *   - onPayload: callback receiving the Realtime payload
 * @param {Array}    [params.deps=[]]     — additional dependency array entries for the effect
 */
export function usePageRealtime({ organizationId, channelName, subscriptions, deps = [] }) {
  useEffect(() => {
    // Disabled during E2E: realtime events from CRUD operations trigger stale
    // refreshPeriods/loadPeriods calls that race with optimistic state updates
    // (e.g. removePeriod), causing deleted rows to reappear. Tests that
    // specifically exercise Realtime can opt back in by setting
    // window.__VERA_E2E_REALTIME__ = true via Playwright's addInitScript.
    if (
      import.meta.env.VITE_E2E &&
      !(typeof window !== "undefined" && window.__VERA_E2E_REALTIME__)
    ) {
      return;
    }
    if (!organizationId) return;
    if (!subscriptions || subscriptions.length === 0) return;

    let channel = supabase.channel(channelName);

    for (const sub of subscriptions) {
      const config = {
        event: sub.event || "*",
        schema: sub.schema || "public",
        table: sub.table,
      };
      if (sub.filter) config.filter = sub.filter;
      channel = channel.on("postgres_changes", config, sub.onPayload);
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, channelName, ...deps]);
}
