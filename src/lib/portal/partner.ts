import "server-only";

import { PortalApiError, supabaseRest, type PortalContext } from "./server";
import type {
  AgentPlatformAccess,
  PartnerPlatformRecord,
  Platform,
  PlatformFolderWithResources,
  PlatformResource,
  PlatformResourceFolder,
  PortalDeal,
} from "./types";

export const STANDARD_PLATFORM_FOLDERS = [
  {
    folder_key: "agent-buy-rate",
    name: "Agent Buy Rate",
    description: "Buy-rate notes, agent margin rules, and quick pricing references.",
    sort_order: 10,
  },
  {
    folder_key: "application",
    name: "Application",
    description: "Application packets and required merchant intake materials.",
    sort_order: 20,
  },
  {
    folder_key: "contacts",
    name: "Contacts",
    description: "Underwriting, boarding, and escalation contacts for this platform.",
    sort_order: 30,
  },
  {
    folder_key: "documents",
    name: "Documents",
    description: "Program PDFs, risk files, pricing sheets, and partner documents.",
    sort_order: 40,
  },
  {
    folder_key: "how-to-submit",
    name: "How to Submit",
    description: "Step-by-step submission guidance and approval expectations.",
    sort_order: 50,
  },
  {
    folder_key: "marketing-material",
    name: "Marketing Material",
    description: "Agent-facing sales assets and approved merchant positioning.",
    sort_order: 60,
  },
  {
    folder_key: "program-details",
    name: "Program Details",
    description: "Rules, risk notes, supported industries, and operational policies.",
    sort_order: 70,
  },
  {
    folder_key: "schedule-a",
    name: "Schedule A",
    description: "Schedule A files and agreement addenda used during boarding.",
    sort_order: 80,
  },
] as const;

type RawPartnerPlatform = Platform & {
  platform_resource_folders?: PlatformFolderWithResources[];
};

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function normalizePortalStatus(value: unknown): "active" | "limited" | "restricted" {
  if (value === "limited" || value === "restricted") return value;
  if (value === "Limited") return "limited";
  if (value === "Restricted") return "restricted";
  return "active";
}

function folderAllowedByDefault(platform: RawPartnerPlatform, folder: PlatformFolderWithResources) {
  return normalizePortalStatus(platform.portal_status) !== "restricted" && folder.folder_key !== "schedule-a";
}

export function normalizePartnerPlatforms(
  platforms: RawPartnerPlatform[],
  context: PortalContext,
  accessRows: AgentPlatformAccess[] = []
): PartnerPlatformRecord[] {
  const accessByFolder = new Map(accessRows.map((row) => [row.folder_id, row.can_view]));

  return platforms
    .map((platform) => {
      const folders = (platform.platform_resource_folders ?? [])
        .filter((folder) => folder.is_active)
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
        .map((folder) => {
          const resources = (folder.platform_resources ?? [])
            .filter((resource) => resource.is_active)
            .sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title));

          return {
            ...folder,
            platform_resources: resources,
            resources,
          };
        })
        .filter((folder) => {
          if (context.profile.role === "admin") return true;
          const explicitAccess = accessByFolder.get(folder.id);
          return explicitAccess ?? folderAllowedByDefault(platform, folder);
        });

      return {
        ...platform,
        folders,
        resource_count: folders.reduce((count, folder) => count + folder.resources.length, 0),
      };
    })
    .filter((platform) => context.profile.role === "admin" || platform.folders.length > 0);
}

function restIn(values: string[]) {
  return `in.(${values.join(",")})`;
}

