"use client";

import { AlertTriangle, ArrowRight, LifeBuoy, Mail, PhoneCall } from "lucide-react";
import Link from "next/link";
import { platformUpdates, supportContacts } from "@/components/portal/partnerData";
import { PageHeader, PortalShell } from "@/components/portal/PortalShell";

export default function AgentSupportPage() {
  return (
    <PortalShell role="agent">
      <PageHeader
        title="Agent Support"
        subtitle="Processing support contacts, escalation paths, program alerts, and internal compliance notes."
      />

      <section className="grid gap-4 lg:grid-cols-3">
        {supportContacts.map((contact) => (
          <article key={contact.team} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              {contact.team.includes("Emergency") ? (
                <AlertTriangle aria-hidden="true" className="h-5 w-5" strokeWidth={1.8} />
              ) : contact.team.includes("Portal") ? (
                <LifeBuoy aria-hidden="true" className="h-5 w-5" strokeWidth={1.8} />
              ) : (
                <PhoneCall aria-hidden="true" className="h-5 w-5" strokeWidth={1.8} />
              )}
            </span>
            <h2 className="mt-4 text-lg font-semibold text-slate-950">{contact.team}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-800">{contact.name}</p>
            <p className="mt-2 flex items-center gap-2 text-sm text-emerald-800">
              <Mail aria-hidden="true" className="h-4 w-4" />
              {contact.detail}
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-700">{contact.note}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-950">Program Shutdown Alerts</h2>
            <p className="mt-1 text-sm text-slate-700">
              Operational notes that agents should review before submitting new merchants.
            </p>
          </div>
          <div className="divide-y divide-slate-200">
            {platformUpdates.map((update) => (
              <article key={update.title} className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-950">{update.title}</h3>
                  <span className="text-xs font-medium text-slate-500">{update.date}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-700">{update.body}</p>
              </article>
            ))}
          </div>
        </div>

        <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Need Platform Files?</h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            Review the Platform Directory first. Folder access is controlled by GreenHub admin permissions.
          </p>
          <Link
            href="/portal/agent/platforms"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900"
          >
            Open Platform Directory
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </aside>
      </section>
    </PortalShell>
  );
}
