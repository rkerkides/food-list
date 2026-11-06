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
