alter table orders
  add column if not exists order_type text not null default 'dine_in'
  check (order_type in ('dine_in', 'takeaway'));
