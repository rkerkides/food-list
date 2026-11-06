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
