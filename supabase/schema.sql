-- Astro Session Log PWA — Supabase schema (Option A: local/UNC paths only)
-- Generated: 2026-01-01
-- Notes:
-- * All durations stored as integer seconds; UI formats to HH:MM:SS
-- * RLS enforces per-user ownership via person.auth_user_id = auth.uid()

-- =============
-- 1) Core user mapping
-- =============

create table if not exists public.person (
  person_id      bigserial primary key,
  auth_user_id   uuid not null unique,
  display_name   text,
  created_at     timestamptz not null default now()
);

create or replace function public.ensure_person(p_display_name text default null)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_person_id bigint;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.person (auth_user_id, display_name)
  values (auth.uid(), p_display_name)
  on conflict (auth_user_id) do update
    set display_name = coalesce(excluded.display_name, person.display_name)
  returning person_id into v_person_id;

  return v_person_id;
end;
$$;

-- Helper: map the current auth user to a person_id
create or replace function public.current_person_id()
returns bigint
language sql
stable
as $$
  select p.person_id
  from public.person p
  where p.auth_user_id = auth.uid()
$$;

-- Auto-fill NEW.person_id on inserts (so the client doesn't have to)
create or replace function public.set_person_id_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.person_id is null then
    new.person_id := public.current_person_id();
  end if;

  if new.person_id is null then
    raise exception 'No person row for auth user. Call public.ensure_person() once after login.';
  end if;

  return new;
end;
$$;



-- Helper to use in RLS policies
create or replace function public.current_person_id()
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select person_id from public.person where auth_user_id = auth.uid();
$$;

-- =============
-- 2) Lookup tables (dropdowns)
-- =============

create table if not exists public.mount (
  mount_id   smallserial primary key,
  name       text not null unique
);

create table if not exists public.camera (
  camera_id  smallserial primary key,
  name       text not null unique
);

create table if not exists public.filter (
  filter_id   smallserial primary key,
  name        text not null unique,
  sort_order  int not null
);

create table if not exists public.location (
  location_id smallserial primary key,
  name        text not null unique
);

-- User-owned telescope list (lets you keep tidy dropdowns without forcing global values)
create table if not exists public.telescope (
  telescope_id bigserial primary key,
  person_id    bigint not null references public.person(person_id) on delete cascade,
  name         text not null,
  notes        text,
  created_at   timestamptz not null default now(),
  unique (person_id, name)
);

-- Seed dropdowns (safe to re-run)
insert into public.mount(name) values
 ('AM3'), ('EQ3'), ('GTI'), ('HEQ5')
on conflict do nothing;

insert into public.camera(name) values
 ('174M'), ('26C'), ('462'), ('585M'), ('DSLR')
on conflict do nothing;

insert into public.location(name) values
 ('Home'), ('Club'), ('Other')
on conflict do nothing;

insert into public.filter(name, sort_order) values
 ('L', 1),
 ('R', 2),
 ('G', 3),
 ('B', 4),
 ('S', 5),
 ('H', 6),
 ('O', 7),
 ('Quad Band', 8),
 ('L-Pro', 9),
 ('Quark', 10)
on conflict do nothing;

-- =============
-- 3) Main entities
-- =============

create table if not exists public.target (
  target_id       bigserial primary key,
  person_id       bigint not null references public.person(person_id) on delete cascade,
  catalog_no      text not null,
  catalog_no_norm text generated always as (lower(catalog_no)) stored,
  description     text,
  constellation   text,
  target_type     text, -- optional free-text (nebula/galaxy/cluster/etc.)
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (person_id, catalog_no_norm)
);

create index if not exists ix_target_person on public.target(person_id);

