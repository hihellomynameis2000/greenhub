"use client";

import {
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  CirclePlus,
  Edit3,
  Filter,
  GripVertical,
  LayoutGrid,
  Search,
  Table2,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type DragEvent } from "react";
import { usePortalData } from "@/components/portal/PortalDataProvider";
import { Card, PageHeader, portalInputClass } from "@/components/portal/PortalShell";
import { PortalSelect } from "@/components/portal/PortalSelect";
import { showPortalToast } from "@/components/portal/PortalToast";
import { portalRequest } from "@/lib/portal/client";
import type { NumericValue, PortalDeal, PortalDealStage } from "@/lib/portal/types";

type CrmRole = "admin" | "agent";
type CrmViewMode = "table" | "board";
type DealPriority = PortalDeal["priority"];

type DealForm = {
  agentId: string;
  contactEmail: string;
  contactName: string;
  estimatedVolume: string;
  lastActivity: string;
  merchantName: string;
  nextFollowUp: string;
  notes: string;
  platformId: string;
  priority: DealPriority;
  salesforceStatus: string;
  stage: PortalDealStage;
};

const stages: { id: PortalDealStage; label: string }[] = [
  { id: "new_lead", label: "New Lead" },
  { id: "contacted", label: "Contacted" },
  { id: "application_sent", label: "Application Sent" },
  { id: "submitted", label: "Submitted" },
  { id: "approved", label: "Approved" },
  { id: "declined", label: "Declined" },
];

const priorityOptions: { label: string; value: DealPriority }[] = [
  { label: "Standard", value: "standard" },
  { label: "High", value: "high" },
  { label: "Escalated", value: "escalated" },
];

function emptyForm(agentId = ""): DealForm {
  return {
    agentId,
    contactEmail: "",
    contactName: "",
    estimatedVolume: "",
    lastActivity: "",
    merchantName: "",
    nextFollowUp: "",
    notes: "",
    platformId: "",
    priority: "standard",
    salesforceStatus: "",
    stage: "new_lead",
  };
}

