"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, ClipboardList, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { partnerPlatforms } from "@/components/portal/partnerData";
import { usePortalData } from "@/components/portal/PortalDataProvider";
import { PageHeader, PortalShell, portalInputClass } from "@/components/portal/PortalShell";
import { PortalSelect } from "@/components/portal/PortalSelect";
import { showPortalToast } from "@/components/portal/PortalToast";
import { portalRequest } from "@/lib/portal/client";

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
  nextFollowUp: "",
  notes: "",
  platform: "",
  priority: "Standard",
};

export default function AgentSubmitDealPage() {
  return (
    <PortalShell role="agent">
      <AgentSubmitDealContent />
    </PortalShell>
  );
}

function AgentSubmitDealContent() {
  const { data, refresh } = usePortalData();
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const platformOptions = data?.partnerPlatforms.length
    ? data.partnerPlatforms.map((platform) => ({
        label: platform.name,
        value: platform.id,
      }))
    : partnerPlatforms.map((platform) => ({ label: platform.name, value: platform.name }));
  const applicationHref = useMemo(() => {
    const params = new URLSearchParams();
    if (form.merchantName.trim()) params.set("merchant", form.merchantName.trim());
    if (form.contactEmail.trim()) params.set("email", form.contactEmail.trim());
    if (form.platform.trim()) {
      const platformName = platformOptions.find((platform) => platform.value === form.platform)?.label ?? form.platform;
      params.set("platform", platformName);
    }
    if (data?.profile.email) params.set("agentEmail", data.profile.email);
    if (data?.profile.id) params.set("agentId", data.profile.id);
    if (data?.profile.name) params.set("agentName", data.profile.name);
    const query = params.toString();
    return query ? `/?${query}` : "/";
  }, [
    data?.profile.email,
    data?.profile.id,
    data?.profile.name,
    form.contactEmail,
    form.merchantName,
    form.platform,
    platformOptions,
  ]);

  async function saveDealDraft() {
    setSaving(true);
    setError(null);

    try {
      if (!form.merchantName.trim()) {
        throw new Error("Merchant name is required.");
      }

      if (data) {
        await portalRequest("/api/portal/deals", {
          method: "POST",
          body: JSON.stringify({
            contactEmail: form.contactEmail,
            contactName: form.contactName,
            estimatedVolume: form.estimatedVolume,
            lastActivity: "Deal draft created in partner portal",
            merchantName: form.merchantName,
            nextFollowUp: form.nextFollowUp,
            notes: form.notes,
            platformId: form.platform,
            priority: form.priority.toLowerCase().replace(" priority", ""),
            stage: "new_lead",
          }),
        });
        await refresh();
      }

      showPortalToast({
        title: "Deal draft saved",
        message: "The agent CRM draft is ready for the full application flow.",
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The deal draft could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
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
                Capture the first pass details, then continue to the full merchant application.
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
                  ...platformOptions,
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
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              Next follow-up
              <input
                className={portalInputClass}
                placeholder="Tomorrow, 10:00 AM"
                value={form.nextFollowUp}
                onChange={(event) => setForm((current) => ({ ...current, nextFollowUp: event.target.value }))}
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

          {error ? <p className="mt-4 text-sm font-medium text-rose-700">{error}</p> : null}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveDealDraft()}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
              {saving ? "Saving..." : "Save CRM Draft"}
            </button>
            <Link
              href={applicationHref}
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
            <h2 className="text-sm font-semibold text-emerald-950">Agent Ownership</h2>
            <p className="mt-2 text-sm leading-6 text-emerald-900">
              Saved drafts stay attached to the signed-in agent and appear in the CRM pipeline.
            </p>
          </div>
        </aside>
      </section>
    </>
  );
}
