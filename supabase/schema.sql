-- Harrison Library: database-opsætning
-- Kør hele filen i Supabase: SQL Editor → New query → indsæt → Run

create table if not exists public.poster (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  titel      text not null,
  emne       text,
  tags       text[] not null default '{}',
  indhold    text,
  offentlig  boolean not null default false,
  oprettet   timestamptz not null default now(),
  opdateret  timestamptz not null default now()
);

create index if not exists poster_oprettet_idx on public.poster (oprettet desc);

-- Opdater "opdateret" automatisk ved ændringer
create or replace function public.saet_opdateret()
returns trigger language plpgsql as $$
begin
  new.opdateret = now();
  return new;
end;
$$;

drop trigger if exists poster_opdateret on public.poster;
create trigger poster_opdateret
  before update on public.poster
  for each row execute function public.saet_opdateret();

-- Sikkerhed: alle kan læse offentlige poster, kun ejeren kan se private og skrive
alter table public.poster enable row level security;

drop policy if exists "Læs offentlige eller egne" on public.poster;
create policy "Læs offentlige eller egne" on public.poster
  for select using (offentlig or auth.uid() = user_id);

drop policy if exists "Opret egne" on public.poster;
create policy "Opret egne" on public.poster
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Ret egne" on public.poster;
create policy "Ret egne" on public.poster
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Slet egne" on public.poster;
create policy "Slet egne" on public.poster
  for delete to authenticated using (auth.uid() = user_id);
