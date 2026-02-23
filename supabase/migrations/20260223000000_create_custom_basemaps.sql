
-- Create custom_basemaps table
create table if not exists public.custom_basemaps (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  file_path text not null, -- Path in storage bucket
  file_size bigint not null,
  crs text, -- e.g., "EPSG:4326"
  bounds jsonb, -- { north, south, east, west }
  resolution jsonb, -- { width, height }
  is_active boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  constraint custom_basemaps_pkey primary key (id)
);

-- Enable RLS
alter table public.custom_basemaps enable row level security;

-- Policies
create policy "Users can view own basemaps"
  on public.custom_basemaps for select
  using (auth.uid() = user_id);

create policy "Users can insert own basemaps"
  on public.custom_basemaps for insert
  with check (auth.uid() = user_id);

create policy "Users can update own basemaps"
  on public.custom_basemaps for update
  using (auth.uid() = user_id);

create policy "Users can delete own basemaps"
  on public.custom_basemaps for delete
  using (auth.uid() = user_id);

-- Create Storage Bucket for Basemaps
insert into storage.buckets (id, name, public)
values ('custom-basemaps', 'custom-basemaps', false) -- Private bucket
on conflict (id) do nothing;

-- Storage Policies (adjusting for standard Supabase storage schema)
-- Allow authenticated users to upload
create policy "Authenticated users can upload basemaps"
  on storage.objects for insert
  with check ( bucket_id = 'custom-basemaps' and auth.role() = 'authenticated' );

-- Allow users to read their own files (owner matches auth.uid())
create policy "Users can view own basemap files"
  on storage.objects for select
  using ( bucket_id = 'custom-basemaps' and auth.uid() = owner );

-- Allow users to delete their own files
create policy "Users can delete own basemap files"
  on storage.objects for delete
  using ( bucket_id = 'custom-basemaps' and auth.uid() = owner );
