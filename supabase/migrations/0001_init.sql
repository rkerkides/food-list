create table if not exists users (
  id text primary key,
  email text not null unique,
  name text not null,
  password_hash text,
  is_demo integer not null default 0,
  created_at text not null
);

create table if not exists sessions (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  token_hash text not null unique,
  created_at text not null,
  expires_at text not null,
  user_agent text
);
create index if not exists sessions_user_idx on sessions(user_id);
create index if not exists sessions_expires_idx on sessions(expires_at);

create table if not exists places (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  name text not null,
  category text not null default 'restaurant',
  cuisines text not null default '[]',
  address text,
  city text,
  area text,
  district text,
  latitude double precision,
  longitude double precision,
  provider text not null default 'manual',
  provider_place_id text,
  public_rating double precision,
  public_rating_count integer,
  price_level integer,
  website text,
  phone text,
  opening_hours text,
  photo_ref text,
  external_fetched_at text,
  external_meta text,
  expected_spend_min double precision,
  expected_spend_max double precision,
  budget_source text not null default 'unknown',
  budget_updated_at text,
  note text,
  saved_reason text,
  tags text not null default '[]',
  overrides text not null default '[]',
  status text not null default 'saved',
  saved_at text not null,
  created_at text not null,
  updated_at text not null
);
create unique index if not exists places_provider_unique
  on places(user_id, provider, provider_place_id);
create index if not exists places_user_status_idx on places(user_id, status);
create index if not exists places_user_city_idx on places(user_id, city);
create index if not exists places_user_category_idx on places(user_id, category);
create index if not exists places_user_saved_at_idx on places(user_id, saved_at desc);

create table if not exists visits (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  place_id text not null references places(id) on delete cascade,
  visited_at text not null,
  occasion text,
  party_size integer,
  rating double precision,
  thoughts text,
  spend_per_person double precision,
  would_return integer,
  tags text not null default '[]',
  created_at text not null
);
create index if not exists visits_place_idx on visits(place_id, visited_at desc);
create index if not exists visits_user_idx on visits(user_id, visited_at desc);

create table if not exists food_items (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  visit_id text not null references visits(id) on delete cascade,
  place_id text not null references places(id) on delete cascade,
  name text not null,
  category text,
  rating double precision,
  comment text,
  is_highlight integer not null default 0,
  price double precision,
  created_at text not null
);
create index if not exists food_items_visit_idx on food_items(visit_id);
create index if not exists food_items_place_idx on food_items(place_id);
create index if not exists food_items_user_rating_idx on food_items(user_id, rating desc);

create table if not exists place_refreshes (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  place_id text not null references places(id) on delete cascade,
  source text not null,
  status text not null,
  changed_fields text not null default '[]',
  preserved_fields text not null default '[]',
  message text,
  created_at text not null
);
create index if not exists place_refreshes_place_idx on place_refreshes(place_id, created_at desc);
