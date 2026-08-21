import {
  BookOpen,
  ClipboardList,
  FileText,
  Megaphone,
  PhoneCall,
  type LucideIcon,
} from "lucide-react";

export type PlatformStatus = "Active" | "Limited" | "Restricted" | "Hidden";

export type PlatformFolderKey =
  | "application"
  | "contacts"
  | "documents"
  | "how-to-submit"
  | "marketing-material"
  | "program-details"
  | "schedule-a";

export type PartnerPlatformFolder = {
  icon: LucideIcon;
  key: PlatformFolderKey;
  name: string;
  summary: string;
  items: string[];
};

export type PartnerPlatform = {
  category: string;
  description: string;
  folders: PartnerPlatformFolder[];
  lastUpdated: string;
  name: string;
  slug: string;
  status: PlatformStatus;
  tags: string[];
};

export type CrmStage =
  | "New Lead"
  | "Contacted"
  | "Application Sent"
  | "Submitted"
  | "Approved"
  | "Declined";

export type CrmDeal = {
  agent: string;
  contact: string;
  email: string;
  estimatedVolume: number;
  lastActivity: string;
  merchant: string;
  nextFollowUp: string;
  platform: string;
  stage: CrmStage;
};

export const standardFolders: PartnerPlatformFolder[] = [
  {
    key: "application",
    name: "Application",
    summary: "Application packets and required merchant intake materials.",
    icon: ClipboardList,
    items: ["Merchant application packet", "Required signer information", "Pre-submit checklist"],
  },
  {
    key: "contacts",
    name: "Contacts",
    summary: "Underwriting, boarding, and escalation contacts for this platform.",
    icon: PhoneCall,
    items: ["Underwriting contact", "Boarding support", "Escalation contact"],
  },
  {
    key: "documents",
    name: "Documents",
    summary: "Program PDFs, risk files, pricing sheets, and partner documents.",
    icon: FileText,
    items: ["Program overview PDF", "Risk matrix", "Pricing sheet"],
  },
  {
    key: "how-to-submit",
    name: "How to Submit",
    summary: "Step-by-step submission guidance and approval expectations.",
    icon: BookOpen,
    items: ["Required documents", "Industry restrictions", "Approval timeline", "Auto-decline rules"],
  },
  {
    key: "marketing-material",
    name: "Marketing Material",
    summary: "Agent-facing sales assets and approved merchant positioning.",
    icon: Megaphone,
    items: ["Merchant one-sheet", "Agent talking points", "Approved email copy"],
  },
  {
    key: "program-details",
    name: "Program Details",
    summary: "Rules, risk notes, supported industries, and operational policies.",
    icon: BookOpen,
    items: ["Supported verticals", "Program notes", "Compliance reminders"],
  },
  {
    key: "schedule-a",
    name: "Schedule A",
    summary: "Schedule A files and agreement addenda used during boarding.",
    icon: FileText,
    items: ["Schedule A template", "Pricing addendum", "Signature instructions"],
  },
];

function folders(overrides: Partial<Record<PlatformFolderKey, string[]>> = {}) {
  return standardFolders.map((folder) => ({
    ...folder,
    items: overrides[folder.key] ?? folder.items,
  }));
}

