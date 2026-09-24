-- =====================================================================
-- Воронка продаж (методология «управляемого отдела продаж»): у каждого
-- клиента — конкретный этап сделки, обязательная следующая задача,
-- причина отказа перед закрытием и лимит активных сделок на менеджера.
-- Заменяет прежний грубый clients.status (lead/active/inactive).
-- =====================================================================

do $$ begin
  create type deal_stage as enum (
    'new', 'contacted', 'proposal_sent', 'meeting_scheduled',
    'won', 'conditional_rejection', 'closed_lost'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type deal_task_type as enum ('call', 'meeting', 'email', 'message', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type deal_task_status as enum ('open', 'done', 'cancelled');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Новые поля сделки на карточке клиента
-- ---------------------------------------------------------------------
alter table public.clients
  add column if not exists stage deal_stage not null default 'new',
  add column if not exists stage_changed_at timestamptz not null default now(),
  add column if not exists budget numeric(14,2),
  add column if not exists priority text check (priority in ('A','B','C')),
  add column if not exists product_interest text,
  add column if not exists urgency text check (urgency in ('high','medium','low')),
  add column if not exists deal_type text check (deal_type in ('new','repeat')),
  add column if not exists proposal_amount numeric(14,2),
  add column if not exists meeting_at timestamptz,
  add column if not exists rejection_reason text,
  add column if not exists rejection_comment text;

create index if not exists clients_stage_idx on public.clients(stage);

-- Старый грубый статус (lead/active/inactive) заменён этапом воронки.
alter table public.clients drop column if exists status;
drop type if exists client_status;

-- ---------------------------------------------------------------------
-- Задачи по сделкам: у каждой активной сделки должна быть ровно одна
-- открытая задача — ответственный, точный дедлайн, тип действия, комментарий.
-- ---------------------------------------------------------------------
create table if not exists public.deal_tasks (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  assignee_id  uuid references public.profiles(id) on delete set null,
  type         deal_task_type not null default 'call',
  due_at       timestamptz not null,
  comment      text not null,
  status       deal_task_status not null default 'open',
  completed_at timestamptz,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists deal_tasks_client_idx on public.deal_tasks(client_id);
create index if not exists deal_tasks_open_idx on public.deal_tasks(client_id) where status = 'open';
create index if not exists deal_tasks_assignee_idx on public.deal_tasks(assignee_id, status);

-- ---------------------------------------------------------------------
-- Лимит активных сделок на менеджера (единственная строка настроек,
-- как integration_settings)
-- ---------------------------------------------------------------------
create table if not exists public.pipeline_settings (
  id                       boolean primary key default true check (id),
  manager_active_deal_limit int not null default 80,
  updated_at               timestamptz not null default now()
);

insert into public.pipeline_settings (id) values (true) on conflict do nothing;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.deal_tasks       enable row level security;
alter table public.pipeline_settings enable row level security;

drop policy if exists deal_tasks_all on public.deal_tasks;
create policy deal_tasks_all on public.deal_tasks for all to authenticated
  using (
    assignee_id = auth.uid()
    or public.is_privileged()
    or exists (
      select 1 from public.clients c
      where c.id = client_id and (c.manager_id = auth.uid() or c.manager_id is null)
    )
  )
  with check (
    assignee_id = auth.uid()
    or public.is_privileged()
    or exists (
      select 1 from public.clients c
      where c.id = client_id and (c.manager_id = auth.uid() or c.manager_id is null)
    )
  );

drop policy if exists pipeline_settings_read on public.pipeline_settings;
create policy pipeline_settings_read on public.pipeline_settings for select to authenticated using (true);

drop policy if exists pipeline_settings_write on public.pipeline_settings;
create policy pipeline_settings_write on public.pipeline_settings for all to authenticated
  using (public.is_privileged()) with check (public.is_privileged());
