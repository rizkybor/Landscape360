alter table offline_maps add column if not exists center_lng float;
alter table offline_maps add column if not exists center_lat float;
alter table offline_maps add column if not exists location_name text;
