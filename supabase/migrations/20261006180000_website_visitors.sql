-- Anonymous browser counts; no names, emails, IP addresses or page URLs are stored.
create table if not exists private.website_visitors (
  visit_day date not null,
  visitor_id uuid not null,
  primary key (visit_day, visitor_id)
);
alter table private.website_visitors enable row level security;
revoke all on private.website_visitors from public, anon, authenticated;

create or replace function public.record_website_visit(p_visitor_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_visitor_id is null then
    raise exception 'Invalid visitor identifier' using errcode = '22023';
  end if;
  insert into private.website_visitors(visit_day,visitor_id)
    values ((now() at time zone 'Africa/Nairobi')::date,p_visitor_id)
    on conflict do nothing;
end;
$$;
revoke all on function public.record_website_visit(uuid) from public;
grant execute on function public.record_website_visit(uuid) to anon, authenticated;

create or replace function public.admin_website_visitors()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'This account is not authorised as an admin' using errcode = '42501';
  end if;
  return (select jsonb_build_object(
    'unique_browsers',count(distinct visitor_id),
    'visitors_today',count(*) filter (where visit_day=(now() at time zone 'Africa/Nairobi')::date),
    'tracking_since',min(visit_day)
  ) from private.website_visitors);
end;
$$;
revoke all on function public.admin_website_visitors() from public, anon;
grant execute on function public.admin_website_visitors() to authenticated;
