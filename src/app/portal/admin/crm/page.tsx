"use client";

import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, CalendarClock, UserCheck } from "lucide-react";
import { crmDeals, crmStages } from "@/components/portal/partnerData";
import { usePortalData } from "@/components/portal/PortalDataProvider";
import { Card, PageHeader, PortalShell } from "@/components/portal/PortalShell";
import type { PortalDeal, PortalDealStage } from "@/lib/portal/types";

type DealRow = {
  agent: string;
  contact: string;
  estimatedVolume: number;
  lastActivity: string;
  merchant: string;
  nextFollowUp: string;
  platform: string;
  stage: string;
};

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function stageClass(stage: string) {
  if (stage === "Approved") return "bg-emerald-100 text-emerald-900";
  if (stage === "Submitted") return "bg-blue-100 text-blue-900";
  if (stage === "Declined") return "bg-rose-100 text-rose-800";
  return "bg-slate-100 text-slate-700";
}

function stageLabel(stage: PortalDealStage) {
  const labels: Record<PortalDealStage, string> = {
    application_sent: "Application Sent",
    approved: "Approved",
    contacted: "Contacted",
    declined: "Declined",
    new_lead: "New Lead",
    submitted: "Submitted",
  };
  return labels[stage];
}

function numberValue(value: number | string | null) {
  if (typeof value === "number") return value;
  const parsed = Number(String(value ?? 0).replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function liveDealRows(
  deals: PortalDeal[],
  agentNames: Map<string, string>,
  platformNames: Map<string, string>
): DealRow[] {
  return deals.map((deal) => ({
    agent: agentNames.get(deal.agent_id) ?? "Unassigned",
    contact: deal.contact_name || deal.contact_email || "Merchant contact",
    estimatedVolume: numberValue(deal.estimated_volume),
    lastActivity: deal.last_activity || "CRM activity updated",
    merchant: deal.merchant_name,
    nextFollowUp: deal.next_follow_up || "No follow-up set",
    platform: platformNames.get(deal.platform_id ?? "") ?? "Unassigned",
    stage: stageLabel(deal.stage),
  }));
}

export default function AdminCrmPage() {
  return (
    <PortalShell role="admin">
      <AdminCrmContent />
    </PortalShell>
  );
}

function AdminCrmContent() {
  const { data } = usePortalData();
  const agentNames = new Map(data?.agents.map((agent) => [agent.id, agent.name]) ?? []);
  const platformNames = new Map(data?.platforms.map((platform) => [platform.id, platform.name]) ?? []);
  const deals: DealRow[] = data?.portalDeals.length
    ? liveDealRows(data.portalDeals, agentNames, platformNames)
    : crmDeals;
  const activeDeals = deals.filter((deal) => !["Approved", "Declined"].includes(deal.stage));
  const volume = activeDeals.reduce((total, deal) => total + deal.estimatedVolume, 0);
  const submitted = deals.filter((deal) => deal.stage === "Submitted").length;
  const approved = deals.filter((deal) => deal.stage === "Approved").length;

  return (
    <>
      <PageHeader
        title="CRM Command Center"
        subtitle="Admin view for agent pipeline, submitted deals, follow-ups, and platform fit."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card title="Active Opportunities" value={String(activeDeals.length)} sub="Across all agents" tone="accent" />
        <Card title="Submitted Deals" value={String(submitted)} sub="Currently in review" />
        <Card title="Approved This Month" value={String(approved)} sub="Ready for onboarding" />
        <Card title="Pipeline Volume" value={money(volume)} sub="Estimated monthly volume" />
      </div>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">All Agent Deals</h2>
              <p className="mt-1 text-sm text-slate-700">
                Central CRM list for reviewing status, owner, platform, and next follow-up.
              </p>
            </div>
            <Link
              href="/portal/admin/platform-library"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              Platform Library
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm text-slate-900">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-700">
                <tr>
                  <th className="px-5 py-3 font-semibold">Merchant</th>
                  <th className="px-4 py-3 font-semibold">Agent</th>
                  <th className="px-4 py-3 font-semibold">Platform</th>
                  <th className="px-4 py-3 font-semibold">Stage</th>
                  <th className="px-4 py-3 font-semibold">Last Activity</th>
                  <th className="px-4 py-3 font-semibold">Next Follow-Up</th>
                  <th className="px-5 py-3 text-right font-semibold">Est. Volume</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((deal) => (
                  <tr key={deal.merchant} className="border-t border-slate-200 hover:bg-slate-50">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-950">{deal.merchant}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{deal.contact}</p>
                    </td>
                    <td className="px-4 py-3.5">{deal.agent}</td>
                    <td className="px-4 py-3.5">{deal.platform}</td>
                    <td className="px-4 py-3.5">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${stageClass(deal.stage)}`}>
                        {deal.stage}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">{deal.lastActivity}</td>
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

        <aside className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <BriefcaseBusiness aria-hidden="true" className="h-5 w-5 text-slate-700" />
              <h2 className="text-lg font-semibold text-slate-950">Pipeline by Stage</h2>
            </div>
            <div className="mt-4 space-y-2">
              {crmStages.map((stage) => {
                const count = deals.filter((deal) => deal.stage === stage).length;

                return (
                  <div key={stage} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                    <span className="text-sm font-medium text-slate-800">{stage}</span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-600">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-center gap-2">
              <UserCheck aria-hidden="true" className="h-5 w-5 text-emerald-700" />
              <h2 className="text-sm font-semibold text-emerald-950">Pipeline Ownership</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-emerald-900">
              Review owner, platform, follow-up, and underwriting stage before deals move to boarding.
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <CalendarClock aria-hidden="true" className="h-5 w-5 text-slate-700" />
              <h2 className="text-lg font-semibold text-slate-950">Due Today</h2>
            </div>
            <div className="mt-4 space-y-3">
              {deals
                .filter((deal) => deal.nextFollowUp.toLowerCase().includes("today"))
                .map((deal) => (
                  <div key={deal.merchant} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm font-semibold text-slate-950">{deal.merchant}</p>
                    <p className="mt-1 text-xs text-slate-600">{deal.agent} - {deal.nextFollowUp}</p>
                  </div>
                ))}
            </div>
          </div>
        </aside>
      </section>
    </>
  );
}
