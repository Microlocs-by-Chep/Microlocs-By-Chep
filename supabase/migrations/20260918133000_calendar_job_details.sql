alter table public.commission_jobs drop constraint if exists commission_jobs_worker_check;
alter table public.commission_jobs alter column worker set default 'Unassigned';
alter table public.commission_jobs add constraint commission_jobs_worker_check check (worker in ('Unassigned', 'Bree', 'Joan'));
alter table public.commission_jobs
  add column if not exists customer_phone text not null default '',
  add column if not exists customer_email text not null default '',
  add column if not exists booking_notes text not null default '',
  add column if not exists week_saved_at timestamptz;
