"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, Search } from "lucide-react";
import { useMemo, useState } from "react";
import {
  displayPortalStatus,
  partnerPlatforms,
  platformCategories,
  statusClassName,
} from "@/components/portal/partnerData";
import { usePortalData } from "@/components/portal/PortalDataProvider";
import { PageHeader, PortalShell, portalInputClass } from "@/components/portal/PortalShell";
import { PortalSelect } from "@/components/portal/PortalSelect";
import type { PartnerPlatformRecord } from "@/lib/portal/types";

type PlatformRow = PartnerPlatformRecord | (typeof partnerPlatforms)[number];

function platformStatus(platform: PlatformRow) {
  return "status" in platform
    ? platform.status
    : displayPortalStatus(platform.portal_status);
}

function platformHref(platform: PlatformRow) {
  return `/portal/agent/platforms/${platform.slug || ("id" in platform ? platform.id : platform.name)}`;
}

function platformTags(platform: PlatformRow) {
  if ("tags" in platform) return platform.tags;
  return [
    platform.category ?? "Other",
    `${platform.resource_count} resource${platform.resource_count === 1 ? "" : "s"}`,
  ];
}

export default function AgentPlatformsPage() {
  return (
    <PortalShell role="agent">
      <AgentPlatformsContent />
    </PortalShell>
  );
}

function AgentPlatformsContent() {
  const { data } = usePortalData();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All categories");
  const [status, setStatus] = useState("All statuses");
  const sourcePlatforms: PlatformRow[] = data?.partnerPlatforms.length
    ? data.partnerPlatforms
    : partnerPlatforms;
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

  const platforms = useMemo(() => {
    const query = search.trim().toLowerCase();

    return sourcePlatforms.filter((platform) => {
      const tags = platformTags(platform);
      const displayStatus = platformStatus(platform);
      const searchMatch =
        !query ||
        platform.name.toLowerCase().includes(query) ||
        (platform.description ?? "").toLowerCase().includes(query) ||
        tags.some((tag) => tag.toLowerCase().includes(query));
      const categoryMatch = category === "All categories" || platform.category === category;
      const statusMatch = status === "All statuses" || displayStatus === status;
      return searchMatch && categoryMatch && statusMatch;
    });
  }, [category, search, sourcePlatforms, status]);

  return (
    <>
      <PageHeader
        title="Platform Directory"
        subtitle="Browse GreenHub payment programs, folders, documents, contacts, and submission rules."
      />

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_180px]">
          <label className="relative">
            <span className="sr-only">Search platforms</span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            />
            <input
              className={`${portalInputClass} pl-9`}
              placeholder="Search platforms, categories, or tags"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
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
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {platforms.map((platform) => (
          <Link
            key={platform.slug || ("id" in platform ? platform.id : platform.name)}
            href={platformHref(platform)}
            className="group rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <div className="flex items-start justify-between gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 group-hover:bg-white">
                <BookOpen aria-hidden="true" className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClassName(platformStatus(platform))}`}>
                {platformStatus(platform)}
              </span>
            </div>
            <h2 className="mt-4 text-lg font-semibold text-slate-950">{platform.name}</h2>
            <p className="mt-2 min-h-12 text-sm leading-6 text-slate-700">
              {platform.description || "Processing platform resources and submission guidance."}
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {platformTags(platform).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600"
                >
                  {tag}
                </span>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
              <span className="text-sm text-slate-600">{platform.folders.length} folders</span>
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-800">
                Open platform
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </span>
            </div>
          </Link>
        ))}
      </section>

      {platforms.length === 0 ? (
        <section className="mt-6 rounded-lg border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
          <p className="text-sm font-semibold text-slate-950">No platforms match those filters.</p>
          <p className="mt-1 text-sm text-slate-600">Try searching a category, bank, or program name.</p>
        </section>
      ) : null}
    </>
  );
}