create table if not exists public.session (
  session_id      bigserial primary key,
  person_id       bigint not null references public.person(person_id) on delete cascade,
  target_id       bigint not null references public.target(target_id) on delete cascade,
  started_at      timestamptz,
  ended_at        timestamptz,
  session_date    date, -- handy for quick entry; can be derived from started_at, but optional
  telescope_id    bigint references public.telescope(telescope_id),
  mount_id        smallint references public.mount(mount_id),
  camera_id       smallint references public.camera(camera_id),
  location_id     smallint references public.location(location_id),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists ix_session_person on public.session(person_id);
create index if not exists ix_session_target on public.session(target_id);
create index if not exists ix_session_date on public.session(session_date);

-- One session can have multiple "image runs" (e.g., different nights/panels)
create table if not exists public.image_run (
  image_run_id  bigserial primary key,
  person_id     bigint not null references public.person(person_id) on delete cascade,
  session_id    bigint not null references public.session(session_id) on delete cascade,
  run_date      date not null,
  panel_no      smallint, -- 1..9 typically
  panel_name    text not null, -- "Panel 1" default, but free-text allowed
  notes         text,
  created_at    timestamptz not null default now()
);

create index if not exists ix_image_run_session on public.image_run(session_id);
create index if not exists ix_image_run_person on public.image_run(person_id);
create index if not exists ix_image_run_date on public.image_run(run_date);

-- Per run: multiple filter lines (L/R/G/B etc.)
create table if not exists public.run_filter (
  run_filter_id    bigserial primary key,
  person_id        bigint not null references public.person(person_id) on delete cascade,
  image_run_id     bigint not null references public.image_run(image_run_id) on delete cascade,
  filter_id        smallint not null references public.filter(filter_id),
  exposures        int not null check (exposures >= 0),
  exposure_sec     int not null check (exposure_sec >= 0),
  gain             int,
  camera_offset    int,
  bin              smallint,
  reject_pct       numeric(5,2),
  notes            text,
  created_at       timestamptz not null default now(),
  unique (image_run_id, filter_id)
);

create index if not exists ix_run_filter_run on public.run_filter(image_run_id);
create index if not exists ix_run_filter_person on public.run_filter(person_id);

-- Output / asset links (local or UNC path for Option A)
create table if not exists public.file_asset (
  file_asset_id  bigserial primary key,
  person_id      bigint not null references public.person(person_id) on delete cascade,
  target_id      bigint references public.target(target_id) on delete cascade,
  session_id     bigint references public.session(session_id) on delete cascade,
  image_run_id   bigint references public.image_run(image_run_id) on delete cascade,
  asset_type     text not null check (asset_type in ('final','stacked','project','other')),
  label          text,
  path           text not null, -- e.g. D:\Astro\... or \\NAS\...
  is_best        boolean not null default false,
  notes          text,
  created_at     timestamptz not null default now(),
  -- Ensure at least one owner link
  constraint ck_file_asset_has_owner check (
    target_id is not null or session_id is not null or image_run_id is not null
  )
);

create index if not exists ix_file_asset_person on public.file_asset(person_id);
create index if not exists ix_file_asset_best on public.file_asset(target_id, is_best) where is_best = true;

-- =============
-- 4) Focus position log
-- =============

create table if not exists public.focus_position (
  focus_position_id  bigserial primary key,
  person_id          bigint not null references public.person(person_id) on delete cascade,
  telescope_description varchar(50) not null,
  position           integer not null check (position >= 0 and position <= 99999),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists ix_focus_position_person on public.focus_position(person_id);

-- =============
-- 5) Updated-at triggers
-- =============

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_target_updated_at on public.target;
create trigger trg_target_updated_at
before update on public.target
for each row execute function public.set_updated_at();

drop trigger if exists trg_session_updated_at on public.session;
create trigger trg_session_updated_at
before update on public.session
for each row execute function public.set_updated_at();

-- =============
-- 5) Reporting views (what the UI will read most often)
-- =============

-- Target catalogue: start date, last imaged, total integration
create or replace view public.v_target_catalog as
select
  t.target_id,
  t.catalog_no,
  t.description,
  min(ir.run_date) as start_date,
  max(ir.run_date) as last_imaged,
  coalesce(sum(rf.exposures * rf.exposure_sec), 0)::bigint as total_integration_sec
from public.target t
left join public.session s
  on s.target_id = t.target_id
left join public.image_run ir
  on ir.session_id = s.session_id
left join public.run_filter rf
  on rf.image_run_id = ir.image_run_id
group by t.target_id, t.catalog_no, t.description;

-- Session totals (for session headers)
create or replace view public.v_session_totals as
select
  s.session_id,
  s.target_id,
  s.session_date,
  s.started_at,
  s.ended_at,
  tel.name as telescope_name,
  m.name as mount_name,
  c.name as camera_name,
  l.name as location_name,
  coalesce(sum(rf.exposures * rf.exposure_sec), 0)::bigint as total_integration_sec
from public.session s
left join public.telescope tel on tel.telescope_id = s.telescope_id
left join public.mount m on m.mount_id = s.mount_id
left join public.camera c on c.camera_id = s.camera_id
left join public.location l on l.location_id = s.location_id
left join public.image_run ir on ir.session_id = s.session_id
left join public.run_filter rf on rf.image_run_id = ir.image_run_id
group by s.session_id, s.target_id, s.session_date, s.started_at, s.ended_at,
         tel.name, m.name, c.name, l.name;

-- Per image run totals
create or replace view public.v_image_run_totals as
select
  ir.image_run_id,
  ir.session_id,
  ir.run_date,
  ir.panel_no,
  ir.panel_name,
  coalesce(sum(rf.exposures * rf.exposure_sec), 0)::bigint as total_panel_sec
