"use client";

import { CalendarDays } from "lucide-react";
import { useState } from "react";
import { usePortalData } from "./PortalDataProvider";
import { Card } from "./PortalShell";
import { PortalSelect } from "./PortalSelect";

const reportingPeriods = {
  currentMonth: {
    accounts: "24",
    detail: "June 1 - June 30, 2026",
    label: "This month",
    netProfit: "$5,900",
    payouts: "$2,510",
    volume: "$168,400",
  },
  lastMonth: {
    accounts: "22",
    detail: "May 1 - May 31, 2026",
    label: "Last month",
    netProfit: "$5,180",
    payouts: "$2,210",
    volume: "$151,800",
  },
  last90Days: {
    accounts: "24",
    detail: "April 1 - June 30, 2026",
    label: "Last 90 days",
    netProfit: "$15,340",
    payouts: "$6,920",
    volume: "$452,600",
  },
  yearToDate: {
    accounts: "24",
    detail: "January 1 - June 30, 2026",
    label: "Year to date",
    netProfit: "$31,680",
    payouts: "$14,260",
    volume: "$937,400",
  },
} as const;

type ReportingPeriod = keyof typeof reportingPeriods;

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

function periodDetail(period: ReportingPeriod, now: Date) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthName = new Intl.DateTimeFormat("en-US", { month: "long" });

  if (period === "currentMonth") {
    const finalDay = new Date(year, month + 1, 0).getDate();
    return `${monthName.format(now)} 1 - ${monthName.format(now)} ${finalDay}, ${year}`;
  }
  if (period === "lastMonth") {
    const start = new Date(year, month - 1, 1);
    const finalDay = new Date(year, month, 0).getDate();
    return `${monthName.format(start)} 1 - ${monthName.format(start)} ${finalDay}, ${start.getFullYear()}`;
  }
  if (period === "last90Days") {
    const start = new Date(year, month - 2, 1);
    const finalDay = new Date(year, month + 1, 0).getDate();
    return `${monthName.format(start)} 1 - ${monthName.format(now)} ${finalDay}, ${year}`;
  }
  return `January 1 - ${monthName.format(now)} ${new Date(year, month + 1, 0).getDate()}, ${year}`;
}

function includesPeriod(
  residualYear: number,
  residualMonth: number,
  period: ReportingPeriod,
  now: Date
) {
  const currentIndex = now.getFullYear() * 12 + now.getMonth() + 1;
  const rowIndex = residualYear * 12 + residualMonth;

  if (period === "currentMonth") return rowIndex === currentIndex;
  if (period === "lastMonth") return rowIndex === currentIndex - 1;
  if (period === "last90Days") return rowIndex >= currentIndex - 2 && rowIndex <= currentIndex;
  return residualYear === now.getFullYear() && residualMonth <= now.getMonth() + 1;
}

export function AdminDashboardOverview() {
  const { data } = usePortalData();
  const [period, setPeriod] = useState<ReportingPeriod>("currentMonth");
  const now = new Date();
  const fallback = reportingPeriods[period];
  const liveResiduals = data
    ? data.residuals.filter((residual) =>
        includesPeriod(residual.residual_year, residual.residual_month, period, now)
      )
    : [];
  const values = data
    ? {
        accounts: String(data.accounts.filter((account) => account.status === "active").length),
        detail: periodDetail(period, now),
        label: fallback.label,
        netProfit: money(
          liveResiduals.reduce((total, residual) => total + amount(residual.greenhub_net_profit), 0)
        ),
        payouts: money(
          liveResiduals.reduce((total, residual) => total + amount(residual.agent_profit), 0)
        ),
        volume: money(
          liveResiduals.reduce((total, residual) => total + amount(residual.monthly_sales_volume), 0)
        ),
      }
    : fallback;

  return (
    <>
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950 sm:text-3xl">
            Admin Dashboard
          </h1>
          <p className="mt-2 text-sm text-slate-700">
            Portfolio performance and operational controls for GreenHub.
          </p>
        </div>
        <div className="w-full sm:w-56">
          <PortalSelect
            ariaLabel="Reporting period"
            leadingIcon={CalendarDays}
            onValueChange={(value) => setPeriod(value as ReportingPeriod)}
            options={Object.entries(reportingPeriods).map(([value, range]) => ({
              label: range.label,
              value,
            }))}
            value={period}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card title="Total Volume" value={values.volume} sub={values.detail} />
        <Card title="Agent Payouts" value={values.payouts} sub={values.detail} />
        <Card
          title="GreenHub Net Profit"
          value={values.netProfit}
          sub={values.detail}
        />
        <Card
          title="Active Accounts"
          value={values.accounts}
          sub={`As of ${values.detail.split(" - ")[1]}`}
        />
      </div>
    </>
  );
}
