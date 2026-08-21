"use client";

import { CreditCard, Layers3, ReceiptText } from "lucide-react";
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

type ResidualReportView = "pob" | "cc" | "total";

const residualReportViews: Array<{
  description: string;
  icon: typeof ReceiptText;
  id: ResidualReportView;
  label: string;
}> = [
  {
    description: "Surcharge, rebate, transaction count, and agent POB payout.",
    icon: ReceiptText,
    id: "pob",
    label: "POB Residual",
  },
  {
    description: "Card-processing volume, commission terms, and agent payout.",
    icon: CreditCard,
    id: "cc",
    label: "CC Residual",
  },
  {
    description: "Combined POB and CC residuals with equipment deductions.",
    icon: Layers3,
    id: "total",
    label: "Combined Agent Residual",
  },
];

type AgentResidualRow = {
  agent: string;
  agentCommissionStructure: string;
  agentProfit: number;
  equipmentCost: number;
  id: string;
  merchant: string;
  month: string;
  monthValue: string;
  platform: string;
  profitPerTransaction: number;
  rebate: number;
  salesVolume: number;
  status: "draft" | "finalized" | string;
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

function pobResidual(row: AgentResidualRow) {
  const calculated = row.transactionsPerMonth * row.profitPerTransaction;
  return calculated > 0 ? calculated : row.agentProfit;
}

function ccResidual(row: AgentResidualRow) {
  return Math.max(row.agentProfit - pobResidual(row), 0);
}

function agentNetResidual(row: AgentResidualRow) {
  return row.agentProfit - row.equipmentCost;
}

function totalRows(rows: AgentResidualRow[]) {
  const totals = rows.reduce(
    (next, row) => {
      const rowPobResidual = pobResidual(row);
      const rowCcResidual = ccResidual(row);

      return {
        agentNetResidual: next.agentNetResidual + agentNetResidual(row),
        agentProfit: next.agentProfit + row.agentProfit,
        ccResidual: next.ccResidual + rowCcResidual,
        equipmentCost: next.equipmentCost + row.equipmentCost,
        pobResidual: next.pobResidual + rowPobResidual,
        rebate: next.rebate + row.rebate,
        salesVolume: next.salesVolume + row.salesVolume,
        surcharge: next.surcharge + row.surcharge,
        transactionsPerMonth: next.transactionsPerMonth + row.transactionsPerMonth,
      };
    },
    {
      agentNetResidual: 0,
      agentProfit: 0,
      ccResidual: 0,
      equipmentCost: 0,
      pobResidual: 0,
      rebate: 0,
      salesVolume: 0,
      surcharge: 0,
      transactionsPerMonth: 0,
    }
  );

  return {
    ...totals,
    averageAgentProfitPerTransaction: totals.transactionsPerMonth
      ? totals.pobResidual / totals.transactionsPerMonth
      : 0,
  };
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
  const [reportView, setReportView] = useState<ResidualReportView>("pob");
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
        agentCommissionStructure:
          row.agent_commission_structure ||
          accountTerms.get(row.merchant_account_id) ||
          "Account terms",
        agentProfit: amount(row.agent_profit),
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
        agentCommissionStructure: row.agentCommissionStructure,
        agentProfit: amount(row.residual),
        equipmentCost: amount(row.equipment),
        id: `${row.merchant}-${row.month}`,
        merchant: row.merchant,
        month: row.month,
        monthValue: monthFilterValue(row.month),
        platform: row.platform,
        profitPerTransaction: amount(row.profitPerTransaction),
        rebate: amount(row.rebate),
        salesVolume: amount(row.volume),
        status: row.status.toLowerCase(),
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

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Agent Residual Report</h2>
              <p className="mt-1 text-sm text-slate-700">
                Agent-visible payout fields only. GreenHub profit, POB buy rate, and merchant notes are hidden here.
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

          <div className="mt-5 grid gap-3 xl:grid-cols-3">
            {residualReportViews.map(({ description, icon: Icon, id, label }) => {
              const active = reportView === id;

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setReportView(id);
                    setPage(1);
                  }}
                  className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                    active
                      ? "border-emerald-800 bg-emerald-900 text-white"
                      : "border-slate-300 bg-white text-slate-800 hover:bg-slate-100"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      active ? "bg-emerald-800 text-white" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={1.8} />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{label}</span>
                    <span className={`mt-1 block text-xs leading-5 ${active ? "text-emerald-50" : "text-slate-600"}`}>
                      {description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <AgentResidualSummary totals={totals} view={reportView} />
        <AgentResidualTable rows={paginatedRows} view={reportView} />
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

function AgentResidualSummary({
  totals,
  view,
}: {
  totals: ReturnType<typeof totalRows>;
  view: ResidualReportView;
}) {
  const tiles =
    view === "pob"
      ? [
          { label: "POB Transactions", value: totals.transactionsPerMonth.toLocaleString() },
          { label: "POB Agent Residual", value: currency(totals.pobResidual) },
          { label: "Total Surcharge", value: currency(totals.surcharge) },
          { label: "Total Rebate to Merchant", value: currency(totals.rebate) },
          { label: "Avg Agent Profit / Transaction", value: currency(totals.averageAgentProfitPerTransaction) },
        ]
      : view === "cc"
        ? [
            { label: "CC Merchant Sales Volume", value: wholeCurrency(totals.salesVolume) },
            { label: "CC Agent Residual", value: currency(totals.ccResidual) },
            { label: "Total Equipment Cost", value: currency(totals.equipmentCost) },
            { label: "CC Net After Equipment", value: currency(totals.ccResidual - totals.equipmentCost) },
          ]
        : [
            { label: "POB Residual", value: currency(totals.pobResidual) },
            { label: "CC Residual", value: currency(totals.ccResidual) },
            { label: "Combined Agent Residual", value: currency(totals.agentProfit) },
            { label: "Total Equipment Cost", value: currency(totals.equipmentCost) },
            { label: "Agent Net Residual", value: currency(totals.agentNetResidual) },
          ];

  return (
    <div className="border-b border-slate-200 bg-slate-50 p-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => (
          <TotalTile key={tile.label} label={tile.label} value={tile.value} />
        ))}
      </div>
    </div>
  );
}

function AgentResidualTable({
  rows,
  view,
}: {
  rows: AgentResidualRow[];
  view: ResidualReportView;
}) {
  if (view === "pob") {
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] text-left text-xs text-slate-900">
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-700">
            <tr>
              <th className="p-4">Merchant</th>
              <th className="px-3 py-3">Agent</th>
              <th className="px-3 py-3">Month</th>
              <th className="px-3 py-3">Platform</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3 text-right">Surcharge</th>
              <th className="px-3 py-3 text-right">Rebate to Merchant</th>
              <th className="px-3 py-3 text-right">Agent Profit / Transaction</th>
              <th className="px-3 py-3 text-right">Transactions</th>
              <th className="px-4 py-3 text-right">Agent POB Residual</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-200 hover:bg-slate-50">
                <td className="p-4 font-semibold text-slate-950">{row.merchant}</td>
                <td className="px-3 py-3">{row.agent}</td>
                <td className="px-3 py-3">{row.month}</td>
                <td className="px-3 py-3">{row.platform}</td>
                <td className="px-3 py-3"><ResidualStatus status={row.status} /></td>
                <td className="px-3 py-3 text-right tabular-nums">{currency(row.surcharge)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{currency(row.rebate)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{currency(row.profitPerTransaction)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{row.transactionsPerMonth.toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">{currency(pobResidual(row))}</td>
              </tr>
            ))}
            <ResidualEmptyRow colSpan={10} rows={rows} />
          </tbody>
        </table>
      </div>
    );
  }

  if (view === "cc") {
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] text-left text-xs text-slate-900">
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-700">
            <tr>
              <th className="p-4">Merchant</th>
              <th className="px-3 py-3">Agent</th>
              <th className="px-3 py-3">Month</th>
              <th className="px-3 py-3">Platform</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Agent Commission Structure</th>
              <th className="px-3 py-3 text-right">Merchant Sales Volume</th>
              <th className="px-3 py-3 text-right">Agent Residual</th>
              <th className="px-4 py-3 text-right">Equipment Cost</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-200 hover:bg-slate-50">
                <td className="p-4 font-semibold text-slate-950">{row.merchant}</td>
                <td className="px-3 py-3">{row.agent}</td>
                <td className="px-3 py-3">{row.month}</td>
                <td className="px-3 py-3">{row.platform}</td>
                <td className="px-3 py-3"><ResidualStatus status={row.status} /></td>
                <td className="px-3 py-3">{row.agentCommissionStructure}</td>
                <td className="px-3 py-3 text-right tabular-nums">{wholeCurrency(row.salesVolume)}</td>
                <td className="px-3 py-3 text-right font-semibold tabular-nums">{currency(ccResidual(row))}</td>
                <td className="px-4 py-3 text-right tabular-nums">{currency(row.equipmentCost)}</td>
              </tr>
            ))}
            <ResidualEmptyRow colSpan={9} rows={rows} />
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1160px] text-left text-xs text-slate-900">
        <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-700">
          <tr>
            <th className="p-4">Merchant</th>
            <th className="px-3 py-3">Agent</th>
            <th className="px-3 py-3">Month</th>
            <th className="px-3 py-3">Platform</th>
            <th className="px-3 py-3">Status</th>
            <th className="px-3 py-3 text-right">POB Residual</th>
            <th className="px-3 py-3 text-right">CC Residual</th>
            <th className="px-3 py-3 text-right">Combined Agent Residual</th>
            <th className="px-3 py-3 text-right">Equipment Cost</th>
            <th className="px-4 py-3 text-right">Agent Net Residual</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-slate-200 hover:bg-slate-50">
              <td className="p-4 font-semibold text-slate-950">{row.merchant}</td>
              <td className="px-3 py-3">{row.agent}</td>
              <td className="px-3 py-3">{row.month}</td>
              <td className="px-3 py-3">{row.platform}</td>
              <td className="px-3 py-3"><ResidualStatus status={row.status} /></td>
              <td className="px-3 py-3 text-right tabular-nums">{currency(pobResidual(row))}</td>
              <td className="px-3 py-3 text-right tabular-nums">{currency(ccResidual(row))}</td>
              <td className="px-3 py-3 text-right font-semibold tabular-nums">{currency(row.agentProfit)}</td>
              <td className="px-3 py-3 text-right tabular-nums">{currency(row.equipmentCost)}</td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums">{currency(agentNetResidual(row))}</td>
            </tr>
          ))}
          <ResidualEmptyRow colSpan={10} rows={rows} />
        </tbody>
      </table>
    </div>
  );
}

function ResidualStatus({ status }: { status: AgentResidualRow["status"] }) {
  const finalized = status === "finalized" || status === "Finalized";

  return (
    <span
      className={`rounded-full px-2 py-1 text-xs font-semibold ${
        finalized ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
      }`}
    >
      {status}
    </span>
  );
}

function ResidualEmptyRow({ colSpan, rows }: { colSpan: number; rows: AgentResidualRow[] }) {
  if (rows.length) return null;

  return (
    <tr>
      <td colSpan={colSpan} className="px-5 py-10 text-center text-sm text-slate-600">
        No residuals match the selected filters.
      </td>
    </tr>
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
