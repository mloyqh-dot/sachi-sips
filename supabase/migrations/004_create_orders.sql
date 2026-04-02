create sequence if not exists order_ticket_number_seq;

create or replace function generate_order_ticket_number()
returns text
language plpgsql
as $$
declare
  seq_value bigint;
begin
  seq_value := nextval('order_ticket_number_seq');
  return 'SS-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(seq_value::text, 6, '0');
end;
$$;

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique default generate_order_ticket_number(),
  created_at timestamptz not null default now(),
  status text not null default 'live' check (status in ('live')),
  subtotal numeric(10, 2) not null check (subtotal >= 0),
  total numeric(10, 2) not null check (total >= 0),
  payment_method text not null check (payment_method in ('cash', 'card', 'other')),
  notes text,
  staff_name text not null
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id),
  name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  options jsonb,
  line_total numeric(10, 2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_orders_created_at on orders(created_at desc);
create index if not exists idx_orders_status on orders(status);
create index if not exists idx_order_items_order_id on order_items(order_id);

alter table orders enable row level security;
alter table order_items enable row level security;

create policy "Anyone can read orders"
  on orders for select
  using (true);

create policy "Anyone can read order items"
  on order_items for select
  using (true);

create or replace function create_order(
  p_staff_name text,
  p_payment_method text,
  p_notes text,
  p_subtotal numeric,
  p_total numeric,
  p_items jsonb
)
returns table (
  id uuid,
  ticket_number text,
  created_at timestamptz,
  status text,
  subtotal numeric,
  total numeric,
  payment_method text,
  notes text,
  staff_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_order orders%rowtype;
begin
  if coalesce(trim(p_staff_name), '') = '' then
    raise exception 'staff_name is required';
  end if;

  if p_payment_method not in ('cash', 'card', 'other') then
    raise exception 'invalid payment_method';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'order items are required';
  end if;

  insert into orders (
    subtotal,
    total,
    payment_method,
    notes,
    staff_name
  ) values (
    p_subtotal,
    p_total,
    p_payment_method,
    nullif(trim(p_notes), ''),
    trim(p_staff_name)
  )
  returning * into new_order;

  insert into order_items (
    order_id,
    product_id,
    name,
    quantity,
    unit_price,
    options,
    line_total
  )
  select
    new_order.id,
    (item->>'product_id')::uuid,
    item->>'name',
    (item->>'quantity')::integer,
    (item->>'unit_price')::numeric(10, 2),
    item->'options',
    ((item->>'quantity')::integer * (item->>'unit_price')::numeric(10, 2))::numeric(10, 2)
  from jsonb_array_elements(p_items) as item;

  return query
  select
    new_order.id,
    new_order.ticket_number,
    new_order.created_at,
    new_order.status,
    new_order.subtotal,
    new_order.total,
    new_order.payment_method,
    new_order.notes,
    new_order.staff_name;
end;
$$;

revoke all on function create_order(text, text, text, numeric, numeric, jsonb) from public;
