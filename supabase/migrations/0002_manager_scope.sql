-- =====================================================================
-- Ограничение аналитики (загруженные отчёты) ролью admin/director,
-- в соответствии с ограничением доступа на уровне страниц /reports, /uploads.
-- =====================================================================

drop policy if exists uploads_all on public.report_uploads;
create policy uploads_all on public.report_uploads for all to authenticated
  using (public.is_privileged()) with check (public.is_privileged());

drop policy if exists rows_all on public.report_rows;
create policy rows_all on public.report_rows for all to authenticated
  using (public.is_privileged()) with check (public.is_privileged());
