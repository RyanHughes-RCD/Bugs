-- Bug Garden Sprite Studio: database setup for Supabase.
-- Run once in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- Safe to run again (it skips what already exists).
--
-- Who can do what (enforced here by row-level security, not just the game):
--   everyone (even signed out)   reads submissions, likes, decisions, live sprites
--   signed-in players            add, edit and withdraw their own pending
--                                submissions; like and unlike; set their own name
--   the owner (studio_owners)    approves, rejects, and changes live sprites
--
-- To make yourself the owner, sign in once in the game's Studio, then run:
--   insert into public.studio_owners (user_id)
--   select id from auth.users where email = 'YOUR EMAIL HERE';

-- ---------- tables ----------

create table if not exists public.studio_owners (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '' check (char_length(name) <= 24)
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  author uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null check (pg_column_size(data) < 8192),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.likes (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  submission_id uuid not null references public.submissions (id) on delete cascade,
  primary key (user_id, submission_id)
);

create table if not exists public.decisions (
  submission_id uuid primary key,
  status text not null check (status in ('approved', 'rejected')),
  note text not null default '' check (char_length(note) <= 160),
  species text,
  rows jsonb,
  decided_at timestamptz not null default now()
);

create table if not exists public.live_sprites (
  species text primary key,
  rows jsonb not null,
  ref uuid,
  updated_at timestamptz not null default now()
);

create table if not exists public.live_bugs (
  ref uuid primary key,
  author uuid,
  data jsonb not null,
  approved_at timestamptz not null default now()
);

-- Added later: eye marks for Albinos ([x, y] pixels) on approved fixes.
alter table public.decisions add column if not exists eyes jsonb;
alter table public.live_sprites add column if not exists eyes jsonb;

-- ---------- helpers ----------

create or replace function public.is_studio_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.studio_owners where user_id = auth.uid());
$$;

-- Keeps a person to 60 submissions.
create or replace function public.limit_submissions() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.submissions where author = new.author) >= 60 then
    raise exception 'You have 60 submissions already. Withdraw an old one first.';
  end if;
  return new;
end;
$$;
drop trigger if exists limit_submissions on public.submissions;
create trigger limit_submissions before insert on public.submissions
  for each row execute function public.limit_submissions();

-- ---------- row-level security ----------

alter table public.studio_owners enable row level security;
alter table public.profiles enable row level security;
alter table public.submissions enable row level security;
alter table public.likes enable row level security;
alter table public.decisions enable row level security;
alter table public.live_sprites enable row level security;
alter table public.live_bugs enable row level security;

do $$
declare t text;
begin
  -- Everything is readable by everyone.
  foreach t in array array['studio_owners', 'profiles', 'submissions', 'likes', 'decisions', 'live_sprites', 'live_bugs'] loop
    execute format('drop policy if exists "read" on public.%I', t);
    execute format('create policy "read" on public.%I for select using (true)', t);
  end loop;
end $$;

-- Your own name.
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Your own submissions, changeable only until they've been decided.
drop policy if exists "add own" on public.submissions;
create policy "add own" on public.submissions for insert
  with check (author = auth.uid());
drop policy if exists "edit own pending" on public.submissions;
create policy "edit own pending" on public.submissions for update
  using (author = auth.uid() and not exists (select 1 from public.decisions d where d.submission_id = submissions.id))
  with check (author = auth.uid());
drop policy if exists "withdraw own" on public.submissions;
create policy "withdraw own" on public.submissions for delete
  using (author = auth.uid() or public.is_studio_owner());

-- Your own likes.
drop policy if exists "own likes" on public.likes;
create policy "own likes" on public.likes for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Only the owner decides.
do $$
declare t text;
begin
  foreach t in array array['decisions', 'live_sprites', 'live_bugs'] loop
    execute format('drop policy if exists "owner writes" on public.%I', t);
    execute format('create policy "owner writes" on public.%I for all using (public.is_studio_owner()) with check (public.is_studio_owner())', t);
  end loop;
end $$;

-- ---------- live updates ----------
-- Lets open games see new submissions, likes and approvals as they happen.

do $$
declare t text;
begin
  foreach t in array array['profiles', 'submissions', 'likes', 'decisions', 'live_sprites', 'live_bugs'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
