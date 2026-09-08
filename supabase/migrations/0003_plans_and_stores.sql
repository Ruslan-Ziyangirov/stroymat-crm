-- =====================================================================
-- Реальные филиалы + план продаж (общий и по филиалам)
-- =====================================================================

-- Переименование демо-магазинов в реальные филиалы
update public.stores set name = 'СТРОЙМАТ Сыктывкар',  city = 'Сыктывкар'   where code = 'ST-01';
update public.stores set name = 'СТРОЙМАТ Помоздино',  city = 'Помоздино'  where code = 'ST-02';
update public.stores set name = 'СТРОЙМАТ Усть-Кулом', city = 'Усть-Кулом' where code = 'ST-03';

insert into public.stores (name, code, city, is_active)
values ('СТРОЙМАТ Корткерос', 'ST-04', 'Корткерос', true)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- Планы продаж: общий по компании (store_id = null) и по филиалам
-- ---------------------------------------------------------------------
create table if not exists public.monthly_plans (
  id            uuid primary key default gen_random_uuid(),
  month         date not null,
  store_id      uuid references public.stores(id) on delete cascade,
  target_amount numeric(14,2) not null default 0,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Один план на филиал в месяц. Уникальность общего плана компании
-- (store_id is null) на месяц контролируется в серверном экшене upsertPlan.
create unique index if not exists monthly_plans_store_month_uidx
  on public.monthly_plans (store_id, month) where store_id is not null;

create index if not exists monthly_plans_month_idx on public.monthly_plans(month);

alter table public.monthly_plans enable row level security;

drop policy if exists monthly_plans_read on public.monthly_plans;
create policy monthly_plans_read on public.monthly_plans for select to authenticated using (true);

drop policy if exists monthly_plans_write on public.monthly_plans;
create policy monthly_plans_write on public.monthly_plans for all to authenticated
  using (public.is_privileged()) with check (public.is_privileged());
