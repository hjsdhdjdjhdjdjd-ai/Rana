-- جدول المعلمين (تسجيل حقيقي — يحل محل الحسابات التجريبية الثابتة)
create table if not exists teachers (
  username text primary key,
  secret text not null,
  name text not null,
  created_at timestamptz default now()
);
alter table teachers enable row level security;
drop policy if exists "open" on teachers;
create policy "open" on teachers for all using (true) with check (true);
