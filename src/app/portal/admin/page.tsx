"use client";

import Link from "next/link";
import { Building2, ReceiptText, Users, type LucideIcon } from "lucide-react";
import { accounts as demoAccounts } from "@/components/portal/mockData";
import { AdminDashboardOverview } from "@/components/portal/AdminPerformanceSummary";
import { usePortalData } from "@/components/portal/PortalDataProvider";
import { PortalShell } from "@/components/portal/PortalShell";

const actions: {
  description: string;
  href: string;
  icon: LucideIcon;
  label: string;
  title: string;
}[] = [
  {
    href: "/portal/admin/agents",
    title: "Manage Agents",
    description: "Maintain agent access, roles, statuses, and commission rates.",
    label: "Agent directory",
    icon: Users,
  },
  {
    href: "/portal/admin/accounts",
    title: "Merchant Accounts",
    description: "Assign merchant accounts to agents and payment platforms.",
    label: "Account management",
    icon: Building2,
  },
  {
    href: "/portal/admin/residuals",
    title: "Monthly Residuals",
    description: "Enter, review, and finalize monthly residual reporting.",
    label: "Residual reporting",
    icon: ReceiptText,
  },
];

function currency(value: number | string | null) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(Number.isFinite(amount) ? amount : 0);
}

function value(value: number | string | null) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

export default function AdminDashboard() {
  return (
    <PortalShell role="admin">
      <AdminDashboardContent />
    </PortalShell>
  );
}

function AdminDashboardContent() {
  const { data } = usePortalData();
  const agentNames = new Map(data?.agents.map((agent) => [agent.id, agent.name]) ?? []);
  const platformNames = new Map(data?.platforms.map((platform) => [platform.id, platform.name]) ?? []);

  return (
    <>
      <AdminDashboardOverview />

      <section className="mt-6">
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-slate-950">Operations</h2>
          <p className="mt-1 text-sm text-slate-700">
            Open a workspace to maintain the portal reporting data.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {actions.map((action) => {
            const Icon = action.icon;

            return (
              <Link
                key={action.href}
                href={action.href}
                className="group rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 transition-colors group-hover:bg-white group-hover:text-emerald-800">
                    <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-emerald-800">{action.label}</div>
                    <h3 className="mt-1 text-base font-semibold text-slate-950">{action.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{action.description}</p>
                    <p className="mt-4 text-sm font-semibold text-emerald-800">Open workspace</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Recent Merchant Accounts</h2>
            <p className="mt-1 text-sm text-slate-700">
              Portfolio view across agents and processing platforms.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {data ? `${data.accounts.filter((account) => account.status === "active").length} active accounts` : "24 active accounts"}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[910px] text-left text-sm text-slate-900">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-700">
              <tr>
                <th className="px-5 py-3 font-semibold">Merchant</th>
                <th className="px-4 py-3 font-semibold">Platform</th>
                <th className="px-4 py-3 font-semibold">Agent</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Volume</th>
                <th className="px-4 py-3 text-right font-semibold">Agent Profit</th>
                <th className="px-5 py-3 text-right font-semibold">Net Profit</th>
              </tr>
            </thead>
            <tbody>
              {data
                ? data.accounts.slice(0, 8).map((account) => {
                    const residuals = data.residuals.filter(
                      (residual) => residual.merchant_account_id === account.id
                    );
                    const volume = residuals.reduce(
                      (total, residual) => total + value(residual.monthly_sales_volume),
                      0
                    );
                    const agentProfit = residuals.reduce(
                      (total, residual) => total + value(residual.agent_profit),
                      0
                    );
                    const netProfit = residuals.reduce(
                      (total, residual) => total + value(residual.greenhub_net_profit),
                      0
                    );

                    return (
                      <tr key={account.id} className="border-t border-slate-200 hover:bg-slate-50">
                        <td className="px-5 py-3.5 font-semibold text-slate-950">{account.account_name}</td>
                        <td className="px-4 py-3.5">
                          {platformNames.get(account.platform_id ?? "") ?? "Unassigned"}
                        </td>
                        <td className="px-4 py-3.5">
                          {agentNames.get(account.assigned_agent_id ?? "") ?? "Unassigned"}
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={
                              account.status === "active"
                                ? "rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-900"
                                : "rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900"
                            }
                          >
                            {account.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums">{currency(volume)}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums">{currency(agentProfit)}</td>
                        <td className="px-5 py-3.5 text-right font-semibold tabular-nums">{currency(netProfit)}</td>
                      </tr>
                    );
                  })
                : demoAccounts.map((account) => (
                    <tr key={account.merchant} className="border-t border-slate-200 hover:bg-slate-50">
                      <td className="px-5 py-3.5 font-semibold text-slate-950">{account.merchant}</td>
                      <td className="px-4 py-3.5">{account.platform}</td>
                      <td className="px-4 py-3.5">{account.agent}</td>
                      <td className="px-4 py-3.5">
                        <span
                          className={
                            account.status === "Active"
                              ? "rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-900"
                              : "rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900"
                          }
                        >
                          {account.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums">{account.volume}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums">{account.residual}</td>
                      <td className="px-5 py-3.5 text-right font-semibold tabular-nums">{account.netProfit}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
