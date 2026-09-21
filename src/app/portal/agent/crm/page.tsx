"use client";

import { CrmWorkspace } from "@/components/portal/CrmWorkspace";
import { PortalShell } from "@/components/portal/PortalShell";

export default function AgentCrmPage() {
  return (
    <PortalShell role="agent">
      <AgentCrmContent />
    </PortalShell>
  );
}

function AgentCrmContent() {
  return <CrmWorkspace role="agent" />;
}
