"use client";

import Link from "next/link";
import { Archive, ArrowRight, BookOpen, FolderPlus, Plus, UploadCloud } from "lucide-react";
import { useMemo, useState } from "react";
import { partnerPlatforms, platformCategories, type PartnerPlatform } from "@/components/portal/partnerData";
import { PageHeader, PortalShell, portalInputClass } from "@/components/portal/PortalShell";
import { PortalSelect } from "@/components/portal/PortalSelect";
import { PortalActionButton } from "@/components/portal/PortalToast";

const initialPlatform = {
  category: "Cashless / Debit",
  description: "",
  name: "",
  status: "Active",
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function statusClass(status: string) {
  if (status === "Active") return "bg-emerald-100 text-emerald-900";
  if (status === "Limited") return "bg-amber-100 text-amber-900";
  return "bg-rose-100 text-rose-800";
}

export default function AdminPlatformLibraryPage() {
  const [platformForm, setPlatformForm] = useState(initialPlatform);
  const [previewPlatforms, setPreviewPlatforms] = useState<PartnerPlatform[]>(partnerPlatforms);
  const [category, setCategory] = useState("All categories");
  const [status, setStatus] = useState("All statuses");

  const filteredPlatforms = useMemo(
    () =>
      previewPlatforms.filter(
        (platform) =>
          (category === "All categories" || platform.category === category) &&
          (status === "All statuses" || platform.status === status)
      ),
    [category, previewPlatforms, status]
  );

  function addPlatform() {
    const name = platformForm.name.trim();
    if (!name) return;
    const platform: PartnerPlatform = {
      category: platformForm.category,
      description:
        platformForm.description.trim() ||
        "New processing platform ready for folders, files, contacts, and program notes.",
      folders: partnerPlatforms[0].folders,
      lastUpdated: "Today",
      name,
      slug: slugify(name),
      status: platformForm.status as PartnerPlatform["status"],
      tags: [platformForm.category],
    };

    setPreviewPlatforms((current) => [platform, ...current]);
    setPlatformForm(initialPlatform);
  }

  function archivePlatform(slug: string) {
    setPreviewPlatforms((current) =>
      current.map((platform) =>
        platform.slug === slug ? { ...platform, status: "Restricted" } : platform
      )
    );
  }

  return (
    <PortalShell role="admin">
      <PageHeader
        title="Platform Library"
        subtitle="Admin workspace for payment platform folders, resource files, contacts, and program notes."
      />

      <section className="grid gap-6 xl:grid-cols-[430px_1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <FolderPlus aria-hidden="true" className="h-5 w-5" strokeWidth={1.8} />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Add Processing Platform</h2>
              <p className="mt-1 text-sm leading-6 text-slate-700">
                Create the platform shell, then control folders and file access from the admin portal.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4">
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              Platform name
              <input
                className={portalInputClass}
                placeholder="Greenway - PPS"
                value={platformForm.name}
                onChange={(event) =>
                  setPlatformForm((current) => ({ ...current, name: event.target.value }))
                }
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              Category
              <PortalSelect
                value={platformForm.category}
                onValueChange={(value) =>
                  setPlatformForm((current) => ({ ...current, category: value }))
                }
                options={platformCategories
                  .filter((item) => item !== "All categories")
                  .map((item) => ({ label: item, value: item }))}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              Status
              <PortalSelect
                value={platformForm.status}
                onValueChange={(value) =>
                  setPlatformForm((current) => ({ ...current, status: value }))
                }
                options={[
                  { label: "Active", value: "Active" },
                  { label: "Limited", value: "Limited" },
                  { label: "Restricted", value: "Restricted" },
                ]}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              Short description
              <textarea
                className={portalInputClass}
                placeholder="Program summary and use case for agents."
                rows={4}
                value={platformForm.description}
                onChange={(event) =>
                  setPlatformForm((current) => ({ ...current, description: event.target.value }))
                }
              />
            </label>
          </div>

          <PortalActionButton
            type="button"
            onClick={addPlatform}
            toastTitle="Platform added"
            toastMessage="The processing platform has been added to the library preview."
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900"
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            Add Platform
          </PortalActionButton>

          <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <h3 className="text-sm font-semibold text-emerald-950">Production Next Step</h3>
            <p className="mt-1 text-sm leading-6 text-emerald-900">
              Connect this UI to Supabase Storage for uploaded PDFs and resource files.
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Library Inventory</h2>
                <p className="mt-1 text-sm text-slate-700">
                  Payment platforms and standardized folder structures for agents.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[420px]">
                <PortalSelect
                  ariaLabel="Filter platform category"
                  value={category}
                  onValueChange={setCategory}
                  options={platformCategories.map((item) => ({ label: item, value: item }))}
                />
                <PortalSelect
                  ariaLabel="Filter platform status"
                  value={status}
                  onValueChange={setStatus}
                  options={[
                    { label: "All statuses", value: "All statuses" },
                    { label: "Active", value: "Active" },
                    { label: "Limited", value: "Limited" },
                    { label: "Restricted", value: "Restricted" },
                  ]}
                />
              </div>
            </div>
          </div>

          <div className="divide-y divide-slate-200">
            {filteredPlatforms.map((platform) => (
              <article key={platform.slug} className="p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(platform.status)}`}>
                        {platform.status}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {platform.category}
                      </span>
                    </div>
                    <h3 className="mt-3 text-lg font-semibold text-slate-950">{platform.name}</h3>
                    <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-700">{platform.description}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {platform.folders.map((folder) => (
                        <span
                          key={folder.key}
                          className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600"
                        >
                          {folder.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
                    >
                      <UploadCloud aria-hidden="true" className="h-4 w-4" />
                      Add Files
                    </button>
                    <button
                      type="button"
                      onClick={() => archivePlatform(platform.slug)}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
                    >
                      <Archive aria-hidden="true" className="h-4 w-4" />
                      Restrict
                    </button>
                    <Link
                      href={`/portal/agent/platforms/${platform.slug}`}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-900"
                    >
                      Preview
                      <ArrowRight aria-hidden="true" className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <BookOpen aria-hidden="true" className="h-5 w-5 text-slate-700" />
          <h2 className="text-lg font-semibold text-slate-950">Standard Folder Template</h2>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {partnerPlatforms[0].folders.map((folder) => {
            const Icon = folder.icon;

            return (
              <div key={folder.key} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <Icon aria-hidden="true" className="h-5 w-5 text-slate-700" strokeWidth={1.8} />
                <h3 className="mt-3 text-sm font-semibold text-slate-950">{folder.name}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-700">{folder.summary}</p>
              </div>
            );
          })}
        </div>
      </section>
    </PortalShell>
  );
}