export const partnerPlatforms: PartnerPlatform[] = [
  {
    name: "Greenway - PPS",
    slug: "greenway-pps",
    category: "Cashless / Debit",
    status: "Active",
    lastUpdated: "Jul 12, 2026",
    description: "Cashless processing program with PPS submission docs and boarding support.",
    tags: ["Cashless", "Debit", "PPS"],
    folders: folders({
      documents: ["PPS program overview", "Merchant risk matrix", "Greenway boarding packet"],
      "how-to-submit": ["Collect merchant docs", "Upload application packet", "Send to PPS boarding queue"],
    }),
  },
  {
    name: "Linked2Pay - Avidia",
    slug: "linked2pay-avida",
    category: "ACH / Alt Pay",
    status: "Active",
    lastUpdated: "Jul 9, 2026",
    description: "ACH and alternative payment program for qualified merchants.",
    tags: ["ACH", "Avidia", "Alt Pay"],
    folders: folders({
      documents: ["ACH overview deck", "Risk review checklist", "Pricing sheet"],
      contacts: ["ACH underwriting", "Avidia boarding", "Linked2Pay escalation desk"],
    }),
  },
  {
    name: "Paynex",
    slug: "paynex",
    category: "High Risk",
    status: "Active",
    lastUpdated: "Jul 10, 2026",
    description: "High-risk placement option with current Paynex program notes and support contacts.",
    tags: ["High Risk", "Card Not Present", "Paynex"],
    folders: folders({
      application: ["Paynex application", "Merchant document checklist", "Beneficial owner requirements"],
      "program-details": ["Restricted MCC notes", "Gateway compatibility", "Reserve expectations"],
    }),
  },
  {
    name: "EllaCash",
    slug: "ellacash",
    category: "Cashless / Debit",
    status: "Active",
    lastUpdated: "Jul 8, 2026",
    description: "Cash discount and debit-focused program for retail merchant opportunities.",
    tags: ["Cashless", "Retail", "Debit"],
    folders: folders({
      "program-details": ["Live merchant examples", "Supported terminal notes", "Risk criteria"],
    }),
  },
  {
    name: "Best Rate - Nuvei",
    slug: "best-rate-nuvei",
    category: "Best Rate",
    status: "Limited",
    lastUpdated: "Jun 28, 2026",
    description: "Best Rate placement option for qualified merchants requiring Nuvei support.",
    tags: ["Best Rate", "Nuvei"],
    folders: folders(),
  },
  {
    name: "Best Rate - Paya",
    slug: "best-rate-paya",
    category: "Best Rate",
    status: "Active",
    lastUpdated: "Jun 30, 2026",
    description: "Paya-backed Best Rate placement with standard Schedule A package.",
    tags: ["Best Rate", "Paya"],
    folders: folders(),
  },
  {
    name: "ElitePay - Adyen",
    slug: "elitepay-adyen",
    category: "ElitePay",
    status: "Active",
    lastUpdated: "Jul 2, 2026",
    description: "ElitePay Adyen program package for agents submitting qualified merchants.",
    tags: ["ElitePay", "Adyen"],
    folders: folders(),
  },
  {
    name: "ElitePay - AUX",
    slug: "elitepay-aux",
    category: "ElitePay",
    status: "Active",
    lastUpdated: "Jul 1, 2026",
    description: "ElitePay AUX program resources and submission packet.",
    tags: ["ElitePay", "AUX"],
    folders: folders(),
  },
  {
    name: "Paybotx - Fiserv",
    slug: "paybotx-fiserv",
    category: "Paybotx",
    status: "Active",
    lastUpdated: "Jun 27, 2026",
    description: "Paybotx Fiserv processing program with current boarding files.",
    tags: ["Paybotx", "Fiserv"],
    folders: folders(),
  },
  {
    name: "Valmar - CB Cal",
    slug: "valmar-cb-cal",
    category: "Valmar",
    status: "Restricted",
    lastUpdated: "Jun 18, 2026",
    description: "Restricted Valmar placement with approval required before submission.",
    tags: ["Valmar", "Restricted"],
    folders: folders(),
  },
];

export const platformCategories = [
  "All categories",
  "Best Rate",
  "ElitePay",
  "Cashless / Debit",
  "ACH / Alt Pay",
  "High Risk",
  "Paybotx",
  "Valmar",
];

export const crmStages: CrmStage[] = [
  "New Lead",
  "Contacted",
  "Application Sent",
  "Submitted",
  "Approved",
  "Declined",
];

