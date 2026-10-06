-- Expose only customer account/profile fields to approved admins.
-- No password hashes, authentication tokens, or service-role keys are returned.
create or replace function public.admin_customer_accounts(
  p_search text default '',
  p_offset integer default 0,
  p_user_id uuid default null
)
returns table (
  user_id uuid,
  email text,
  full_name text,
  phone text,
  birthday date,
  reminder_weeks integer,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'This account is not authorised as an admin' using errcode = '42501';
  end if;
  if p_offset is null or p_offset < 0 or p_offset > 100000 or length(coalesce(p_search, '')) > 100 then
    raise exception 'Invalid customer search' using errcode = '22023';
  end if;
  return query
    select u.id, u.email::text, coalesce(p.full_name, ''), coalesce(p.phone, ''),
      p.birthday, coalesce(p.reminder_weeks, 6), u.created_at
    from auth.users u
    left join public.customer_profiles p on p.user_id = u.id
    where u.deleted_at is null
      and not exists (select 1 from public.admin_users a where a.user_id = u.id)
      and (p_user_id is null or u.id = p_user_id)
      and (coalesce(p_search, '') = ''
        or strpos(lower(coalesce(u.email::text, '')), lower(p_search)) > 0
        or strpos(lower(coalesce(p.full_name, '')), lower(p_search)) > 0
        or strpos(coalesce(p.phone, ''), p_search) > 0)
    order by u.created_at desc, u.id
    limit 51 offset p_offset;
end;
$$;
revoke all on function public.admin_customer_accounts(text, integer, uuid) from public, anon;
grant execute on function public.admin_customer_accounts(text, integer, uuid) to authenticated;
