-- VTE MEDIA: esquema inicial. Ejecutar con Supabase CLI o SQL Editor por el propietario.
-- No contiene datos de producción ni asigna administradores.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

do $$ begin
  create type public.app_role as enum ('admin');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null default 'Usuario' check (char_length(username) between 2 and 48),
  avatar_url text check (avatar_url is null or avatar_url ~* '^https://'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now()
);

create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  description text not null default '' check (char_length(description) <= 500),
  logo_url text check (logo_url is null or logo_url ~* '^https://'),
  video_source text check (video_source is null or video_source ~* '^https://'),
  is_active boolean not null default false,
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 140),
  description text not null default '' check (char_length(description) <= 1000),
  video_source text check (video_source is null or video_source ~* '^https://'),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint programs_valid_interval check (ends_at > starts_at),
  constraint programs_no_overlap exclude using gist (
    channel_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references public.channels(id) on delete set null,
  title text not null check (char_length(trim(title)) between 1 and 140),
  description text not null default '' check (char_length(description) <= 1000),
  video_source text check (video_source is null or video_source ~* '^https://'),
  starts_at timestamptz not null,
  ends_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_valid_interval check (ends_at is null or ends_at > starts_at),
  constraint events_no_scheduled_channel_overlap exclude using gist (
    channel_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (channel_id is not null and ends_at is not null and status = 'scheduled')
);

create table if not exists public.saved_videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content_key text not null check (char_length(trim(content_key)) between 1 and 300),
  title text not null check (char_length(trim(title)) between 1 and 140),
  thumbnail_url text not null default '' check (thumbnail_url = '' or thumbnail_url ~* '^https://'),
  video_source text not null default '' check (video_source = '' or video_source ~* '^https://'),
  created_at timestamptz not null default now(),
  constraint saved_videos_one_copy_per_user unique (user_id, content_key)
);

create index if not exists channels_public_order_idx on public.channels (is_active, display_order);
create index if not exists programs_channel_starts_at_idx on public.programs (channel_id, starts_at);
create index if not exists programs_starts_at_idx on public.programs (starts_at);
create index if not exists events_starts_at_idx on public.events (starts_at);
create index if not exists events_channel_starts_at_idx on public.events (channel_id, starts_at);
create index if not exists saved_videos_user_created_idx on public.saved_videos (user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$ begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists channels_set_updated_at on public.channels;
create trigger channels_set_updated_at before update on public.channels for each row execute function public.set_updated_at();
drop trigger if exists programs_set_updated_at on public.programs;
create trigger programs_set_updated_at before update on public.programs for each row execute function public.set_updated_at();
drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at before update on public.events for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$ begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(nullif(left(new.raw_user_meta_data ->> 'username', 48), ''), 'Usuario'))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- SECURITY DEFINER prevents RLS recursion while still evaluating the caller's auth.uid().
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'::public.app_role
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.channels enable row level security;
alter table public.programs enable row level security;
alter table public.events enable row level security;
alter table public.saved_videos enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "roles_select_own" on public.user_roles;
create policy "roles_select_own" on public.user_roles for select to authenticated using (user_id = auth.uid());

drop policy if exists "channels_select_public" on public.channels;
create policy "channels_select_public" on public.channels for select using (is_active or public.is_admin());
drop policy if exists "channels_admin_write" on public.channels;
create policy "channels_admin_write" on public.channels for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "programs_select_public" on public.programs;
create policy "programs_select_public" on public.programs for select using (
  public.is_admin() or exists (select 1 from public.channels where channels.id = programs.channel_id and channels.is_active)
);
drop policy if exists "programs_admin_write" on public.programs;
create policy "programs_admin_write" on public.programs for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "events_select_public" on public.events;
create policy "events_select_public" on public.events for select using (status in ('scheduled', 'cancelled') or public.is_admin());
drop policy if exists "events_admin_write" on public.events;
create policy "events_admin_write" on public.events for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "saved_videos_select_own" on public.saved_videos;
create policy "saved_videos_select_own" on public.saved_videos for select to authenticated using (user_id = auth.uid());
drop policy if exists "saved_videos_insert_own" on public.saved_videos;
create policy "saved_videos_insert_own" on public.saved_videos for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "saved_videos_delete_own" on public.saved_videos;
create policy "saved_videos_delete_own" on public.saved_videos for delete to authenticated using (user_id = auth.uid());

-- RLS does not limit columns; users may only edit their public profile fields.
revoke all on public.profiles, public.user_roles, public.channels, public.programs, public.events, public.saved_videos from anon, authenticated;
grant select on public.channels, public.programs, public.events to anon, authenticated;
grant select on public.profiles, public.user_roles, public.saved_videos to authenticated;
grant update (username, avatar_url) on public.profiles to authenticated;
grant select, insert, delete on public.saved_videos to authenticated;
grant insert, update, delete on public.channels, public.programs, public.events to authenticated;
