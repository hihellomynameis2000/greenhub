"use client";

import { CrmWorkspace } from "@/components/portal/CrmWorkspace";
import { PortalShell } from "@/components/portal/PortalShell";

export default function AdminCrmPage() {
  return (
    <PortalShell role="admin">
      <AdminCrmContent />
    </PortalShell>
  );
}

function AdminCrmContent() {
  return <CrmWorkspace role="admin" />;
}
