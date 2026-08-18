"use client";

import { Check, FolderLock, LockKeyhole, Save, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { agents as demoAgents } from "@/components/portal/mockData";
import {
  displayPortalStatus,
  folderIconForKey,
  partnerPlatforms,
  type PartnerPlatform,
} from "@/components/portal/partnerData";
import { usePortalData } from "@/components/portal/PortalDataProvider";
import { PageHeader, PortalShell } from "@/components/portal/PortalShell";
import { PortalSelect } from "@/components/portal/PortalSelect";
import { PortalActionButton, showPortalToast } from "@/components/portal/PortalToast";
import { portalRequest } from "@/lib/portal/client";
import type { AgentProfile, PartnerPlatformRecord, PlatformFolderWithResources } from "@/lib/portal/types";

type AccessMap = Record<string, Record<string, boolean>>;
type PlatformRow = PartnerPlatform | PartnerPlatformRecord;
type AgentRow =
  | AgentProfile
  | {
      commissionNotes: string;
      email: string;
      name: string;
      role: string;
      status: string;
    };
type FolderRow = PartnerPlatform["folders"][number] | PlatformFolderWithResources;

function platformId(platform: PlatformRow) {
  return "id" in platform ? platform.id : platform.slug;
}

function folderId(folder: FolderRow) {
  return "id" in folder ? folder.id : folder.key;
}

function folderKey(folder: FolderRow) {
  return "folder_key" in folder ? folder.folder_key : folder.key;
}

function agentId(agent: AgentRow) {
  return "id" in agent ? agent.id : agent.email;
}

function defaultAllowed(platform: PlatformRow, folder: FolderRow) {
  const status = "status" in platform
    ? platform.status
    : displayPortalStatus(platform.portal_status);
  return status !== "Restricted" && folderKey(folder) !== "schedule-a";
}

function buildAccessMap(platforms: PlatformRow[], agents: AgentRow[], liveAccess: { agent_id: string; can_view: boolean; folder_id: string }[] = []) {
  const explicit = new Map(liveAccess.map((row) => [`${row.agent_id}:${row.folder_id}`, row.can_view]));
  const map: AccessMap = {};

  for (const agent of agents) {
    const currentAgentId = agentId(agent);
    map[currentAgentId] = {};
    for (const platform of platforms) {
      for (const folder of platform.folders) {
        const key = `${platformId(platform)}:${folderId(folder)}`;
        map[currentAgentId][key] =
          explicit.get(`${currentAgentId}:${folderId(folder)}`) ?? defaultAllowed(platform, folder);
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
  const { data, refresh } = usePortalData();
  const liveMode = Boolean(data?.partnerPlatforms.length);
  const agents: AgentRow[] = useMemo(
    () => data?.agents.filter((agent) => agent.role === "agent") ?? demoAgents.filter((agent) => agent.role === "Agent"),
    [data?.agents]
  );
  const platforms: PlatformRow[] = useMemo(
    () => (liveMode ? data!.partnerPlatforms : partnerPlatforms),
    [data, liveMode]
  );
  const [selectedPlatformId, setSelectedPlatformId] = useState(platforms[0] ? platformId(platforms[0]) : "");
  const [access, setAccess] = useState<AccessMap>(() => buildAccessMap(platforms, agents, data?.platformAccess ?? []));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!platforms.length) return;
    setSelectedPlatformId((current) =>
      platforms.some((platform) => platformId(platform) === current) ? current : platformId(platforms[0])
    );
    setAccess(buildAccessMap(platforms, agents, data?.platformAccess ?? []));
  }, [agents, data?.platformAccess, platforms]);

  const selectedPlatform =
    platforms.find((platform) => platformId(platform) === selectedPlatformId) ?? platforms[0];
  const folders = selectedPlatform?.folders ?? [];

  const accessSummary = useMemo(() => {
    const total = agents.length * folders.length;
    const allowed = agents.reduce(
      (count, agent) =>
        count +
        folders.filter((folder) => access[agentId(agent)]?.[`${platformId(selectedPlatform)}:${folderId(folder)}`]).length,
      0
    );
    return { allowed, total };
  }, [access, agents, folders, selectedPlatform]);

  function toggleAccess(currentAgentId: string, folder: FolderRow) {
    const key = `${platformId(selectedPlatform)}:${folderId(folder)}`;
    setAccess((current) => ({
      ...current,
      [currentAgentId]: {
        ...current[currentAgentId],
        [key]: !current[currentAgentId]?.[key],
      },
    }));
  }

  function setAgentAccess(currentAgentId: string, allowed: boolean) {
    setAccess((current) => ({
      ...current,
      [currentAgentId]: {
        ...current[currentAgentId],
        ...Object.fromEntries(folders.map((folder) => [`${platformId(selectedPlatform)}:${folderId(folder)}`, allowed])),
      },
    }));
  }

  async function saveAccessRules() {
    setSaving(true);
    setError(null);

    try {
      if (data && "id" in selectedPlatform) {
        await portalRequest("/api/portal/partner/access", {
          method: "POST",
          body: JSON.stringify({
            rules: agents.flatMap((agent) =>
              folders
                .filter((folder): folder is PlatformFolderWithResources => "id" in folder)
                .map((folder) => ({
                  agentId: agentId(agent),
                  canView: Boolean(access[agentId(agent)]?.[`${selectedPlatform.id}:${folder.id}`]),
                  folderId: folder.id,
                  platformId: selectedPlatform.id,
                }))
            ),
          }),
        });
        await refresh();
      }

      showPortalToast({
        title: "Access rules saved",
        message: "Folder visibility rules were saved.",
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Folder access could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Folder Access"
        subtitle="Control which platform folders each agent can view inside the partner portal."
      />

      {error ? (
        <div className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          {error}
        </div>
      ) : null}

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
                value={selectedPlatformId}
                onValueChange={setSelectedPlatformId}
                options={platforms.map((platform) => ({
                  label: platform.name,
                  value: platformId(platform),
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
                    <th key={folderId(folder)} className="px-3 py-3 text-center font-semibold">
                      {folder.name}
                    </th>
                  ))}
                  <th className="px-5 py-3 text-right font-semibold">Bulk</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => {
                  const currentAgentId = agentId(agent);

                  return (
                    <tr key={currentAgentId} className="border-t border-slate-200 hover:bg-slate-50">
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-slate-950">{agent.name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{agent.email}</p>
                      </td>
                      {folders.map((folder) => {
                        const allowed = Boolean(access[currentAgentId]?.[`${platformId(selectedPlatform)}:${folderId(folder)}`]);

                        return (
                          <td key={folderId(folder)} className="px-3 py-3.5 text-center">
                            <button
                              type="button"
                              onClick={() => toggleAccess(currentAgentId, folder)}
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
                            onClick={() => setAgentAccess(currentAgentId, true)}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                          >
                            Allow all
                          </button>
                          <button
                            type="button"
                            onClick={() => setAgentAccess(currentAgentId, false)}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                          >
                            Restrict all
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <PortalActionButton
            type="button"
            disabled={saving}
            onClick={saveAccessRules}
            toastTitle="Access rules saved"
            toastMessage="Folder visibility rules were saved."
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save aria-hidden="true" className="h-4 w-4" />
            {saving ? "Saving..." : "Save Access Rules"}
          </PortalActionButton>
        </div>

        <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <LockKeyhole aria-hidden="true" className="h-5 w-5 text-slate-700" />
            <h2 className="text-lg font-semibold text-slate-950">Access Summary</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            {selectedPlatform.name} has {folders.length} folder types. Current rules allow{" "}
            <span className="font-semibold text-slate-950">{accessSummary.allowed}</span> of{" "}
            <span className="font-semibold text-slate-950">{accessSummary.total}</span> agent-folder permissions.
          </p>
          <div className="mt-5 space-y-3">
            {folders.map((folder) => {
              const allowedCount = agents.filter(
                (agent) => access[agentId(agent)]?.[`${platformId(selectedPlatform)}:${folderId(folder)}`]
              ).length;
              const Icon = "icon" in folder ? folder.icon : folderIconForKey(folderKey(folder));

              return (
                <div key={folderId(folder)} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
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
