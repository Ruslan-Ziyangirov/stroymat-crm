import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .max(500)
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : undefined));

export const loginSchema = z.object({
  email: z.string().email("Укажите корректный e-mail"),
  password: z.string().min(6, "Минимум 6 символов"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const clientSchema = z.object({
  name: z.string().trim().min(2, "Укажите название или ФИО"),
  type: z.enum(["individual", "company"]),
  status: z.enum(["lead", "active", "inactive"]),
  inn: optionalText,
  phone: optionalText,
  email: z
    .string()
    .trim()
    .email("Некорректный e-mail")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  address: optionalText,
  source: optionalText,
  note: optionalText,
  store_id: z.string().uuid().optional().or(z.literal("")).transform((v) => (v ? v : undefined)),
  manager_id: z.string().uuid().optional().or(z.literal("")).transform((v) => (v ? v : undefined)),
  discount_percent: z.coerce.number().min(0).max(50).default(0),
});
export type ClientInput = z.output<typeof clientSchema>;
export type ClientFormValues = z.input<typeof clientSchema>;

export const orderItemSchema = z.object({
  product_id: z.string().uuid().optional().or(z.literal("")).transform((v) => (v ? v : undefined)),
  name: z.string().trim().min(1, "Укажите наименование"),
  unit: z.string().trim().min(1).default("шт"),
  quantity: z.coerce.number().positive("Количество должно быть больше 0"),
  price: z.coerce.number().min(0, "Цена не может быть отрицательной"),
});
export type OrderItemInput = z.output<typeof orderItemSchema>;
export type OrderItemFormValues = z.input<typeof orderItemSchema>;

export const orderSchema = z.object({
  client_id: z.string().uuid("Выберите клиента"),
  manager_id: z.string().uuid().optional().or(z.literal("")).transform((v) => (v ? v : undefined)),
  store_id: z.string().uuid().optional().or(z.literal("")).transform((v) => (v ? v : undefined)),
  status: z.enum(["new", "confirmed", "paid", "shipping", "completed", "cancelled"]),
  discount_percent: z.coerce.number().min(0).max(50).default(0),
  bonus_used: z.coerce.number().min(0).default(0),
  delivery_address: optionalText,
  delivery_date: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  comment: optionalText,
  items: z.array(orderItemSchema).min(1, "Добавьте хотя бы одну позицию"),
});
export type OrderInput = z.output<typeof orderSchema>;
export type OrderFormValues = z.input<typeof orderSchema>;

export const clientEventSchema = z.object({
  client_id: z.string().uuid(),
  type: z.enum(["note", "call", "meeting", "bonus"]),
  title: z.string().trim().min(2, "Укажите тему"),
  description: optionalText,
});
export type ClientEventInput = z.output<typeof clientEventSchema>;
export type ClientEventFormValues = z.input<typeof clientEventSchema>;

export const bonusSchema = z.object({
  client_id: z.string().uuid(),
  type: z.enum(["accrual", "redeem", "manual"]),
  points: z.coerce.number().positive("Укажите количество баллов"),
  comment: optionalText,
});
export type BonusInput = z.output<typeof bonusSchema>;
export type BonusFormValues = z.input<typeof bonusSchema>;

export const storeSchema = z.object({
  name: z.string().trim().min(2, "Укажите название"),
  code: optionalText,
  city: optionalText,
  address: optionalText,
  phone: optionalText,
  is_active: z.coerce.boolean().default(true),
});
export type StoreInput = z.output<typeof storeSchema>;
export type StoreFormValues = z.input<typeof storeSchema>;

export const productSchema = z.object({
  name: z.string().trim().min(2, "Укажите наименование"),
  sku: optionalText,
  category: optionalText,
  unit: z.string().trim().min(1).default("шт"),
  price: z.coerce.number().min(0),
  is_active: z.coerce.boolean().default(true),
});
export type ProductInput = z.output<typeof productSchema>;
export type ProductFormValues = z.input<typeof productSchema>;

export const userSchema = z.object({
  email: z.string().email("Некорректный e-mail"),
  password: z.string().min(8, "Минимум 8 символов"),
  full_name: z.string().trim().min(2, "Укажите ФИО"),
  role: z.enum(["admin", "director", "manager"]),
  store_id: z.string().uuid().optional().or(z.literal("")).transform((v) => (v ? v : undefined)),
});
export type UserInput = z.output<typeof userSchema>;
export type UserFormValues = z.input<typeof userSchema>;

export const districtSchema = z.object({
  name: z.string().trim().min(2, "Укажите район"),
  city: optionalText,
  competitors: z.coerce.number().int().min(0).max(100),
  competitorStrength: z.coerce.number().int().min(1).max(5),
  priceLevel: z.coerce.number().int().min(1).max(5),
  residentialUnits: z.coerce.number().int().min(0),
  newConstructions: z.coerce.number().int().min(0),
  infrastructure: z.coerce.number().int().min(1).max(5),
  demand: z.coerce.number().int().min(1).max(5),
  prospects: z.coerce.number().int().min(1).max(5),
  rentCost: z.coerce.number().min(0),
  logistics: z.coerce.number().int().min(1).max(5),
  comment: optionalText,
});
export type DistrictInput = z.output<typeof districtSchema>;
export type DistrictFormValues = z.input<typeof districtSchema>;

export const planSchema = z.object({
  /** Первое число месяца, YYYY-MM-DD. */
  month: z.string().regex(/^\d{4}-\d{2}-01$/, "Некорректный месяц"),
  store_id: z.string().uuid().optional().or(z.literal("")).transform((v) => (v ? v : undefined)),
  target_amount: z.coerce.number().min(0, "Сумма не может быть отрицательной"),
});
export type PlanInput = z.output<typeof planSchema>;
export type PlanFormValues = z.input<typeof planSchema>;

export const integrationSchema = z.object({
  is_enabled: z.coerce.boolean().default(false),
  base_url: z
    .string()
    .trim()
    .url("Укажите корректный URL")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  username: optionalText,
  sync_clients: z.coerce.boolean().default(true),
  sync_orders: z.coerce.boolean().default(true),
  sync_bonuses: z.coerce.boolean().default(true),
});
export type IntegrationInput = z.output<typeof integrationSchema>;
export type IntegrationFormValues = z.input<typeof integrationSchema>;
