alter table public.articles_read
  add column if not exists category text;

create index if not exists articles_read_user_id_created_at_idx
  on public.articles_read (user_id, created_at desc);

create index if not exists articles_read_user_id_category_idx
  on public.articles_read (user_id, category);
