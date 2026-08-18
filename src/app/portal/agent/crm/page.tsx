"use client";

import Link from "next/link";
import { ArrowRight, CalendarClock, CheckCircle2, CircleDashed, Send, Users } from "lucide-react";
import { crmDeals, crmStages } from "@/components/portal/partnerData";
import { Card, PageHeader, PortalShell } from "@/components/portal/PortalShell";

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

export default function AgentCrmPage() {
  const openDeals = crmDeals.filter((deal) => !["Approved", "Declined"].includes(deal.stage));
  const submittedDeals = crmDeals.filter((deal) => deal.stage === "Submitted");
  const approvedDeals = crmDeals.filter((deal) => deal.stage === "Approved");
  const dueToday = crmDeals.filter((deal) => deal.nextFollowUp.toLowerCase().includes("today"));
  const totalVolume = openDeals.reduce((total, deal) => total + deal.estimatedVolume, 0);

  return (
    <PortalShell role="agent">
      <PageHeader
        title="Agent CRM"
        subtitle="Track merchant opportunities, follow-ups, platform fit, and deal submission status."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card title="Open Leads" value={String(openDeals.length)} sub="Active opportunities" tone="accent" />
        <Card title="Submitted Deals" value={String(submittedDeals.length)} sub="Currently in review" />
        <Card title="Approved This Month" value={String(approvedDeals.length)} sub="Ready for onboarding" />
        <Card title="Pipeline Volume" value={money(totalVolume)} sub="Estimated monthly volume" />
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
            const deals = crmDeals.filter((deal) => deal.stage === stage);

            return (
              <div key={stage} className="rounded-lg border border-slate-200 bg-slate-50">
                <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2.5">
                  <h3 className="text-sm font-semibold text-slate-950">{stage}</h3>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-600">
                    {deals.length}
                  </span>
                </div>
                <div className="space-y-2 p-2">
                  {deals.length ? (
                    deals.map((deal) => (
                      <article key={deal.merchant} className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-sm font-semibold text-slate-950">{deal.merchant}</h4>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${stageTone(deal.stage)}`}>
                            {deal.stage}
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
                {crmDeals.map((deal) => (
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
    </PortalShell>
  );
}
