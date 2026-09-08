import {
  BarChart3,
  Boxes,
  Building2,
  FileSpreadsheet,
  Gift,
  LayoutDashboard,
  MapPinned,
  Plug,
  ShoppingCart,
  Target,
  Users,
  UsersRound,
} from "lucide-react";
import type { UserRole } from "@/lib/types";

export interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: UserRole[];
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Работа с клиентами",
    items: [
      { href: "/dashboard", label: "Дашборд", icon: LayoutDashboard },
      { href: "/clients", label: "Клиенты", icon: Users },
      { href: "/orders", label: "Заказы", icon: ShoppingCart },
      { href: "/bonuses", label: "Бонусы", icon: Gift },
    ],
  },
  {
    title: "Аналитика",
    items: [
      {
        href: "/reports",
        label: "Отчётность",
        icon: BarChart3,
        roles: ["admin", "director"],
      },
      {
        href: "/uploads",
        label: "Загрузка отчётов",
        icon: FileSpreadsheet,
        roles: ["admin", "director"],
      },
      {
        href: "/districts",
        label: "Анализ районов",
        icon: MapPinned,
        roles: ["admin", "director"],
      },
      {
        href: "/plans",
        label: "Планы продаж",
        icon: Target,
        roles: ["admin", "director"],
      },
    ],
  },
  {
    title: "Настройки",
    items: [
      { href: "/products", label: "Номенклатура", icon: Boxes },
      {
        href: "/stores",
        label: "Магазины",
        icon: Building2,
        roles: ["admin", "director"],
      },
      {
        href: "/users",
        label: "Пользователи",
        icon: UsersRound,
        roles: ["admin", "director"],
      },
      {
        href: "/integration",
        label: "Интеграция 1С",
        icon: Plug,
        roles: ["admin", "director"],
      },
    ],
  },
];

export function visibleGroups(role: UserRole): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.roles || item.roles.includes(role)),
  })).filter((group) => group.items.length > 0);
}
