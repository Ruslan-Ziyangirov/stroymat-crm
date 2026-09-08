import type {
  BonusType,
  ClientStatus,
  ClientType,
  OrderStatus,
  UserRole,
} from "@/lib/types";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Новый",
  confirmed: "Подтверждён",
  paid: "Оплачен",
  shipping: "В доставке",
  completed: "Завершён",
  cancelled: "Отменён",
};

/** Классы бейджа для статуса заказа. */
export const ORDER_STATUS_STYLES: Record<OrderStatus, string> = {
  new: "bg-muted text-foreground border-border",
  confirmed: "bg-sky-50 text-sky-700 border-sky-200",
  paid: "bg-amber-50 text-amber-700 border-amber-200",
  shipping: "bg-violet-50 text-violet-700 border-violet-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};

export const ORDER_STATUSES = Object.keys(ORDER_STATUS_LABELS) as OrderStatus[];

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  lead: "Лид",
  active: "Активный",
  inactive: "Неактивный",
};

export const CLIENT_STATUS_STYLES: Record<ClientStatus, string> = {
  lead: "bg-amber-50 text-amber-700 border-amber-200",
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  inactive: "bg-muted text-muted-foreground border-border",
};

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
