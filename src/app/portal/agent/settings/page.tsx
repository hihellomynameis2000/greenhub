"use client";

import { usePortalData } from "@/components/portal/PortalDataProvider";
import { PageHeader, PortalShell, portalInputClass } from "@/components/portal/PortalShell";

export default function AgentSettingsPage() {
  return (
    <PortalShell role="agent">
      <AgentSettingsContent />
    </PortalShell>
  );
}

function AgentSettingsContent() {
  const { data } = usePortalData();
  const profile = data?.profile ?? {
    email: "nick@greenhubinc.com",
    name: "Nicholas Sanchez",
    role: "agent",
  };

  return (
    <>
      <PageHeader
        title="Account Settings"
        subtitle="Review your portal profile and notification preferences."
      />

      <section className="max-w-2xl rounded-lg border border-slate-300 bg-white shadow-sm">
        <div className="border-b border-slate-300 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-950">Profile</h2>
          <p className="mt-1 text-sm text-slate-700">
            Your details are managed by the GreenHub administration team.
          </p>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Full name
            <input
              className={`${portalInputClass} cursor-default bg-slate-50`}
              readOnly
              value={profile.name}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Email address
            <input
              className={`${portalInputClass} cursor-default bg-slate-50`}
              readOnly
              type="email"
              value={profile.email}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700 sm:col-span-2">
            Portal role
            <input
              className={`${portalInputClass} cursor-default bg-slate-50 capitalize`}
              readOnly
              value={profile.role}
            />
          </label>
        </div>
      </section>
    </>
  );
}