from public.image_run ir
left join public.run_filter rf on rf.image_run_id = ir.image_run_id
group by ir.image_run_id, ir.session_id, ir.run_date, ir.panel_no, ir.panel_name;



-- Auto-fill person_id on inserts for user-owned tables
drop trigger if exists trg_telescope_person on public.telescope;
create trigger trg_telescope_person
before insert on public.telescope
for each row execute function public.set_person_id_from_auth();

drop trigger if exists trg_target_person on public.target;
create trigger trg_target_person
before insert on public.target
for each row execute function public.set_person_id_from_auth();

drop trigger if exists trg_session_person on public.session;
create trigger trg_session_person
before insert on public.session
for each row execute function public.set_person_id_from_auth();

drop trigger if exists trg_image_run_person on public.image_run;
create trigger trg_image_run_person
before insert on public.image_run
for each row execute function public.set_person_id_from_auth();

drop trigger if exists trg_run_filter_person on public.run_filter;
create trigger trg_run_filter_person
before insert on public.run_filter
for each row execute function public.set_person_id_from_auth();

drop trigger if exists trg_file_asset_person on public.file_asset;
create trigger trg_file_asset_person
before insert on public.file_asset
for each row execute function public.set_person_id_from_auth();

drop trigger if exists trg_focus_position_person on public.focus_position;
create trigger trg_focus_position_person
before insert on public.focus_position
for each row execute function public.set_person_id_from_auth();

drop trigger if exists trg_focus_position_updated_at on public.focus_position;
create trigger trg_focus_position_updated_at
before update on public.focus_position
for each row execute function public.set_updated_at();

-- =============
-- 6) Row Level Security (RLS)
-- =============

-- person
alter table public.person enable row level security;

drop policy if exists "person_select_own" on public.person;
create policy "person_select_own"
on public.person for select
to authenticated
using (auth_user_id = auth.uid());

drop policy if exists "person_update_own" on public.person;
create policy "person_update_own"
on public.person for update
to authenticated
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid());

-- telescope (user-owned list)
alter table public.telescope enable row level security;

drop policy if exists "telescope_crud_own" on public.telescope;
create policy "telescope_crud_own"
on public.telescope
to authenticated
using (person_id = public.current_person_id())
with check (person_id = public.current_person_id());

-- target
alter table public.target enable row level security;

drop policy if exists "target_crud_own" on public.target;
create policy "target_crud_own"
on public.target
to authenticated
using (person_id = public.current_person_id())
with check (person_id = public.current_person_id());

-- session
alter table public.session enable row level security;

drop policy if exists "session_crud_own" on public.session;
create policy "session_crud_own"
on public.session
to authenticated
using (person_id = public.current_person_id())
with check (person_id = public.current_person_id());

-- image_run
alter table public.image_run enable row level security;

drop policy if exists "image_run_crud_own" on public.image_run;
create policy "image_run_crud_own"
on public.image_run
to authenticated
using (person_id = public.current_person_id())
with check (person_id = public.current_person_id());

-- run_filter
alter table public.run_filter enable row level security;

drop policy if exists "run_filter_crud_own" on public.run_filter;
create policy "run_filter_crud_own"
on public.run_filter
to authenticated
using (person_id = public.current_person_id())
with check (person_id = public.current_person_id());

-- file_asset
alter table public.file_asset enable row level security;

drop policy if exists "file_asset_crud_own" on public.file_asset;
create policy "file_asset_crud_own"
on public.file_asset
to authenticated
using (person_id = public.current_person_id())
with check (person_id = public.current_person_id());

-- focus_position
alter table public.focus_position enable row level security;

drop policy if exists "focus_position_crud_own" on public.focus_position;
create policy "focus_position_crud_own"
on public.focus_position
to authenticated
using (person_id = public.current_person_id())
with check (person_id = public.current_person_id());

-- Lookup tables: allow read for authenticated (no writes needed from app)
alter table public.mount enable row level security;
alter table public.camera enable row level security;
alter table public.filter enable row level security;
alter table public.location enable row level security;

drop policy if exists "mount_read" on public.mount;
create policy "mount_read" on public.mount for select to authenticated using (true);

drop policy if exists "camera_read" on public.camera;
create policy "camera_read" on public.camera for select to authenticated using (true);

drop policy if exists "filter_read" on public.filter;
create policy "filter_read" on public.filter for select to authenticated using (true);

drop policy if exists "location_read" on public.location;
create policy "location_read" on public.location for select to authenticated using (true);

-- Optional: prevent writes to lookup tables from app users
revoke insert, update, delete on public.mount from authenticated;
revoke insert, update, delete on public.camera from authenticated;
revoke insert, update, delete on public.filter from authenticated;
revoke insert, update, delete on public.location from authenticated;

-- =============
-- 7) Star Party Checklist
-- =============

