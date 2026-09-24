export type UserRole = "admin" | "director" | "manager";
export type ClientType = "individual" | "company";
export type DealStage =
  | "new"
  | "contacted"
  | "proposal_sent"
  | "meeting_scheduled"
  | "won"
  | "conditional_rejection"
  | "closed_lost";
export type DealPriority = "A" | "B" | "C";
export type DealUrgency = "high" | "medium" | "low";
export type DealType = "new" | "repeat";
export type DealTaskType = "call" | "meeting" | "email" | "message" | "other";
export type DealTaskStatus = "open" | "done" | "cancelled";
export type EventType =
  | "note"
  | "call"
  | "meeting"
  | "order_created"
  | "status_changed"
  | "bonus"
  | "sync";
export type BonusType = "accrual" | "redeem" | "manual" | "sync_1c";
export type UploadStatus = "uploaded" | "parsed" | "failed";

export interface Store {
  id: string;
  name: string;
  code: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  store_id: string | null;
  is_active: boolean;
  created_at: string;
  store?: Pick<Store, "id" | "name"> | null;
}

export interface Product {
  id: string;
  sku: string | null;
  name: string;
  category: string | null;
  unit: string;
  price: number;
  is_active: boolean;
  external_1c_id: string | null;
  created_at: string;
}

export interface Client {
  id: string;
  name: string;
  type: ClientType;
  inn: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  source: string | null;
  note: string | null;
  store_id: string | null;
  manager_id: string | null;
  bonus_balance: number;
  discount_percent: number;
  external_1c_id: string | null;
  created_at: string;
  updated_at: string;
  manager?: Pick<Profile, "id" | "full_name"> | null;
  store?: Pick<Store, "id" | "name"> | null;
}

export interface DealTask {
  id: string;
  order_id: string;
  assignee_id: string | null;
  type: DealTaskType;
  due_at: string;
  comment: string;
  status: DealTaskStatus;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  assignee?: Pick<Profile, "id" | "full_name"> | null;
}

export interface PipelineSettings {
  id: boolean;
  manager_active_deal_limit: number;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  name: string;
  unit: string;
  quantity: number;
  price: number;
  amount: number;
  position: number;
}

export interface Order {
  id: string;
  number: string;
  client_id: string;
  manager_id: string | null;
  store_id: string | null;
  stage: DealStage;
  stage_changed_at: string;
  budget: number | null;
  priority: DealPriority | null;
  product_interest: string | null;
  urgency: DealUrgency | null;
  deal_type: DealType | null;
  proposal_amount: number | null;
  meeting_at: string | null;
  rejection_reason: string | null;
  rejection_comment: string | null;
  items_total: number;
  discount_percent: number;
  bonus_used: number;
  bonus_earned: number;
  total: number;
  delivery_address: string | null;
  delivery_date: string | null;
  comment: string | null;
  external_1c_id: string | null;
  created_at: string;
  updated_at: string;
  client?: Pick<Client, "id" | "name" | "phone" | "bonus_balance"> | null;
  manager?: Pick<Profile, "id" | "full_name"> | null;
  store?: Pick<Store, "id" | "name"> | null;
  items?: OrderItem[];
}

export interface ClientEvent {
  id: string;
  client_id: string;
  order_id: string | null;
  type: EventType;
  title: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  author?: Pick<Profile, "id" | "full_name"> | null;
}

export interface BonusTransaction {
  id: string;
  client_id: string;
  order_id: string | null;
  type: BonusType;
  points: number;
  comment: string | null;
  created_by: string | null;
  created_at: string;
  client?: Pick<Client, "id" | "name"> | null;
}

export interface ReportUpload {
  id: string;
  file_name: string;
  file_path: string | null;
  store_id: string | null;
  period_start: string | null;
  period_end: string | null;
  status: UploadStatus;
  rows_count: number;
  total_amount: number;
  summary: UploadSummary;
  error: string | null;
  uploaded_by: string | null;
  created_at: string;
  store?: Pick<Store, "id" | "name"> | null;
}

export interface UploadSummary {
  columns?: string[];
  months?: { month: string; amount: number; rows: number }[];
  topProducts?: { name: string; amount: number; quantity: number }[];
  topClients?: { name: string; amount: number }[];
  insights?: string[];
}

export interface ReportRow {
  id: string;
  upload_id: string;
  store_id: string | null;
  doc_date: string | null;
  period_month: string | null;
  client_name: string | null;
  order_number: string | null;
  product_name: string | null;
  category: string | null;
  quantity: number | null;
  amount: number | null;
  raw: Record<string, unknown>;
}

export interface DistrictInputs {
  competitors: number;
  competitorStrength: number;
  priceLevel: number;
  residentialUnits: number;
  newConstructions: number;
  infrastructure: number;
  demand: number;
  prospects: number;
  rentCost: number;
  logistics: number;
  comment?: string;
}

export interface DistrictScores {
  competition: number;
  pricing: number;
  housing: number;
  construction: number;
  infrastructure: number;
  demand: number;
  prospects: number;
  economics: number;
}

export interface DistrictAnalysis {
  id: string;
  name: string;
  city: string | null;
  inputs: DistrictInputs;
  scores: DistrictScores;
  total_score: number;
  verdict: string | null;
  recommendation: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface IntegrationSettings {
  id: boolean;
  is_enabled: boolean;
  base_url: string | null;
  username: string | null;
  sync_clients: boolean;
  sync_orders: boolean;
  sync_bonuses: boolean;
  last_sync_at: string | null;
  updated_at: string;
}

export interface SyncLogEntry {
  id: string;
  direction: "in" | "out";
  entity: string;
  status: "ok" | "error";
  message: string | null;
  payload: unknown;
  created_at: string;
}

export interface MonthlyPlan {
  id: string;
  /** Первое число месяца, YYYY-MM-DD. */
  month: string;
  /** null — план по компании целиком. */
  store_id: string | null;
  target_amount: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  store?: Pick<Store, "id" | "name"> | null;
}

export type FinanceUploadKind = "cash_flow_51" | "financial_statement";

export interface FinanceUploadSummary {
  openingBalance?: number | null;
  closingBalance?: number | null;
  turnoverDebit?: number | null;
  turnoverCredit?: number | null;
  turnoverMismatch?: boolean;
  orgName?: string | null;
  inn?: string | null;
}

export interface FinanceUpload {
  id: string;
  kind: FinanceUploadKind;
  file_name: string;
  file_path: string | null;
  period_month: string | null;
  period_year: number | null;
  status: UploadStatus;
  rows_count: number;
  summary: FinanceUploadSummary;
  error: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface FinanceCashFlowRow {
  id: string;
  upload_id: string;
  period_month: string;
  corr_account: string | null;
  debit: number | null;
  credit: number | null;
  comment: string | null;
  raw: Record<string, unknown>;
}

export interface FinanceStatementLine {
  id: string;
  upload_id: string;
  period_year: number;
  statement_type: "balance" | "income";
  code: string;
  label: string;
  value: number | null;
  position: number;
}

export interface MonthlyStat {
  month: string;
  store_id: string | null;
  orders_count: number;
  completed_count: number;
  clients_count: number;
  total_amount: number;
  avg_check: number;
}
