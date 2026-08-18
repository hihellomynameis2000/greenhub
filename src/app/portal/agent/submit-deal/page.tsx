"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, ClipboardList, Send } from "lucide-react";
import { useState } from "react";
import { partnerPlatforms } from "@/components/portal/partnerData";
import { PageHeader, PortalShell, portalInputClass } from "@/components/portal/PortalShell";
import { PortalSelect } from "@/components/portal/PortalSelect";
import { PortalActionButton } from "@/components/portal/PortalToast";

const intakeSteps = [
  "Company",
  "Industry",
  "Website",
  "Gateway",
  "Address",
  "Contact",
  "Volume",
  "Acceptance",
  "Notes",
];

const initialForm = {
  contactEmail: "",
  contactName: "",
  estimatedVolume: "",
  merchantName: "",
  notes: "",
  platform: "",
  priority: "Standard",
};

export default function AgentSubmitDealPage() {
  const [form, setForm] = useState(initialForm);

  return (
    <PortalShell role="agent">
      <PageHeader
        title="Submit New Deal"
        subtitle="Prepare a merchant opportunity and continue into the GreenHub application workflow."
      />

      <section className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
              <ClipboardList aria-hidden="true" className="h-5 w-5" strokeWidth={1.8} />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Deal Intake</h2>
              <p className="mt-1 text-sm leading-6 text-slate-700">
                This frontend captures the CRM handoff and routes agents into the existing merchant application.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              Merchant name
              <input
                className={portalInputClass}
                placeholder="Merchant business name"
                value={form.merchantName}
                onChange={(event) => setForm((current) => ({ ...current, merchantName: event.target.value }))}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              Preferred platform
              <PortalSelect
                value={form.platform}
                onValueChange={(platform) => setForm((current) => ({ ...current, platform }))}
                options={[
                  { disabled: true, label: "Select platform", value: "" },
                  ...partnerPlatforms.map((platform) => ({ label: platform.name, value: platform.name })),
                ]}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              Contact name
              <input
                className={portalInputClass}
                placeholder="Merchant contact"
                value={form.contactName}
                onChange={(event) => setForm((current) => ({ ...current, contactName: event.target.value }))}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              Contact email
              <input
                className={portalInputClass}
                placeholder="owner@example.com"
                type="email"
                value={form.contactEmail}
                onChange={(event) => setForm((current) => ({ ...current, contactEmail: event.target.value }))}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              Estimated monthly volume
              <input
                className={portalInputClass}
                placeholder="$50,000"
                value={form.estimatedVolume}
                onChange={(event) => setForm((current) => ({ ...current, estimatedVolume: event.target.value }))}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              Priority
              <PortalSelect
                value={form.priority}
                onValueChange={(priority) => setForm((current) => ({ ...current, priority }))}
                options={[
                  { label: "Standard", value: "Standard" },
                  { label: "High priority", value: "High priority" },
                  { label: "Escalated", value: "Escalated" },
                ]}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-slate-700 md:col-span-2">
              Agent notes
              <textarea
                className={portalInputClass}
                placeholder="Anything ops should know before the full application is completed."
                rows={4}
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <PortalActionButton
              type="button"
              toastTitle="Deal draft prepared"
              toastMessage="The CRM intake draft is ready for the full application flow."
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900"
            >
              <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
              Save CRM Draft
            </PortalActionButton>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              Continue to Full Application
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Send aria-hidden="true" className="h-5 w-5 text-emerald-700" />
              <h2 className="text-lg font-semibold text-slate-950">Submission Flow</h2>
            </div>
            <div className="mt-4 grid gap-2">
              {intakeSteps.map((step, index) => (
                <div key={step} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-700">
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium text-slate-800">{step}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
            <h2 className="text-sm font-semibold text-emerald-950">Production Wiring</h2>
            <p className="mt-2 text-sm leading-6 text-emerald-900">
              Next step is to pass the signed-in agent ID into the existing lead submission so Salesforce can auto-assign ownership.
            </p>
          </div>
        </aside>
      </section>
    </PortalShell>
  );
}
