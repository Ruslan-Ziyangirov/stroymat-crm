-- =====================================================================
-- CRM «СТРОЙМАТ» — базовая схема
-- Postgres / Supabase
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Перечисления
-- ---------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('admin', 'director', 'manager');
exception when duplicate_object then null; end $$;

do $$ begin
  create type client_type as enum ('individual', 'company');
exception when duplicate_object then null; end $$;

do $$ begin
  create type client_status as enum ('lead', 'active', 'inactive');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum ('new', 'confirmed', 'paid', 'shipping', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type event_type as enum ('note', 'call', 'meeting', 'order_created', 'status_changed', 'bonus', 'sync');
exception when duplicate_object then null; end $$;

do $$ begin
  create type bonus_type as enum ('accrual', 'redeem', 'manual', 'sync_1c');
exception when duplicate_object then null; end $$;

do $$ begin
  create type upload_status as enum ('uploaded', 'parsed', 'failed');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Магазины / точки продаж
-- ---------------------------------------------------------------------
create table if not exists public.stores (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  code        text unique,
  city        text,
  address     text,
  phone       text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Профили пользователей (роли)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  email       text,
  phone       text,
  role        user_role not null default 'manager',
  store_id    uuid references public.stores(id) on delete set null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles(role);

-- Автосоздание профиля при регистрации пользователя
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'manager')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Хелперы ролей (используются в RLS)
create or replace function public.current_role_name()
returns user_role
language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.is_privileged()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(public.current_role_name() in ('admin','director'), false) $$;

-- ---------------------------------------------------------------------
-- Номенклатура
-- ---------------------------------------------------------------------
create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  sku         text unique,
  name        text not null,
  category    text,
  unit        text not null default 'шт',
  price       numeric(14,2) not null default 0,
  is_active   boolean not null default true,
  external_1c_id text,
  created_at  timestamptz not null default now()
);

create index if not exists products_name_idx on public.products (lower(name));