export async function fetchPartnerLibrary(context: PortalContext) {
  const platformQuery = new URLSearchParams({
    select: "*",
    is_active: "eq.true",
    order: "sort_order.asc,name.asc",
  });
  const platforms = await supabaseRest<RawPartnerPlatform[]>("platforms", {
    query: platformQuery,
  });
  const platformIds = platforms.map((platform) => platform.id);

  let folders: PlatformFolderWithResources[] = [];
  if (platformIds.length) {
    const folderQuery = new URLSearchParams({
      select: "*",
      is_active: "eq.true",
      order: "sort_order.asc,name.asc",
      platform_id: restIn(platformIds),
    });

    folders = await supabaseRest<PlatformFolderWithResources[]>("platform_resource_folders", {
      query: folderQuery,
    });

    const platformsWithoutFolders = platformIds.filter(
      (id) => !folders.some((folder) => folder.platform_id === id)
    );

    if (context.profile.role === "admin" && platformsWithoutFolders.length) {
      await Promise.all(platformsWithoutFolders.map((id) => seedPlatformFolders(id)));
      folders = await supabaseRest<PlatformFolderWithResources[]>("platform_resource_folders", {
        query: folderQuery,
      });
    }
  }

  const folderIds = folders.map((folder) => folder.id);
  let resources: PlatformResource[] = [];

  if (folderIds.length) {
    const resourceQuery = new URLSearchParams({
      select: "*",
      is_active: "eq.true",
      order: "sort_order.asc,title.asc",
      folder_id: restIn(folderIds),
    });
    resources = await supabaseRest<PlatformResource[]>("platform_resources", {
      query: resourceQuery,
    });
  }

  const resourcesByFolder = new Map<string, PlatformResource[]>();
  for (const resource of resources) {
    resourcesByFolder.set(resource.folder_id, [
      ...(resourcesByFolder.get(resource.folder_id) ?? []),
      resource,
    ]);
  }

  const foldersByPlatform = new Map<string, PlatformFolderWithResources[]>();
  for (const folder of folders) {
    const folderWithResources = {
      ...folder,
      platform_resources: resourcesByFolder.get(folder.id) ?? [],
      resources: resourcesByFolder.get(folder.id) ?? [],
    };
    foldersByPlatform.set(folder.platform_id, [
      ...(foldersByPlatform.get(folder.platform_id) ?? []),
      folderWithResources,
    ]);
  }

  const accessQuery = new URLSearchParams({
    select: "*",
    order: "created_at.desc",
  });
  if (context.profile.role === "agent") {
    accessQuery.set("agent_id", `eq.${context.profile.id}`);
  }
  const platformAccess = await supabaseRest<AgentPlatformAccess[]>("agent_platform_access", {
    query: accessQuery,
  });

  return {
    partnerPlatforms: normalizePartnerPlatforms(
      platforms.map((platform) => ({
        ...platform,
        platform_resource_folders: foldersByPlatform.get(platform.id) ?? [],
      })),
      context,
      platformAccess
    ),
    platformAccess,
  };
}

export async function seedPlatformFolders(platformId: string) {
  return supabaseRest<PlatformResourceFolder[]>("platform_resource_folders", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    query: new URLSearchParams({ on_conflict: "platform_id,folder_key" }),
    body: STANDARD_PLATFORM_FOLDERS.map((folder) => ({
      ...folder,
      is_active: true,
      platform_id: platformId,
      updated_at: new Date().toISOString(),
    })),
  });
}

export function assertPartnerLibraryAvailable(error: unknown): never {
  if (
    error instanceof PortalApiError &&
    /agent_platform_access|platform_resource_folders|platform_resources|platform_updates|portal_deals|schema cache|column/i.test(
      error.message
    )
  ) {
    throw new PortalApiError(
      "The partner portal library migration has not been applied yet.",
      503
    );
  }

  throw error;
}

export function visibleDealQuery(context: PortalContext) {
  const query = new URLSearchParams({
    select: "*",
    order: "updated_at.desc,created_at.desc",
  });
  if (context.profile.role === "agent") query.set("agent_id", `eq.${context.profile.id}`);
  return query;
}

export function canEditDeal(context: PortalContext, deal: PortalDeal) {
  return context.profile.role === "admin" || deal.agent_id === context.profile.id;
}