-- Global category lookup (slug matches star_party_item.category text)
create table if not exists public.star_party_category (
  category_id  smallserial primary key,
  slug         text not null unique,
  label        text not null,
  sort_order   int not null default 0
);

insert into public.star_party_category (slug, label, sort_order) values
  ('camping', 'Camping Gear', 10),
  ('astro',   'Astro Gear',  20)
on conflict do nothing;

-- Global sub-category lookup
create table if not exists public.star_party_sub_category (
  sub_category_id smallserial primary key,
  category_slug   text not null references public.star_party_category(slug) on delete cascade,
  name            text not null,
  sort_order      int not null default 0,
  unique (category_slug, name)
);

insert into public.star_party_sub_category (category_slug, name, sort_order) values
  ('astro', 'Cameras',        10),
  ('astro', 'Controllers',    20),
  ('astro', 'General',        30),
  ('astro', 'Mounts',         40),
  ('astro', 'PC',             50),
  ('astro', 'Power Supplies', 60),
  ('astro', 'Scopes',         70),
  ('astro', 'Tripods',        80)
on conflict do nothing;

alter table public.star_party_category enable row level security;
drop policy if exists "sp_cat_read" on public.star_party_category;
create policy "sp_cat_read"
on public.star_party_category for select to authenticated using (true);

alter table public.star_party_sub_category enable row level security;
drop policy if exists "sp_subcat_read" on public.star_party_sub_category;
create policy "sp_subcat_read"
on public.star_party_sub_category for select to authenticated using (true);

drop policy if exists "sp_subcat_insert" on public.star_party_sub_category;
create policy "sp_subcat_insert"
on public.star_party_sub_category for insert to authenticated with check (true);

create table if not exists public.star_party_item (
  item_id      bigserial primary key,
  person_id    bigint not null references public.person(person_id) on delete cascade,
  name         text not null,
  category     text not null check (category in ('camping', 'astro')),
  sub_category text,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists ix_sp_item_person on public.star_party_item(person_id);

create table if not exists public.star_party_event (
  event_id    bigserial primary key,
  person_id   bigint not null references public.person(person_id) on delete cascade,
  name        text not null,
  date_from   date not null,
  date_to     date not null,
  is_current  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists ix_sp_event_person on public.star_party_event(person_id);

create table if not exists public.star_party_plan_item (
  plan_item_id bigserial primary key,
  event_id     bigint not null references public.star_party_event(event_id) on delete cascade,
  item_id      bigint not null references public.star_party_item(item_id) on delete cascade,
  person_id    bigint not null references public.person(person_id) on delete cascade,
  status       text not null default 'to_pick' check (status in ('to_pick', 'picked', 'packed')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (event_id, item_id)
);

create index if not exists ix_spp_event on public.star_party_plan_item(event_id);
create index if not exists ix_spp_person on public.star_party_plan_item(person_id);

drop trigger if exists trg_sp_item_updated_at on public.star_party_item;
create trigger trg_sp_item_updated_at
before update on public.star_party_item
for each row execute function public.set_updated_at();

drop trigger if exists trg_sp_event_updated_at on public.star_party_event;
create trigger trg_sp_event_updated_at
before update on public.star_party_event
for each row execute function public.set_updated_at();

drop trigger if exists trg_spp_updated_at on public.star_party_plan_item;
create trigger trg_spp_updated_at
before update on public.star_party_plan_item
for each row execute function public.set_updated_at();

drop trigger if exists trg_sp_item_person on public.star_party_item;
create trigger trg_sp_item_person
before insert on public.star_party_item
for each row execute function public.set_person_id_from_auth();

drop trigger if exists trg_sp_event_person on public.star_party_event;
create trigger trg_sp_event_person
before insert on public.star_party_event
for each row execute function public.set_person_id_from_auth();

drop trigger if exists trg_spp_person on public.star_party_plan_item;
create trigger trg_spp_person
before insert on public.star_party_plan_item
for each row execute function public.set_person_id_from_auth();

alter table public.star_party_item enable row level security;
drop policy if exists "sp_item_crud" on public.star_party_item;
create policy "sp_item_crud"
on public.star_party_item to authenticated
using (person_id = public.current_person_id())
with check (person_id = public.current_person_id());

alter table public.star_party_event enable row level security;
drop policy if exists "sp_event_crud" on public.star_party_event;
create policy "sp_event_crud"
on public.star_party_event to authenticated
using (person_id = public.current_person_id())
with check (person_id = public.current_person_id());

alter table public.star_party_plan_item enable row level security;
drop policy if exists "spp_crud" on public.star_party_plan_item;
create policy "spp_crud"
on public.star_party_plan_item to authenticated
using (person_id = public.current_person_id())
with check (person_id = public.current_person_id());
