"use client";

import {
  Archive,
  BookOpen,
  Download,
  ExternalLink,
  Eye,
  FilePlus2,
  FileText,
  FolderPlus,
  Link2,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Tags,
  Trash2,
  UploadCloud,
  X,
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
import { inferredResidualPlatformType, residualTypeLabel } from "@/lib/portal/residualType";
import type {
  PartnerPlatformRecord,
  PlatformFolderWithResources,
  PlatformResource,
} from "@/lib/portal/types";

const initialPlatform = {
  category: "Cashless / Debit",
  description: "",
  name: "",
  residualType: "cc",
  status: "active",
};

const initialPlatformEdit = {
  category: "Other",
  description: "",
  name: "",
  residualType: "cc",
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
type PlatformEditForm = typeof initialPlatformEdit;
type ResourceForm = typeof initialResource;

type UploadTokenResponse = {
  bucket: string;
  path: string;
  token: string;
};

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

function displayResidualType(platform: PlatformRow) {
  return inferredResidualPlatformType(platform);
}

function displayStatus(platform: PlatformRow) {
  if ("is_active" in platform && !platform.is_active) return "Hidden";
  return "status" in platform
    ? platform.status
    : displayPortalStatus(platform.portal_status);
}

function platformStatusValue(platform: PlatformRow) {
  const status = displayStatus(platform);
  if (status === "Limited") return "limited";
  if (status === "Restricted" || status === "Hidden") return "restricted";
  return "active";
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

function resourcesForFolder(
  folder: PartnerPlatform["folders"][number] | PlatformFolderWithResources
) {
  return "resources" in folder ? folderResources(folder) : folder.items;
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
  const [categoryForm, setCategoryForm] = useState("");
  const [resourceForm, setResourceForm] = useState<ResourceForm>(initialResource);
  const [resourceFile, setResourceFile] = useState<File | null>(null);
  const [editingPlatformId, setEditingPlatformId] = useState<string | null>(null);
  const [platformEditForm, setPlatformEditForm] = useState<PlatformEditForm>(initialPlatformEdit);
  const [previewCategoryNames, setPreviewCategoryNames] = useState(
    platformCategories.filter((item) => item !== "All categories")
  );
  const [previewPlatforms, setPreviewPlatforms] = useState<PartnerPlatform[]>(partnerPlatforms);
  const [category, setCategory] = useState("All categories");
  const [status, setStatus] = useState("All statuses");
  const [deletingPlatformId, setDeletingPlatformId] = useState<string | null>(null);
  const [savingCategory, setSavingCategory] = useState(false);
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
  const activeResourceFolder =
    selectedFolders.find((folder) => folderId(folder) === activeResourceFolderId) ??
    selectedFolders[0];
  const categoryOptions = useMemo(
    () => {
      const liveCategories =
        data?.platformCategories?.map((item) => item.name).filter(Boolean) ?? previewCategoryNames;

      return [
        "All categories",
        ...Array.from(
          new Set([
            ...liveCategories,
            ...sourcePlatforms
              .map((platform) => platform.category)
              .filter((value): value is string => Boolean(value)),
          ])
        ).sort((left, right) => left.localeCompare(right)),
      ];
    },
    [data?.platformCategories, previewCategoryNames, sourcePlatforms]
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
  const resourceHasContent = (() => {
    if (resourceForm.resourceType === "link") return Boolean(resourceForm.externalUrl.trim());
    if (resourceForm.resourceType === "note") return Boolean(resourceForm.description.trim());
    return Boolean(resourceFile || resourceForm.externalUrl.trim());
  })();
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

  function setPlatformEditField(field: keyof PlatformEditForm, value: string) {
    setPlatformEditForm((current) => ({ ...current, [field]: value }));
  }

  function beginEditPlatform(platform: PlatformRow) {
    setEditingPlatformId(platformId(platform));
    setPlatformEditForm({
      category: displayCategory(platform),
      description: platform.description || "",
      name: platform.name,
      residualType: displayResidualType(platform),
      status: platformStatusValue(platform),
    });
  }

  async function savePlatformEdit() {
    if (!editingPlatformId) return;
    const name = platformEditForm.name.trim();
    if (!name) {
      setError("Platform name is required.");
      return;
    }

    setSavingPlatform(true);
    setError(null);

    try {
      if (data) {
        await portalRequest("/api/portal/partner/platforms", {
          method: "PATCH",
          body: JSON.stringify({
            ...platformEditForm,
            id: editingPlatformId,
          }),
        });
        await refresh();
      } else {
        setPreviewPlatforms((current) =>
          current.map((platform) =>
            platform.slug === editingPlatformId
              ? {
                  ...platform,
                  category: platformEditForm.category,
                  description: platformEditForm.description,
                  name,
                  residualType: inferredResidualPlatformType({
                    name,
                    residualType: platformEditForm.residualType,
                  }),
                  status: displayPortalStatus(platformEditForm.status),
                  tags: [platformEditForm.category],
                }
              : platform
          )
        );
      }

      setEditingPlatformId(null);
      showPortalToast({ title: "Platform updated", message: `${name} was saved.` });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The platform could not be updated.");
    } finally {
      setSavingPlatform(false);
    }
  }

  async function addCategory() {
    const name = categoryForm.trim().replace(/\s+/g, " ");
    if (!name) {
      setError("Category name is required.");
      return;
    }

    setSavingCategory(true);
    setError(null);

    try {
      if (data) {
        await portalRequest("/api/portal/partner/categories", {
          method: "POST",
          body: JSON.stringify({ name }),
        });
        await refresh();
      } else {
        setPreviewCategoryNames((current) =>
          current.some((item) => item.toLowerCase() === name.toLowerCase())
            ? current
            : [...current, name]
        );
      }

      setPlatformForm((current) => ({ ...current, category: name }));
      setCategory(name);
      setCategoryForm("");
      showPortalToast({ title: "Category added", message: `${name} is ready for platforms.` });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The category could not be saved.");
    } finally {
      setSavingCategory(false);
    }
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
          residualType: inferredResidualPlatformType({
            name,
            residualType: platformForm.residualType,
          }),
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

    if (!data) {
      setError("A verified admin session is required to save platform resources.");
      return;
    }

    if (!resourceHasContent) {
      setError(
        resourceForm.resourceType === "link"
          ? "Add a link URL before saving this resource."
          : resourceForm.resourceType === "note"
            ? "Add note text in the description before saving this resource."
            : "Upload a file or add a document link before saving this resource."
      );
      return;
    }

    setSavingResource(true);
    setError(null);

    try {
      if (resourceFile) {
        const upload = await portalRequest<UploadTokenResponse>("/api/portal/partner/upload-token", {
          method: "POST",
          body: JSON.stringify({
            fileName: resourceFile.name,
            fileSize: resourceFile.size,
            fileType: resourceFile.type,
            folderId: activeResourceFolderId,
            platformId: activeResourcePlatformId,
            title: resourceForm.title,
          }),
        });

        const { error: uploadError } = await getPortalSupabase()
          .storage
          .from(upload.bucket)
          .uploadToSignedUrl(upload.path, upload.token, resourceFile, {
            contentType: resourceFile.type || "application/octet-stream",
          });

        if (uploadError) throw new Error("The resource file could not be uploaded.");

        await portalRequest("/api/portal/partner/resources", {
          method: "POST",
          body: JSON.stringify({
            ...resourceForm,
            externalUrl: resourceForm.externalUrl,
            fileName: resourceFile.name,
            fileSize: resourceFile.size,
            folderId: activeResourceFolderId,
            platformId: activeResourcePlatformId,
            resourceType: "document",
            storageBucket: upload.bucket,
            storagePath: upload.path,
          }),
        });
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

  async function restorePlatform(id: string, name: string) {
    setSavingPlatform(true);
    setError(null);

    try {
      if (data) {
        await portalRequest("/api/portal/partner/platforms", {
          method: "PATCH",
          body: JSON.stringify({
            id,
            isActive: true,
            restoreAccess: true,
            status: "active",
          }),
        });
        await refresh();
      } else {
        setPreviewPlatforms((current) =>
          current.map((platform) =>
            platform.slug === id ? { ...platform, status: "Active" } : platform
          )
        );
      }

      showPortalToast({ title: "Platform restored", message: `${name} is active again.` });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The platform could not be restored.");
    } finally {
      setSavingPlatform(false);
    }
  }

  async function deletePlatform(id: string, name: string) {
    if (!window.confirm(`Delete ${name} from the platform library? This removes its folders and saved resources.`)) {
      return;
    }

    setDeletingPlatformId(id);
    setError(null);

    try {
      if (data) {
        await portalRequest(`/api/portal/partner/platforms?id=${encodeURIComponent(id)}&mode=delete`, {
          method: "DELETE",
        });
        await refresh();
      } else {
        setPreviewPlatforms((current) => current.filter((platform) => platform.slug !== id));
      }

      if (activeResourcePlatformId === id) {
        setResourceForm(initialResource);
      }

      showPortalToast({ title: "Platform deleted", message: `${name} was removed from the library.` });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The platform could not be deleted.");
    } finally {
      setDeletingPlatformId(null);
    }
  }

  function previewPlatform(platform: PlatformRow) {
    const folder =
      platform.folders.find((item) => resourcesForFolder(item).length > 0) ?? platform.folders[0];

    setResourceForm((current) => ({
      ...current,
      folderId: folder ? folderId(folder) : "",
      platformId: platformId(platform),
    }));

    window.requestAnimationFrame(() => {
      document.getElementById("folder-resource-preview")?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    });
  }

  async function openResource(resource: PlatformResource) {
    if (resource.resource_type === "note" && !resource.external_url && !resource.storage_path) {
      showPortalToast({
        title: resource.title,
        message: resource.description || "This note does not have a file or link attached.",
      });
      return;
    }

    const result = await portalRequest<{ url: string }>(
      `/api/portal/partner/resource-download?id=${encodeURIComponent(resource.id)}`
    );
    window.open(result.url, "_blank", "noopener,noreferrer");
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
                <Tags aria-hidden="true" className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Add Category</h2>
                <p className="mt-1 text-sm leading-6 text-slate-700">
                  Create library categories such as POS, Cashless, ACH, or High Risk.
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <input
                className={portalInputClass}
                placeholder="POS"
                value={categoryForm}
                onChange={(event) => setCategoryForm(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void addCategory();
                  }
                }}
              />
              <button
                type="button"
                disabled={savingCategory}
                onClick={() => void addCategory()}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus aria-hidden="true" className="h-4 w-4" />
                {savingCategory ? "Saving..." : "Add Category"}
              </button>
            </div>
          </div>

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
                Residual type
                <PortalSelect
                  value={platformForm.residualType}
                  onValueChange={(value) =>
                    setPlatformForm((current) => ({ ...current, residualType: value }))
                  }
                  options={[
                    { label: "CC residual", value: "cc" },
                    { label: "POB residual", value: "pob" },
                  ]}
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

          <div id="folder-resource-preview" className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                <Eye aria-hidden="true" className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Folder Preview</h2>
                <p className="mt-1 text-sm leading-6 text-slate-700">
                  {selectedPlatform?.name ?? "Select a platform"} ·{" "}
                  {activeResourceFolder?.name ?? "Select a folder"}
                </p>
              </div>
            </div>

            <div className="mt-5 divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200">
              {activeResourceFolder ? (
                resourcesForFolder(activeResourceFolder).length ? (
                  resourcesForFolder(activeResourceFolder).map((resource) =>
                    typeof resource === "string" ? (
                      <div key={resource} className="flex items-start gap-3 bg-white p-3">
                        <FileText aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
                        <div>
                          <p className="text-sm font-semibold text-slate-950">{resource}</p>
                          <p className="mt-0.5 text-xs text-slate-600">Demo resource item</p>
                        </div>
                      </div>
                    ) : (
                      <div key={resource.id} className="bg-white p-3">
                        <div className="flex items-start gap-3">
                          <FileText aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-950">{resource.title}</p>
                            <p className="mt-0.5 text-xs leading-5 text-slate-600">
                              {resource.description || resource.file_name || resource.resource_type}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 pl-7">
                          <button
                            type="button"
                            onClick={() =>
                              void openResource(resource).catch((requestError) =>
                                showPortalToast({
                                  title: "Resource unavailable",
                                  message:
                                    requestError instanceof Error
                                      ? requestError.message
                                      : "The resource could not be opened.",
                                })
                              )
                            }
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                          >
                            <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                            Open
                          </button>
                          {resource.storage_path || resource.external_url ? (
                            <button
                              type="button"
                              onClick={() =>
                                void openResource(resource).catch((requestError) =>
                                  showPortalToast({
                                    title: "Download unavailable",
                                    message:
                                      requestError instanceof Error
                                        ? requestError.message
                                        : "The resource could not be downloaded.",
                                  })
                                )
                              }
                              className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-900"
                            >
                              <Download aria-hidden="true" className="h-3.5 w-3.5" />
                              Download
                            </button>
                          ) : null}
                        </div>
                      </div>
                    )
                  )
                ) : (
                  <div className="bg-slate-50 p-4 text-sm text-slate-700">
                    No resources have been added to this folder yet.
                  </div>
                )
              ) : (
                <div className="bg-slate-50 p-4 text-sm text-slate-700">
                  Select a platform folder to preview resources.
                </div>
              )}
            </div>
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
                    { label: "Hidden", value: "Hidden" },
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
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                        {residualTypeLabel(displayResidualType(platform))}
                      </span>
                    </div>
                    <h3 className="mt-3 text-lg font-semibold text-slate-950">{platform.name}</h3>
                    <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-700">
                      {platform.description || "Processing platform resources and submission guidance."}
                    </p>
                    {editingPlatformId === platformId(platform) ? (
                      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <div className="grid gap-3 lg:grid-cols-2">
                          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                            Platform name
                            <input
                              className={portalInputClass}
                              value={platformEditForm.name}
                              onChange={(event) => setPlatformEditField("name", event.target.value)}
                            />
                          </label>
                          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                            Category
                            <PortalSelect
                              value={platformEditForm.category}
                              onValueChange={(value) => setPlatformEditField("category", value)}
                              options={categoryOptions
                                .filter((item) => item !== "All categories")
                                .map((item) => ({ label: item, value: item }))}
                            />
                          </label>
                          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                            Residual type
                            <PortalSelect
                              value={platformEditForm.residualType}
                              onValueChange={(value) => setPlatformEditField("residualType", value)}
                              options={[
                                { label: "CC residual", value: "cc" },
                                { label: "POB residual", value: "pob" },
                              ]}
                            />
                          </label>
                          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                            Status
                            <PortalSelect
                              value={platformEditForm.status}
                              onValueChange={(value) => setPlatformEditField("status", value)}
                              options={[
                                { label: "Active", value: "active" },
                                { label: "Limited", value: "limited" },
                                { label: "Restricted", value: "restricted" },
                              ]}
                            />
                          </label>
                          <label className="grid gap-1.5 text-sm font-medium text-slate-700 lg:col-span-2">
                            Description
                            <textarea
                              className={portalInputClass}
                              rows={3}
                              value={platformEditForm.description}
                              onChange={(event) =>
                                setPlatformEditField("description", event.target.value)
                              }
                            />
                          </label>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={savingPlatform}
                            onClick={() => void savePlatformEdit()}
                            className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Save aria-hidden="true" className="h-4 w-4" />
                            Save changes
                          </button>
                          <button
                            type="button"
                            disabled={savingPlatform}
                            onClick={() => setEditingPlatformId(null)}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <X aria-hidden="true" className="h-4 w-4" />
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : null}
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
                      onClick={() => beginEditPlatform(platform)}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
                    >
                      <Pencil aria-hidden="true" className="h-4 w-4" />
                      Edit
                    </button>
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
                      onClick={() =>
                        displayStatus(platform) === "Active" || displayStatus(platform) === "Limited"
                          ? void archivePlatform(platformId(platform))
                          : void restorePlatform(platformId(platform), platform.name)
                      }
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {displayStatus(platform) === "Active" || displayStatus(platform) === "Limited" ? (
                        <>
                          <Archive aria-hidden="true" className="h-4 w-4" />
                          Restrict
                        </>
                      ) : (
                        <>
                          <RotateCcw aria-hidden="true" className="h-4 w-4" />
                          Restore
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={deletingPlatformId === platformId(platform)}
                      onClick={() => void deletePlatform(platformId(platform), platform.name)}
                      className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Trash2 aria-hidden="true" className="h-4 w-4" />
                      {deletingPlatformId === platformId(platform) ? "Deleting..." : "Delete"}
                    </button>
                    <button
                      type="button"
                      onClick={() => previewPlatform(platform)}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-900"
                    >
                      Preview
                      <Eye aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </article>
            ))}

            {filteredPlatforms.length === 0 ? (
              <div className="p-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                  <BookOpen aria-hidden="true" className="h-6 w-6" strokeWidth={1.8} />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-950">
                  {sourcePlatforms.length
                    ? "No platforms match those filters"
                    : "No platforms in the live library yet"}
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-700">
                  {sourcePlatforms.length
                    ? "Adjust the category or status filters to return to the full platform inventory."
                    : "Add a processing platform above, or run the partner portal migration to seed the starter platform library."}
                </p>
              </div>
            ) : null}
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
