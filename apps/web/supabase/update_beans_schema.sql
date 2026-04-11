alter table public.beans
  add column if not exists "totalWeight" numeric not null default 0,
  add column if not exists "remainingWeight" numeric not null default 0,
  add column if not exists status text not null default 'RESTING',
  add column if not exists "roastDate" timestamptz not null default timezone('utc', now()),
  add column if not exists "peakDate" timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'beans_status_check'
  ) then
    alter table public.beans
      add constraint beans_status_check
      check (status in ('RESTING', 'ACTIVE', 'ARCHIVED'));
  end if;
end
$$;

update public.beans
set "remainingWeight" = "totalWeight"
where "remainingWeight" < 0;
