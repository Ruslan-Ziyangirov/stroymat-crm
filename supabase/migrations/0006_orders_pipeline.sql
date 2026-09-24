-- =====================================================================
-- Перенос воронки продаж с клиентов на заказы. Клиент — справочник «кому
-- продаём», сделка (со всеми этапами, задачами и гейтингом) — это заказ:
-- у одного клиента их может быть несколько за время работы с ним.
-- Полностью заменяет прежний статус заказа (новый/подтверждён/оплачен/
-- в доставке/выполнен/отменён) этапами воронки (deal_stage, см. 0005).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Поля сделки переезжают с clients на orders
-- ---------------------------------------------------------------------
alter table public.orders
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

create index if not exists orders_stage_idx on public.orders(stage);

-- ---------------------------------------------------------------------
-- Бонус теперь начисляется при выходе сделки на этап «Продажа», а не при
-- смене статуса на «Завершён». История статуса заказа в client_events
-- пишется по этапу.
-- ---------------------------------------------------------------------
create or replace function public.trg_order_history()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.client_events (client_id, order_id, type, title, description, created_by)
    values (new.client_id, new.id, 'order_created', 'Создан заказ ' || new.number, null, new.created_by);

  elsif (tg_op = 'UPDATE' and new.stage is distinct from old.stage) then
    insert into public.client_events (client_id, order_id, type, title, description, created_by)
    values (new.client_id, new.id, 'status_changed',
            'Заказ ' || new.number || ': этап изменён',
            old.stage::text || ' → ' || new.stage::text, new.created_by);

    if new.stage = 'won' and old.stage <> 'won' and new.bonus_earned > 0 then
      insert into public.bonus_transactions (client_id, order_id, type, points, comment)
      values (new.client_id, new.id, 'accrual', new.bonus_earned, 'Начисление за заказ ' || new.number);
    end if;
  end if;
  return new;
end $$;

-- monthly_stats зависит от orders.status — переопределяем до удаления колонки.
create or replace view public.monthly_stats with (security_invoker = on) as
select
  date_trunc('month', o.created_at)::date       as month,
  o.store_id,
  count(*)                                      as orders_count,
  count(*) filter (where o.stage = 'won')       as completed_count,
  count(distinct o.client_id)                   as clients_count,
  coalesce(sum(o.total), 0)                     as total_amount,
  coalesce(round(avg(o.total), 2), 0)           as avg_check
from public.orders o
where o.stage <> 'closed_lost'
group by 1, 2;

-- Старый триггер/колонка статуса больше не нужны.
alter table public.orders drop column if exists status;
drop type if exists order_status;

-- ---------------------------------------------------------------------
-- У clients эти поля больше не нужны — сделка живёт на заказе.
-- ---------------------------------------------------------------------
alter table public.clients
  drop column if exists stage,
  drop column if exists stage_changed_at,
  drop column if exists budget,
  drop column if exists priority,
  drop column if exists product_interest,
  drop column if exists urgency,
  drop column if exists deal_type,
  drop column if exists proposal_amount,
  drop column if exists meeting_at,
  drop column if exists rejection_reason,
  drop column if exists rejection_comment;

-- ---------------------------------------------------------------------
-- deal_tasks — теперь про заказ, не про клиента. Данные в таблице только
-- демонстрационные, пересоздаём с нуля вместо миграции значений.
-- ---------------------------------------------------------------------
drop table if exists public.deal_tasks;

create table public.deal_tasks (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders(id) on delete cascade,
  assignee_id  uuid references public.profiles(id) on delete set null,
  type         deal_task_type not null default 'call',
  due_at       timestamptz not null,
  comment      text not null,
  status       deal_task_status not null default 'open',
  completed_at timestamptz,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists deal_tasks_order_idx on public.deal_tasks(order_id);
create index if not exists deal_tasks_open_idx on public.deal_tasks(order_id) where status = 'open';
create index if not exists deal_tasks_assignee_idx on public.deal_tasks(assignee_id, status);

alter table public.deal_tasks enable row level security;

drop policy if exists deal_tasks_all on public.deal_tasks;
create policy deal_tasks_all on public.deal_tasks for all to authenticated
  using (
    assignee_id = auth.uid()
    or public.is_privileged()
    or exists (
      select 1 from public.orders o
      where o.id = order_id and (o.manager_id = auth.uid() or o.manager_id is null)
    )
  )
  with check (
    assignee_id = auth.uid()
    or public.is_privileged()
    or exists (
      select 1 from public.orders o
      where o.id = order_id and (o.manager_id = auth.uid() or o.manager_id is null)
    )
  );

-- pipeline_settings — без изменений, лимит теперь считает активные заказы.
