"use client";

import { useMemo, useState } from "react";
import { agentResiduals, platforms as demoPlatforms } from "@/components/portal/mockData";
import { usePortalData } from "@/components/portal/PortalDataProvider";
import { PortalPagination } from "@/components/portal/PortalPagination";
import { PageHeader, PortalShell } from "@/components/portal/PortalShell";
import { PortalSelect } from "@/components/portal/PortalSelect";

const residualsPerPage = 10;

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

type AgentResidualRow = {
  agent: string;
  agentPobBuyRate: number;
  agentProfit: number;
  agentRevenueShare: string;
  equipmentCost: number;
  id: string;
  merchant: string;
  month: string;
  monthValue: string;
  platform: string;
  profitPerTransaction: number;
  rebate: number;
  salesVolume: number;
  status: string;
  surcharge: number;
  transactionsPerMonth: number;
};

function amount(value: number | string | null | undefined) {
  const numeric =
    typeof value === "number"
      ? value
      : Number(String(value ?? 0).replace(/[$,%\s,]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function currency(value: number | string | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(amount(value));
}

function wholeCurrency(value: number | string | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(amount(value));
}

function monthFilterValue(label: string) {
  const [monthName, year] = label.split(" ");
  const month = months.indexOf(monthName) + 1;
  return month && year ? `${year}-${month}` : "";
}

function totalRows(rows: AgentResidualRow[]) {
  return rows.reduce(
    (totals, row) => ({
      agentProfit: totals.agentProfit + row.agentProfit,
      equipmentCost: totals.equipmentCost + row.equipmentCost,
      salesVolume: totals.salesVolume + row.salesVolume,
      transactionsPerMonth: totals.transactionsPerMonth + row.transactionsPerMonth,
    }),
    {
      agentProfit: 0,
      equipmentCost: 0,
      salesVolume: 0,
      transactionsPerMonth: 0,
    }
  );
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
  const [page, setPage] = useState(1);
  const accountNames = new Map(data?.accounts.map((account) => [account.id, account.account_name]) ?? []);
  const accountTerms = new Map(data?.accounts.map((account) => [account.id, account.commission_structure]) ?? []);
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
  const rows = useMemo<AgentResidualRow[]>(
    () =>
      data?.residuals.map((row) => ({
        agent: data.profile.name,
        agentPobBuyRate: amount(row.greenhub_pob_buy_rate),
        agentProfit: amount(row.agent_profit),
        agentRevenueShare: row.agent_commission_structure || accountTerms.get(row.merchant_account_id) || "Account terms",
        equipmentCost: amount(row.equipment_cost),
        id: row.id,
        merchant: accountNames.get(row.merchant_account_id) ?? "Unknown account",
        month: `${months[row.residual_month - 1]} ${row.residual_year}`,
        monthValue: `${row.residual_year}-${row.residual_month}`,
        platform: platformNames.get(row.platform_id ?? "") ?? "Unassigned",
        profitPerTransaction: amount(row.profit_per_transaction),
        rebate: amount(row.rebate),
        salesVolume: amount(row.monthly_sales_volume),
        status: row.residual_status,
        surcharge: amount(row.surcharge),
        transactionsPerMonth: amount(row.transactions_per_month),
      })) ?? [],
    [accountNames, accountTerms, data, platformNames]
  );
  const demoRows = useMemo<AgentResidualRow[]>(
    () =>
      agentResiduals.map((row) => ({
        agent: "Nicholas Sanchez",
        agentPobBuyRate: amount(row.greenhubPobBuyRate),
        agentProfit: amount(row.residual),
        agentRevenueShare: row.agentCommissionStructure,
        equipmentCost: amount(row.equipment),
        id: `${row.merchant}-${row.month}`,
        merchant: row.merchant,
        month: row.month,
        monthValue: monthFilterValue(row.month),
        platform: row.platform,
        profitPerTransaction: amount(row.profitPerTransaction),
        rebate: amount(row.rebate),
        salesVolume: amount(row.volume),
        status: row.status,
        surcharge: amount(row.surcharge),
        transactionsPerMonth: amount(row.transactions),
      })),
    []
  );
  const filteredRows = (data ? rows : demoRows).filter(
    (row) =>
      (applied.month === "all" || row.monthValue === applied.month) &&
      (applied.platform === "all" || row.platform === applied.platform || platformNames.get(applied.platform) === row.platform)
  );
  const filteredRowCount = filteredRows.length;
  const pageCount = Math.max(1, Math.ceil(filteredRowCount / residualsPerPage));
  const activePage = Math.min(page, pageCount);
  const pageOffset = (activePage - 1) * residualsPerPage;
  const paginatedRows = filteredRows.slice(pageOffset, pageOffset + residualsPerPage);
  const totals = totalRows(filteredRows);

  return (
    <>
      <PageHeader
        title="Residual History"
        subtitle="Review finalized monthly residuals by account, platform, and agent payout details."
      />

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Agent Residual Report</h2>
            <p className="mt-1 text-sm text-slate-700">
              Agent-visible payout fields only. GreenHub profit and merchant notes are hidden here.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[170px_220px_auto]">
            <PortalSelect ariaLabel="Month" value={month} onValueChange={setMonth} options={monthOptions} />
            <PortalSelect ariaLabel="Platform" value={platform} onValueChange={setPlatform} options={platformOptions} />
            <button
              type="button"
              onClick={() => {
                setApplied({ month, platform });
                setPage(1);
              }}
              className="rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900"
            >
              Filter
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1580px] text-left text-xs text-slate-900">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-700">
              <tr>
                <th className="px-5 py-3 font-semibold">Merchant</th>
                <th className="px-3 py-3 font-semibold">Agent</th>
                <th className="px-3 py-3 font-semibold">Month</th>
                <th className="px-3 py-3 font-semibold">Platform</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">Agent Revenue Share</th>
                <th className="px-3 py-3 text-right font-semibold">Agent POB Buy Rate</th>
                <th className="px-3 py-3 text-right font-semibold">Merchant Sales Volume</th>
                <th className="px-3 py-3 text-right font-semibold">Surcharge</th>
                <th className="px-3 py-3 text-right font-semibold">Rebate to Merchant</th>
                <th className="px-3 py-3 text-right font-semibold">Agent Profit Per Transaction</th>
                <th className="px-3 py-3 text-right font-semibold">Transactions per Month</th>
                <th className="px-3 py-3 text-right font-semibold">Agent Profit</th>
                <th className="px-5 py-3 text-right font-semibold">Equipment Cost</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row) => (
                <tr key={row.id} className="border-t border-slate-200 hover:bg-slate-50">
                  <td className="px-5 py-3.5 font-semibold text-slate-950">{row.merchant}</td>
                  <td className="px-3 py-3.5">{row.agent}</td>
                  <td className="px-3 py-3.5">{row.month}</td>
                  <td className="px-3 py-3.5">{row.platform}</td>
                  <td className="px-3 py-3.5">
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-900">
                      {row.status}
                    </span>
                  </td>
                  <td className="px-3 py-3.5">{row.agentRevenueShare}</td>
                  <td className="px-3 py-3.5 text-right tabular-nums">{currency(row.agentPobBuyRate)}</td>
                  <td className="px-3 py-3.5 text-right tabular-nums">{wholeCurrency(row.salesVolume)}</td>
                  <td className="px-3 py-3.5 text-right tabular-nums">{currency(row.surcharge)}</td>
                  <td className="px-3 py-3.5 text-right tabular-nums">{currency(row.rebate)}</td>
                  <td className="px-3 py-3.5 text-right tabular-nums">{currency(row.profitPerTransaction)}</td>
                  <td className="px-3 py-3.5 text-right tabular-nums">{row.transactionsPerMonth.toLocaleString()}</td>
                  <td className="px-3 py-3.5 text-right font-semibold tabular-nums">{currency(row.agentProfit)}</td>
                  <td className="px-5 py-3.5 text-right tabular-nums">{currency(row.equipmentCost)}</td>
                </tr>
              ))}
              {filteredRowCount === 0 ? (
                <tr>
                  <td colSpan={14} className="px-5 py-10 text-center text-sm text-slate-600">
                    No residuals match the selected filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-200 bg-slate-50 p-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <TotalTile label="Total Merchant Sales Volume" value={wholeCurrency(totals.salesVolume)} />
            <TotalTile label="Total Transactions per Month" value={totals.transactionsPerMonth.toLocaleString()} />
            <TotalTile label="Total Agent Profit" value={currency(totals.agentProfit)} />
            <TotalTile label="Total Equipment Cost" value={currency(totals.equipmentCost)} />
            <TotalTile label="Agent Profit Less Equipment" value={currency(totals.agentProfit - totals.equipmentCost)} />
          </div>
        </div>
        <PortalPagination
          page={activePage}
          pageCount={pageCount}
          pageSize={residualsPerPage}
          totalItems={filteredRowCount}
          onPageChange={setPage}
        />
      </section>
    </>
  );
}

function TotalTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs font-medium text-slate-600">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}
