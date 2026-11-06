create table if not exists place_image_uploads (
  place_id text primary key references places(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  mime_type text not null,
  data_base64 text not null,
  byte_size integer not null,
  updated_at text not null
);
create index if not exists place_image_uploads_user_idx on place_image_uploads(user_id);
