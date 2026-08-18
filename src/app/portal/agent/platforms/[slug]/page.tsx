"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  FileText,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  displayPortalStatus,
  folderIconForKey,
  folderSummaryForKey,
  partnerPlatforms,
  statusClassName,
} from "@/components/portal/partnerData";
import { usePortalData } from "@/components/portal/PortalDataProvider";
import { PageHeader, PortalShell } from "@/components/portal/PortalShell";
import { showPortalToast } from "@/components/portal/PortalToast";
import { portalRequest } from "@/lib/portal/client";
import type { PartnerPlatformRecord, PlatformFolderWithResources, PlatformResource } from "@/lib/portal/types";

type DemoPlatform = (typeof partnerPlatforms)[number];
type DemoFolder = DemoPlatform["folders"][number];
type PlatformRow = DemoPlatform | PartnerPlatformRecord;
type FolderRow = DemoFolder | PlatformFolderWithResources;

function platformStatus(platform: PlatformRow) {
  return "status" in platform
    ? platform.status
    : displayPortalStatus(platform.portal_status);
}

function folderKey(folder: FolderRow) {
  return "folder_key" in folder ? folder.folder_key : folder.key;
}

function folderName(folder: FolderRow) {
  return folder.name;
}

function folderSummary(folder: FolderRow) {
  return "folder_key" in folder
    ? folderSummaryForKey(folder.folder_key, folder.description)
    : folder.summary;
}

function folderResourceCount(folder: FolderRow) {
  return "resources" in folder ? folder.resources.length : folder.items.length;
}

async function openResource(resource: PlatformResource) {
  const result = await portalRequest<{ url: string }>(
    `/api/portal/partner/resource-download?id=${encodeURIComponent(resource.id)}`
  );
  window.open(result.url, "_blank", "noopener,noreferrer");
}

export default function AgentPlatformDetailPage() {
  return (
    <PortalShell role="agent">
      <AgentPlatformDetailContent />
    </PortalShell>
  );
}

function AgentPlatformDetailContent() {
  const params = useParams<{ slug: string }>();
  const { data } = usePortalData();
  const platforms: PlatformRow[] = data?.partnerPlatforms.length
    ? data.partnerPlatforms
    : partnerPlatforms;
  const platform = platforms.find(
    (item) => item.slug === params.slug || ("id" in item && item.id === params.slug)
  );
  const [activeFolderKey, setActiveFolderKey] = useState("agent-buy-rate");
  const folders = platform?.folders ?? [];
  const folder = useMemo(
    () => folders.find((item) => folderKey(item) === activeFolderKey) ?? folders[0],
    [activeFolderKey, folders]
  );

  if (!platform || !folder) {
    return (
      <>
        <PageHeader title="Platform Not Found" subtitle="This platform is not available in your portal access." />
        <Link
          href="/portal/agent/platforms"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Back to platforms
        </Link>
      </>
    );
  }

  return (
    <>
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
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClassName(platformStatus(platform))}`}>
                {platformStatus(platform)}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                {platform.category ?? "Other"}
              </span>
            </div>
            <h1 className="mt-4 text-2xl font-semibold text-slate-950 sm:text-3xl">{platform.name}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {platform.description || "Processing platform resources and submission guidance."}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 lg:min-w-64">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <ShieldCheck aria-hidden="true" className="h-4 w-4 text-emerald-700" />
              Agent access enabled
            </div>
            <p className="mt-2 text-sm text-slate-700">
              Last updated{" "}
              {"lastUpdated" in platform
                ? platform.lastUpdated
                : new Date(platform.last_updated_at ?? platform.updated_at ?? platform.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
            </p>
            <p className="mt-1 text-sm text-slate-700">
              {folders.length} visible folders
              {"resource_count" in platform ? `, ${platform.resource_count} resources` : ""}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[340px_1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <h2 className="px-2 py-2 text-sm font-semibold text-slate-950">Platform Folders</h2>
          <div className="mt-1 space-y-1">
            {folders.map((item) => {
              const key = folderKey(item);
              const Icon = "icon" in item ? item.icon : folderIconForKey(key);
              const active = key === folderKey(folder);

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveFolderKey(key)}
                  className={`flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors ${
                    active ? "bg-slate-200 text-slate-950" : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{folderName(item)}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-slate-600">
                      {folderResourceCount(item)} items
                    </span>
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
                <h2 className="text-lg font-semibold text-slate-950">{folderName(folder)}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-700">{folderSummary(folder)}</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                <LockKeyhole aria-hidden="true" className="h-3.5 w-3.5" />
                Permission controlled
              </span>
            </div>
          </div>

          <div className="divide-y divide-slate-200">
            {"resources" in folder ? (
              folder.resources.length ? (
                folder.resources.map((resource) => (
                  <div key={resource.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                        <FileText aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
                      </span>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-950">{resource.title}</h3>
                        <p className="mt-0.5 text-sm text-slate-600">
                          {resource.description || resource.file_name || resource.resource_type}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void openResource(resource).catch((error) =>
                            showPortalToast({
                              title: "Resource unavailable",
                              message: error instanceof Error ? error.message : "The resource could not be opened.",
                            })
                          )
                        }
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
                      >
                        <ExternalLink aria-hidden="true" className="h-4 w-4" />
                        Preview
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void openResource(resource).catch((error) =>
                            showPortalToast({
                              title: "Download unavailable",
                              message: error instanceof Error ? error.message : "The resource could not be downloaded.",
                            })
                          )
                        }
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-900"
                      >
                        <Download aria-hidden="true" className="h-4 w-4" />
                        Download
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-5 py-12 text-center">
                  <p className="text-sm font-semibold text-slate-950">No resources uploaded yet.</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Admins can add files or links from the Platform Library.
                  </p>
                </div>
              )
            ) : (
              folder.items.map((item, index) => (
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
              ))
            )}
          </div>
        </div>
      </section>
    </>
  );
}