-- ---------------------------------------------------------------------
-- Клиенты
-- ---------------------------------------------------------------------
create table if not exists public.clients (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  type           client_type not null default 'company',
  status         client_status not null default 'lead',
  inn            text,
  phone          text,
  email          text,
  address        text,
  source         text,
  note           text,
  store_id       uuid references public.stores(id) on delete set null,
  manager_id     uuid references public.profiles(id) on delete set null,
  bonus_balance  numeric(14,2) not null default 0,
  discount_percent numeric(5,2) not null default 0,
  external_1c_id text unique,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists clients_manager_idx on public.clients(manager_id);
create index if not exists clients_store_idx on public.clients(store_id);
create index if not exists clients_status_idx on public.clients(status);

-- ---------------------------------------------------------------------
-- Бонусная система (объявляется до заказов — на неё ссылается триггер)
-- ---------------------------------------------------------------------
create table if not exists public.bonus_transactions (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  order_id   uuid,
  type       bonus_type not null default 'manual',
  points     numeric(14,2) not null default 0,
  comment    text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists bonus_client_idx on public.bonus_transactions(client_id, created_at desc);

create or replace function public.trg_bonus_balance()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.clients
       set bonus_balance = bonus_balance + case when new.type = 'redeem' then -abs(new.points) else new.points end,
           updated_at = now()
     where id = new.client_id;
  elsif tg_op = 'DELETE' then
    update public.clients
       set bonus_balance = bonus_balance - case when old.type = 'redeem' then -abs(old.points) else old.points end
     where id = old.client_id;
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists bonus_balance_sync on public.bonus_transactions;
create trigger bonus_balance_sync
  after insert or delete on public.bonus_transactions
  for each row execute function public.trg_bonus_balance();

-- ---------------------------------------------------------------------
-- Заказы
-- ---------------------------------------------------------------------
create sequence if not exists public.order_number_seq start 1000;

create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  number           text not null unique default ('ЗК-' || nextval('public.order_number_seq')::text),
  client_id        uuid not null references public.clients(id) on delete restrict,
  manager_id       uuid references public.profiles(id) on delete set null,
  store_id         uuid references public.stores(id) on delete set null,
  status           order_status not null default 'new',
  items_total      numeric(14,2) not null default 0,
  discount_percent numeric(5,2) not null default 0,
  bonus_used       numeric(14,2) not null default 0,
  bonus_earned     numeric(14,2) not null default 0,
  total            numeric(14,2) not null default 0,
  delivery_address text,
  delivery_date    date,
  comment          text,
  external_1c_id   text unique,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.bonus_transactions
  drop constraint if exists bonus_transactions_order_id_fkey;
alter table public.bonus_transactions
  add constraint bonus_transactions_order_id_fkey
  foreign key (order_id) references public.orders(id) on delete set null;

create index if not exists orders_client_idx on public.orders(client_id);
create index if not exists orders_manager_idx on public.orders(manager_id);
create index if not exists orders_store_idx on public.orders(store_id);
create index if not exists orders_created_idx on public.orders(created_at);
create index if not exists orders_status_idx on public.orders(status);

create table if not exists public.order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name       text not null,
  unit       text not null default 'шт',
  quantity   numeric(14,3) not null default 1,
  price      numeric(14,2) not null default 0,
  amount     numeric(14,2) generated always as (round(quantity * price, 2)) stored,
  position   int not null default 0
);

create index if not exists order_items_order_idx on public.order_items(order_id);

-- Пересчёт сумм заказа
create or replace function public.recalc_order_totals(p_order_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_items numeric(14,2);
  v_discount numeric(5,2);
  v_bonus_used numeric(14,2);
  v_total numeric(14,2);
begin
  select coalesce(sum(amount), 0) into v_items from public.order_items where order_id = p_order_id;
  select discount_percent, bonus_used into v_discount, v_bonus_used from public.orders where id = p_order_id;
  if not found then
    return;
  end if;

  v_total := greatest(round(v_items * (1 - coalesce(v_discount, 0) / 100.0), 2) - coalesce(v_bonus_used, 0), 0);

  update public.orders
     set items_total = v_items,
         total = v_total,
         bonus_earned = round(v_total * 0.01, 2),
         updated_at = now()
   where id = p_order_id;
end $$;

create or replace function public.trg_order_items_changed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.recalc_order_totals(coalesce(new.order_id, old.order_id));
  return coalesce(new, old);
end $$;

drop trigger if exists order_items_recalc on public.order_items;
create trigger order_items_recalc
  after insert or update or delete on public.order_items
  for each row execute function public.trg_order_items_changed();

-- ---------------------------------------------------------------------
-- История работы с клиентом
-- ---------------------------------------------------------------------
create table if not exists public.client_events (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  order_id    uuid references public.orders(id) on delete set null,
  type        event_type not null default 'note',
  title       text not null,
  description text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists client_events_client_idx on public.client_events(client_id, created_at desc);

-- Автозапись событий по заказам + начисление бонусов при завершении
create or replace function public.trg_order_history()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.client_events (client_id, order_id, type, title, description, created_by)
    values (new.client_id, new.id, 'order_created', 'Создан заказ ' || new.number, null, new.created_by);

  elsif (tg_op = 'UPDATE' and new.status is distinct from old.status) then
    insert into public.client_events (client_id, order_id, type, title, description, created_by)
    values (new.client_id, new.id, 'status_changed',
            'Заказ ' || new.number || ': статус изменён',
            old.status::text || ' → ' || new.status::text, new.created_by);

    if new.status = 'completed' and old.status <> 'completed' and new.bonus_earned > 0 then
      insert into public.bonus_transactions (client_id, order_id, type, points, comment)
      values (new.client_id, new.id, 'accrual', new.bonus_earned, 'Начисление за заказ ' || new.number);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists order_history on public.orders;
create trigger order_history
  after insert or update on public.orders
  for each row execute function public.trg_order_history();

-- ---------------------------------------------------------------------
-- Загрузка и разбор внешних отчётов
-- ---------------------------------------------------------------------
create table if not exists public.report_uploads (
  id           uuid primary key default gen_random_uuid(),
  file_name    text not null,
  file_path    text,
  store_id     uuid references public.stores(id) on delete set null,
  period_start date,
  period_end   date,
  status       upload_status not null default 'uploaded',
  rows_count   int not null default 0,
  total_amount numeric(14,2) not null default 0,
  summary      jsonb not null default '{}'::jsonb,
  error        text,
  uploaded_by  uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

create table if not exists public.report_rows (
  id           uuid primary key default gen_random_uuid(),
  upload_id    uuid not null references public.report_uploads(id) on delete cascade,
  store_id     uuid references public.stores(id) on delete set null,
  doc_date     date,
  period_month date,
  client_name  text,
  order_number text,
  product_name text,
  category     text,
  quantity     numeric(14,3),
  amount       numeric(14,2),
  raw          jsonb not null default '{}'::jsonb
);

create index if not exists report_rows_upload_idx on public.report_rows(upload_id);
create index if not exists report_rows_month_idx on public.report_rows(period_month);

-- ---------------------------------------------------------------------
-- Анализ района для открытия магазина
-- ---------------------------------------------------------------------
create table if not exists public.district_analyses (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  city           text,
  inputs         jsonb not null default '{}'::jsonb,
  scores         jsonb not null default '{}'::jsonb,
  total_score    numeric(5,2) not null default 0,
  verdict        text,
  recommendation text,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Интеграция с 1С
-- ---------------------------------------------------------------------
create table if not exists public.integration_settings (
  id             boolean primary key default true check (id),
  is_enabled     boolean not null default false,
  base_url       text,
  username       text,
  sync_clients   boolean not null default true,
  sync_orders    boolean not null default true,
  sync_bonuses   boolean not null default true,
  last_sync_at   timestamptz,
  updated_at     timestamptz not null default now()
);

insert into public.integration_settings (id) values (true) on conflict do nothing;

create table if not exists public.sync_log (
  id         uuid primary key default gen_random_uuid(),
  direction  text not null check (direction in ('in', 'out')),
  entity     text not null,
  status     text not null check (status in ('ok', 'error')),
  message    text,
  payload    jsonb,
  created_at timestamptz not null default now()
);

create index if not exists sync_log_created_idx on public.sync_log(created_at desc);

-- ---------------------------------------------------------------------
-- Аналитическое представление: помесячная статистика
-- ---------------------------------------------------------------------
-- security_invoker: представление уважает RLS вызывающего пользователя
create or replace view public.monthly_stats with (security_invoker = on) as
select
  date_trunc('month', o.created_at)::date        as month,
  o.store_id,
  count(*)                                       as orders_count,
  count(*) filter (where o.status = 'completed') as completed_count,
  count(distinct o.client_id)                    as clients_count,
  coalesce(sum(o.total), 0)                      as total_amount,
  coalesce(round(avg(o.total), 2), 0)            as avg_check
from public.orders o
where o.status <> 'cancelled'
group by 1, 2;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.stores               enable row level security;
alter table public.profiles             enable row level security;
alter table public.products             enable row level security;
alter table public.clients              enable row level security;
alter table public.orders               enable row level security;
alter table public.order_items          enable row level security;
alter table public.client_events        enable row level security;
alter table public.bonus_transactions   enable row level security;
alter table public.report_uploads       enable row level security;
alter table public.report_rows          enable row level security;
alter table public.district_analyses    enable row level security;
alter table public.integration_settings enable row level security;
alter table public.sync_log             enable row level security;

-- Справочники
drop policy if exists stores_read on public.stores;
create policy stores_read on public.stores for select to authenticated using (true);
drop policy if exists stores_write on public.stores;
create policy stores_write on public.stores for all to authenticated
  using (public.is_privileged()) with check (public.is_privileged());

drop policy if exists products_read on public.products;
create policy products_read on public.products for select to authenticated using (true);
drop policy if exists products_write on public.products;
create policy products_write on public.products for all to authenticated
  using (public.is_privileged()) with check (public.is_privileged());

-- Профили
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (true);
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_privileged())
  with check (id = auth.uid() or public.is_privileged());
drop policy if exists profiles_admin_insert on public.profiles;
create policy profiles_admin_insert on public.profiles for insert to authenticated
  with check (public.is_privileged());

-- Клиенты: менеджер видит своих и нераспределённых, руководство — всех
drop policy if exists clients_read on public.clients;
create policy clients_read on public.clients for select to authenticated
  using (public.is_privileged() or manager_id = auth.uid() or manager_id is null);
drop policy if exists clients_write on public.clients;
create policy clients_write on public.clients for all to authenticated
  using (public.is_privileged() or manager_id = auth.uid() or manager_id is null)
  with check (public.is_privileged() or manager_id = auth.uid() or manager_id is null);

-- Заказы
drop policy if exists orders_read on public.orders;
create policy orders_read on public.orders for select to authenticated
  using (public.is_privileged() or manager_id = auth.uid() or manager_id is null);
drop policy if exists orders_write on public.orders;
create policy orders_write on public.orders for all to authenticated
  using (public.is_privileged() or manager_id = auth.uid() or manager_id is null)
  with check (public.is_privileged() or manager_id = auth.uid() or manager_id is null);

drop policy if exists order_items_all on public.order_items;
create policy order_items_all on public.order_items for all to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id))
  with check (exists (select 1 from public.orders o where o.id = order_id));

drop policy if exists client_events_all on public.client_events;
create policy client_events_all on public.client_events for all to authenticated
  using (exists (select 1 from public.clients c where c.id = client_id))
  with check (exists (select 1 from public.clients c where c.id = client_id));

drop policy if exists bonus_all on public.bonus_transactions;
create policy bonus_all on public.bonus_transactions for all to authenticated
  using (exists (select 1 from public.clients c where c.id = client_id))
  with check (exists (select 1 from public.clients c where c.id = client_id));

-- Отчёты
drop policy if exists uploads_all on public.report_uploads;
create policy uploads_all on public.report_uploads for all to authenticated using (true) with check (true);
drop policy if exists rows_all on public.report_rows;
create policy rows_all on public.report_rows for all to authenticated using (true) with check (true);

-- Анализ районов — только руководство
drop policy if exists districts_read on public.district_analyses;
create policy districts_read on public.district_analyses for select to authenticated
  using (public.is_privileged());
drop policy if exists districts_write on public.district_analyses;
create policy districts_write on public.district_analyses for all to authenticated
  using (public.is_privileged()) with check (public.is_privileged());

drop policy if exists integration_read on public.integration_settings;
create policy integration_read on public.integration_settings for select to authenticated using (true);
drop policy if exists integration_write on public.integration_settings;
create policy integration_write on public.integration_settings for all to authenticated
  using (public.is_privileged()) with check (public.is_privileged());

drop policy if exists sync_log_read on public.sync_log;
create policy sync_log_read on public.sync_log for select to authenticated using (true);

-- ---------------------------------------------------------------------
-- Storage: бакет для загружаемых отчётов
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('reports', 'reports', false)
on conflict (id) do nothing;

drop policy if exists "reports read" on storage.objects;
create policy "reports read" on storage.objects for select to authenticated
  using (bucket_id = 'reports');

drop policy if exists "reports write" on storage.objects;
create policy "reports write" on storage.objects for insert to authenticated
  with check (bucket_id = 'reports');

drop policy if exists "reports delete" on storage.objects;
create policy "reports delete" on storage.objects for delete to authenticated
  using (bucket_id = 'reports');
