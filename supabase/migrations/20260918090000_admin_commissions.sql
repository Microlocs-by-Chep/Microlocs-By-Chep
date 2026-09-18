create schema if not exists private;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.commission_jobs (
  id uuid primary key default gen_random_uuid(),
  calendar_event_id text not null unique,
  worker text not null default 'Unassigned' check (worker in ('Unassigned', 'Bree', 'Joan')),
  customer_name text not null default 'Calendar appointment',
  service text not null default 'Appointment',
  customer_phone text not null default '',
  customer_email text not null default '',
  booking_notes text not null default '',
  completed_at timestamptz not null,
  week_start date not null,
  week_end date not null,
  final_amount numeric(12,2) check (final_amount is null or final_amount >= 0),
  commission_amount numeric(12,2) generated always as (round(coalesce(final_amount, 0) * 0.40, 2)) stored,
  is_paid boolean not null default false,
  paid_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  week_saved_at timestamptz,
  constraint valid_week check (week_end = week_start + 5),
  constraint paid_state check ((not is_paid and paid_at is null) or (is_paid and paid_at is not null))
);

create index if not exists commission_jobs_week_worker_idx
  on public.commission_jobs (week_start desc, worker);

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_admin() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

create or replace function public.set_commission_job_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  if new.is_paid and (old.is_paid is false or new.paid_at is null) then
    new.paid_at = now();
  elsif not new.is_paid then
    new.paid_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists commission_jobs_updated_at on public.commission_jobs;
create trigger commission_jobs_updated_at
before update on public.commission_jobs
for each row execute function public.set_commission_job_updated_at();

alter table public.admin_users enable row level security;
alter table public.commission_jobs enable row level security;

drop policy if exists "Admins can view own membership" on public.admin_users;
create policy "Admins can view own membership"
on public.admin_users for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Admins can read commission jobs" on public.commission_jobs;
create policy "Admins can read commission jobs"
on public.commission_jobs for select
to authenticated
using ((select private.is_admin()));

drop policy if exists "Admins can add commission jobs" on public.commission_jobs;
create policy "Admins can add commission jobs"
on public.commission_jobs for insert
to authenticated
with check ((select private.is_admin()) and created_by = (select auth.uid()));

drop policy if exists "Admins can update commission jobs" on public.commission_jobs;
create policy "Admins can update commission jobs"
on public.commission_jobs for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

revoke all on public.admin_users, public.commission_jobs from anon;
grant select on public.admin_users to authenticated;
grant select, insert, update on public.commission_jobs to authenticated;
