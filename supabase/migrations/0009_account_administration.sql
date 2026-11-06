alter table users add column if not exists is_admin integer not null default 0 check (is_admin in (0, 1));
create table if not exists admin_audit_log (
  id text primary key,
  actor_user_id text references users(id) on delete set null,
  target_user_id text references users(id) on delete set null,
  action text not null,
  created_at text not null
);
create index if not exists admin_audit_actor_action_idx on admin_audit_log(actor_user_id, action, created_at);
