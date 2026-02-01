create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  status_subscribe text default 'Free' check (status_subscribe in ('Free', 'Pro', 'Ultimate')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update their own profile" on public.profiles
  for update using (auth.uid() = id);

-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, status_subscribe)
  values (new.id, new.email, 'Free');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new user signup
-- Drop if exists to avoid error on repeated runs
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill existing users
insert into public.profiles (id, email, status_subscribe)
select id, email, 'Free' from auth.users
where id not in (select id from public.profiles)
on conflict (id) do nothing;
