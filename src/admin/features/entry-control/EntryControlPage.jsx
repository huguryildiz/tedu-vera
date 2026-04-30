// src/admin/features/entry-control/EntryControlPage.jsx
// Entry Control page: QR access tokens, session monitoring, access history.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAdminContext } from "@/admin/shared/useAdminContext";
import { useAuth } from "@/auth";
import { LOCK_TOOLTIP_GRACE, LOCK_TOOLTIP_EXPIRED } from "@/auth/shared/lockedActions";
import QRCodeStyling from "qr-code-styling";
import veraLogo from "@/assets/vera_logo.png";
import FbAlert from "@/shared/ui/FbAlert";
import {
  generateEntryToken,
  publishPeriod,
  revokeEntryToken,
  getEntryTokenStatus,
  getEntryTokenHistory,
  getActiveEntryTokenPlain,
  sendEntryTokenEmail,
  supabase,
} from "@/shared/api";
import { useToast } from "@/shared/hooks/useToast";
import {
  getRawToken as storageGetRawToken,
  setRawToken as storageSetRawToken,
  clearRawToken as storageClearRawToken,
} from "@/shared/storage/adminStorage";
import JuryRevokeConfirmDialog from "@/admin/shared/JuryRevokeConfirmDialog";
import { QrCode, TriangleAlert } from "lucide-react";
import { formatDateTime as fmtDate } from "@/shared/lib/dateUtils";
import useCardSelection from "@/shared/hooks/useCardSelection";
import {
  fmtExpiry,
  fmtExpiryHeadline,
  fmtExpiryCompact,
  fmtRelative,
  toTimestampMs,
  isExpiringSoon,
} from "./components/entryControlHelpers";
import TokenGeneratorCard from "./components/TokenGeneratorCard";
import SessionOverviewPanel from "./components/SessionOverviewPanel";
import SessionHistoryTable from "./components/SessionHistoryTable";
import SendQrModal from "./components/SendQrModal";
import SendSuccessModal from "./components/SendSuccessModal";
import NewUserSendModal from "./components/NewUserSendModal";
import LockWarnModal from "./components/LockWarnModal";
import "./EntryControlPage.css";

