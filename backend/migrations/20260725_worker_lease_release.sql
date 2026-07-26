create or replace function public.release_app_worker_lease(
  p_lease_name text,
  p_owner_id text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  released_name text;
begin
  if nullif(trim(p_lease_name), '') is null or nullif(trim(p_owner_id), '') is null then
    raise exception 'lease name and owner are required';
  end if;

  delete from public.app_worker_leases
  where lease_name = p_lease_name
    and owner_id = p_owner_id
  returning lease_name into released_name;

  return released_name is not null;
end;
$$;

revoke all on function public.release_app_worker_lease(text, text)
  from public, anon, authenticated;
grant execute on function public.release_app_worker_lease(text, text)
  to service_role;
