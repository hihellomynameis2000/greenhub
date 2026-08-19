"use client";

import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  GripVertical,
  Send,
} from "lucide-react";
import { useEffect, useMemo, useState, type DragEvent } from "react";
import { crmDeals, crmStages, type CrmStage } from "@/components/portal/partnerData";
import { usePortalData } from "@/components/portal/PortalDataProvider";
import { Card, PageHeader, PortalShell } from "@/components/portal/PortalShell";
import { showPortalToast } from "@/components/portal/PortalToast";
import { portalRequest } from "@/lib/portal/client";
import type { PortalDeal, PortalDealStage } from "@/lib/portal/types";

type DealRow = {
  agent: string;
  contact: string;
  email: string;
  estimatedVolume: number;
  id: string;
  isLive: boolean;
  lastActivity: string;
  merchant: string;
  nextFollowUp: string;
  platform: string;
  stage: CrmStage;
};

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function stageTone(stage: string) {
  if (stage === "Approved") return "bg-emerald-100 text-emerald-900";
  if (stage === "Declined") return "bg-rose-100 text-rose-800";
  if (stage === "Submitted") return "bg-blue-100 text-blue-900";
  return "bg-slate-100 text-slate-700";
}

function stageLabel(stage: PortalDealStage): CrmStage {
  const labels: Record<PortalDealStage, CrmStage> = {
    application_sent: "Application Sent",
    approved: "Approved",
    contacted: "Contacted",
    declined: "Declined",
    new_lead: "New Lead",
    submitted: "Submitted",
  };
  return labels[stage];
}

function stageCode(stage: CrmStage): PortalDealStage {
  const codes: Record<CrmStage, PortalDealStage> = {
    "Application Sent": "application_sent",
    Approved: "approved",
    Contacted: "contacted",
    Declined: "declined",
    "New Lead": "new_lead",
    Submitted: "submitted",
  };
  return codes[stage];
}

