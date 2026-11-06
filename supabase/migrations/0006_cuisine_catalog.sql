create table if not exists cuisine_catalog (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  name text not null,
  normalized_name text not null,
  created_at text not null,
  updated_at text not null
);
create unique index if not exists cuisine_catalog_user_name_unique
  on cuisine_catalog(user_id, normalized_name);
create index if not exists cuisine_catalog_user_idx on cuisine_catalog(user_id, name);
