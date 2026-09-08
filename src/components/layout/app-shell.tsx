"use client";

import * as React from "react";
import Link from "next/link";
import { LogOut, Menu, Plus } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/layout/logo";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { visibleGroups } from "@/components/layout/nav";
import { ROLE_LABELS } from "@/lib/constants";
import { initials } from "@/lib/format";
import { signOut } from "@/lib/actions/auth";
import type { Profile } from "@/lib/types";

export function AppShell({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const groups = visibleGroups(profile.role);

  return (
    <div className="flex min-h-dvh">
      {/* Десктопная боковая панель */}
      <aside className="bg-sidebar text-sidebar-foreground hidden w-64 shrink-0 flex-col border-r border-(--sidebar-border) lg:flex">
        <div className="px-5 py-5">
          <Link href="/dashboard" aria-label="На дашборд">
            <Logo width={160} priority />
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-6">
          <SidebarNav groups={groups} />
        </div>
        <div className="border-t border-(--sidebar-border) px-5 py-3 text-[11px] opacity-50">
          CRM · внутренняя система
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-card sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-4 lg:px-6">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="size-5" />
                <span className="sr-only">Меню</span>
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="bg-sidebar text-sidebar-foreground w-72 border-(--sidebar-border) p-0"
            >
              <SheetTitle className="sr-only">Навигация</SheetTitle>
              <div className="px-5 py-5">
                <Logo width={150} />
              </div>
              <div className="overflow-y-auto px-3 pb-6">
                <SidebarNav groups={groups} onNavigate={() => setMobileOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>

          <Link href="/dashboard" className="lg:hidden" aria-label="На дашборд">
            <Logo width={124} />
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <Button asChild size="sm">
              <Link href="/orders/new">
                <Plus className="size-4" />
                <span className="hidden sm:inline">Новый заказ</span>
              </Link>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="hover:bg-muted flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors">
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
                      {initials(profile.full_name || profile.email || "?")}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden text-left text-sm leading-tight sm:block">
                    <span className="block font-medium">
                      {profile.full_name || profile.email}
                    </span>
                    <span className="text-muted-foreground block text-xs">
                      {ROLE_LABELS[profile.role]}
                    </span>
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <p className="text-sm font-medium">{profile.full_name}</p>
                  <p className="text-muted-foreground text-xs">{profile.email}</p>
                  {profile.store?.name && (
                    <p className="text-muted-foreground mt-1 text-xs">
                      {profile.store.name}
                    </p>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <form action={signOut}>
                  <DropdownMenuItem asChild>
                    <button type="submit" className="w-full">
                      <LogOut className="size-4" />
                      Выйти
                    </button>
                  </DropdownMenuItem>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
