create table if not exists private.allowed_admin_emails (
  email text primary key,
  created_at timestamptz not null default now()
);

create or replace function private.add_approved_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from private.allowed_admin_emails
    where lower(email) = lower(new.email)
  ) then
    insert into public.admin_users (user_id, email)
    values (new.id, lower(new.email))
    on conflict (user_id) do update set email = excluded.email;
  end if;
  return new;
end;
$$;

revoke all on function private.add_approved_admin() from public, anon, authenticated;
drop trigger if exists add_approved_admin_after_signup on auth.users;
create trigger add_approved_admin_after_signup
after insert or update of email on auth.users
for each row execute function private.add_approved_admin();
