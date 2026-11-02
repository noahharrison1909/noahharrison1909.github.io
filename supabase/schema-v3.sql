-- Harrison Library v3: din egen liste over symboler og \-kommandoer
-- Kør hele filen i Supabase: SQL Editor → New query → indsæt → Run

create table if not exists public.symboler (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kommando    text not null check (kommando ~ '^[A-Za-z][A-Za-z0-9]*$'),
  tegn        text not null,
  latex       text,
  kategori    text not null default 'Andet',
  beskrivelse text,
  oprettet    timestamptz not null default now(),
  unique (user_id, kommando)
);

alter table public.symboler enable row level security;

drop policy if exists "Læs egne symboler" on public.symboler;
create policy "Læs egne symboler" on public.symboler
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Opret egne symboler" on public.symboler;
create policy "Opret egne symboler" on public.symboler
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Ret egne symboler" on public.symboler;
create policy "Ret egne symboler" on public.symboler
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Slet egne symboler" on public.symboler;
create policy "Slet egne symboler" on public.symboler
  for delete to authenticated using (auth.uid() = user_id);