function inputValue(value: NumericValue | undefined) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function numberValue(value: NumericValue | undefined) {
  if (typeof value === "number") return value;
  const parsed = Number(String(value ?? 0).replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function stageLabel(stage: PortalDealStage) {
  return stages.find((item) => item.id === stage)?.label ?? "New Lead";
}

function priorityLabel(priority: DealPriority) {
  return priorityOptions.find((item) => item.value === priority)?.label ?? "Standard";
}

function stageTone(stage: PortalDealStage) {
  if (stage === "approved") return "bg-emerald-100 text-emerald-900";
  if (stage === "submitted") return "bg-blue-100 text-blue-900";
  if (stage === "declined") return "bg-rose-100 text-rose-800";
  if (stage === "application_sent") return "bg-amber-100 text-amber-900";
  return "bg-slate-100 text-slate-700";
}

function priorityTone(priority: DealPriority) {
  if (priority === "escalated") return "bg-rose-100 text-rose-800";
  if (priority === "high") return "bg-amber-100 text-amber-900";
  return "bg-slate-100 text-slate-700";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formFromDeal(deal: PortalDeal): DealForm {
  return {
    agentId: deal.agent_id,
    contactEmail: deal.contact_email ?? "",
    contactName: deal.contact_name ?? "",
    estimatedVolume: inputValue(deal.estimated_volume),
    lastActivity: deal.last_activity ?? "",
    merchantName: deal.merchant_name,
    nextFollowUp: deal.next_follow_up ?? "",
    notes: deal.notes ?? "",
    platformId: deal.platform_id ?? "",
    priority: deal.priority,
    salesforceStatus: deal.salesforce_status ?? "",
    stage: deal.stage,
  };
}

export function CrmWorkspace({ role }: { role: CrmRole }) {
  const { data, error: loadError, isLoading, refresh } = usePortalData();
  const [agentFilter, setAgentFilter] = useState("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DealForm>(emptyForm());
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [platformFilter, setPlatformFilter] = useState("all");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [viewMode, setViewMode] = useState<CrmViewMode>("table");
  const [draggedDealId, setDraggedDealId] = useState<string | null>(null);
  const [dropStage, setDropStage] = useState<PortalDealStage | null>(null);
  const [localDeals, setLocalDeals] = useState<PortalDeal[]>([]);
  const [updatingStageId, setUpdatingStageId] = useState<string | null>(null);

  const agents = useMemo(
    () => (data?.agents ?? []).filter((agent) => agent.status === "active"),
    [data?.agents]
  );
  const agentOptions = useMemo(
    () => agents.map((agent) => ({ label: agent.name, value: agent.id })),
    [agents]
  );
  const platformOptions = useMemo(
    () =>
      (data?.platforms ?? [])
        .filter((platform) => platform.is_active)
        .map((platform) => ({ label: platform.name, value: platform.id })),
    [data?.platforms]
  );
  const agentNames = useMemo(
    () => new Map((data?.agents ?? []).map((agent) => [agent.id, agent.name])),
    [data?.agents]
  );
  const platformNames = useMemo(
    () => new Map((data?.platforms ?? []).map((platform) => [platform.id, platform.name])),
    [data?.platforms]
  );
  const defaultAgentId =
    role === "agent" ? data?.profile.id ?? "" : agentOptions[0]?.value ?? data?.profile.id ?? "";

  useEffect(() => {
    if (!defaultAgentId || editingId) return;
    setForm((current) => ({ ...current, agentId: current.agentId || defaultAgentId }));
  }, [defaultAgentId, editingId]);

  useEffect(() => {
    setLocalDeals(data?.portalDeals ?? []);
  }, [data?.portalDeals]);

  const deals = localDeals;
  const activeDeals = deals.filter((deal) => !["approved", "declined"].includes(deal.stage));
  const submittedDeals = deals.filter((deal) => deal.stage === "submitted");
  const approvedDeals = deals.filter((deal) => deal.stage === "approved");
  const pipelineVolume = activeDeals.reduce((total, deal) => total + numberValue(deal.estimated_volume), 0);
  const followUpsDue = deals.filter((deal) => deal.next_follow_up?.toLowerCase().includes("today")).length;

  const filteredDeals = deals.filter((deal) => {
    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      [
        deal.merchant_name,
        deal.contact_name,
        deal.contact_email,
        deal.next_follow_up,
        deal.notes,
        deal.salesforce_status,
        agentNames.get(deal.agent_id),
        platformNames.get(deal.platform_id ?? ""),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    const matchesStage = stageFilter === "all" || deal.stage === stageFilter;
    const matchesAgent = agentFilter === "all" || deal.agent_id === agentFilter;
    const matchesPlatform = platformFilter === "all" || deal.platform_id === platformFilter;

    return matchesSearch && matchesStage && matchesAgent && matchesPlatform;
  });

  function openNewForm() {
    setEditingId(null);
    setForm(emptyForm(defaultAgentId));
    setFormError(null);
    setFormOpen(true);
  }

  function editDeal(deal: PortalDeal) {
    setEditingId(deal.id);
    setForm(formFromDeal(deal));
    setFormError(null);
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeForm() {
    setEditingId(null);
    setForm(emptyForm(defaultAgentId));
    setFormError(null);
    setFormOpen(false);
  }

  async function saveDeal() {
    setSaving(true);
    setFormError(null);

    try {
      if (!form.merchantName.trim()) throw new Error("Merchant name is required.");
      if (role === "admin" && !form.agentId) throw new Error("Assigned agent is required.");

      await portalRequest<{ deal: PortalDeal }>("/api/portal/deals", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify({
          ...(editingId ? { id: editingId } : {}),
          agentId: form.agentId,
          contactEmail: form.contactEmail,
          contactName: form.contactName,
          estimatedVolume: form.estimatedVolume,
          lastActivity:
            form.lastActivity ||
            (editingId ? "CRM details updated" : "CRM opportunity created"),
          merchantName: form.merchantName,
          nextFollowUp: form.nextFollowUp,
          notes: form.notes,
          platformId: form.platformId,
          priority: form.priority,
          salesforceStatus: form.salesforceStatus,
          stage: form.stage,
        }),
      });
      await refresh();
      closeForm();
      showPortalToast({
        title: editingId ? "Deal updated" : "Deal created",
        message: `${form.merchantName.trim()} is saved in the CRM.`,
      });
    } catch (requestError) {
      setFormError(requestError instanceof Error ? requestError.message : "The CRM deal could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function updateDealStage(deal: PortalDeal, nextStage: string) {
    if (deal.stage === nextStage) return;
    const nextDealStage = nextStage as PortalDealStage;
    const nextLastActivity = `Moved to ${stageLabel(nextDealStage)}`;

    setUpdatingStageId(deal.id);
    setLocalDeals((current) =>
      current.map((item) =>
        item.id === deal.id
          ? {
              ...item,
              last_activity: nextLastActivity,
              stage: nextDealStage,
              updated_at: new Date().toISOString(),
            }
          : item
      )
    );

    try {
      const result = await portalRequest<{ deal: PortalDeal }>("/api/portal/deals", {
        method: "PATCH",
        body: JSON.stringify({
          id: deal.id,
          lastActivity: nextLastActivity,
          stage: nextDealStage,
        }),
      });
      setLocalDeals((current) =>
        current.map((item) => (item.id === deal.id ? result.deal : item))
      );
      showPortalToast({
        title: "Stage updated",
        message: `${deal.merchant_name} moved to ${stageLabel(nextDealStage)}.`,
      });
    } catch (requestError) {
      setLocalDeals((current) =>
        current.map((item) => (item.id === deal.id ? deal : item))
      );
      showPortalToast({
        title: "Stage update failed",
        message: requestError instanceof Error ? requestError.message : "The deal stage could not be updated.",
      });
    } finally {
      setUpdatingStageId(null);
    }
  }

  async function deleteDeal(deal: PortalDeal) {
    if (!window.confirm(`Remove ${deal.merchant_name} from the CRM?`)) return;

    setDeletingId(deal.id);
    try {
      await portalRequest(`/api/portal/deals?id=${encodeURIComponent(deal.id)}`, {
        method: "DELETE",
      });
      await refresh();
      if (editingId === deal.id) closeForm();
      showPortalToast({ title: "Deal removed", message: `${deal.merchant_name} was removed from the CRM.` });
    } catch (requestError) {
      showPortalToast({
        title: "Remove failed",
        message: requestError instanceof Error ? requestError.message : "The CRM deal could not be removed.",
      });
    } finally {
      setDeletingId(null);
    }
  }

  function handleDealDragStart(event: DragEvent<HTMLElement>, deal: PortalDeal) {
    setDraggedDealId(deal.id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", deal.id);
  }

  function handleStageDragOver(event: DragEvent<HTMLDivElement>, stage: PortalDealStage) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dropStage !== stage) setDropStage(stage);
  }

  function clearDragState() {
    setDraggedDealId(null);
    setDropStage(null);
  }

  function handleStageDrop(event: DragEvent<HTMLDivElement>, stage: PortalDealStage) {
    event.preventDefault();
    const dealId = event.dataTransfer.getData("text/plain") || draggedDealId;
    const deal = filteredDeals.find((item) => item.id === dealId) ?? deals.find((item) => item.id === dealId);
    clearDragState();

    if (!deal) return;
    void updateDealStage(deal, stage);
  }

  const title = role === "admin" ? "CRM Command Center" : "Agent CRM";
  const subtitle =
    role === "admin"
      ? "Manage agent pipeline, merchant follow-ups, platform fit, and submitted deal status."
      : "Manage merchant opportunities, follow-ups, platform fit, and submitted deal status.";

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card title="Active Deals" value={String(activeDeals.length)} sub="Open pipeline" tone="accent" />
        <Card title="Submitted" value={String(submittedDeals.length)} sub="In review" />
        <Card title="Approved" value={String(approvedDeals.length)} sub="Won opportunities" />
        <Card title="Pipeline Volume" value={money(pipelineVolume)} sub="Active estimated volume" />
        <Card title="Due Today" value={String(followUpsDue)} sub="Follow-ups" />
      </div>

      {loadError ? (
        <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          {loadError}
        </div>
      ) : null}

      <section className="mt-6 overflow-hidden rounded-lg border border-slate-200/80 bg-white shadow-sm shadow-slate-200/50">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-white p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100">
              <BriefcaseBusiness aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Pipeline Workspace</h2>
              <p className="mt-1 text-sm text-slate-700">
                {filteredDeals.length} of {deals.length} deals shown
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 shadow-sm shadow-slate-200/40">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-semibold transition-colors ${
                  viewMode === "table"
                    ? "bg-white text-slate-950 shadow-sm shadow-slate-200/70"
                    : "text-slate-600 hover:bg-white/70 hover:text-slate-950"
                }`}
              >
                <Table2 aria-hidden="true" className="h-4 w-4" />
                Table
              </button>
              <button
                type="button"
                onClick={() => setViewMode("board")}
                className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-semibold transition-colors ${
                  viewMode === "board"
                    ? "bg-white text-slate-950 shadow-sm shadow-slate-200/70"
                    : "text-slate-600 hover:bg-white/70 hover:text-slate-950"
                }`}
              >
                <LayoutGrid aria-hidden="true" className="h-4 w-4" />
                Board
              </button>
            </div>
            <button
              type="button"
              onClick={openNewForm}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-800 px-4 text-sm font-semibold text-white shadow-sm shadow-emerald-900/20 transition-colors hover:bg-emerald-900"
            >
              <CirclePlus aria-hidden="true" className="h-4 w-4" />
              New Deal
            </button>
          </div>
        </div>

        {formOpen ? (
          <div className="border-b border-slate-200/80 bg-slate-50/80 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-950">
                {editingId ? "Edit CRM Deal" : "Create CRM Deal"}
              </h3>
              <button
                type="button"
                onClick={closeForm}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm shadow-slate-200/40 hover:bg-slate-100"
              >
                <X aria-hidden="true" className="h-4 w-4" />
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Merchant
                <input
                  className={portalInputClass}
                  value={form.merchantName}
                  onChange={(event) => setForm((current) => ({ ...current, merchantName: event.target.value }))}
                  placeholder="Merchant business name"
                />
              </label>
              {role === "admin" ? (
                <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                  Assigned agent
                  <PortalSelect
                    value={form.agentId}
                    onValueChange={(agentId) => setForm((current) => ({ ...current, agentId }))}
                    options={[
                      { disabled: true, label: "Assign agent", value: "" },
                      ...agentOptions,
                    ]}
                  />
                </label>
              ) : null}
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Platform
                <PortalSelect
                  value={form.platformId}
                  onValueChange={(platformId) => setForm((current) => ({ ...current, platformId }))}
                  options={[
                    { label: "No platform selected", value: "" },
                    ...platformOptions,
                  ]}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Stage
                <PortalSelect
                  value={form.stage}
                  onValueChange={(stage) => setForm((current) => ({ ...current, stage: stage as PortalDealStage }))}
                  options={stages.map((stage) => ({ label: stage.label, value: stage.id }))}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Priority
                <PortalSelect
                  value={form.priority}
                  onValueChange={(priority) =>
                    setForm((current) => ({ ...current, priority: priority as DealPriority }))
                  }
                  options={priorityOptions}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Estimated monthly volume
                <input
                  className={portalInputClass}
                  value={form.estimatedVolume}
                  onChange={(event) => setForm((current) => ({ ...current, estimatedVolume: event.target.value }))}
                  placeholder="$50,000"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Contact name
                <input
                  className={portalInputClass}
                  value={form.contactName}
                  onChange={(event) => setForm((current) => ({ ...current, contactName: event.target.value }))}
                  placeholder="Merchant contact"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Contact email
                <input
                  className={portalInputClass}
                  value={form.contactEmail}
                  onChange={(event) => setForm((current) => ({ ...current, contactEmail: event.target.value }))}
                  placeholder="owner@example.com"
                  type="email"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Next follow-up
                <input
                  className={portalInputClass}
                  value={form.nextFollowUp}
                  onChange={(event) => setForm((current) => ({ ...current, nextFollowUp: event.target.value }))}
                  placeholder="Today, 4:00 PM"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Last activity
                <input
                  className={portalInputClass}
                  value={form.lastActivity}
                  onChange={(event) => setForm((current) => ({ ...current, lastActivity: event.target.value }))}
                  placeholder="Docs requested"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Salesforce status
                <input
                  className={portalInputClass}
                  value={form.salesforceStatus}
                  onChange={(event) => setForm((current) => ({ ...current, salesforceStatus: event.target.value }))}
                  placeholder="Optional"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700 lg:col-span-3">
                Notes
                <textarea
                  className={portalInputClass}
                  rows={3}
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Pricing, risk notes, next steps, missing docs"
                />
              </label>
            </div>

            {formError ? <p className="mt-4 text-sm font-semibold text-rose-700">{formError}</p> : null}

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveDeal()}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-800 px-5 text-sm font-semibold text-white shadow-sm shadow-emerald-900/20 hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                {saving ? "Saving..." : editingId ? "Save Changes" : "Create Deal"}
              </button>
              <button
                type="button"
                onClick={closeForm}
                className="h-10 rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-900 shadow-sm shadow-slate-200/40 hover:bg-slate-100"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        <div
          className={`grid gap-3 border-b border-slate-200/80 bg-white p-4 ${
            role === "admin" ? "lg:grid-cols-[1fr_180px_220px_220px]" : "lg:grid-cols-[1fr_180px_220px]"
          }`}
        >
          <label className="relative block">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            />
            <input
              className={`${portalInputClass} w-full pl-9`}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search merchant, contact, agent, notes"
            />
          </label>
          <PortalSelect
            leadingIcon={Filter}
            value={stageFilter}
            onValueChange={setStageFilter}
            options={[
              { label: "All stages", value: "all" },
              ...stages.map((stage) => ({ label: stage.label, value: stage.id })),
            ]}
          />
          {role === "admin" ? (
            <PortalSelect
              value={agentFilter}
              onValueChange={setAgentFilter}
              options={[
                { label: "All agents", value: "all" },
                ...agentOptions,
              ]}
            />
          ) : null}
          <PortalSelect
            value={platformFilter}
            onValueChange={setPlatformFilter}
            options={[
              { label: "All platforms", value: "all" },
              ...platformOptions,
            ]}
          />
        </div>

        <div className="grid gap-3 border-b border-slate-200/80 bg-slate-50 p-4 sm:grid-cols-2 xl:grid-cols-6">
          {stages.map((stage) => {
            const stageDeals = filteredDeals.filter((deal) => deal.stage === stage.id);
            const stageVolume = stageDeals.reduce((total, deal) => total + numberValue(deal.estimated_volume), 0);

            return (
              <div key={stage.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm shadow-slate-200/40">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-950">{stage.label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${stageTone(stage.id)}`}>
                    {stageDeals.length}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold tabular-nums text-slate-700">{money(stageVolume)}</p>
              </div>
            );
          })}
        </div>

        {viewMode === "board" ? (
          <div className="overflow-x-auto bg-slate-50/70">
            <div className="grid min-w-[1180px] grid-cols-6 gap-3 p-4">
              {stages.map((stage) => {
                const stageDeals = filteredDeals.filter((deal) => deal.stage === stage.id);
                const stageVolume = stageDeals.reduce((total, deal) => total + numberValue(deal.estimated_volume), 0);

                return (
                  <section key={stage.id} className="min-w-0">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-slate-950">{stage.label}</h3>
                        <p className="mt-0.5 text-xs font-medium tabular-nums text-slate-500">
                          {stageDeals.length} deals - {money(stageVolume)}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${stageTone(stage.id)}`}>
                        {stageDeals.length}
                      </span>
                    </div>
                    <div
                      onDragOver={(event) => handleStageDragOver(event, stage.id)}
                      onDragLeave={() => setDropStage((current) => (current === stage.id ? null : current))}
                      onDrop={(event) => handleStageDrop(event, stage.id)}
                      className={`min-h-[24rem] rounded-lg border border-dashed p-2 transition-colors ${
                        dropStage === stage.id
                          ? "border-emerald-400 bg-emerald-50"
                          : "border-slate-200 bg-white/80"
                      }`}
                    >
                      {isLoading ? (
                        <div className="flex min-h-[10rem] items-center justify-center rounded-lg bg-white text-sm font-medium text-slate-500">
                          Loading...
                        </div>
                      ) : stageDeals.length ? (
                        <div className="space-y-2">
                          {stageDeals.map((deal) => (
                            <article
                              key={deal.id}
                              draggable
                              onDragStart={(event) => handleDealDragStart(event, deal)}
                              onDragEnd={clearDragState}
                              className={`group cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm shadow-slate-200/50 transition active:cursor-grabbing hover:border-slate-300 hover:shadow-md ${
                                draggedDealId === deal.id ? "opacity-60 ring-2 ring-emerald-200" : ""
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                <GripVertical
                                  aria-hidden="true"
                                  className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 group-hover:text-slate-500"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="line-clamp-2 text-sm font-semibold leading-5 text-slate-950">
                                    {deal.merchant_name}
                                  </p>
                                  <p className="mt-1 truncate text-xs text-slate-500">
                                    {[deal.contact_name, deal.contact_email].filter(Boolean).join(" - ") ||
                                      "No contact saved"}
                                  </p>
                                </div>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                <span
                                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${priorityTone(
                                    deal.priority
                                  )}`}
                                >
                                  {priorityLabel(deal.priority)}
                                </span>
                                {role === "admin" ? (
                                  <span className="max-w-full truncate rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                                    {agentNames.get(deal.agent_id) ?? "Unassigned"}
                                  </span>
                                ) : null}
                              </div>
                              <dl className="mt-3 grid gap-2 text-xs">
                                <div className="min-w-0">
                                  <dt className="font-semibold uppercase text-slate-400">Platform</dt>
                                  <dd className="mt-0.5 truncate font-medium text-slate-700">
                                    {platformNames.get(deal.platform_id ?? "") ?? "-"}
                                  </dd>
                                </div>
                                <div className="min-w-0">
                                  <dt className="font-semibold uppercase text-slate-400">Volume</dt>
                                  <dd className="mt-0.5 font-semibold tabular-nums text-slate-900">
                                    {money(numberValue(deal.estimated_volume))}
                                  </dd>
                                </div>
                                {deal.last_activity ? (
                                  <div className="min-w-0">
                                    <dt className="font-semibold uppercase text-slate-400">Activity</dt>
                                    <dd className="mt-0.5 line-clamp-2 leading-5 text-slate-600">{deal.last_activity}</dd>
                                  </div>
                                ) : null}
                              </dl>
                              <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                                <span className="min-w-0 truncate text-xs font-medium text-slate-500">
                                  {deal.next_follow_up || "No follow-up"}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => editDeal(deal)}
                                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-sm shadow-slate-200/40 hover:bg-slate-100"
                                >
                                  <Edit3 aria-hidden="true" className="h-3.5 w-3.5" />
                                  Edit
                                </button>
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <div className="flex min-h-[10rem] items-center justify-center rounded-lg border border-slate-200 bg-slate-50/70 px-3 text-center text-xs font-medium leading-5 text-slate-500">
                          Drop deals here or change filters.
                        </div>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto bg-white">
            <table className="w-full min-w-[1320px] table-fixed text-left text-sm text-slate-900">
              <colgroup>
                <col style={{ width: role === "admin" ? "250px" : "310px" }} />
                {role === "admin" ? <col style={{ width: "135px" }} /> : null}
                <col style={{ width: "135px" }} />
                <col style={{ width: "165px" }} />
                <col style={{ width: "105px" }} />
                <col style={{ width: "150px" }} />
                <col style={{ width: "110px" }} />
                <col style={{ width: "155px" }} />
                <col style={{ width: "130px" }} />
              </colgroup>
              <thead className="border-y border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Merchant</th>
                  {role === "admin" ? <th className="px-3 py-3 font-semibold">Agent</th> : null}
                  <th className="px-3 py-3 font-semibold">Platform</th>
                  <th className="px-3 py-3 font-semibold">Stage</th>
                  <th className="px-3 py-3 font-semibold">Priority</th>
                  <th className="px-3 py-3 font-semibold">Follow-up</th>
                  <th className="px-3 py-3 text-right font-semibold">Volume</th>
                  <th className="px-3 py-3 font-semibold">Updated</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={role === "admin" ? 9 : 8} className="px-4 py-10 text-center text-sm text-slate-600">
                      Loading CRM pipeline...
                    </td>
                  </tr>
                ) : filteredDeals.length ? (
                  filteredDeals.map((deal) => (
                    <tr
                      key={deal.id}
                      className="border-t border-slate-200 align-middle transition-colors hover:bg-slate-50/80"
                    >
                      <td className="px-4 py-4">
                        <p className="truncate font-semibold text-slate-950">{deal.merchant_name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {[deal.contact_name, deal.contact_email].filter(Boolean).join(" - ") || "No contact saved"}
                        </p>
                        {deal.notes ? (
                          <p className="mt-1 line-clamp-2 max-w-sm text-xs leading-5 text-slate-600">{deal.notes}</p>
                        ) : null}
                      </td>
                      {role === "admin" ? (
                        <td className="px-3 py-4">{agentNames.get(deal.agent_id) ?? "Unassigned"}</td>
                      ) : null}
                      <td className="px-3 py-4">{platformNames.get(deal.platform_id ?? "") ?? "-"}</td>
                      <td className="px-3 py-4">
                        <PortalSelect
                          aria-label={`Stage for ${deal.merchant_name}`}
                          value={deal.stage}
                          disabled={updatingStageId === deal.id}
                          onValueChange={(stage) => void updateDealStage(deal, stage)}
                          options={stages.map((stage) => ({ label: stage.label, value: stage.id }))}
                          className="h-9 min-h-0 py-0 text-sm"
                        />
                      </td>
                      <td className="px-3 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${priorityTone(deal.priority)}`}>
                          {priorityLabel(deal.priority)}
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex items-start gap-2">
                          <CalendarClock aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                          <span>{deal.next_follow_up || "-"}</span>
                        </div>
                      </td>
                      <td className="px-3 py-4 text-right font-semibold tabular-nums">
                        {money(numberValue(deal.estimated_volume))}
                      </td>
                      <td className="px-3 py-4">
                        <p>{formatDate(deal.updated_at)}</p>
                        {deal.last_activity ? <p className="mt-1 text-xs text-slate-500">{deal.last_activity}</p> : null}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => editDeal(deal)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-sm shadow-slate-200/40 hover:bg-slate-100"
                          >
                            <Edit3 aria-hidden="true" className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={deletingId === deal.id}
                            onClick={() => void deleteDeal(deal)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-rose-200 bg-white px-2.5 text-xs font-semibold text-rose-700 shadow-sm shadow-rose-100/40 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                            {deletingId === deal.id ? "Removing" : "Remove"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={role === "admin" ? 9 : 8} className="px-4 py-12 text-center">
                      <div className="mx-auto max-w-md">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                          <BriefcaseBusiness aria-hidden="true" className="h-5 w-5" />
                        </div>
                        <p className="mt-3 text-sm font-semibold text-slate-950">No CRM deals match this view.</p>
                        <p className="mt-1 text-sm text-slate-600">Create a deal or clear filters to rebuild the list.</p>
                        <button
                          type="button"
                          onClick={openNewForm}
                          className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-800 px-4 text-sm font-semibold text-white shadow-sm shadow-emerald-900/20 hover:bg-emerald-900"
                        >
                          <CirclePlus aria-hidden="true" className="h-4 w-4" />
                          New Deal
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
