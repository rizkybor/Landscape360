-- Create surveys table
create table surveys (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  name text default 'Untitled Survey',
  data jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table surveys enable row level security;

-- Policies
create policy "Users can view own surveys" 
  on surveys for select 
  using (auth.uid() = user_id);

create policy "Users can insert own surveys" 
  on surveys for insert 
  with check (auth.uid() = user_id);

create policy "Users can update own surveys" 
  on surveys for update 
  using (auth.uid() = user_id);

create policy "Users can delete own surveys" 
  on surveys for delete 
  using (auth.uid() = user_id);