export default function EntryControlPage() {
  const {
    organizationId: _organizationId,
    activeOrganization,
    selectedPeriodId,
    selectedPeriod,
    allJurors = [],
    isDemoMode = false,
    fetchData,
  } = useAdminContext();
  const { isEmailVerified, graceEndsAt } = useAuth();
  const isGraceLocked    = !!(graceEndsAt && !isEmailVerified && new Date(graceEndsAt) < new Date());
  const graceLockTooltip = isGraceLocked
    ? (new Date(graceEndsAt) < new Date() ? LOCK_TOOLTIP_EXPIRED : LOCK_TOOLTIP_GRACE)
    : null;
  const historyScopeRef = useCardSelection();
  const periodId = selectedPeriodId;
  const periodName = selectedPeriod?.name || selectedPeriod?.period_name || selectedPeriod?.semester_name || "";

  const [status, setStatus] = useState(null);
  const [tokenHistory, setTokenHistory] = useState([]);
  const [error, setError] = useState("");
  const [rawToken, setRawToken] = useState("");
  const [showTokenDetail, setShowTokenDetail] = useState(false);
  const [revokeModalOpen, setRevokeModalOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [lockWarnOpen, setLockWarnOpen] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [historySortKey, setHistorySortKey] = useState("created_at");
  const [historySortDir, setHistorySortDir] = useState("desc");
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [sendSuccessOpen, setSendSuccessOpen] = useState(false);
  const [selectedRecipientIds, setSelectedRecipientIds] = useState([]);
  const [bulkSending, setBulkSending] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [newUserModalOpen, setNewUserModalOpen] = useState(false);
  const [newUserRecipients, setNewUserRecipients] = useState([]);
  const [newUserInputValue, setNewUserInputValue] = useState("");
  const [newUserSending, setNewUserSending] = useState(false);
  const [newUserError, setNewUserError] = useState("");
  const [lastBulkSend, setLastBulkSend] = useState(null);
  const [sendSummary, setSendSummary] = useState({ delivered: 0, skipped: 0, failed: 0 });
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const qrRef = useRef(null);
  const qrInstance = useRef(null);
  const newUserInputRef = useRef(null);
  const _toast = useToast();

  const entryUrl = rawToken
    ? `${window.location.origin}${isDemoMode ? "/demo" : ""}/eval?t=${encodeURIComponent(rawToken)}`
    : "";

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser()
      .then(({ data }) => {
        if (!mounted) return;
        setCurrentUserEmail(data?.user?.email || "");
      })
      .catch(() => {
        if (!mounted) return;
        setCurrentUserEmail("");
      });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    qrInstance.current = new QRCodeStyling({
      width: 200,
      height: 200,
      type: "svg",
      dotsOptions: { type: "extra-rounded", color: "#1e3a5f" },
      cornersSquareOptions: { type: "extra-rounded", color: "#1e3a5f" },
      cornersDotOptions: { type: "dot", color: "#2563eb" },
      backgroundOptions: { color: "#ffffff" },
      imageOptions: { crossOrigin: "anonymous", margin: 4, imageSize: 0.46 },
    });
  }, []);

  useEffect(() => {
    if (!qrInstance.current || !entryUrl) return;
    qrInstance.current.update({ data: entryUrl, image: veraLogo });
    if (qrRef.current) {
      qrRef.current.innerHTML = "";
      qrInstance.current.append(qrRef.current);
    }
  }, [entryUrl]);

  const loadStatus = useCallback(async () => {
    if (!periodId) return;
    setError("");
    try {
      const [s, history] = await Promise.all([
        getEntryTokenStatus(periodId),
        getEntryTokenHistory(periodId),
      ]);
      setStatus(s);
      const normalizedHistory = [...(history || [])].sort((a, b) => (
        toTimestampMs(b?.created_at) - toTimestampMs(a?.created_at)
      ));
      setTokenHistory(normalizedHistory);
    } catch (e) {
      setError(e?.unauthorized ? "Session expired — please log in again." : "Failed to load token status.");
    }
  }, [periodId]);

  useEffect(() => {
    if (!periodId) {
      setRawToken("");
      setStatus(null);
      setTokenHistory([]);
      return;
    }
    const saved = storageGetRawToken(periodId);
    if (saved) {
      setRawToken(saved);
    }
    loadStatus();
    if (!saved) {
      getActiveEntryTokenPlain(periodId)
        .then((plain) => { if (plain) setRawToken(plain); })
        .catch(() => { });
    }
  }, [periodId, loadStatus]);

  useEffect(() => {
    if (!isDemoMode || !status?.has_token || !status?.enabled) return;
    if (rawToken) return;
    setRawToken("demo-token-" + (periodId || "").slice(0, 8));
  }, [isDemoMode, status, rawToken, periodId]);

  const willLockPeriod = !selectedPeriod?.is_locked;

  function handleGenerateClick() {
    if (!periodId) return;
    if (willLockPeriod) {
      setLockWarnOpen(true);
      return;
    }
    handleGenerate();
  }

  async function handleGenerate() {
    if (!periodId) return;
    setLockWarnOpen(false);
    setRegenerating(true);
    setError("");
    setRawToken("");
    storageClearRawToken(periodId);
    try {
      if (!selectedPeriod?.is_locked) {
        const publishResult = await publishPeriod(periodId);
        if (publishResult?.ok === false) {
          const blockers = (publishResult?.readiness?.issues || [])
            .filter((i) => i.severity === "required")
            .map((i) => i.msg)
            .join(" · ");
          setError(blockers ? `Cannot publish: ${blockers}` : "Period is not ready to publish.");
          return;
        }
      }
      const token = await generateEntryToken(periodId);
      if (token) {
        setHistorySortKey("created_at");
        setHistorySortDir("desc");
        setRawToken(token);
        storageSetRawToken(periodId, token);
        await loadStatus();
        fetchData?.();
        _toast.success("Period published — new access QR generated");
      } else {
        setError("Token generation failed — please try again.");
      }
    } catch (e) {
      console.error("[generateEntryToken]", e);
      const msg = String(e?.message || "");
      if (msg.includes("period_not_published")) {
        setError("This period is not published yet. Publish it first from the Periods page.");
      } else if (e?.unauthorized) {
        setError("Unauthorized — check your session.");
      } else {
        setError("Failed to generate token.");
      }
    } finally {
      setRegenerating(false);
    }
  }

  async function handleRevoke() {
    if (!periodId) return;
    setRevoking(true);
    setError("");
    try {
      const result = await revokeEntryToken(periodId);
      setRawToken("");
      storageClearRawToken(periodId);
      await loadStatus();
      const lockMsg = result.active_juror_count > 0
        ? `Jury access revoked. ${result.active_juror_count} active session(s) locked.`
        : "Jury access revoked and evaluations locked.";
      _toast.success(lockMsg);
      setRevokeModalOpen(false);
    } catch (e) {
      setError(e?.unauthorized ? "Unauthorized — check your session." : "Failed to revoke token.");
      _toast.error("Failed to revoke jury access — try again");
    } finally {
      setRevoking(false);
    }
  }

  async function handleCopy() {
    if (!entryUrl) return;
    try {
      await navigator.clipboard.writeText(entryUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = entryUrl;
        ta.style.cssText = "position:fixed;opacity:0;pointer-events:none";
        document.body.appendChild(ta);
        ta.focus(); ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        setError("Failed to copy to clipboard.");
      }
    }
  }

  const recipients = (allJurors || [])
    .filter((row) => row?.jurorId)
    .map((row) => {
      const name = row.juryName || "Unnamed juror";
      const email = (row.email || "").trim();
      const parts = String(name).trim().split(/\s+/).filter(Boolean);
      const initials = (parts[0]?.[0] || "") + (parts[1]?.[0] || "");
      return {
        id: row.jurorId,
        name,
        email,
        hasEmail: Boolean(email),
        initials: initials.toUpperCase() || "JR",
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const emailRecipients = recipients.filter((r) => r.hasEmail);
  const noEmailCount = recipients.length - emailRecipients.length;
  const selectedSet = new Set(selectedRecipientIds);
  const selectedCount = emailRecipients.filter((r) => selectedSet.has(r.id)).length;

  const initializeRecipients = useCallback(() => {
    setSelectedRecipientIds(emailRecipients.map((r) => r.id));
  }, [emailRecipients]);

  function openSendModal() {
    if (!entryUrl) {
      _toast.error("Generate an active QR token first");
      return;
    }
    initializeRecipients();
    setSendModalOpen(true);
  }

  function toggleRecipient(recipient) {
    if (!recipient?.hasEmail) return;
    setSelectedRecipientIds((prev) => {
      if (prev.includes(recipient.id)) return prev.filter((id) => id !== recipient.id);
      return [...prev, recipient.id];
    });
  }

  function selectAllRecipients() {
    setSelectedRecipientIds(emailRecipients.map((r) => r.id));
  }

  function deselectAllRecipients() {
    setSelectedRecipientIds([]);
  }

  async function handleSendTestToMe() {
    if (!entryUrl) return;
    if (!currentUserEmail) {
      _toast.error("Failed to load your account email");
      return;
    }
    setTestSending(true);
    try {
      const result = await sendEntryTokenEmail({
        recipientEmail: currentUserEmail,
        tokenUrl: entryUrl,
        expiresIn: expiryLabel || undefined,
        periodName: periodName || undefined,
        organizationName: activeOrganization?.name || undefined,
        organizationId: activeOrganization?.id || undefined,
        periodId: periodId || undefined,
      });
      if (result?.sent === false || result?.ok === false) {
        throw new Error(result?.error || "send_failed");
      }
      _toast.success(`Test sent to ${currentUserEmail}`);
    } catch (err) {
      _toast.error("Failed to send test email");
    } finally {
      setTestSending(false);
    }
  }

  async function handleSendToNewUser() {
    if (!entryUrl) return;
    const targets = [...newUserRecipients];
    const pendingInput = String(newUserInputValue || "").trim().toLowerCase();
    if (pendingInput && !targets.includes(pendingInput)) {
      targets.push(pendingInput);
    }
    if (!targets.length) {
      setNewUserError("Please add at least one email address.");
      return;
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmail = targets.find((email) => !emailPattern.test(email));
    if (invalidEmail) {
      setNewUserError(`Invalid email: ${invalidEmail}`);
      return;
    }
    setNewUserSending(true);
    setNewUserError("");
    try {
      const results = await Promise.allSettled(
        targets.map((email) => sendEntryTokenEmail({
          recipientEmail: email,
          tokenUrl: entryUrl,
          expiresIn: expiryLabel || undefined,
          periodName: periodName || undefined,
          organizationName: activeOrganization?.name || undefined,
          organizationId: activeOrganization?.id || undefined,
          periodId: periodId || undefined,
        }))
      );
      let delivered = 0;
      let failed = 0;
      results.forEach((result) => {
        if (result.status === "fulfilled") {
          const payload = result.value;
          if (payload?.sent === false || payload?.ok === false) failed += 1;
          else delivered += 1;
        } else {
          failed += 1;
        }
      });
      if (delivered === 0) {
        throw new Error("Failed to send email.");
      }
      _toast.success(`Access link sent to ${delivered} recipient${delivered === 1 ? "" : "s"}`);
      if (failed > 0) {
        _toast.error(`${failed} email${failed === 1 ? "" : "s"} failed to send`);
      }
      setNewUserRecipients([]);
      setNewUserInputValue("");
      setNewUserModalOpen(false);
    } catch (err) {
      setNewUserError("Failed to send email.");
    } finally {
      setNewUserSending(false);
    }
  }

  async function handleBulkSend() {
    if (!entryUrl) return;
    const targets = emailRecipients.filter((recipient) => selectedSet.has(recipient.id));
    if (!targets.length) return;
    setBulkSending(true);
    try {
      const results = await Promise.allSettled(
        targets.map((recipient) =>
          sendEntryTokenEmail({
            recipientEmail: recipient.email,
            tokenUrl: entryUrl,
            expiresIn: expiryLabel || undefined,
            periodName: periodName || undefined,
            organizationName: activeOrganization?.name || undefined,
            organizationId: activeOrganization?.id || undefined,
            periodId: periodId || undefined,
          })
        )
      );
      let delivered = 0;
      let failed = 0;
      results.forEach((result) => {
        if (result.status === "fulfilled") {
          const payload = result.value;
          if (payload?.sent === false || payload?.ok === false) {
            failed += 1;
          } else {
            delivered += 1;
          }
        } else {
          failed += 1;
        }
      });
      const summary = { delivered, skipped: noEmailCount, failed };
      setSendSummary(summary);
      setLastBulkSend({
        sentAt: new Date().toISOString(),
        delivered,
        selected: targets.length,
        noEmail: noEmailCount,
        failed,
        totalAssigned: recipients.length,
      });
      setSendModalOpen(false);
      setSendSuccessOpen(true);
      if (delivered > 0) {
        _toast.success(`Sent to ${delivered} juror${delivered === 1 ? "" : "s"}`);
      }
      if (failed > 0) {
        _toast.error(`${failed} email${failed === 1 ? "" : "s"} failed to send`);
      }
    } catch (err) {
      _toast.error("Bulk send failed");
    } finally {
      setBulkSending(false);
    }
  }

  async function handleDownload() {
    if (!entryUrl) return;
    const fileName = `jury-qr-${periodName || periodId || "access"}`;
    try {
      const hiRes = new QRCodeStyling({
        width: 800,
        height: 800,
        data: entryUrl,
        image: veraLogo,
        dotsOptions: { type: "extra-rounded", color: "#1e3a5f" },
        cornersSquareOptions: { type: "extra-rounded", color: "#1e3a5f" },
        cornersDotOptions: { type: "dot", color: "#2563eb" },
        backgroundOptions: { color: "#ffffff" },
        imageOptions: { crossOrigin: "anonymous", margin: 4, imageSize: 0.46 },
      });
      const raw = await hiRes.getRawData("png");
      if (!raw) throw new Error("QR data unavailable.");
      const blob = raw instanceof Blob ? raw : new Blob([raw], { type: "image/png" });
      const file = new File([blob], `${fileName}.png`, { type: "image/png" });
      const isTouchDevice = navigator.maxTouchPoints > 1;
      if (isTouchDevice && navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Jury QR Code" });
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${fileName}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (err) {
      if (err?.name === "AbortError") return;
      _toast.error("Failed to download QR code");
    }
  }

  const hasToken = status?.has_token;
  const isActive = status?.enabled;
  const isBusy = regenerating || revoking;
  const expirySoon = isExpiringSoon(status?.expires_at);
  const expiryLabel = fmtExpiry(status?.expires_at);
  const expiryHeadline = fmtExpiryHeadline(status?.expires_at);
  const expiryCompact = fmtExpiryCompact(status?.expires_at);
  const activeSessionsCount = typeof status?.active_session_count === "number"
    ? status.active_session_count
    : (typeof status?.active_juror_count === "number" ? status.active_juror_count : null);
  const activeSessions = activeSessionsCount ?? "—";
  const entryUrlLabel = (() => {
    if (!entryUrl) return "";
    try {
      const url = new URL(entryUrl);
      const evalToken = url.searchParams.get("eval");
      if (!evalToken || evalToken.length <= 16) return entryUrl;
      const shortened = `${evalToken.slice(0, 8)}...${evalToken.slice(-4)}`;
      url.searchParams.set("eval", shortened);
      return url.toString();
    } catch {
      return entryUrl;
    }
  })();
  const hasTokenHistory = tokenHistory.length > 0;

  const addNewUserRecipient = useCallback((email) => {
    const normalized = String(email || "").trim().toLowerCase();
    if (!normalized) return;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(normalized)) {
      setNewUserError("Please enter a valid email address.");
      return;
    }
    setNewUserRecipients((prev) => {
      if (prev.includes(normalized)) return prev;
      return [...prev, normalized];
    });
    setNewUserInputValue("");
    setNewUserError("");
  }, []);
  const removeNewUserRecipient = useCallback((email) => {
    setNewUserRecipients((prev) => prev.filter((recipient) => recipient !== email));
  }, []);
  const handleNewUserKeyDown = useCallback((e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addNewUserRecipient(newUserInputValue);
    }
    if (e.key === "Backspace" && !newUserInputValue && newUserRecipients.length > 0) {
      setNewUserRecipients((prev) => prev.slice(0, -1));
    }
  }, [addNewUserRecipient, newUserInputValue, newUserRecipients.length]);
  const handleNewUserPaste = useCallback((e) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text");
    const emails = text.split(/[,;\s]+/).filter(Boolean);
    emails.forEach((email) => addNewUserRecipient(email));
  }, [addNewUserRecipient]);

  const sortedTokenHistory = [...tokenHistory].sort((a, b) => {
    const dirMul = historySortDir === "asc" ? 1 : -1;
    const statusValue = (row) => {
      if (row?.is_active) return 3;
      if (row?.is_expired) return 2;
      return 1;
    };
    const numOrMin = (value) => (typeof value === "number" ? value : Number.NEGATIVE_INFINITY);
    switch (historySortKey) {
      case "access_id":
        return dirMul * String(a?.access_id || "").localeCompare(String(b?.access_id || ""), undefined, { numeric: true, sensitivity: "base" });
      case "created_at":
        {
          const createdDiff = Date.parse(a?.created_at || "") - Date.parse(b?.created_at || "");
          if (createdDiff !== 0) return dirMul * createdDiff;
          return dirMul * String(a?.id || "").localeCompare(String(b?.id || ""));
        }
      case "expires_at":
        return dirMul * (Date.parse(a?.expires_at || "") - Date.parse(b?.expires_at || ""));
      case "session_count":
        return dirMul * (numOrMin(a?.session_count) - numOrMin(b?.session_count));
      case "status":
        return dirMul * (statusValue(a) - statusValue(b));
      default:
        return 0;
    }
  });
  const latestToken = hasTokenHistory ? sortedTokenHistory[0] : null;
  const revokedCount = status?.revoked_count ?? tokenHistory.filter((token) => token.is_revoked).length;
  const totalEntries = status?.total_entries ?? tokenHistory.length;
  const recentActivities = useMemo(() => {
    const now = Date.now();
    return (allJurors || [])
      .filter((juror) => juror?.jurorId)
      .map((juror) => {
        const name = juror.juryName || "Unnamed juror";
        const parts = String(name).trim().split(/\s+/).filter(Boolean);
        const initials = ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "JR";
        const lastSeenAt = juror.lastSeenAt || juror.last_seen_at || null;
        const finalSubmittedAt = juror.finalSubmittedAt || juror.final_submitted_at || null;
        const lastSeenMs = toTimestampMs(lastSeenAt);
        const finalSubmittedMs = toTimestampMs(finalSubmittedAt);
        const latestMs = Math.max(lastSeenMs, finalSubmittedMs);
        const latestAt = latestMs > 0 ? new Date(latestMs).toISOString() : null;
        const staleMs = latestMs > 0 ? now - latestMs : Number.POSITIVE_INFINITY;
        const isExpired = latestMs > 0 && staleMs >= 6 * 3600000;
        const isIdle = !isExpired && latestMs > 0 && staleMs >= 90 * 60000;

        let statusText = "Awaiting activity";
        let timeText = "—";
        let dotTone = "muted";
        let isDimmed = false;
        if (juror.finalSubmitted || finalSubmittedAt) {
          statusText = "Final scores submitted";
          dotTone = "success";
        } else if (juror.editEnabled) {
          statusText = "Scoring in progress";
          dotTone = "warning";
        } else if ((juror.completedProjects || 0) > 0) {
          const total = juror.totalProjects || "—";
          statusText = `${juror.completedProjects}/${total} projects scored`;
          dotTone = "neutral";
        }
        if (isExpired) {
          statusText = "Session expired";
          timeText = "expired";
          dotTone = "muted";
          isDimmed = true;
        } else if (isIdle) {
          const rel = latestAt ? (fmtRelative(latestAt) || fmtDate(latestAt)) : "a while ago";
          statusText = `Idle — last seen ${rel}`;
          const idleHours = Math.max(1, Math.floor(staleMs / 3600000));
          timeText = `idle ${idleHours}h`;
          dotTone = "warning";
        } else if (latestAt) {
          timeText = fmtRelative(latestAt) || fmtDate(latestAt);
          if (dotTone === "muted") dotTone = "success";
        }

        return {
          id: juror.jurorId,
          name,
          initials,
          latestAt,
          latestMs,
          statusText,
          timeText,
          dotClass:
            dotTone === "success"
              ? "dot-success"
              : dotTone === "warning"
                ? "dot-warning"
                : dotTone === "neutral"
                  ? "dot-neutral"
                  : "dot-muted",
          isDimmed,
        };
      })
      .filter((item) => item.latestMs > 0 || item.statusText !== "Awaiting activity")
      .sort((a, b) => {
        if (b.latestMs !== a.latestMs) return b.latestMs - a.latestMs;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 8);
  }, [allJurors]);

  function handleHistorySort(key) {
    if (historySortKey === key) {
      setHistorySortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setHistorySortKey(key);
    setHistorySortDir(key === "created_at" ? "desc" : "asc");
  }

  function closeNewUserModal() {
    if (newUserSending) return;
    setNewUserModalOpen(false);
    setNewUserError("");
    setNewUserRecipients([]);
    setNewUserInputValue("");
  }

  if (!periodId) {
    return (
      <div className="page entry-control-page" id="page-entry-control">
        <div className="page-title">Entry Control</div>
        <div className="page-desc">Select an evaluation period to manage QR access tokens.</div>
        <div className="card">
          <div className="vera-es-page-prompt">
            <div className="vera-es-ghost-rows" aria-hidden="true">
              <div className="vera-es-ghost-row">
                <div className="vera-es-ghost-bar" style={{ width: "18%" }} /><div className="vera-es-ghost-bar" style={{ width: "28%" }} /><div className="vera-es-ghost-spacer" /><div className="vera-es-ghost-bar" style={{ width: "16%" }} />
              </div>
              <div className="vera-es-ghost-row">
                <div className="vera-es-ghost-bar" style={{ width: "24%" }} /><div className="vera-es-ghost-bar" style={{ width: "20%" }} /><div className="vera-es-ghost-spacer" /><div className="vera-es-ghost-bar" style={{ width: "20%" }} />
              </div>
            </div>
            <div className="vera-es-icon">
              <QrCode size={22} strokeWidth={1.8}/>
            </div>
            <p className="vera-es-page-prompt-title">Select an Evaluation Period</p>
            <p className="vera-es-page-prompt-desc">Choose an evaluation period from the selector above to view and manage entry tokens, QR codes, and access links for jury participants.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page entry-control-page" id="page-entry-control">
      <div className="page-title">Entry Control</div>
      <div className="page-desc" style={{ marginBottom: 18 }}>
        Manage QR access tokens, monitor active jury sessions, and control entry to the evaluation.
      </div>

      {expirySoon && expiryLabel && (
        <div className="ec-expiry-banner">
          <div className="ec-expiry-banner-icon">
            <TriangleAlert size={18} />
          </div>
          <div className="ec-expiry-banner-content">
            <div className="ec-expiry-banner-title">Access expires in {expiryHeadline || expiryLabel}</div>
            <div className="ec-expiry-banner-text">
              Jurors will lose entry after expiration. Extend now to ensure uninterrupted access.
            </div>
          </div>
          <button className="ec-expiry-banner-action" onClick={handleGenerateClick} disabled={isBusy}>
            Extend 24 hours
          </button>
        </div>
      )}

      <div className="scores-kpi-strip">
        <div className="scores-kpi-item">
          <div className="scores-kpi-item-value">
            {hasToken && isActive ? (
              <span className="ec-kpi-status-badge ec-kpi-status-badge--active">
                <span className="ec-kpi-status-dot" />Active
              </span>
            ) : hasToken ? (
              <span className="ec-kpi-status-badge ec-kpi-status-badge--expired">
                <span className="ec-kpi-status-dot" />Expired
              </span>
            ) : (
              <span className="ec-kpi-status-badge ec-kpi-status-badge--none">No Token</span>
            )}
          </div>
          <div className="scores-kpi-item-label">Token Status</div>
        </div>
        <div className="scores-kpi-item">
          <div className="scores-kpi-item-value">
            {hasToken && isActive && activeSessionsCount != null ? (
              <>
                <span className="success">{activeSessionsCount}</span>
                {allJurors.length > 0 && (
                  <span className="ec-kpi-sessions-denom"> of {allJurors.length}</span>
                )}
              </>
            ) : "—"}
          </div>
          <div className="scores-kpi-item-label">Live Sessions</div>
        </div>
        <div className="scores-kpi-item">
          <div className={`scores-kpi-item-value${expirySoon ? " danger" : ""}`}>
            {expiryCompact || (status?.expires_at ? fmtDate(status.expires_at) : "—")}
          </div>
          <div className="scores-kpi-item-label">Expires In</div>
        </div>
        <div className="scores-kpi-item">
          <div className="scores-kpi-item-value"><span className="success">{totalEntries}</span></div>
          <div className="scores-kpi-item-label">Total Entries</div>
        </div>
        <div className="scores-kpi-item">
          <div className="scores-kpi-item-value">{revokedCount}</div>
          <div className="scores-kpi-item-label">Revoked Tokens</div>
        </div>
      </div>

      {error && (
        <FbAlert variant="danger" style={{ marginBottom: 12 }}>
          {error}
        </FbAlert>
      )}

      <div className="ec-layout">
        <TokenGeneratorCard
          qrRef={qrRef}
          status={status}
          rawToken={rawToken}
          hasToken={hasToken}
          isActive={isActive}
          expirySoon={expirySoon}
          periodName={periodName}
          periodId={periodId}
          activeSessions={activeSessions}
          isBusy={isBusy}
          regenerating={regenerating}
          copied={copied}
          showTokenDetail={showTokenDetail}
          setShowTokenDetail={setShowTokenDetail}
          entryUrl={entryUrl}
          entryUrlLabel={entryUrlLabel}
          recipientsCount={recipients.length}
          lastBulkSend={lastBulkSend}
          testSending={testSending}
          latestToken={latestToken}
          hasTokenHistory={hasTokenHistory}
          graceLockTooltip={graceLockTooltip}
          isGraceLocked={isGraceLocked}
          onGenerateClick={handleGenerateClick}
          onCopy={handleCopy}
          onDownload={handleDownload}
          onOpenSendModal={openSendModal}
          onOpenRevoke={() => setRevokeModalOpen(true)}
          onSendTest={handleSendTestToMe}
        />

        <SessionOverviewPanel
          status={status}
          activeSessions={activeSessions}
          hasToken={hasToken}
          isActive={isActive}
          recentActivities={recentActivities}
        />
      </div>

      <SessionHistoryTable
        tokenHistory={tokenHistory}
        sortedTokenHistory={sortedTokenHistory}
        historySortKey={historySortKey}
        historySortDir={historySortDir}
        onSort={handleHistorySort}
        onDownload={handleDownload}
        rawToken={rawToken}
        tableRef={historyScopeRef}
      />

      <JuryRevokeConfirmDialog
        open={revokeModalOpen}
        loading={revoking}
        activeJurorCount={status?.active_juror_count ?? status?.active_session_count ?? 0}
        onCancel={() => setRevokeModalOpen(false)}
        onConfirm={handleRevoke}
      />

      <LockWarnModal
        open={lockWarnOpen}
        onClose={() => setLockWarnOpen(false)}
        onConfirm={handleGenerate}
        periodName={periodName}
        regenerating={regenerating}
      />

      <SendQrModal
        open={sendModalOpen}
        onClose={() => setSendModalOpen(false)}
        periodName={periodName}
        recipients={recipients}
        emailRecipients={emailRecipients}
        selectedRecipientIds={selectedRecipientIds}
        selectedSet={selectedSet}
        selectedCount={selectedCount}
        noEmailCount={noEmailCount}
        bulkSending={bulkSending}
        onToggleRecipient={toggleRecipient}
        onSelectAll={selectAllRecipients}
        onDeselectAll={deselectAllRecipients}
        onBulkSend={handleBulkSend}
        onOpenNewUserModal={() => { setNewUserError(""); setNewUserModalOpen(true); }}
      />

      <SendSuccessModal
        open={sendSuccessOpen}
        onClose={() => setSendSuccessOpen(false)}
        sendSummary={sendSummary}
        periodName={periodName}
      />

      <NewUserSendModal
        open={newUserModalOpen}
        onClose={closeNewUserModal}
        sending={newUserSending}
        recipients={newUserRecipients}
        inputValue={newUserInputValue}
        onInputChange={(e) => {
          setNewUserInputValue(e.target.value);
          if (newUserError) setNewUserError("");
        }}
        onKeyDown={handleNewUserKeyDown}
        onPaste={handleNewUserPaste}
        onInputBlur={() => {
          if (newUserInputValue.trim()) addNewUserRecipient(newUserInputValue);
        }}
        onRemoveRecipient={removeNewUserRecipient}
        error={newUserError}
        onSubmit={handleSendToNewUser}
        inputRef={newUserInputRef}
      />
    </div>
  );
}
