import { useEffect, useRef, useState } from "react";
import { getDemoClient } from "@/shared/lib/supabaseClient";

const FALLBACK = {
  organizations: 6,
  evaluations: 468,
  jurors: 36,
  projects: 76,
};

const demoClient = getDemoClient();

function useLiveStats() {
  const [stats, setStats] = useState(FALLBACK);
  const [synced, setSynced] = useState(false);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    demoClient
      .rpc("rpc_landing_stats")
      .then(({ data }) => {
        if (data && typeof data === "object") {
          setStats(data);
          setSynced(true);
        }
      })
      .catch(() => {});
  }, []);

  return { stats, synced };
}

function useSyncSeconds() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return seconds;
}

const fmt = (n) => Number(n || 0).toLocaleString("en-US");

export default function LiveSignal() {
  const { stats, synced } = useLiveStats();
  const sync = useSyncSeconds();

  return (
    <section className="ed-ticker" aria-label="Live signal — VERA platform metrics">
      <div className="ed-wrap ed-ticker-inner">
        <div className="ed-ticker-label">
          <span className="ed-ticker-dot" />
          Live signal
        </div>

        <div className="ed-ticker-stat">
          <div className="num"><em>{fmt(stats.jurors)}</em></div>
          <div className="lbl">Active jurors</div>
        </div>
        <div className="ed-ticker-stat">
          <div className="num">{fmt(stats.evaluations)}</div>
          <div className="lbl">Evaluations</div>
        </div>
        <div className="ed-ticker-stat">
          <div className="num">{fmt(stats.organizations)}</div>
          <div className="lbl">Organizations</div>
        </div>
        <div className="ed-ticker-stat">
          <div className="num">{fmt(stats.projects)}</div>
          <div className="lbl">Projects · scored</div>
        </div>

        <div className="ed-ticker-source">
          Source · <b>vera-prod</b>
          <br />
          {synced ? (
            <>Last sync <b>{sync}s ago</b></>
          ) : (
            <>Source · <b>cached</b></>
          )}
        </div>
      </div>
    </section>
  );
}
