-- =====================================================================
-- Раздел «Финансы»: помесячный анализ счёта 51 (движение денег по счёту
-- из 1С) и годовая бухгалтерская отчётность (баланс + отчёт о финансовых
-- результатах). Отдельно от продуктовой отчётности (report_uploads) —
-- другая структура данных (статьи/счета, а не клиенты и номенклатура).
-- =====================================================================

do $$ begin
  create type finance_upload_kind as enum ('cash_flow_51', 'financial_statement');
exception when duplicate_object then null; end $$;

create table if not exists public.finance_uploads (
  id           uuid primary key default gen_random_uuid(),
  kind         finance_upload_kind not null,
  file_name    text not null,
  file_path    text,
  period_month date,        -- для cash_flow_51: 1-е число месяца отчёта
  period_year  int,         -- для financial_statement: отчётный год
  status       upload_status not null default 'uploaded',
  rows_count   int not null default 0,
  summary      jsonb not null default '{}'::jsonb,
  error        text,
  uploaded_by  uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists finance_uploads_kind_idx on public.finance_uploads(kind);
create index if not exists finance_uploads_month_idx on public.finance_uploads(period_month);
create index if not exists finance_uploads_year_idx on public.finance_uploads(period_year);

-- Помесячные обороты по счёту 51 (движение денег по статьям/корр. счетам)
create table if not exists public.finance_cash_flow_rows (
  id           uuid primary key default gen_random_uuid(),
  upload_id    uuid not null references public.finance_uploads(id) on delete cascade,
  period_month date not null,
  corr_account text,
  debit        numeric(16,2),
  credit       numeric(16,2),
  comment      text,
  raw          jsonb not null default '{}'::jsonb
);

create index if not exists finance_cash_flow_rows_upload_idx on public.finance_cash_flow_rows(upload_id);
create index if not exists finance_cash_flow_rows_month_idx on public.finance_cash_flow_rows(period_month);

-- Строки бухгалтерского баланса и отчёта о финансовых результатах
create table if not exists public.finance_statement_lines (
  id             uuid primary key default gen_random_uuid(),
  upload_id      uuid not null references public.finance_uploads(id) on delete cascade,
  period_year    int not null,
  statement_type text not null check (statement_type in ('balance', 'income')),
  code           text not null,
  label          text not null,
  value          numeric(16,2),
  position       int not null default 0
);

create index if not exists finance_statement_lines_upload_idx on public.finance_statement_lines(upload_id);
create index if not exists finance_statement_lines_year_idx on public.finance_statement_lines(period_year);

alter table public.finance_uploads         enable row level security;
alter table public.finance_cash_flow_rows  enable row level security;
alter table public.finance_statement_lines enable row level security;

-- Финансовые данные — только руководство, как и остальная аналитика.
drop policy if exists finance_uploads_all on public.finance_uploads;
create policy finance_uploads_all on public.finance_uploads for all to authenticated
  using (public.is_privileged()) with check (public.is_privileged());

drop policy if exists finance_cash_flow_rows_all on public.finance_cash_flow_rows;
create policy finance_cash_flow_rows_all on public.finance_cash_flow_rows for all to authenticated
  using (public.is_privileged()) with check (public.is_privileged());

drop policy if exists finance_statement_lines_all on public.finance_statement_lines;
create policy finance_statement_lines_all on public.finance_statement_lines for all to authenticated
  using (public.is_privileged()) with check (public.is_privileged());
