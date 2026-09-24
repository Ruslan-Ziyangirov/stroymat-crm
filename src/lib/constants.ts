import type {
  BonusType,
  ClientType,
  DealPriority,
  DealStage,
  DealTaskType,
  DealType,
  DealUrgency,
  UserRole,
} from "@/lib/types";

/** Этапы воронки продаж — порядок важен, это же порядок колонок канбана. */
export const DEAL_STAGE_ORDER: DealStage[] = [
  "new",
  "contacted",
  "proposal_sent",
  "meeting_scheduled",
  "won",
  "conditional_rejection",
  "closed_lost",
];

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  new: "Новый лид",
  contacted: "Первый контакт",
  proposal_sent: "КП отправлено",
  meeting_scheduled: "Встреча назначена",
  won: "Продажа",
  conditional_rejection: "Условный отказ",
  closed_lost: "Закрыто и не реализовано",
};

export const DEAL_STAGE_STYLES: Record<DealStage, string> = {
  new: "bg-muted text-foreground border-border",
  contacted: "bg-sky-50 text-sky-700 border-sky-200",
  proposal_sent: "bg-violet-50 text-violet-700 border-violet-200",
  meeting_scheduled: "bg-amber-50 text-amber-700 border-amber-200",
  won: "bg-emerald-50 text-emerald-700 border-emerald-200",
  conditional_rejection: "bg-orange-50 text-orange-700 border-orange-200",
  closed_lost: "bg-red-50 text-red-700 border-red-200",
};

/** Этапы, на которых сделка считается активной (учитывается в лимите менеджера). */
export const ACTIVE_DEAL_STAGES: DealStage[] = DEAL_STAGE_ORDER.filter(
  (s) => s !== "won" && s !== "closed_lost",
);

export const DEAL_TASK_TYPE_LABELS: Record<DealTaskType, string> = {
  call: "Звонок",
  meeting: "Встреча",
  email: "Письмо",
  message: "Сообщение",
  other: "Другое",
};

export const DEAL_PRIORITY_LABELS: Record<DealPriority, string> = {
  A: "A — высокий",
  B: "B — средний",
  C: "C — низкий",
};

export const DEAL_PRIORITY_STYLES: Record<DealPriority, string> = {
  A: "bg-red-50 text-red-700 border-red-200",
  B: "bg-amber-50 text-amber-700 border-amber-200",
  C: "bg-muted text-muted-foreground border-border",
};

export const DEAL_URGENCY_LABELS: Record<DealUrgency, string> = {
  high: "Высокая",
  medium: "Средняя",
  low: "Низкая",
};

export const DEAL_TYPE_LABELS: Record<DealType, string> = {
  new: "Первичная",
  repeat: "Повторная",
};

export const REJECTION_REASONS = [
  "Дорого / нет бюджета",
  "Выбрал конкурента",
  "Не актуально / нет потребности",
  "Не отвечает / пропал",
  "Другое",
];

export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  individual: "Физлицо",
  company: "Организация",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Администратор",
  director: "Руководитель",
  manager: "Менеджер",
};

export const BONUS_TYPE_LABELS: Record<BonusType, string> = {
  accrual: "Начисление",
  redeem: "Списание",
  manual: "Ручная корректировка",
  sync_1c: "Синхронизация 1С",
};

export const EVENT_TYPE_LABELS: Record<string, string> = {
  note: "Заметка",
  call: "Звонок",
  meeting: "Встреча",
  order_created: "Заказ создан",
  status_changed: "Смена статуса",
  bonus: "Бонусы",
  sync: "Синхронизация",
};

export const CLIENT_SOURCES = [
  "Сайт",
  "Витрина",
  "Рекомендация",
  "Холодный звонок",
  "Выставка",
  "Реклама",
  "Другое",
];

export const UNITS = ["шт", "м", "м2", "м3", "кг", "т", "меш", "уп", "лист", "пал"];

/** Фирменная палитра «СТРОЙМАТ» для графиков. */
export const BRAND = {
  orange: "#f0a11b",
  orangeSoft: "#f8c46a",
  gray: "#575756",
  graySoft: "#9a9a97",
  green: "#2f9e6f",
  red: "#d94a3d",
};

export const CHART_COLORS = [
  BRAND.orange,
  BRAND.gray,
  BRAND.orangeSoft,
  BRAND.graySoft,
  "#b97a06",
  "#7d7d7b",
];
