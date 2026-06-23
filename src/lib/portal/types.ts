export type PortalRole = "admin" | "agent";
export type NumericValue = number | string | null;

export type AgentProfile = {
  auth_user_id: string | null;
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
  created_at: string;
  id: string;
  is_active: boolean;
  name: string;
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
  agent_profit: NumericValue;
  created_at: string;
  created_by: string | null;
  equipment_cost: NumericValue;
  greenhub_net_profit: NumericValue;
  id: string;
  merchant_account_id: string;
  monthly_sales_volume: NumericValue;
  one_time_fees: NumericValue;
  platform_id: string | null;
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
  platforms: Platform[];
  profile: AgentProfile;
  residuals: MonthlyResidual[];
};
