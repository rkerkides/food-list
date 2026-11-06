alter table users add column if not exists shared_content_editable_by_group integer not null default 0;
