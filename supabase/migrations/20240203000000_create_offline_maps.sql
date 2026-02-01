create table if not exists offline_maps (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  name text not null,
  bounds jsonb not null,
  min_zoom integer not null,
  max_zoom integer not null,
  tile_count integer not null,
  size_est_mb float not null,
  created_at timestamp with time zone default now()
);

alter table offline_maps enable row level security;

create policy "Users can insert their own offline maps"
  on offline_maps for insert
  with check (auth.uid() = user_id);

create policy "Users can view their own offline maps"
  on offline_maps for select
  using (auth.uid() = user_id);

create policy "Users can delete their own offline maps"
  on offline_maps for delete
  using (auth.uid() = user_id);
