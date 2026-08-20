"use client";

import Link from "next/link";
import {
  Archive,
  ArrowRight,
  BookOpen,
  FilePlus2,
  FolderPlus,
  Link2,
  Plus,
  UploadCloud,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  displayPortalStatus,
  folderIconForKey,
  partnerPlatforms,
  platformCategories,
  statusClassName,
  standardFolders,
  type PartnerPlatform,
} from "@/components/portal/partnerData";
import { usePortalData } from "@/components/portal/PortalDataProvider";
import { PageHeader, PortalShell, portalInputClass } from "@/components/portal/PortalShell";
import { PortalSelect } from "@/components/portal/PortalSelect";
import { showPortalToast } from "@/components/portal/PortalToast";
import { getPortalSupabase, portalRequest } from "@/lib/portal/client";
import type { PartnerPlatformRecord, PlatformFolderWithResources } from "@/lib/portal/types";

const initialPlatform = {
  category: "Cashless / Debit",
  description: "",
  name: "",
  status: "active",
};

const initialResource = {
  description: "",
  externalUrl: "",
  folderId: "",
  platformId: "",
  resourceType: "document",
  title: "",
};

type PlatformRow = PartnerPlatform | PartnerPlatformRecord;
type ResourceForm = typeof initialResource;

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function displayName(platform: PlatformRow) {
  return platform.name;
}

function displayCategory(platform: PlatformRow) {
  return platform.category ?? "Other";
}

function displayStatus(platform: PlatformRow) {
  return "status" in platform
    ? platform.status
    : displayPortalStatus(platform.portal_status);
}

function platformId(platform: PlatformRow) {
  return "id" in platform ? platform.id : platform.slug;
}

function platformSlug(platform: PlatformRow) {
  return platform.slug || platformId(platform);
}

function folderId(folder: PartnerPlatform["folders"][number] | PlatformFolderWithResources) {
  return "id" in folder ? folder.id : folder.key;
}

function folderKey(folder: PartnerPlatform["folders"][number] | PlatformFolderWithResources) {
  return "folder_key" in folder ? folder.folder_key : folder.key;
}

function folderResources(folder: PlatformFolderWithResources) {
  return folder.resources ?? folder.platform_resources ?? [];
}

export default function AdminPlatformLibraryPage() {
  return (
    <PortalShell role="admin">
      <AdminPlatformLibraryContent />
    </PortalShell>
  );
}

