/**
 * Migrations are plain SQL, kept in TypeScript so they work at runtime without
 * filesystem access (Next.js builds, serverless deployments) and can be emitted
 * as .sql files for the Supabase CLI with `npm run db:sql`.
 */

export interface Migration {
  id: string;
  name: string;
  sqlite: string;
  postgres: string;
}

const init: Migration = {
  id: "0001",
  name: "init",
  sqlite: `
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
  latitude real,
  longitude real,
  provider text not null default 'manual',
  provider_place_id text,
  public_rating real,
  public_rating_count integer,
  price_level integer,
  website text,
  phone text,
  opening_hours text,
  photo_ref text,
  external_fetched_at text,
  external_meta text,
  expected_spend_min real,
  expected_spend_max real,
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
  rating real,
  thoughts text,
  spend_per_person real,
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
  rating real,
  comment text,
  is_highlight integer not null default 0,
  price real,
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
`,
  postgres: `
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
`,
};

const osmCatalog: Migration = {
  id: "0002",
  name: "osm_catalog",
  sqlite: `
create table if not exists osm_places (
  provider_place_id text primary key,
  osm_type text not null,
  osm_id text not null,
  name text not null,
  category text not null,
  cuisines text not null default '[]',
  address text,
  city text,
  area text,
  district text,
  latitude real not null,
  longitude real not null,
  website text,
  phone text,
  opening_hours text,
  search_text text not null,
  tags text not null default '{}',
  imported_at text not null
);
create unique index if not exists osm_places_element_unique on osm_places(osm_type, osm_id);
create index if not exists osm_places_city_idx on osm_places(city);
create index if not exists osm_places_category_idx on osm_places(category);
create index if not exists osm_places_name_idx on osm_places(name);

create table if not exists osm_catalog_metadata (
  key text primary key,
  value text not null
);
`,
  postgres: `
create table if not exists osm_places (
  provider_place_id text primary key,
  osm_type text not null,
  osm_id text not null,
  name text not null,
  category text not null,
  cuisines text not null default '[]',
  address text,
  city text,
  area text,
  district text,
  latitude double precision not null,
  longitude double precision not null,
  website text,
  phone text,
  opening_hours text,
  search_text text not null,
  tags text not null default '{}',
  imported_at text not null
);
create unique index if not exists osm_places_element_unique on osm_places(osm_type, osm_id);
create index if not exists osm_places_city_idx on osm_places(city);
create index if not exists osm_places_category_idx on osm_places(category);
create index if not exists osm_places_name_idx on osm_places(name);

create table if not exists osm_catalog_metadata (
  key text primary key,
  value text not null
);
`,
};

const placeImageUploads: Migration = {
  id: "0003",
  name: "place_image_uploads",
  sqlite: `
create table if not exists place_image_uploads (
  place_id text primary key references places(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  mime_type text not null,
  data_base64 text not null,
  byte_size integer not null,
  updated_at text not null
);
create index if not exists place_image_uploads_user_idx on place_image_uploads(user_id);
`,
  postgres: `
create table if not exists place_image_uploads (
  place_id text primary key references places(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  mime_type text not null,
  data_base64 text not null,
  byte_size integer not null,
  updated_at text not null
);
create index if not exists place_image_uploads_user_idx on place_image_uploads(user_id);
`,
};

const sharedCircles: Migration = {
  id: "0004",
  name: "shared_circles",
  sqlite: `
create table if not exists shared_circles (
  id text primary key,
  owner_user_id text not null references users(id) on delete cascade,
  name text not null,
  created_at text not null
);
create index if not exists shared_circles_owner_idx on shared_circles(owner_user_id);

create table if not exists shared_circle_members (
  circle_id text not null references shared_circles(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  role text not null default 'member',
  joined_at text not null,
  primary key(circle_id, user_id)
);
create index if not exists shared_circle_members_user_idx on shared_circle_members(user_id);
`,
  postgres: `
create table if not exists shared_circles (
  id text primary key,
  owner_user_id text not null references users(id) on delete cascade,
  name text not null,
  created_at text not null
);
create index if not exists shared_circles_owner_idx on shared_circles(owner_user_id);

create table if not exists shared_circle_members (
  circle_id text not null references shared_circles(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  role text not null default 'member',
  joined_at text not null,
  primary key(circle_id, user_id)
);
create index if not exists shared_circle_members_user_idx on shared_circle_members(user_id);
`,
};

const placeGoogleMapsUrl: Migration = {
  id: "0005",
  name: "place_google_maps_url",
  sqlite: `
alter table places add column google_maps_url text;
`,
  postgres: `
alter table places add column if not exists google_maps_url text;
`,
};

const cuisineCatalog: Migration = {
  id: "0006",
  name: "cuisine_catalog",
  sqlite: `
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
`,
  postgres: `
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
`,
};

export const MIGRATIONS: Migration[] = [
  init,
  osmCatalog,
  placeImageUploads,
  sharedCircles,
  placeGoogleMapsUrl,
  cuisineCatalog,
];
