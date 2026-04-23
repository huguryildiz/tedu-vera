import { FileEdit, Send, Play, Archive, Lock } from "lucide-react";

export default function StatusPill({ status }) {
  if (status === "draft_incomplete" || status === "draft_ready" || status === "draft") {
    return (
      <span className="sem-status sem-status-draft">
        <FileEdit size={12} />
        Draft
      </span>
    );
  }
  if (status === "published") {
    return (
      <span className="sem-status sem-status-published">
        <Send size={12} />
        Published
      </span>
    );
  }
  if (status === "live") {
    return (
      <span className="sem-status sem-status-live">
        <Play size={12} />
        Live
      </span>
    );
  }
  if (status === "closed") {
    return (
      <span className="sem-status sem-status-closed">
        <Archive size={12} />
        Closed
      </span>
    );
  }
  // Legacy fallback — should not hit after rollout completes.
  return (
    <span className="sem-status sem-status-locked">
      <Lock size={12} />
      Locked
    </span>
  );
}