function AdminPlatformLibraryContent() {
  const { data, refresh } = usePortalData();
  const liveMode = Boolean(data);
  const [platformForm, setPlatformForm] = useState(initialPlatform);
  const [resourceForm, setResourceForm] = useState<ResourceForm>(initialResource);
  const [resourceFile, setResourceFile] = useState<File | null>(null);
  const [previewPlatforms, setPreviewPlatforms] = useState<PartnerPlatform[]>(partnerPlatforms);
  const [category, setCategory] = useState("All categories");
  const [status, setStatus] = useState("All statuses");
  const [savingPlatform, setSavingPlatform] = useState(false);
  const [savingResource, setSavingResource] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sourcePlatforms: PlatformRow[] = data ? data.partnerPlatforms : previewPlatforms;
  const activeResourcePlatformId =
    resourceForm.platformId || (sourcePlatforms[0] ? platformId(sourcePlatforms[0]) : "");
  const selectedPlatform =
    sourcePlatforms.find((platform) => platformId(platform) === activeResourcePlatformId) ??
    sourcePlatforms[0];
  const selectedFolders = selectedPlatform?.folders ?? [];
  const activeResourceFolderId =
    resourceForm.folderId || (selectedFolders[0] ? folderId(selectedFolders[0]) : "");
  const categoryOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...platformCategories,
          ...sourcePlatforms
            .map((platform) => platform.category)
            .filter((value): value is string => Boolean(value)),
        ])
      ),
    [sourcePlatforms]
  );

  const filteredPlatforms = useMemo(
    () =>
      sourcePlatforms.filter(
        (platform) =>
          (category === "All categories" || displayCategory(platform) === category) &&
          (status === "All statuses" || displayStatus(platform) === status)
      ),
    [category, sourcePlatforms, status]
  );
  const resourceHasContent = Boolean(
    resourceFile || resourceForm.externalUrl.trim() || resourceForm.description.trim()
  );
  const resourceCanSubmit = Boolean(
    activeResourcePlatformId &&
      activeResourceFolderId &&
      resourceForm.title.trim() &&
      resourceHasContent
  );

  function setResourceField(field: keyof ResourceForm, value: string) {
    setResourceForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "platformId") {
        const platform = sourcePlatforms.find((item) => platformId(item) === value);
        next.folderId = platform?.folders[0] ? folderId(platform.folders[0]) : "";
      }
      return next;
    });
  }

  async function addPlatform() {
    const name = platformForm.name.trim();
    if (!name) {
      setError("Platform name is required.");
      return;
    }

    setSavingPlatform(true);
    setError(null);

    try {
      if (data) {
        await portalRequest("/api/portal/partner/platforms", {
          method: "POST",
          body: JSON.stringify(platformForm),
        });
        await refresh();
      } else {
        const platform: PartnerPlatform = {
          category: platformForm.category,
          description:
            platformForm.description.trim() ||
            "Processing platform resources, contacts, documents, and submission guidance.",
          folders: standardFolders,
          lastUpdated: "Today",
          name,
          slug: slugify(name),
          status: displayPortalStatus(platformForm.status),
          tags: [platformForm.category],
        };
        setPreviewPlatforms((current) => [platform, ...current]);
      }
      setPlatformForm(initialPlatform);
      showPortalToast({ title: "Platform added", message: `${name} is available in the library.` });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The platform could not be saved.");
    } finally {
      setSavingPlatform(false);
    }
  }

  async function saveResource() {
    if (!activeResourcePlatformId || !activeResourceFolderId || !resourceForm.title.trim()) {
      setError("Platform, folder, and resource title are required.");
      return;
    }

    if (!resourceHasContent) {
      setError("Add a file, link, or description before saving the resource.");
      return;
    }

    if (!data) {
      setError(
        "A verified admin session is required to save platform resources."
      );
      return;
    }

    setSavingResource(true);
    setError(null);

    try {
      if (resourceFile) {
        const {
          data: { session },
        } = await getPortalSupabase().auth.getSession();
        if (!session?.access_token) throw new Error("Sign in is required to upload resources.");

        const formData = new FormData();
        formData.append("file", resourceFile);
        formData.append("platformId", activeResourcePlatformId);
        formData.append("folderId", activeResourceFolderId);
        formData.append("title", resourceForm.title);
        formData.append("description", resourceForm.description);

        const response = await fetch("/api/portal/partner/upload", {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: formData,
        });
        const payload = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(payload.error || "The resource file could not be uploaded.");
      } else {
        await portalRequest("/api/portal/partner/resources", {
          method: "POST",
          body: JSON.stringify({
            ...resourceForm,
            folderId: activeResourceFolderId,
            platformId: activeResourcePlatformId,
          }),
        });
      }

      setResourceForm((current) => ({
        ...initialResource,
        folderId: current.folderId,
        platformId: current.platformId,
      }));
      setResourceFile(null);
      await refresh();
      showPortalToast({ title: "Resource saved", message: "The folder resource is now available." });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The resource could not be saved.");
    } finally {
      setSavingResource(false);
    }
  }

  async function archivePlatform(id: string) {
    setSavingPlatform(true);
    setError(null);

    try {
      if (data) {
        await portalRequest(`/api/portal/partner/platforms?id=${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
        await refresh();
      } else {
        setPreviewPlatforms((current) =>
          current.map((platform) =>
            platform.slug === id ? { ...platform, status: "Restricted" } : platform
          )
        );
      }
      showPortalToast({ title: "Platform restricted", message: "The platform visibility was updated." });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The platform could not be restricted.");
    } finally {
      setSavingPlatform(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Platform Library"
        subtitle="Manage payment platforms, folder structures, resource links, files, and agent-facing guidance."
      />

      {error ? (
        <div className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          {error}
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[430px_1fr]">
        <div className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                <FolderPlus aria-hidden="true" className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Add Processing Platform</h2>
                <p className="mt-1 text-sm leading-6 text-slate-700">
                  Create platforms such as EllaCash, Greenway PPS, Linked2Pay, and Paynex.
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
                  options={categoryOptions
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
                    { label: "Active", value: "active" },
                    { label: "Limited", value: "limited" },
                    { label: "Restricted", value: "restricted" },
                  ]}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Description
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

            <button
              type="button"
              disabled={savingPlatform}
              onClick={() => void addPlatform()}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              {savingPlatform ? "Saving..." : "Add Platform"}
            </button>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                <FilePlus2 aria-hidden="true" className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Add Folder Resource</h2>
                <p className="mt-1 text-sm leading-6 text-slate-700">
                  Add a file, link, or note to a platform folder.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4">
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Platform
                <PortalSelect
                  value={activeResourcePlatformId}
                  onValueChange={(value) => setResourceField("platformId", value)}
                  options={[
                    { disabled: true, label: "Select platform", value: "" },
                    ...sourcePlatforms.map((platform) => ({
                      label: displayName(platform),
                      value: platformId(platform),
                    })),
                  ]}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Folder
                <PortalSelect
                  value={activeResourceFolderId}
                  onValueChange={(value) => setResourceField("folderId", value)}
                  options={[
                    { disabled: true, label: "Select folder", value: "" },
                    ...selectedFolders.map((folder) => ({
                      label: folder.name,
                      value: folderId(folder),
                    })),
                  ]}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Resource type
                <PortalSelect
                  value={resourceForm.resourceType}
                  onValueChange={(value) => setResourceField("resourceType", value)}
                  options={[
                    { label: "Document", value: "document" },
                    { label: "Link", value: "link" },
                    { label: "Note", value: "note" },
                  ]}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Title
                <input
                  className={portalInputClass}
                  placeholder="PPS buy-rate sheet"
                  value={resourceForm.title}
                  onChange={(event) => setResourceField("title", event.target.value)}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Link URL
                <input
                  className={portalInputClass}
                  placeholder="https://drive.google.com/..."
                  value={resourceForm.externalUrl}
                  onChange={(event) => setResourceField("externalUrl", event.target.value)}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Upload file
                <input
                  className={portalInputClass}
                  type="file"
                  onChange={(event) => setResourceFile(event.target.files?.[0] ?? null)}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Description
                <textarea
                  className={portalInputClass}
                  rows={3}
                  placeholder="Short internal label shown to agents."
                  value={resourceForm.description}
                  onChange={(event) => setResourceField("description", event.target.value)}
                />
              </label>
            </div>

            <button
              type="button"
              disabled={savingResource || !resourceCanSubmit}
              onClick={() => void saveResource()}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <UploadCloud aria-hidden="true" className="h-4 w-4" />
              {savingResource ? "Saving..." : "Save Resource"}
            </button>
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
                  options={categoryOptions.map((item) => ({ label: item, value: item }))}
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
              <article key={platformId(platform)} className="p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClassName(displayStatus(platform))}`}>
                        {displayStatus(platform)}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {displayCategory(platform)}
                      </span>
                    </div>
                    <h3 className="mt-3 text-lg font-semibold text-slate-950">{platform.name}</h3>
                    <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-700">
                      {platform.description || "Processing platform resources and submission guidance."}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {platform.folders.map((folder) => {
                        const key = folderKey(folder);
                        const Icon = "icon" in folder ? folder.icon : folderIconForKey(key);
                        const resources =
                          "resources" in folder ? folderResources(folder) : folder.items;

                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => {
                              setResourceField("platformId", platformId(platform));
                              setResourceField("folderId", folderId(folder));
                            }}
                            className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left transition-colors hover:bg-slate-100"
                          >
                            <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-600" strokeWidth={1.8} />
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-semibold text-slate-950">{folder.name}</span>
                              <span className="block text-[11px] font-medium text-slate-500">
                                {resources.length} {resources.length === 1 ? "resource" : "resources"}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setResourceField("platformId", platformId(platform));
                        setResourceField("folderId", platform.folders[0] ? folderId(platform.folders[0]) : "");
                      }}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
                    >
                      <Link2 aria-hidden="true" className="h-4 w-4" />
                      Add Resource
                    </button>
                    <button
                      type="button"
                      disabled={savingPlatform}
                      onClick={() => void archivePlatform(platformId(platform))}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Archive aria-hidden="true" className="h-4 w-4" />
                      Restrict
                    </button>
                    <Link
                      href={`/portal/agent/platforms/${platformSlug(platform)}`}
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
          {standardFolders.map((folder) => {
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
    </>
  );
}
