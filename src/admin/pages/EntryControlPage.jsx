// src/admin/pages/EntryControlPage.jsx
// Standalone page for jury entry token / QR management.
// Wraps the existing JuryEntryControlPanel in a PageShell layout.

import PageShell from "./PageShell";
import JuryEntryControlPanel from "../settings/JuryEntryControlPanel";

export default function EntryControlPage({
  organizationId,
  periodId,
  periodName,
  isDemoMode = false,
}) {
  return (
    <PageShell
      title="Entry Control"
      description="Manage jury entry tokens and QR access codes"
    >
      <JuryEntryControlPanel
        periodId={periodId}
        periodName={periodName}
        organizationId={organizationId}
        isDemoMode={isDemoMode}
        isOpen={true}
        onToggle={() => {}}
        isMobile={false}
      />
    </PageShell>
  );
}
