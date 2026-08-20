"use client";

import {
  AlertTriangle,
  Check,
  FolderLock,
  LockKeyhole,
  Save,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { agents as demoAgents } from "@/components/portal/mockData";
import {
  displayPortalStatus,
  folderIconForKey,
  partnerPlatforms,
  type PartnerPlatform,
} from "@/components/portal/partnerData";
import { usePortalData } from "@/components/portal/PortalDataProvider";
import { PageHeader, PortalShell, portalInputClass } from "@/components/portal/PortalShell";
import { PortalSelect } from "@/components/portal/PortalSelect";
import { showPortalToast } from "@/components/portal/PortalToast";
import { portalRequest } from "@/lib/portal/client";
import type { AgentProfile, AgentPlatformAccess, PartnerPlatformRecord, PlatformFolderWithResources } from "@/lib/portal/types";

type AccessMap = Record<string, boolean>;
type PlatformRow = PartnerPlatform | PartnerPlatformRecord;
type FolderRow = PartnerPlatform["folders"][number] | PlatformFolderWithResources;
type AgentRow =
  | AgentProfile
  | {
      commissionNotes: string;
      email: string;
      name: string;
      role: string;
      status: string;
    };

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

function agentStatus(agent: AgentRow) {
  return "status" in agent ? agent.status : "active";
}

function accessKey(agent: AgentRow | string, platform: PlatformRow | string, folder: FolderRow | string) {
  const currentAgentId = typeof agent === "string" ? agent : agentId(agent);
  const currentPlatformId = typeof platform === "string" ? platform : platformId(platform);
  const currentFolderId = typeof folder === "string" ? folder : folderId(folder);
  return `${currentAgentId}:${currentPlatformId}:${currentFolderId}`;
}

function defaultAllowed(platform: PlatformRow, folder: FolderRow) {
  const status = "status" in platform
    ? platform.status
    : displayPortalStatus(platform.portal_status);
  return status !== "Restricted" && folderKey(folder) !== "schedule-a";
}

function buildAccessMap(
  platforms: PlatformRow[],
  agents: AgentRow[],
  liveAccess: AgentPlatformAccess[] = []
) {
  const explicit = new Map(
    liveAccess.map((row) => [`${row.agent_id}:${row.platform_id}:${row.folder_id}`, row.can_view])
  );
  const map: AccessMap = {};

  for (const agent of agents) {
    for (const platform of platforms) {
      for (const folder of platform.folders) {
        const key = accessKey(agent, platform, folder);
        map[key] = explicit.get(key) ?? defaultAllowed(platform, folder);
      }
    }
  }

  return map;
}

function accessIsAllowed(access: AccessMap, agent: AgentRow, platform: PlatformRow, folder: FolderRow) {
  return Boolean(access[accessKey(agent, platform, folder)]);
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
  const liveMode = Boolean(data);
  const platforms: PlatformRow[] = useMemo(
    () => (data ? data.partnerPlatforms : partnerPlatforms),
    [data]
  );
  const agents: AgentRow[] = useMemo(
    () =>
      data
        ? data.agents.filter((agent) => agent.role === "agent" && agent.status === "active")
        : demoAgents.filter((agent) => agent.role === "Agent"),
    [data]
  );
  const [selectedPlatformId, setSelectedPlatformId] = useState(platforms[0] ? platformId(platforms[0]) : "");
  const [agentSearch, setAgentSearch] = useState("");
  const [access, setAccess] = useState<AccessMap>(() => buildAccessMap(platforms, agents, data?.platformAccess ?? []));
  const [savedAccess, setSavedAccess] = useState<AccessMap>(() => buildAccessMap(platforms, agents, data?.platformAccess ?? []));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const nextAccess = buildAccessMap(platforms, agents, data?.platformAccess ?? []);
    setAccess(nextAccess);
    setSavedAccess(nextAccess);
    setSelectedPlatformId((current) =>
      platforms.some((platform) => platformId(platform) === current)
        ? current
        : platforms[0]
          ? platformId(platforms[0])
          : ""
    );
  }, [agents, data?.platformAccess, platforms]);

  const selectedPlatform =
    platforms.find((platform) => platformId(platform) === selectedPlatformId) ?? platforms[0];
  const folders = selectedPlatform?.folders ?? [];
  const filteredAgents = useMemo(() => {
    const query = agentSearch.trim().toLowerCase();
    if (!query) return agents;
    return agents.filter(
      (agent) =>
        agent.name.toLowerCase().includes(query) ||
        agent.email.toLowerCase().includes(query)
    );
  }, [agentSearch, agents]);

  const dirtyCount = useMemo(
    () => Object.keys(access).filter((key) => access[key] !== savedAccess[key]).length,
    [access, savedAccess]
  );
  const selectedAllowedCount = useMemo(() => {
    if (!selectedPlatform) return 0;
    return agents.reduce(
      (count, agent) =>
        count + folders.filter((folder) => accessIsAllowed(access, agent, selectedPlatform, folder)).length,
      0
    );
  }, [access, agents, folders, selectedPlatform]);
  const selectedTotal = agents.length * folders.length;

  function setRule(agent: AgentRow, folder: FolderRow, allowed: boolean) {
    if (!selectedPlatform) return;
    setAccess((current) => ({
      ...current,
      [accessKey(agent, selectedPlatform, folder)]: allowed,
    }));
  }

  function toggleRule(agent: AgentRow, folder: FolderRow) {
    if (!selectedPlatform) return;
    const key = accessKey(agent, selectedPlatform, folder);
    setAccess((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  function setAgentAccess(agent: AgentRow, allowed: boolean) {
    if (!selectedPlatform) return;
    setAccess((current) => ({
      ...current,
      ...Object.fromEntries(folders.map((folder) => [accessKey(agent, selectedPlatform, folder), allowed])),
    }));
  }

  function setFolderAccess(folder: FolderRow, allowed: boolean) {
    if (!selectedPlatform) return;
    setAccess((current) => ({
      ...current,
      ...Object.fromEntries(agents.map((agent) => [accessKey(agent, selectedPlatform, folder), allowed])),
    }));
  }

  function setPlatformAccess(allowed: boolean) {
    if (!selectedPlatform) return;
    setAccess((current) => ({
      ...current,
      ...Object.fromEntries(
        agents.flatMap((agent) =>
          folders.map((folder) => [accessKey(agent, selectedPlatform, folder), allowed])
        )
      ),
    }));
  }

  async function saveAccessRules() {
    setError(null);

    if (!liveMode || !data) {
      setError("Live platform library data is required before folder access can be saved.");
      return;
    }
    if (!selectedPlatform || !("id" in selectedPlatform)) {
      setError("Select a live platform before saving folder access.");
      return;
    }
    const liveFolders = folders.filter((folder): folder is PlatformFolderWithResources => "id" in folder);
    const liveAgents = agents.filter((agent): agent is AgentProfile => "id" in agent);
    if (!liveFolders.length || !liveAgents.length) {
      setError("Add live platform folders and active agents before saving access rules.");
      return;
    }

    setSaving(true);

    try {
      const rules = liveAgents.flatMap((agent) =>
        liveFolders.map((folder) => ({
          agentId: agent.id,
          canView: accessIsAllowed(access, agent, selectedPlatform, folder),
          folderId: folder.id,
          platformId: selectedPlatform.id,
        }))
      );

      const response = await portalRequest<{ access: AgentPlatformAccess[] }>(
        "/api/portal/partner/access",
        {
          method: "POST",
          body: JSON.stringify({ rules }),
        }
      );
      await refresh();
      setSavedAccess(access);
      showPortalToast({
        title: "Folder access saved",
        message: `${response.access.length} permissions were updated for ${selectedPlatform.name}.`,
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
        subtitle="Grant or restrict each agent's platform folders from one admin control panel."
      />

      {error ? (
        <div className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          {error}
        </div>
      ) : null}

      {liveMode && !platforms.length ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-950">
          <div className="flex items-start gap-3">
            <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <h2 className="text-base font-semibold">Platform library is empty</h2>
              <p className="mt-1 text-sm leading-6">
                Folder access needs live platforms and folders. Run the partner portal migration or add platforms in Platform Library first.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="space-y-5">
          <div className="grid gap-4 xl:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <FolderLock aria-hidden="true" className="h-4 w-4" />
                Selected platform
              </div>
              <p className="mt-3 truncate text-xl font-semibold text-slate-950">
                {selectedPlatform?.name ?? "No platform"}
              </p>
              <p className="mt-1 text-sm text-slate-600">{folders.length} folder controls</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Users aria-hidden="true" className="h-4 w-4" />
                Active agents
              </div>
              <p className="mt-3 text-xl font-semibold text-slate-950">{agents.length}</p>
              <p className="mt-1 text-sm text-slate-600">Eligible for portal folder access</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <ShieldCheck aria-hidden="true" className="h-4 w-4" />
                Allowed rules
              </div>
              <p className="mt-3 text-xl font-semibold text-slate-950">
                {selectedAllowedCount}/{selectedTotal}
              </p>
              <p className="mt-1 text-sm text-slate-600">For the selected platform</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
                Pending changes
              </div>
              <p className="mt-3 text-xl font-semibold text-slate-950">{dirtyCount}</p>
              <p className="mt-1 text-sm text-slate-600">Unsaved permission edits</p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-5">
              <div className="grid gap-3 lg:grid-cols-[minmax(240px,360px)_1fr_auto] lg:items-center">
                <PortalSelect
                  ariaLabel="Select platform for folder access"
                  value={selectedPlatformId}
                  onValueChange={setSelectedPlatformId}
                  options={platforms.map((platform) => ({
                    label: platform.name,
                    value: platformId(platform),
                  }))}
                />
                <label className="relative">
                  <span className="sr-only">Search agents</span>
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    className={`${portalInputClass} pl-9`}
                    placeholder="Search agent name or email"
                    value={agentSearch}
                    onChange={(event) => setAgentSearch(event.target.value)}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setPlatformAccess(true)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                  >
                    Allow platform
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlatformAccess(false)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                  >
                    Restrict platform
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="sticky left-0 z-10 min-w-64 bg-slate-50 px-4 py-3 text-left text-xs font-semibold uppercase text-slate-600">
                      Agent
                    </th>
                    {folders.map((folder) => {
                      const Icon = "icon" in folder ? folder.icon : folderIconForKey(folderKey(folder));
                      const allowedCount = agents.filter((agent) =>
                        selectedPlatform ? accessIsAllowed(access, agent, selectedPlatform, folder) : false
                      ).length;

                      return (
                        <th key={folderId(folder)} className="min-w-36 px-3 py-3 text-center align-top">
                          <div className="mx-auto flex max-w-36 flex-col items-center gap-2">
                            <Icon aria-hidden="true" className="h-4 w-4 text-slate-600" strokeWidth={1.8} />
                            <span className="text-xs font-semibold text-slate-700">{folder.name}</span>
                            <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                              {allowedCount}/{agents.length}
                            </span>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => setFolderAccess(folder, true)}
                                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-100"
                              >
                                All
                              </button>
                              <button
                                type="button"
                                onClick={() => setFolderAccess(folder, false)}
                                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-100"
                              >
                                None
                              </button>
                            </div>
                          </div>
                        </th>
                      );
                    })}
                    <th className="min-w-32 px-4 py-3 text-left text-xs font-semibold uppercase text-slate-600">
                      Bulk
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredAgents.map((agent) => {
                    const allowedForAgent = selectedPlatform
                      ? folders.filter((folder) => accessIsAllowed(access, agent, selectedPlatform, folder)).length
                      : 0;

                    return (
                      <tr key={agentId(agent)} className="hover:bg-slate-50">
                        <td className="sticky left-0 z-10 bg-white px-4 py-3 group-hover:bg-slate-50">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-950">{agent.name}</p>
                            <p className="truncate text-xs text-slate-500">{agent.email}</p>
                            <p className="mt-1 text-xs font-semibold text-slate-600">
                              {allowedForAgent}/{folders.length} folders allowed
                            </p>
                          </div>
                        </td>
                        {folders.map((folder) => {
                          const allowed = selectedPlatform
                            ? accessIsAllowed(access, agent, selectedPlatform, folder)
                            : false;

                          return (
                            <td key={folderId(folder)} className="px-3 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => toggleRule(agent, folder)}
                                className={`mx-auto flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
                                  allowed
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                                    : "border-slate-200 bg-slate-100 text-slate-400 hover:bg-slate-200"
                                }`}
                                aria-label={`${allowed ? "Restrict" : "Allow"} ${folder.name} for ${agent.name}`}
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
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-2">
                            <button
                              type="button"
                              onClick={() => setAgentAccess(agent, true)}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                            >
                              Allow all
                            </button>
                            <button
                              type="button"
                              onClick={() => setAgentAccess(agent, false)}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100"
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

            {!filteredAgents.length ? (
              <div className="border-t border-slate-200 px-5 py-10 text-center">
                <p className="text-sm font-semibold text-slate-950">No active agents found.</p>
                <p className="mt-1 text-sm text-slate-600">Add active agents before assigning folder access.</p>
              </div>
            ) : null}

            <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2 text-sm text-slate-700">
                <LockKeyhole aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                <span>
                  Agents only see folders explicitly allowed here, plus default-open folders when no rule exists.
                  Schedule A is restricted by default.
                </span>
              </div>
              <button
                type="button"
                disabled={saving || !dirtyCount}
                onClick={() => void saveAccessRules()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save aria-hidden="true" className="h-4 w-4" />
                {saving ? "Saving..." : dirtyCount ? `Save ${dirtyCount} changes` : "Saved"}
              </button>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
