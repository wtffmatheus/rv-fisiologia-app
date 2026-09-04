revoke all on function public.assign_program_to_student(uuid, bigint, date) from public, anon;
grant execute on function public.assign_program_to_student(uuid, bigint, date) to authenticated;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

revoke all on function public.handle_new_user() from public, anon, authenticated;
