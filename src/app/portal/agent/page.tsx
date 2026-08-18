"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bell,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  ReceiptText,
  Send,
  type LucideIcon,
} from "lucide-react";
import { agentResiduals } from "@/components/portal/mockData";
import { crmDeals, partnerPlatforms, platformUpdates } from "@/components/portal/partnerData";
import { usePortalData } from "@/components/portal/PortalDataProvider";
import { Card, PageHeader, PortalShell } from "@/components/portal/PortalShell";

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function amount(value: number | string | null | undefined) {
  const parsed =
    typeof value === "number"
      ? value
      : Number(String(value ?? 0).replace(/[$,%\s,]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

const workspaceCards = [
  {
    title: "Agent CRM",
    body: "Track leads, follow-ups, submitted deals, and approvals.",
    href: "/portal/agent/crm",
    icon: BriefcaseBusiness,
  },
  {
    title: "Platform Directory",
    body: "Review payment programs, folders, documents, and submission rules.",
    href: "/portal/agent/platforms",
    icon: BookOpen,
  },
  {
    title: "Submit New Deal",
    body: "Start an internal merchant submission using the GreenHub intake flow.",
    href: "/portal/agent/submit-deal",
    icon: Send,
  },
  {
    title: "Residuals",
    body: "View finalized residual reporting and account-level payout details.",
    href: "/portal/agent/residuals",
    icon: ReceiptText,
  },
];

export default function AgentDashboard() {
  return (
    <PortalShell role="agent">
      <AgentDashboardContent />
    </PortalShell>
  );
}

function AgentDashboardContent() {
  const { data } = usePortalData();
  const latestSummary = data?.monthlySummaries[0];
  const currentResidual = latestSummary
    ? amount(latestSummary.total_monthly_residual)
    : data
      ? data.residuals.reduce((total, row) => total + amount(row.agent_profit), 0)
      : 2510;
  const currentEquipment = latestSummary
    ? amount(latestSummary.total_equipment_cost)
    : data
      ? data.residuals.reduce((total, row) => total + amount(row.equipment_cost), 0)
      : 275;
  const submittedDeals = crmDeals.filter((deal) => deal.stage === "Submitted").length;
  const approvedDeals = crmDeals.filter((deal) => deal.stage === "Approved").length;

  return (
    <>
      <PageHeader
        title="Partner Dashboard"
        subtitle="Pipeline, platform resources, submitted deals, and finalized residuals in one workspace."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card title="Open CRM Deals" value={String(crmDeals.length - approvedDeals)} sub="Active pipeline" tone="accent" />
        <Card title="Submitted Deals" value={String(submittedDeals)} sub="Underwriting review" />
        <Card
          title="Monthly Residual"
          value={money(currentResidual)}
          sub={
            latestSummary
              ? `${months[latestSummary.residual_month - 1]} ${latestSummary.residual_year}`
              : "Finalized reporting"
          }
        />
        <Card title="Equipment Withheld" value={money(currentEquipment)} sub="Current residual view" />
      </div>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Partner Workspace</h2>
              <p className="mt-1 text-sm text-slate-700">
                Quick access to the areas agents need every day.
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {workspaceCards.map((card) => {
              const Icon = card.icon;

              return (
                <Link
                  key={card.href}
                  href={card.href}
                  className="group rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300 hover:bg-slate-50"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 group-hover:bg-white">
                      <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={1.8} />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-slate-950">{card.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-700">{card.body}</p>
                      <p className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-emerald-800">
                        Open
                        <ArrowRight aria-hidden="true" className="h-4 w-4" />
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Program Updates</h2>
              <p className="mt-1 text-sm text-slate-700">Platform notes and operational changes.</p>
            </div>
            <Bell aria-hidden="true" className="h-5 w-5 text-slate-500" />
          </div>
          <div className="mt-4 space-y-3">
            {platformUpdates.map((update) => (
              <div key={update.title} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-950">{update.title}</h3>
                  <span className="shrink-0 text-xs text-slate-500">{update.date}</span>
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-700">{update.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Active Partner Snapshot</h2>
            <p className="mt-1 text-sm text-slate-700">
              Pipeline, assigned accounts, and platform access at a glance.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {partnerPlatforms.length} platforms available
          </span>
        </div>
        <div className="grid divide-y divide-slate-200 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
          <SnapshotTile icon={BriefcaseBusiness} label="Next CRM Follow-Up" value={crmDeals[0]?.nextFollowUp ?? "Today"} />
          <SnapshotTile icon={Building2} label="Assigned Accounts" value={data ? String(data.accounts.length) : "3"} />
          <SnapshotTile icon={ReceiptText} label="Finalized Residual Rows" value={data ? String(data.residuals.length) : String(agentResiduals.length)} />
        </div>
      </section>
    </>
  );
}

function SnapshotTile({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 p-5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
        <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={1.8} />
      </span>
      <div>
        <p className="text-sm text-slate-600">{label}</p>
        <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
      </div>
    </div>
  );
}
