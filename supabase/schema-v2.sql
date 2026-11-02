-- Harrison Library v2: mapper, projekter, poster, links, filer og historik
-- Kør hele filen i Supabase: SQL Editor → New query → indsæt → Run
-- Filen kan køres flere gange uden at ødelægge noget.

-- ─── Fælles hjælpefunktion ──────────────────────────────────────────────
create or replace function public.saet_opdateret()
returns trigger language plpgsql as $$
begin
  new.opdateret = now();
  return new;
end;
$$;


-- ─── Elementer: alt i biblioteket er et element ─────────────────────────
create table if not exists public.elementer (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  parent_id   uuid references public.elementer (id) on delete cascade,
  type        text not null default 'post' check (type in ('mappe', 'projekt', 'post', 'link')),
  titel       text not null,
  beskrivelse text,
  indhold     text,
  url         text,
  status      text check (status in ('idé', 'i gang', 'pause', 'færdig')),
  ikon        text,
  farve       text,
  tags        text[] not null default '{}',
  offentlig   boolean not null default false,
  fastgjort   boolean not null default false,
  oprettet    timestamptz not null default now(),
  opdateret   timestamptz not null default now()
);

create index if not exists elementer_parent_idx on public.elementer (parent_id);

drop trigger if exists elementer_opdateret on public.elementer;
create trigger elementer_opdateret
  before update on public.elementer
  for each row execute function public.saet_opdateret();

-- Forhindr at et element flyttes ind i sig selv eller sine egne undermapper
create or replace function public.tjek_ingen_loekke()
returns trigger language plpgsql as $$
declare
  p uuid := new.parent_id;
begin
  while p is not null loop
    if p = new.id then
      raise exception 'Et element kan ikke ligge inde i sig selv';
    end if;
    select parent_id into p from public.elementer where id = p;
  end loop;
  return new;
end;
$$;

drop trigger if exists elementer_ingen_loekke on public.elementer;
create trigger elementer_ingen_loekke
  before insert or update of parent_id on public.elementer
  for each row execute function public.tjek_ingen_loekke();

alter table public.elementer enable row level security;

drop policy if exists "Læs offentlige eller egne" on public.elementer;
create policy "Læs offentlige eller egne" on public.elementer
  for select using (offentlig or auth.uid() = user_id);

drop policy if exists "Opret egne" on public.elementer;
create policy "Opret egne" on public.elementer
  for insert to authenticated with check (
    auth.uid() = user_id
    and (parent_id is null or exists (
      select 1 from public.elementer p where p.id = parent_id and p.user_id = auth.uid()))
  );

drop policy if exists "Ret egne" on public.elementer;
create policy "Ret egne" on public.elementer
  for update to authenticated using (auth.uid() = user_id) with check (
    auth.uid() = user_id
    and (parent_id is null or exists (
      select 1 from public.elementer p where p.id = parent_id and p.user_id = auth.uid()))
  );

drop policy if exists "Slet egne" on public.elementer;
create policy "Slet egne" on public.elementer
  for delete to authenticated using (auth.uid() = user_id);

-- ─── Historik: gammel tekst gemmes automatisk ved hver ændring ──────────
create table if not exists public.versioner (
  id         bigint generated always as identity primary key,
  element_id uuid not null references public.elementer (id) on delete cascade,
  user_id    uuid not null,
  titel      text,
  indhold    text,
  gemt       timestamptz not null default now()
);

create index if not exists versioner_element_idx on public.versioner (element_id, gemt desc);

create or replace function public.gem_version()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.indhold is distinct from new.indhold or old.titel is distinct from new.titel then
    insert into public.versioner (element_id, user_id, titel, indhold)
    values (old.id, old.user_id, old.titel, old.indhold);
  end if;
  return new;
end;
$$;

drop trigger if exists elementer_version on public.elementer;
create trigger elementer_version
  after update on public.elementer
  for each row execute function public.gem_version();

alter table public.versioner enable row level security;

drop policy if exists "Læs egne versioner" on public.versioner;
create policy "Læs egne versioner" on public.versioner
  for select to authenticated using (auth.uid() = user_id);

-- ─── Filer: metadata i tabellen, selve filen i Storage ──────────────────
create table if not exists public.filer (
  id         uuid primary key default gen_random_uuid(),
  element_id uuid not null references public.elementer (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  sti        text not null unique,
  navn       text not null,
  mime       text,
  stoerrelse bigint,
  oprettet   timestamptz not null default now()
);

create index if not exists filer_element_idx on public.filer (element_id);

alter table public.filer enable row level security;

drop policy if exists "Læs filer på synlige elementer" on public.filer;
create policy "Læs filer på synlige elementer" on public.filer
  for select using (exists (
    select 1 from public.elementer e
    where e.id = element_id and (e.offentlig or e.user_id = auth.uid())));

drop policy if exists "Opret egne filer" on public.filer;
create policy "Opret egne filer" on public.filer
  for insert to authenticated with check (
    auth.uid() = user_id
    and exists (select 1 from public.elementer e where e.id = element_id and e.user_id = auth.uid()));

drop policy if exists "Slet egne filer" on public.filer;
create policy "Slet egne filer" on public.filer
  for delete to authenticated using (auth.uid() = user_id);

-- Privat bucket (maks. 50 MB pr. fil). Adgang styres af reglerne nedenfor.
insert into storage.buckets (id, name, public, file_size_limit)
values ('filer', 'filer', false, 52428800)
on conflict (id) do nothing;

drop policy if exists "Harrison: læs filer" on storage.objects;
create policy "Harrison: læs filer" on storage.objects
  for select using (
    bucket_id = 'filer' and exists (
      select 1 from public.filer f
      join public.elementer e on e.id = f.element_id
      where f.sti = storage.objects.name and (e.offentlig or e.user_id = auth.uid())));

drop policy if exists "Harrison: upload egne filer" on storage.objects;
create policy "Harrison: upload egne filer" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'filer' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Harrison: slet egne filer" on storage.objects;
create policy "Harrison: slet egne filer" on storage.objects
  for delete to authenticated using (
    bucket_id = 'filer' and (storage.foldername(name))[1] = auth.uid()::text);

-- ─── Flyt gamle poster fra v1 over (emne bliver til en mappe) ───────────
do $$
begin
  if to_regclass('public.poster') is not null then
    insert into public.elementer (user_id, type, titel, offentlig)
    select p.user_id, 'mappe', p.emne, bool_or(p.offentlig)
    from public.poster p
    where p.emne is not null
      and not exists (
        select 1 from public.elementer e
        where e.type = 'mappe' and e.parent_id is null
          and e.titel = p.emne and e.user_id = p.user_id)
    group by p.user_id, p.emne;

    insert into public.elementer
      (id, user_id, parent_id, type, titel, indhold, tags, offentlig, oprettet, opdateret)
    select p.id, p.user_id,
      (select e.id from public.elementer e
        where e.type = 'mappe' and e.parent_id is null
          and e.titel = p.emne and e.user_id = p.user_id
        limit 1),
      'post', p.titel, p.indhold, p.tags, p.offentlig, p.oprettet, p.opdateret
    from public.poster p
    on conflict (id) do nothing;
  end if;
end;
$$;
