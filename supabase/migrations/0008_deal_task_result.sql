-- Результат выполненной задачи («что произошло на звонке/встрече»).
-- Заполняется, когда менеджер закрывает задачу и ставит следующий шаг.
alter table public.deal_tasks
  add column if not exists result text;
