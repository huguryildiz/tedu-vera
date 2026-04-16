// src/admin/hooks/useAdminRealtime.js
// ============================================================
// Manages the Supabase Realtime subscription for the admin panel.
//
// Extracted from useAdminData.js (Phase 5 — Final Decomposition).
//
// Accepts a ref object whose .current holds the background-refresh
// callback. Using a ref (instead of a plain function) keeps this
// effect's dependency array stable — the subscription is only
// torn down and rebuilt when organizationId changes, not on every render.
//
// Scope narrowing:
//   * periods and jurors subscriptions filter on organization_id so other
//     tenants' events never reach this WS connection.
//   * score_sheets / score_sheet_items / juror_period_auth / projects have
//     no organization_id column — they're scoped by period_id. RLS drops
//     cross-tenant rows on the server, so we don't add a client filter.
//
// Selective refresh:
//   * Each event's table name is collected into a pending set.
//   * After the 600 ms debounce, the set is passed to onRefreshRef.current()
//     so useAdminData only fetches the slices that actually changed, instead
//     of always firing scores + summary + jurors on every event.
// ============================================================

import { useEffect, useRef } from "react";
import { supabase } from "@/shared/lib/supabaseClient";

/**
 * useAdminRealtime — Supabase Realtime subscription for admin panel data.
 *
 * Subscribes to all relevant tables and calls onRefreshRef.current(tables)
 * (debounced 600 ms) with the set of tables that fired events in the window.
 *
 * @param {object} opts
 * @param {string} opts.organizationId               Current tenant ID for scoping the subscription.
 * @param {React.MutableRefObject<Function>} opts.onRefreshRef
 *   Ref whose .current is the background-refresh callback. Called with
 *   (tables: string[]) so the consumer can refresh only affected slices.
 */
export function useAdminRealtime({ organizationId, onRefreshRef }) {
  const bgTimerRef = useRef(null);
  const pendingTablesRef = useRef(new Set());

  useEffect(() => {
    if (!organizationId) return;

    const scheduleBgRefresh = (table) => () => {
      pendingTablesRef.current.add(table);
      if (bgTimerRef.current) return;
      bgTimerRef.current = setTimeout(() => {
        bgTimerRef.current = null;
        const tables = Array.from(pendingTablesRef.current);
        pendingTablesRef.current.clear();
        onRefreshRef.current?.(tables);
      }, 600);
    };

    const orgFilter = `organization_id=eq.${organizationId}`;

    const channel = supabase
      .channel("admin-panel-live")
      // Period-scoped tables — RLS drops cross-tenant rows server-side.
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "score_sheets" },
        scheduleBgRefresh("score_sheets"),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "score_sheet_items" },
        scheduleBgRefresh("score_sheet_items"),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "juror_period_auth" },
        scheduleBgRefresh("juror_period_auth"),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projects" },
        scheduleBgRefresh("projects"),
      )
      // Org-scoped tables — narrow at WS level.
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "periods", filter: orgFilter },
        scheduleBgRefresh("periods"),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jurors", filter: orgFilter },
        scheduleBgRefresh("jurors"),
      )
      .subscribe();

    return () => {
      if (bgTimerRef.current) {
        clearTimeout(bgTimerRef.current);
        bgTimerRef.current = null;
      }
      pendingTablesRef.current.clear();
      supabase.removeChannel(channel);
    };
  }, [organizationId, onRefreshRef]);
}