function demoDealRows(): DealRow[] {
  return crmDeals.map((deal) => ({
    ...deal,
    id: `demo-${deal.merchant.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
    isLive: false,
  }));
}

function numberValue(value: number | string | null) {
  if (typeof value === "number") return value;
  const parsed = Number(String(value ?? 0).replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function liveDealRows(deals: PortalDeal[], platformNames: Map<string, string>, agentName: string): DealRow[] {
  return deals.map((deal) => ({
    agent: agentName,
    contact: deal.contact_name || "Merchant contact",
    email: deal.contact_email || "",
    estimatedVolume: numberValue(deal.estimated_volume),
    id: deal.id,
    isLive: true,
    lastActivity: deal.last_activity || "CRM activity updated",
    merchant: deal.merchant_name,
    nextFollowUp: deal.next_follow_up || "No follow-up set",
    platform: platformNames.get(deal.platform_id ?? "") ?? "Unassigned",
    stage: stageLabel(deal.stage),
  }));
}

export default function AgentCrmPage() {
  return (
    <PortalShell role="agent">
      <AgentCrmContent />
    </PortalShell>
  );
}

function AgentCrmContent() {
  const { data, refresh } = usePortalData();
  const platformNames = useMemo(
    () => new Map(data?.platforms.map((platform) => [platform.id, platform.name]) ?? []),
    [data?.platforms]
  );
  const sourceDeals = useMemo(
    () =>
      data?.portalDeals.length
        ? liveDealRows(data.portalDeals, platformNames, data.profile.name)
        : demoDealRows(),
    [data?.portalDeals, data?.profile.name, platformNames]
  );
  const [deals, setDeals] = useState<DealRow[]>(sourceDeals);
  const [draggedDealId, setDraggedDealId] = useState<string | null>(null);
  const [dropStage, setDropStage] = useState<CrmStage | null>(null);
  const [savingDealId, setSavingDealId] = useState<string | null>(null);
  const openDeals = deals.filter((deal) => !["Approved", "Declined"].includes(deal.stage));
  const submittedDeals = deals.filter((deal) => deal.stage === "Submitted");
  const approvedDeals = deals.filter((deal) => deal.stage === "Approved");
  const dueToday = deals.filter((deal) => deal.nextFollowUp.toLowerCase().includes("today"));

  useEffect(() => {
    setDeals(sourceDeals);
  }, [sourceDeals]);

  function dragStart(event: DragEvent<HTMLElement>, dealId: string) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", dealId);
    setDraggedDealId(dealId);
  }

  function dragOver(event: DragEvent<HTMLDivElement>, stage: CrmStage) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropStage(stage);
  }

  async function moveDeal(dealId: string, nextStage: CrmStage) {
    const deal = deals.find((item) => item.id === dealId);
    if (!deal || deal.stage === nextStage) return;

    const previousStage = deal.stage;
    setDeals((current) =>
      current.map((item) =>
        item.id === dealId
          ? { ...item, lastActivity: `Moved to ${nextStage}`, stage: nextStage }
          : item
      )
    );

    if (!deal.isLive) {
      showPortalToast({ title: "Pipeline updated", message: `${deal.merchant} moved to ${nextStage}.` });
      return;
    }

    setSavingDealId(dealId);

    try {
      await portalRequest<{ deal: PortalDeal }>("/api/portal/deals", {
        method: "PATCH",
        body: JSON.stringify({
          id: dealId,
          lastActivity: `Moved to ${nextStage}`,
          stage: stageCode(nextStage),
        }),
      });
      await refresh();
      showPortalToast({ title: "Deal stage updated", message: `${deal.merchant} moved to ${nextStage}.` });
    } catch (requestError) {
      setDeals((current) =>
        current.map((item) => (item.id === dealId ? { ...item, stage: previousStage } : item))
      );
      showPortalToast({
        title: "Move failed",
        message: requestError instanceof Error ? requestError.message : "The deal stage could not be updated.",
      });
    } finally {
      setSavingDealId(null);
    }
  }

  function dropDeal(event: DragEvent<HTMLDivElement>, stage: CrmStage) {
    event.preventDefault();
    const dealId = event.dataTransfer.getData("text/plain") || draggedDealId;
    setDraggedDealId(null);
    setDropStage(null);
    if (dealId) void moveDeal(dealId, stage);
  }

  return (
    <>
      <PageHeader
        title="Agent CRM"
        subtitle="Track merchant opportunities, follow-ups, platform fit, and deal submission status."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card title="Open Leads" value={String(openDeals.length)} sub="Active opportunities" tone="accent" />
        <Card title="Submitted Deals" value={String(submittedDeals.length)} sub="Currently in review" />
        <Card title="Approved This Month" value={String(approvedDeals.length)} sub="Ready for onboarding" />
        <Card title="Follow-ups Due" value={String(dueToday.length)} sub="Needs agent action" />
      </div>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Pipeline Board</h2>
            <p className="mt-1 text-sm text-slate-700">
              A working CRM view for agents to manage deals before submission.
            </p>
          </div>
          <Link
            href="/portal/agent/submit-deal"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-900"
          >
            <Send aria-hidden="true" className="h-4 w-4" />
            Submit New Deal
          </Link>
        </div>

        <div className="mt-5 grid gap-3 xl:grid-cols-6">
          {crmStages.map((stage) => {
            const stageDeals = deals.filter((deal) => deal.stage === stage);

            return (
              <div key={stage} className="rounded-lg border border-slate-200 bg-slate-50">
                <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2.5">
                  <h3 className="text-sm font-semibold text-slate-950">{stage}</h3>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-600">
                    {stageDeals.length}
                  </span>
                </div>
                <div
                  className={`min-h-64 space-y-2 p-2 transition-colors ${
                    dropStage === stage ? "bg-emerald-50" : ""
                  }`}
                  onDragOver={(event) => dragOver(event, stage)}
                  onDrop={(event) => dropDeal(event, stage)}
                >
                  {stageDeals.length ? (
                    stageDeals.map((deal) => (
                      <article
                        key={deal.id}
                        draggable
                        onDragStart={(event) => dragStart(event, deal.id)}
                        onDragEnd={() => {
                          setDraggedDealId(null);
                          setDropStage(null);
                        }}
                        className={`cursor-grab rounded-lg border border-slate-200 bg-white p-3 transition active:cursor-grabbing ${
                          draggedDealId === deal.id
                            ? "opacity-60 ring-2 ring-emerald-200"
                            : "hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 items-start gap-1.5">
                            <GripVertical
                              aria-hidden="true"
                              className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"
                            />
                            <h4 className="text-sm font-semibold text-slate-950">{deal.merchant}</h4>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${stageTone(deal.stage)}`}>
                            {savingDealId === deal.id ? "Saving" : deal.stage}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">{deal.contact}</p>
                        <p className="mt-2 text-xs font-medium text-slate-700">{deal.platform}</p>
                        <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-600">
                          <CalendarClock aria-hidden="true" className="h-3.5 w-3.5" />
                          {deal.nextFollowUp}
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-7 text-center text-xs text-slate-500">
                      No deals
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.35fr_0.75fr]">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-950">Deal List</h2>
            <p className="mt-1 text-sm text-slate-700">
              Merchant pipeline with owner, platform, next step, and estimated volume.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm text-slate-900">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-700">
                <tr>
                  <th className="px-5 py-3 font-semibold">Merchant</th>
                  <th className="px-4 py-3 font-semibold">Contact</th>
                  <th className="px-4 py-3 font-semibold">Platform</th>
                  <th className="px-4 py-3 font-semibold">Stage</th>
                  <th className="px-4 py-3 font-semibold">Next Follow-Up</th>
                  <th className="px-5 py-3 text-right font-semibold">Est. Volume</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((deal) => (
                  <tr key={deal.merchant} className="border-t border-slate-200 hover:bg-slate-50">
                    <td className="px-5 py-3.5 font-semibold text-slate-950">{deal.merchant}</td>
                    <td className="px-4 py-3.5">
                      <p>{deal.contact}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{deal.email}</p>
                    </td>
                    <td className="px-4 py-3.5">{deal.platform}</td>
                    <td className="px-4 py-3.5">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${stageTone(deal.stage)}`}>
                        {deal.stage}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">{deal.nextFollowUp}</td>
                    <td className="px-5 py-3.5 text-right font-semibold tabular-nums">
                      {money(deal.estimatedVolume)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Today&apos;s Work</h2>
          <p className="mt-1 text-sm text-slate-700">
            High-priority CRM actions surfaced for the agent.
          </p>
          <div className="mt-4 space-y-3">
            {dueToday.map((deal) => (
              <div key={deal.merchant} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center gap-2">
                  <CircleDashed aria-hidden="true" className="h-4 w-4 text-amber-600" />
                  <p className="text-sm font-semibold text-slate-950">{deal.merchant}</p>
                </div>
                <p className="mt-1 text-sm text-slate-700">{deal.lastActivity}</p>
              </div>
            ))}
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-emerald-700" />
                <p className="text-sm font-semibold text-emerald-950">Keep submissions moving</p>
              </div>
              <p className="mt-1 text-sm leading-6 text-emerald-900">
                Use Submit New Deal when the merchant packet is ready, then track the opportunity here.
              </p>
            </div>
          </div>
          <Link
            href="/portal/agent/platforms"
            className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-emerald-800 hover:text-emerald-950"
          >
            Review platform fit
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  );
}
