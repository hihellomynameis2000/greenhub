"use client";

import { useMemo, useState } from "react";
import { agentResiduals, platforms as demoPlatforms } from "@/components/portal/mockData";
import { usePortalData } from "@/components/portal/PortalDataProvider";
import { PageHeader, PortalShell } from "@/components/portal/PortalShell";
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

function money(value: number | string | null) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(Number.isFinite(amount) ? amount : 0);
}

function monthFilterValue(label: string) {
  const [monthName, year] = label.split(" ");
  const month = months.indexOf(monthName) + 1;
  return month && year ? `${year}-${month}` : "";
}

export default function AgentResidualsPage() {
  return (
    <PortalShell role="agent">
      <AgentResidualsContent />
    </PortalShell>
  );
}

function AgentResidualsContent() {
  const { data } = usePortalData();
  const [month, setMonth] = useState("all");
  const [platform, setPlatform] = useState("all");
  const [applied, setApplied] = useState({ month: "all", platform: "all" });
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
  const rows = useMemo(
    () =>
      data?.residuals.filter((row) => {
        const rowMonth = `${row.residual_year}-${row.residual_month}`;
        return (
          (applied.month === "all" || rowMonth === applied.month) &&
          (applied.platform === "all" || row.platform_id === applied.platform)
        );
      }) ?? [],
    [applied, data?.residuals]
  );
  const demoRows = useMemo(
    () =>
      agentResiduals.filter((row) => {
        const rowMonth = monthFilterValue(row.month);
        return (
          (applied.month === "all" || rowMonth === applied.month) &&
          (applied.platform === "all" || row.platform === applied.platform)
        );
      }),
    [applied]
  );
  const filteredRowCount = data ? rows.length : demoRows.length;

  return (
    <>
      <PageHeader
        title="Residual History"
        subtitle="Review finalized monthly residuals by account and platform."
      />

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Residual History</h2>
            <p className="mt-1 text-sm text-slate-700">
              Finalized residual reporting available to your account.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[150px_190px_auto]">
            <PortalSelect ariaLabel="Month" value={month} onValueChange={setMonth} options={monthOptions} />
            <PortalSelect ariaLabel="Platform" value={platform} onValueChange={setPlatform} options={platformOptions} />
            <button
              type="button"
              onClick={() => setApplied({ month, platform })}
              className="rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900"
            >
              Filter
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-left text-sm text-slate-900">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-700">
              <tr>
                <th className="px-5 py-3 font-semibold">Merchant</th>
                <th className="px-4 py-3 font-semibold">Platform</th>
                <th className="px-4 py-3 font-semibold">Month</th>
                <th className="px-4 py-3 text-right font-semibold">Volume</th>
                <th className="px-4 py-3 text-right font-semibold">Agent Residual</th>
                <th className="px-4 py-3 text-right font-semibold">Equipment</th>
                <th className="px-5 py-3 text-right font-semibold">Net Profit</th>
              </tr>
            </thead>
            <tbody>
              {data
                ? rows.map((row) => (
                    <tr key={row.id} className="border-t border-slate-200 hover:bg-slate-50">
                      <td className="px-5 py-3.5 font-semibold text-slate-950">
                        {accountNames.get(row.merchant_account_id) ?? "Unknown account"}
                      </td>
                      <td className="px-4 py-3.5">{platformNames.get(row.platform_id ?? "") ?? "Unassigned"}</td>
                      <td className="px-4 py-3.5">{`${months[row.residual_month - 1]} ${row.residual_year}`}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums">{money(row.monthly_sales_volume)}</td>
                      <td className="px-4 py-3.5 text-right font-semibold tabular-nums">{money(row.agent_profit)}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums">{money(row.equipment_cost)}</td>
                      <td className="px-5 py-3.5 text-right tabular-nums">{money(row.greenhub_net_profit)}</td>
                    </tr>
                  ))
                : demoRows.map((row) => (
                    <tr key={`${row.merchant}-${row.month}`} className="border-t border-slate-200 hover:bg-slate-50">
                      <td className="px-5 py-3.5 font-semibold text-slate-950">{row.merchant}</td>
                      <td className="px-4 py-3.5">{row.platform}</td>
                      <td className="px-4 py-3.5">{row.month}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums">{row.volume}</td>
                      <td className="px-4 py-3.5 text-right font-semibold tabular-nums">{row.residual}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums">{row.equipment}</td>
                      <td className="px-5 py-3.5 text-right tabular-nums">{row.netProfit}</td>
                    </tr>
                  ))}
              {filteredRowCount === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-600">
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
