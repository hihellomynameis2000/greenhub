"use client";

import { accounts as demoAccounts } from "@/components/portal/mockData";
import { usePortalData } from "@/components/portal/PortalDataProvider";
import { PageHeader, PortalShell } from "@/components/portal/PortalShell";

export default function AgentAccountsPage() {
  return (
    <PortalShell role="agent">
      <AgentAccountsContent />
    </PortalShell>
  );
}

function AgentAccountsContent() {
  const { data } = usePortalData();
  const platformNames = new Map(data?.platforms.map((platform) => [platform.id, platform.name]) ?? []);

  return (
    <>
      <PageHeader
        title="Merchant Accounts"
        subtitle="Accounts assigned to your residual reporting portfolio."
      />

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Assigned Accounts</h2>
            <p className="mt-1 text-sm text-slate-700">
              Active and paused merchant accounts in your portfolio.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {data ? `${data.accounts.length} assigned` : "3 assigned"}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm text-slate-900">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-700">
              <tr>
                <th className="px-5 py-3 font-semibold">Merchant</th>
                <th className="px-4 py-3 font-semibold">Platform</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Commission Structure</th>
              </tr>
            </thead>
            <tbody>
              {data
                ? data.accounts.map((account) => (
                    <tr key={account.id} className="border-t border-slate-200 hover:bg-slate-50">
                      <td className="px-5 py-3.5 font-semibold text-slate-950">{account.account_name}</td>
                      <td className="px-4 py-3.5">
                        {platformNames.get(account.platform_id ?? "") ?? "Unassigned"}
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
                      <td className="px-5 py-3.5">{account.commission_structure || "Not specified"}</td>
                    </tr>
                  ))
                : demoAccounts.map((account) => (
                    <tr key={account.merchant} className="border-t border-slate-200 hover:bg-slate-50">
                      <td className="px-5 py-3.5 font-semibold text-slate-950">{account.merchant}</td>
                      <td className="px-4 py-3.5">{account.platform}</td>
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
                      <td className="px-5 py-3.5">Agent portfolio</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
