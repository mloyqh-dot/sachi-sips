-- Transactions table
create table if not exists transactions (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  items           jsonb not null,
  total           numeric(10, 2) not null check (total >= 0),
  payment_method  text not null check (payment_method in ('cash', 'card', 'other')),
  notes           text,
  staff_name      text not null
);

-- Allow anon key to insert transactions (staff complete sales without login)
alter table transactions enable row level security;

create policy "Anyone can insert transactions"
  on transactions for insert
  with check (true);

create policy "Anyone can read transactions"
  on transactions for select
  using (true);
