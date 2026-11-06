create table if not exists venue_link_submissions (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  google_maps_url text not null,
  note text,
  latitude double precision,
  longitude double precision,
  status text not null default 'pending',
  review_note text,
  reviewed_by text references users(id) on delete set null,
  reviewed_at text,
  created_at text not null
);
create index if not exists venue_link_submissions_status_idx on venue_link_submissions(status, created_at asc);
