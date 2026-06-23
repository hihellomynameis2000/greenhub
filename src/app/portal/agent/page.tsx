"use client";

import { useMemo, useState } from "react";
import { agentResiduals, platforms as demoPlatforms } from "@/components/portal/mockData";
import { usePortalData } from "@/components/portal/PortalDataProvider";
import { Card, PageHeader, PortalShell } from "@/components/portal/PortalShell";
import { PortalSelect } from "@/components/portal/PortalSelect";

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

function amount(value: number | string | null) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function monthFilterValue(label: string) {
  const [monthName, year] = label.split(" ");
  const month = months.indexOf(monthName) + 1;
  return month && year ? `${year}-${month}` : "";
}

export default function AgentDashboard() {
  return (
    <PortalShell role="agent">
      <AgentDashboardContent />
    </PortalShell>
  );
}

function AgentDashboardContent() {
  const { data } = usePortalData();
  const [month, setMonth] = useState("all");
  const [platform, setPlatform] = useState("all");
  const [status, setStatus] = useState("finalized");
  const [appliedFilters, setAppliedFilters] = useState({ month: "all", platform: "all", status: "finalized" });
  const accountNames = new Map(data?.accounts.map((account) => [account.id, account.account_name]) ?? []);
  const platformNames = new Map(data?.platforms.map((item) => [item.id, item.name]) ?? []);
  const monthOptions = data
    ? [
        { label: "All months", value: "all" },
        ...Array.from(
          new Set(data.residuals.map((row) => `${row.residual_year}-${row.residual_month}`))
        ).map((value) => {
          const [year, numericMonth] = value.split("-");
          return { label: `${months[Number(numericMonth) - 1]} ${year}`, value };
        }),
      ]
    : [
        { label: "All months", value: "all" },
        { label: "June 2026", value: "2026-6" },
        { label: "May 2026", value: "2026-5" },
      ];
  const platformOptions = data
    ? [
        { label: "All platforms", value: "all" },
        ...data.platforms.map((item) => ({ label: item.name, value: item.id })),
      ]
    : [
        { label: "All platforms", value: "all" },
        ...demoPlatforms.map((item) => ({ label: item, value: item })),
      ];

  const liveRows = useMemo(() => {
    if (!data) return [];
    return data.residuals.filter((row) => {
      const rowMonth = `${row.residual_year}-${row.residual_month}`;
      return (
        (appliedFilters.month === "all" || rowMonth === appliedFilters.month) &&
        (appliedFilters.platform === "all" || row.platform_id === appliedFilters.platform) &&
        (appliedFilters.status === "all" || row.residual_status === appliedFilters.status)
      );
    });
  }, [appliedFilters, data]);
  const demoRows = useMemo(
    () =>
      agentResiduals.filter((row) => {
        const rowMonth = monthFilterValue(row.month);
        return (
          (appliedFilters.month === "all" || rowMonth === appliedFilters.month) &&
          (appliedFilters.platform === "all" || row.platform === appliedFilters.platform) &&
          (appliedFilters.status === "all" ||
            row.status.toLowerCase() === appliedFilters.status)
        );
      }),
    [appliedFilters]
  );
  const filteredRowCount = data ? liveRows.length : demoRows.length;

  const latestSummary = data?.monthlySummaries[0];
  const lifetimeSummary = data?.lifetimeSummary;
  const currentResidual = latestSummary
    ? amount(latestSummary.total_monthly_residual)
    : data
      ? data.residuals.reduce((total, row) => total + amount(row.agent_profit), 0)
      : 2510;
  const currentNetProfit = latestSummary
    ? amount(latestSummary.total_net_profit)
    : data
      ? data.residuals.reduce((total, row) => total + amount(row.greenhub_net_profit), 0)
      : 5900;
  const currentEquipment = latestSummary
    ? amount(latestSummary.total_equipment_cost)
    : data
      ? data.residuals.reduce((total, row) => total + amount(row.equipment_cost), 0)
      : 275;

  return (
    <>
      <PageHeader title="Residual Dashboard" subtitle="Viewing finalized residuals only" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card
          title="Total Monthly Residual"
          value={money(currentResidual)}
          sub={latestSummary ? `${months[latestSummary.residual_month - 1]} ${latestSummary.residual_year}` : "Current month"}
          tone="accent"
        />
        <Card
          title="Lifetime Residual"
          value={money(lifetimeSummary ? amount(lifetimeSummary.lifetime_residual_earned) : data ? currentResidual : 18420)}
          sub="All finalized reporting"
        />
        <Card title="Total Net Profit" value={money(currentNetProfit)} sub="Current month portfolio" />
        <Card title="Total Equipment Cost" value={money(currentEquipment)} sub="Current month portfolio" />
      </div>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Finalized Residual Detail</h2>
            <p className="mt-1 text-sm text-slate-700">
              Account-level residuals available for agent reporting.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[150px_190px_145px_auto]">
            <PortalSelect ariaLabel="Month" value={month} onValueChange={setMonth} options={monthOptions} />
            <PortalSelect ariaLabel="Platform" value={platform} onValueChange={setPlatform} options={platformOptions} />
            <PortalSelect
              ariaLabel="Status"
              value={status}
              onValueChange={setStatus}
              options={[
                { label: "Finalized", value: "finalized" },
                { label: "All statuses", value: "all" },
              ]}
            />
            <button
              type="button"
              onClick={() => setAppliedFilters({ month, platform, status })}
              className="rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-900"
            >
              Filter
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm text-slate-900">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-700">
              <tr>
                <th className="px-5 py-3 font-semibold">Merchant</th>
                <th className="px-4 py-3 font-semibold">Platform</th>
                <th className="px-4 py-3 font-semibold">Month</th>
                <th className="px-4 py-3 text-right font-semibold">Volume</th>
                <th className="px-4 py-3 text-right font-semibold">Residual</th>
                <th className="px-4 py-3 text-right font-semibold">Net Profit</th>
                <th className="px-4 py-3 text-right font-semibold">Equipment</th>
                <th className="px-5 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {data
                ? liveRows.map((row) => (
                    <tr key={row.id} className="border-t border-slate-200 hover:bg-slate-50">
                      <td className="px-5 py-3.5 font-semibold text-slate-950">
                        {accountNames.get(row.merchant_account_id) ?? "Unknown account"}
                      </td>
                      <td className="px-4 py-3.5">{platformNames.get(row.platform_id ?? "") ?? "Unassigned"}</td>
                      <td className="px-4 py-3.5">{`${months[row.residual_month - 1]} ${row.residual_year}`}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums">{money(amount(row.monthly_sales_volume))}</td>
                      <td className="px-4 py-3.5 text-right font-semibold tabular-nums">{money(amount(row.agent_profit))}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums">{money(amount(row.greenhub_net_profit))}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums">{money(amount(row.equipment_cost))}</td>
                      <td className="px-5 py-3.5">
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-900">
                          {row.residual_status}
                        </span>
                      </td>
                    </tr>
                  ))
                : demoRows.map((row) => (
                    <tr key={`${row.merchant}-${row.month}`} className="border-t border-slate-200 hover:bg-slate-50">
                      <td className="px-5 py-3.5 font-semibold text-slate-950">{row.merchant}</td>
                      <td className="px-4 py-3.5">{row.platform}</td>
                      <td className="px-4 py-3.5">{row.month}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums">{row.volume}</td>
                      <td className="px-4 py-3.5 text-right font-semibold tabular-nums">{row.residual}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums">{row.netProfit}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums">{row.equipment}</td>
                      <td className="px-5 py-3.5">
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-900">
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
              {filteredRowCount === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-600">
                    No residuals match the selected filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
