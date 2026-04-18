// src/admin/hooks/useAdminRealtime.js
// ============================================================
// Manages the Supabase Realtime subscription for the admin panel's
// score cluster.
//
// Scope (narrowed 2026-04): only score-related tables. `jurors` and
// `periods` subscriptions now live in useManageJurors / useManagePeriods
// so they only run on pages that manage those entities.
//
// Tables covered here:
//   score_sheets, score_sheet_items, juror_period_auth, projects
// All four are period-scoped (no organization_id column). RLS drops
// cross-tenant rows on the server, so no client filter is needed.
//
// Gating:
//   * `enabled` prop controls whether the subscription is established.
//     Callers pass `false` on routes that don't display score data
//     (e.g. settings, jurors, periods) to avoid a high-frequency WS
//     stream during live jury days.
//
// Selective refresh:
//   * Each event's table name is collected into a pending set.
//   * After the 600 ms debounce, the set is passed to onRefreshRef.current()
//     so useAdminData only fetches the slices that actually changed.
// ============================================================

import { useEffect, useRef } from "react";
import { supabase } from "@/shared/lib/supabaseClient";

/**
 * useAdminRealtime — Supabase Realtime subscription for admin score data.
 *
 * @param {object} opts
 * @param {string} opts.organizationId               Current tenant ID (guard only; tables below have no org column).
 * @param {boolean} [opts.enabled=true]              When false, no channel is opened.
 * @param {React.MutableRefObject<Function>} opts.onRefreshRef
 *   Ref whose .current is the background-refresh callback. Called with
 *   (tables: string[]) so the consumer can refresh only affected slices.
 */
export function useAdminRealtime({ organizationId, onRefreshRef, enabled = true }) {
  const bgTimerRef = useRef(null);
  const pendingTablesRef = useRef(new Set());

  useEffect(() => {
    if (!enabled) return;
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

    const channel = supabase
      .channel("admin-panel-live")
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
      .subscribe();

    return () => {
      if (bgTimerRef.current) {
        clearTimeout(bgTimerRef.current);
        bgTimerRef.current = null;
      }
      pendingTablesRef.current.clear();
      supabase.removeChannel(channel);
    };
  }, [enabled, organizationId, onRefreshRef]);
}
