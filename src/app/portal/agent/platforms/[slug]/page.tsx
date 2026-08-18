"use client";

import Link from "next/link";
import { ArrowLeft, Download, ExternalLink, FileText, LockKeyhole, ShieldCheck } from "lucide-react";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { partnerPlatforms, type PlatformFolderKey } from "@/components/portal/partnerData";
import { PageHeader, PortalShell } from "@/components/portal/PortalShell";

function statusClass(status: string) {
  if (status === "Active") return "bg-emerald-100 text-emerald-900";
  if (status === "Limited") return "bg-amber-100 text-amber-900";
  return "bg-rose-100 text-rose-800";
}

export default function AgentPlatformDetailPage() {
  const params = useParams<{ slug: string }>();
  const platform = partnerPlatforms.find((item) => item.slug === params.slug);
  const [activeFolder, setActiveFolder] = useState<PlatformFolderKey>(
    platform?.folders[0]?.key ?? "agent-buy-rate"
  );
  const folder = useMemo(
    () => platform?.folders.find((item) => item.key === activeFolder) ?? platform?.folders[0],
    [activeFolder, platform]
  );

  if (!platform || !folder) {
    return (
      <PortalShell role="agent">
        <PageHeader title="Platform Not Found" subtitle="This platform is not available in your portal access." />
        <Link
          href="/portal/agent/platforms"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Back to platforms
        </Link>
      </PortalShell>
    );
  }

  return (
    <PortalShell role="agent">
      <div className="mb-5">
        <Link
          href="/portal/agent/platforms"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-950"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Platform Directory
        </Link>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(platform.status)}`}>
                {platform.status}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                {platform.category}
              </span>
            </div>
            <h1 className="mt-4 text-2xl font-semibold text-slate-950 sm:text-3xl">{platform.name}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-700">{platform.description}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 lg:min-w-64">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <ShieldCheck aria-hidden="true" className="h-4 w-4 text-emerald-700" />
              Agent access enabled
            </div>
            <p className="mt-2 text-sm text-slate-700">Last updated {platform.lastUpdated}</p>
            <p className="mt-1 text-sm text-slate-700">{platform.folders.length} visible folders</p>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[340px_1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <h2 className="px-2 py-2 text-sm font-semibold text-slate-950">Platform Folders</h2>
          <div className="mt-1 space-y-1">
            {platform.folders.map((item) => {
              const Icon = item.icon;
              const active = item.key === activeFolder;

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveFolder(item.key)}
                  className={`flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors ${
                    active ? "bg-slate-200 text-slate-950" : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{item.name}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-slate-600">{item.summary}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">{folder.name}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-700">{folder.summary}</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                <LockKeyhole aria-hidden="true" className="h-3.5 w-3.5" />
                Permission controlled
              </span>
            </div>
          </div>

          <div className="divide-y divide-slate-200">
            {folder.items.map((item, index) => (
              <div key={item} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                    <FileText aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-950">{item}</h3>
                    <p className="mt-0.5 text-sm text-slate-600">
                      {index % 2 === 0 ? "Resource file" : "Internal note"} for {platform.name}.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
                  >
                    <ExternalLink aria-hidden="true" className="h-4 w-4" />
                    Preview
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-900"
                  >
                    <Download aria-hidden="true" className="h-4 w-4" />
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PortalShell>
  );
}
