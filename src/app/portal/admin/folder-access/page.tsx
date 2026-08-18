"use client";

import { Check, FolderLock, LockKeyhole, Save, X } from "lucide-react";
import { useMemo, useState } from "react";
import { agents as demoAgents } from "@/components/portal/mockData";
import { partnerPlatforms, type PlatformFolderKey } from "@/components/portal/partnerData";
import { usePortalData } from "@/components/portal/PortalDataProvider";
import { PageHeader, PortalShell } from "@/components/portal/PortalShell";
import { PortalSelect } from "@/components/portal/PortalSelect";
import { PortalActionButton } from "@/components/portal/PortalToast";

type AccessMap = Record<string, Record<string, boolean>>;

function initialAccessMap() {
  const map: AccessMap = {};
  for (const agent of demoAgents.filter((agent) => agent.role === "Agent")) {
    map[agent.email] = {};
    for (const platform of partnerPlatforms) {
      for (const folder of platform.folders) {
        map[agent.email][`${platform.slug}:${folder.key}`] =
          platform.status !== "Restricted" && folder.key !== "schedule-a";
      }
    }
  }
  return map;
}

export default function AdminFolderAccessPage() {
  return (
    <PortalShell role="admin">
      <AdminFolderAccessContent />
    </PortalShell>
  );
}

function AdminFolderAccessContent() {
  const { data } = usePortalData();
  const agents = data?.agents.filter((agent) => agent.role === "agent") ?? demoAgents.filter((agent) => agent.role === "Agent");
  const [platformSlug, setPlatformSlug] = useState(partnerPlatforms[0]?.slug ?? "");
  const [access, setAccess] = useState<AccessMap>(initialAccessMap);
  const selectedPlatform = partnerPlatforms.find((platform) => platform.slug === platformSlug) ?? partnerPlatforms[0];
  const folders = selectedPlatform?.folders ?? [];

  const accessSummary = useMemo(() => {
    const total = agents.length * folders.length;
    const allowed = agents.reduce(
      (count, agent) =>
        count +
        folders.filter((folder) => access[agent.email]?.[`${selectedPlatform.slug}:${folder.key}`]).length,
      0
    );
    return { allowed, total };
  }, [access, agents, folders, selectedPlatform]);

  function toggleAccess(agentEmail: string, folderKey: PlatformFolderKey) {
    const key = `${selectedPlatform.slug}:${folderKey}`;
    setAccess((current) => ({
      ...current,
      [agentEmail]: {
        ...current[agentEmail],
        [key]: !current[agentEmail]?.[key],
      },
    }));
  }

  function setAgentAccess(agentEmail: string, allowed: boolean) {
    setAccess((current) => ({
      ...current,
      [agentEmail]: {
        ...current[agentEmail],
        ...Object.fromEntries(folders.map((folder) => [`${selectedPlatform.slug}:${folder.key}`, allowed])),
      },
    }));
  }

  return (
    <>
      <PageHeader
        title="Folder Access"
        subtitle="Control which platform folders each agent can view inside the partner portal."
      />

      <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <FolderLock aria-hidden="true" className="h-5 w-5 text-slate-700" />
                <h2 className="text-lg font-semibold text-slate-950">Access Matrix</h2>
              </div>
              <p className="mt-1 text-sm text-slate-700">
                Toggle folders on or off for each agent and selected platform.
              </p>
            </div>
            <div className="w-full lg:w-72">
              <PortalSelect
                ariaLabel="Select platform for folder access"
                value={platformSlug}
                onValueChange={setPlatformSlug}
                options={partnerPlatforms.map((platform) => ({
                  label: platform.name,
                  value: platform.slug,
                }))}
              />
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm text-slate-900">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-700">
                <tr>
                  <th className="px-5 py-3 font-semibold">Agent</th>
                  {folders.map((folder) => (
                    <th key={folder.key} className="px-3 py-3 text-center font-semibold">
                      {folder.name}
                    </th>
                  ))}
                  <th className="px-5 py-3 text-right font-semibold">Bulk</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => (
                  <tr key={agent.email} className="border-t border-slate-200 hover:bg-slate-50">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-950">{agent.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{agent.email}</p>
                    </td>
                    {folders.map((folder) => {
                      const allowed = Boolean(access[agent.email]?.[`${selectedPlatform.slug}:${folder.key}`]);

                      return (
                        <td key={folder.key} className="px-3 py-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => toggleAccess(agent.email, folder.key)}
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                              allowed
                                ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                                : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                            }`}
                            aria-label={`${allowed ? "Remove" : "Allow"} ${folder.name} access for ${agent.name}`}
                            title={allowed ? "Allowed" : "Restricted"}
                          >
                            {allowed ? (
                              <Check aria-hidden="true" className="h-4 w-4" />
                            ) : (
                              <X aria-hidden="true" className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setAgentAccess(agent.email, true)}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                        >
                          Allow all
                        </button>
                        <button
                          type="button"
                          onClick={() => setAgentAccess(agent.email, false)}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                        >
                          Restrict all
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <PortalActionButton
            type="button"
            toastTitle="Access rules saved"
            toastMessage="Folder visibility rules were saved in the portal preview."
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900"
          >
            <Save aria-hidden="true" className="h-4 w-4" />
            Save Access Rules
          </PortalActionButton>
        </div>

        <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <LockKeyhole aria-hidden="true" className="h-5 w-5 text-slate-700" />
            <h2 className="text-lg font-semibold text-slate-950">Access Summary</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            {selectedPlatform.name} has {folders.length} folder types. Current preview allows{" "}
            <span className="font-semibold text-slate-950">{accessSummary.allowed}</span> of{" "}
            <span className="font-semibold text-slate-950">{accessSummary.total}</span> agent-folder permissions.
          </p>
          <div className="mt-5 space-y-3">
            {folders.map((folder) => {
              const allowedCount = agents.filter(
                (agent) => access[agent.email]?.[`${selectedPlatform.slug}:${folder.key}`]
              ).length;
              const Icon = folder.icon;

              return (
                <div key={folder.key} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Icon aria-hidden="true" className="h-4 w-4 text-slate-600" strokeWidth={1.8} />
                      <span className="text-sm font-semibold text-slate-950">{folder.name}</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-600">
                      {allowedCount}/{agents.length}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
      </section>
    </>
  );
}
