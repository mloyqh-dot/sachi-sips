-- Products table
create table if not exists products (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  price         numeric(10, 2) not null check (price >= 0),
  category      text not null check (category in ('Beverage', 'Food', 'Dessert', 'Other')),
  is_available  boolean not null default true,
  created_at    timestamptz not null default now()
);

-- Allow anyone (anon key) to read products
alter table products enable row level security;

create policy "Anyone can read products"
  on products for select
  using (true);
