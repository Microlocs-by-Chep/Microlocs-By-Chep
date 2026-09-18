create table if not exists public.customer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text not null default '',
  birthday date,
  reminder_weeks integer not null default 6 check (reminder_weeks between 4 and 12),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.customer_profiles enable row level security;
create policy "Customers view own profile" on public.customer_profiles for select to authenticated using (user_id=(select auth.uid()));
create policy "Customers create own profile" on public.customer_profiles for insert to authenticated with check (user_id=(select auth.uid()));
create policy "Customers update own profile" on public.customer_profiles for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
revoke all on public.customer_profiles from anon;
grant select,insert,update on public.customer_profiles to authenticated;
