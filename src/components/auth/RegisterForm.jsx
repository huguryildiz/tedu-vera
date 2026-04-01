import { useEffect, useMemo, useState } from "react";
import { ChevronDown, CheckCircle2 } from "lucide-react";
import { listOrganizationsPublic } from "../../shared/api";

function generateTemporaryPassword() {
  const rand =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "")
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `Va!${rand.slice(0, 14)}9Z`;
}

function getUniversityLabel(tenant) {
  return String(tenant?.university || tenant?.name || "Organization").trim();
}

export default function RegisterForm({ onRegister, onSwitchToLogin, error: externalError }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedUniversity, setSelectedUniversity] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [tenants, setTenants] = useState([]);
  const [tenantsLoading, setTenantsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    listOrganizationsPublic()
      .then((data) => {
        if (!active) return;
        setTenants(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!active) return;
        setTenants([]);
      })
      .finally(() => {
        if (active) setTenantsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const universityOptions = useMemo(() => {
    return [...new Set(tenants.map(getUniversityLabel).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b),
    );
  }, [tenants]);

  const departmentOptions = useMemo(() => {
    if (!selectedUniversity) return [];
    return tenants
      .filter((tenant) => getUniversityLabel(tenant) === selectedUniversity)
      .sort((a, b) => String(a?.department || "").localeCompare(String(b?.department || "")));
  }, [selectedUniversity, tenants]);

  useEffect(() => {
    if (!selectedUniversity) {
      setTenantId("");
      return;
    }
    if (!departmentOptions.some((entry) => entry.id === tenantId)) {
      setTenantId("");
    }
  }, [selectedUniversity, departmentOptions, tenantId]);

  const normalizeRegisterError = (raw) => {
    const msg = String(raw || "").toLowerCase().trim();
    if (!msg) return "Application could not be submitted. Please try again.";
    if (msg.includes("email_already_registered")) return "This email is already registered. Please sign in.";
    if (msg.includes("email_required")) return "Work email is required.";
    if (msg.includes("name_required")) return "First name and last name are required.";
    if (msg.includes("tenant_not_found")) return "Selected department was not found.";
    if (msg.includes("application_already_pending")) return "You already have a pending application for this department.";
    if (msg.includes("duplicate") || msg.includes("already")) return "An application with this information already exists.";
    return raw;
  };

  const extractErrorText = (err) => {
    if (!err) return "";
    return [err.message, err.details, err.hint, err.code ? `code:${err.code}` : ""]
      .filter(Boolean)
      .join(" | ");
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!firstName.trim()) {
      setError("First name is required.");
      return;
    }
    if (!lastName.trim()) {
      setError("Last name is required.");
      return;
    }
    if (!email.trim()) {
      setError("Work email is required.");
      return;
    }
    if (!selectedUniversity) {
      setError("Please select a university or organization.");
      return;
    }
    if (!tenantId) {
      setError("Please select a department.");
      return;
    }

    setLoading(true);
    try {
      const selectedTenant = tenants.find((entry) => entry.id === tenantId);
      await onRegister(email.trim(), generateTemporaryPassword(), {
        name: `${firstName.trim()} ${lastName.trim()}`.trim(),
        university: selectedUniversity,
        department: String(selectedTenant?.department || "").trim(),
        tenantId,
      });
      setSubmitted(true);
    } catch (err) {
      setError(normalizeRegisterError(extractErrorText(err) || "Application could not be submitted."));
    } finally {
      setLoading(false);
    }
  }

  const rawDisplayError = (error || externalError || "").trim();
  const displayError = rawDisplayError ? normalizeRegisterError(rawDisplayError) : "";
  const inputBase =
    "h-14 w-full rounded-[18px] border border-white/14 bg-white/8 px-5 text-[16px] text-slate-100 placeholder:text-slate-400/85 outline-none transition focus:border-sky-300/70 focus:bg-white/10";

  if (submitted) {
    return (
      <div className="min-h-dvh w-full overflow-y-auto bg-[radial-gradient(70%_70%_at_50%_0%,#25375d_0%,#1a2948_45%,#121f3b_100%)] px-4 py-10 text-slate-100 sm:px-6">
      <div className="mx-auto flex w-full max-w-[840px] flex-col items-center">
        <div className="mb-8 grid h-[90px] w-[90px] place-items-center rounded-[24px] bg-gradient-to-br from-sky-500 to-indigo-500 text-[40px] font-bold text-white shadow-[0_16px_48px_rgba(61,118,255,0.45)]">
          V
        </div>
          <div className="w-full max-w-[640px] rounded-[34px] border border-white/12 bg-white/8 p-8 text-center backdrop-blur-md sm:p-10">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-200">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h2 className="text-[38px] font-semibold tracking-[-0.02em] text-slate-50">Application Submitted</h2>
            <p className="mt-4 text-[18px] text-slate-300/95">
              Your request was received. We&apos;ll notify you once your department admin approves it.
            </p>
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="mt-8 h-14 w-full rounded-[18px] bg-gradient-to-r from-blue-500 to-blue-600 text-[26px] font-medium text-white shadow-[0_12px_30px_rgba(59,130,246,0.4)] transition hover:brightness-110"
            >
              Back to Sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh w-full overflow-y-auto bg-[radial-gradient(70%_70%_at_50%_0%,#25375d_0%,#1a2948_45%,#121f3b_100%)] px-4 py-8 text-slate-100 sm:px-6">
      <div className="mx-auto flex w-full max-w-[840px] flex-col items-center">
        <div className="mb-7 grid h-[90px] w-[90px] place-items-center rounded-[24px] bg-gradient-to-br from-sky-500 to-indigo-500 text-[40px] font-bold text-white shadow-[0_16px_48px_rgba(61,118,255,0.45)]">
          V
        </div>

        <h1 className="text-center text-[56px] leading-none font-semibold tracking-[-0.02em] text-slate-50">Apply for Access</h1>
        <p className="mt-3 text-center text-[22px] text-slate-300/85">Register your department to start evaluating</p>

        <div className="mt-10 w-full rounded-[40px] border border-white/12 bg-white/8 p-6 backdrop-blur-md sm:p-10">
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            {displayError ? (
              <div className="rounded-2xl border border-rose-300/45 bg-rose-500/15 px-4 py-3 text-base text-rose-100">
                {displayError}
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-[18px] text-slate-300/95">First name</span>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Hugur"
                  className={inputBase}
                  disabled={loading}
                />
              </label>

              <label className="space-y-2">
                <span className="text-[18px] text-slate-300/95">Last name</span>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Yildiz"
                  className={inputBase}
                  disabled={loading}
                />
              </label>
            </div>

            <label className="space-y-2">
              <span className="text-[18px] text-slate-300/95">Work email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="hugur@tedu.edu.tr"
                className={inputBase}
                autoComplete="email"
                disabled={loading}
              />
            </label>

            <label className="space-y-2">
              <span className="text-[18px] text-slate-300/95">University / Organization</span>
              <div className="relative">
                <select
                  value={selectedUniversity}
                  onChange={(e) => setSelectedUniversity(e.target.value)}
                  className={`${inputBase} appearance-none pr-14`}
                  disabled={loading || tenantsLoading}
                >
                  <option value="" className="text-slate-900">
                    {tenantsLoading ? "Loading..." : "Select university"}
                  </option>
                  {universityOptions.map((option) => (
                    <option key={option} value={option} className="text-slate-900">
                      {option}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-5 top-1/2 h-6 w-6 -translate-y-1/2 text-slate-400/90" />
              </div>
            </label>

            <label className="space-y-2">
              <span className="text-[18px] text-slate-300/95">Department</span>
              <div className="relative">
                <select
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  className={`${inputBase} appearance-none pr-14`}
                  disabled={loading || !selectedUniversity}
                >
                  <option value="" className="text-slate-900">
                    {selectedUniversity ? "Select department" : "Choose university first"}
                  </option>
                  {departmentOptions.map((option) => (
                    <option key={option.id} value={option.id} className="text-slate-900">
                      {option.department || option.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-5 top-1/2 h-6 w-6 -translate-y-1/2 text-slate-400/90" />
              </div>
            </label>

            <button
              type="submit"
              disabled={loading || tenantsLoading}
              className="mt-4 h-[58px] w-full rounded-[18px] bg-gradient-to-r from-blue-500 to-blue-600 text-[20px] font-medium text-white shadow-[0_16px_36px_rgba(59,130,246,0.42)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Submitting..." : "Submit Application"}
            </button>
          </form>
        </div>

        <p className="mt-8 text-center text-[18px] text-slate-400">
          Already have an account?{" "}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="font-medium text-blue-400 transition hover:text-blue-300"
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}