export const crmDeals: CrmDeal[] = [
  {
    merchant: "Ivy Dispensary",
    contact: "Maya Collins",
    email: "maya@ivydispensary.com",
    platform: "EllaCash",
    stage: "Submitted",
    agent: "Nicholas Sanchez",
    estimatedVolume: 142000,
    lastActivity: "Docs uploaded today",
    nextFollowUp: "Today, 4:00 PM",
  },
  {
    merchant: "Beacon of Hope",
    contact: "Andre Miller",
    email: "andre@beaconhope.org",
    platform: "Best Rate - Paya",
    stage: "Approved",
    agent: "Nicholas Sanchez",
    estimatedVolume: 75800,
    lastActivity: "Approval notice received",
    nextFollowUp: "Tomorrow",
  },
  {
    merchant: "Cussins Cannabis",
    contact: "Rachel Nguyen",
    email: "rachel@cussins.example",
    platform: "Paynex",
    stage: "Application Sent",
    agent: "Rob Sinn",
    estimatedVolume: 98000,
    lastActivity: "Application packet sent",
    nextFollowUp: "Jul 17, 10:00 AM",
  },
  {
    merchant: "Woodstock Market",
    contact: "Sam Patel",
    email: "sam@woodstock.example",
    platform: "Paybotx - SSB",
    stage: "Contacted",
    agent: "Mark Suchy",
    estimatedVolume: 12600,
    lastActivity: "Discovery call complete",
    nextFollowUp: "Jul 18",
  },
  {
    merchant: "Diem Lynn",
    contact: "Elaine Carter",
    email: "elaine@diemlynn.example",
    platform: "EllaCash",
    stage: "New Lead",
    agent: "Nicholas Sanchez",
    estimatedVolume: 54000,
    lastActivity: "Imported from referral list",
    nextFollowUp: "Today",
  },
  {
    merchant: "Mass Vet Clinic",
    contact: "Dr. Olivia Grant",
    email: "olivia@massvet.example",
    platform: "Paybotx - T1",
    stage: "Submitted",
    agent: "Nicholas Sanchez",
    estimatedVolume: 169900,
    lastActivity: "Underwriting review",
    nextFollowUp: "Jul 19",
  },
];

export const supportContacts = [
  {
    team: "Processing Support",
    name: "GreenHub Operations",
    detail: "ops@greenhubinc.com",
    note: "General account, platform, and boarding questions.",
  },
  {
    team: "Emergency Escalations",
    name: "Underwriting Desk",
    detail: "escalations@greenhubinc.com",
    note: "Use when a merchant is blocked, time-sensitive, or at risk.",
  },
  {
    team: "Partner Portal Help",
    name: "Portal Support",
    detail: "support@greenhubinc.com",
    note: "Login, document access, and platform folder visibility.",
  },
];

export const platformUpdates = [
  {
    title: "Greenway PPS folder added",
    date: "Jul 16, 2026",
    body: "Initial PPS documents, buy-rate notes, and submission instructions are available to approved agents.",
  },
  {
    title: "Paynex submission notes refreshed",
    date: "Jul 12, 2026",
    body: "High-risk underwriting expectations and escalation contacts were updated.",
  },
  {
    title: "Linked2Pay ACH checklist live",
    date: "Jul 9, 2026",
    body: "Agents can now review required ACH documents before submitting a merchant.",
  },
];

export function folderIconForKey(folderKey: string) {
  return standardFolders.find((folder) => folder.key === folderKey)?.icon ?? FileText;
}

export function folderSummaryForKey(folderKey: string, fallback?: string | null) {
  return (
    fallback ||
    standardFolders.find((folder) => folder.key === folderKey)?.summary ||
    "Platform resource folder."
  );
}

export function displayPortalStatus(status?: string | null) {
  if (status === "hidden" || status === "Hidden") return "Hidden";
  if (status === "limited" || status === "Limited") return "Limited";
  if (status === "restricted" || status === "Restricted") return "Restricted";
  return "Active";
}

export function statusClassName(status?: string | null) {
  const display = displayPortalStatus(status);
  if (display === "Active") return "bg-emerald-100 text-emerald-900";
  if (display === "Limited") return "bg-amber-100 text-amber-900";
  if (display === "Hidden") return "bg-slate-200 text-slate-800";
  return "bg-rose-100 text-rose-800";
}
