export type PortalRole = "admin" | "agent";
export type NumericValue = number | string | null;

export type AgentProfile = {
  auth_user_id: string | null;
  commission_notes?: string | null;
  commission_rate: NumericValue;
  created_at: string;
  email: string;
  id: string;
  name: string;
  role: PortalRole;
  status: "active" | "inactive";
  updated_at: string;
};

export type Platform = {
  category?: string | null;
  created_at: string;
  description?: string | null;
  id: string;
  is_active: boolean;
  last_updated_at?: string | null;
  name: string;
  portal_status?: "active" | "limited" | "restricted" | null;
  residual_type?: "cc" | "pob" | null;
  slug?: string | null;
  sort_order?: number | null;
  updated_at?: string | null;
};

export type PlatformCategory = {
  created_at: string;
  id: string;
  name: string;
  sort_order: number;
};

export type PlatformResourceFolder = {
  created_at: string;
  description: string | null;
  folder_key: string;
  id: string;
  is_active: boolean;
  name: string;
  platform_id: string;
  sort_order: number;
  updated_at: string;
};

export type PlatformResource = {
  created_at: string;
  created_by: string | null;
  description: string | null;
  external_url: string | null;
  file_name: string | null;
  file_size: number | null;
  folder_id: string;
  id: string;
  is_active: boolean;
  platform_id: string;
  resource_type: "document" | "link" | "note";
  sort_order: number;
  storage_bucket: string | null;
  storage_path: string | null;
  title: string;
  updated_at: string;
  updated_by: string | null;
};

export type PlatformFolderWithResources = PlatformResourceFolder & {
  platform_resources?: PlatformResource[];
  resources: PlatformResource[];
};

export type PartnerPlatformRecord = Platform & {
  folders: PlatformFolderWithResources[];
  platform_resource_folders?: PlatformFolderWithResources[];
  resource_count: number;
};

export type AgentPlatformAccess = {
  agent_id: string;
  can_view: boolean;
  created_at: string;
  created_by: string | null;
  folder_id: string;
  id: string;
  platform_id: string;
  updated_at: string;
  updated_by: string | null;
};

export type PlatformUpdate = {
  audience: "all" | "admin" | "agent";
  created_at: string;
  created_by: string | null;
  id: string;
  message: string;
  platform_id: string | null;
  published_at: string | null;
  title: string;
};

export type PortalDealStage =
  | "new_lead"
  | "contacted"
  | "application_sent"
  | "submitted"
  | "approved"
  | "declined";

export type PortalDeal = {
  agent_id: string;
  contact_email: string | null;
  contact_name: string | null;
  created_at: string;
  created_by: string | null;
  estimated_volume: NumericValue;
  id: string;
  last_activity: string | null;
  merchant_application_id: string | null;
  merchant_name: string;
  next_follow_up: string | null;
  notes: string | null;
  platform_id: string | null;
  priority: "standard" | "high" | "escalated";
  salesforce_status: string | null;
  stage: PortalDealStage;
  updated_at: string;
  updated_by: string | null;
};

export type MerchantAccount = {
  account_name: string;
  assigned_agent_id: string | null;
  commission_structure: string | null;
  created_at: string;
  created_by: string | null;
  id: string;
  internal_notes: string | null;
  merchant_application_id: string | null;
  platform_id: string | null;
  status: "active" | "paused" | "closed";
  updated_at: string;
  updated_by: string | null;
};

export type MonthlyResidual = {
  agent_id: string;
  agent_commission_structure?: string | null;
  agent_profit: NumericValue;
  created_at: string;
  created_by: string | null;
  equipment_cost: NumericValue;
  greenhub_net_profit: NumericValue;
  greenhub_pob_buy_rate?: NumericValue;
  greenhub_pob_net_profit?: NumericValue;
  greenhub_pob_profit_per_transaction?: NumericValue;
  id: string;
  merchant_notes?: string | null;
  merchant_account_id: string;
  monthly_sales_volume: NumericValue;
  one_time_fees: NumericValue;
  platform_id: string | null;
  pos_integration_fee?: NumericValue;
  profit_per_transaction: NumericValue;
  rebate: NumericValue;
  residual_month: number;
  residual_status: "draft" | "finalized";
  residual_year: number;
  surcharge: NumericValue;
  transactions_per_month: NumericValue;
  updated_at: string;
  updated_by: string | null;
};

export type ResidualNotification = {
  agent_id: string;
  created_at: string;
  id: string;
  message: string | null;
  notification_sent: boolean;
  notification_sent_at: string | null;
  notification_type: string;
  read_at: string | null;
  residual_id: string | null;
  residual_month: number;
  residual_year: number;
  title: string | null;
  triggered_by: string | null;
};

export type AgentMonthlySummary = {
  agent_id: string;
  agent_name: string;
  residual_month: number;
  residual_year: number;
  total_equipment_cost: NumericValue;
  total_monthly_residual: NumericValue;
  total_net_profit: NumericValue;
  total_volume: NumericValue;
};

export type AgentLifetimeSummary = {
  agent_id: string;
  agent_name: string;
  lifetime_equipment_cost: NumericValue;
  lifetime_net_profit: NumericValue;
  lifetime_residual_earned: NumericValue;
  lifetime_volume: NumericValue;
};

export type PortalBootstrap = {
  accounts: MerchantAccount[];
  agents: AgentProfile[];
  lifetimeSummary: AgentLifetimeSummary | null;
  monthlySummaries: AgentMonthlySummary[];
  notifications: ResidualNotification[];
  partnerPlatforms: PartnerPlatformRecord[];
  platformAccess: AgentPlatformAccess[];
  platformCategories: PlatformCategory[];
  platformUpdates: PlatformUpdate[];
  platforms: Platform[];
  profile: AgentProfile;
  portalDeals: PortalDeal[];
  residuals: MonthlyResidual[];
};
