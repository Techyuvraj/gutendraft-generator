-- GutenDraft database schema.
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run: every statement is idempotent.

-- ---------------------------------------------------------------------------
-- Generations: one row per design a user converts, kept exactly as generated
-- and updated in place as they refine it in the AI Assistant.
-- ---------------------------------------------------------------------------
create table if not exists public.generations (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),

    source      text not null check (source in ('image', 'url', 'template')),
    framework   text not null,
    provider    text,
    model       text,

    image_path  text,          -- object path in the "designs" bucket, for image uploads
    xd_url      text,          -- for XD link inputs
    context     text,          -- the description typed alongside an XD link
    template_id text,          -- for Quick Start templates

    code        text not null, -- the current block markup
    chat        jsonb not null default '[]'::jsonb
);

create index if not exists generations_user_created_idx
    on public.generations (user_id, created_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists generations_touch_updated_at on public.generations;
create trigger generations_touch_updated_at
    before update on public.generations
    for each row execute function public.touch_updated_at();

-- Row-level security: a user can only ever see and change their own rows.
alter table public.generations enable row level security;

drop policy if exists "generations: owner select" on public.generations;
create policy "generations: owner select" on public.generations
    for select to authenticated using (user_id = auth.uid());

drop policy if exists "generations: owner insert" on public.generations;
create policy "generations: owner insert" on public.generations
    for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "generations: owner update" on public.generations;
create policy "generations: owner update" on public.generations
    for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "generations: owner delete" on public.generations;
create policy "generations: owner delete" on public.generations
    for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Uploaded design images. Private bucket; each user writes under a folder
-- named with their own user id: designs/<user_id>/<file>.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('designs', 'designs', false, 20971520) -- 20 MB
on conflict (id) do nothing;

drop policy if exists "designs: owner read" on storage.objects;
create policy "designs: owner read" on storage.objects
    for select to authenticated
    using (bucket_id = 'designs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "designs: owner upload" on storage.objects;
create policy "designs: owner upload" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'designs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "designs: owner delete" on storage.objects;
create policy "designs: owner delete" on storage.objects
    for delete to authenticated
    using (bucket_id = 'designs' and (storage.foldername(name))[1] = auth.uid()::text);
