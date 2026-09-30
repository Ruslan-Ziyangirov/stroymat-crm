-- =====================================================================
-- Персональный план продаж менеджера.
-- План теперь бывает трёх видов: на компанию (store_id и manager_id пусты),
-- на магазин (store_id) или на менеджера (manager_id).
-- =====================================================================

alter table public.monthly_plans
  add column if not exists manager_id uuid references public.profiles(id) on delete cascade;

alter table public.monthly_plans
  drop constraint if exists monthly_plans_single_target;
alter table public.monthly_plans
  add constraint monthly_plans_single_target
  check (store_id is null or manager_id is null);

create unique index if not exists monthly_plans_manager_month_uidx
  on public.monthly_plans (manager_id, month) where manager_id is not null;

-- Менеджер видит общие планы и свой личный, но не чужие личные.
drop policy if exists monthly_plans_read on public.monthly_plans;
create policy monthly_plans_read on public.monthly_plans for select to authenticated
  using (public.is_privileged() or manager_id is null or manager_id = auth.uid());
