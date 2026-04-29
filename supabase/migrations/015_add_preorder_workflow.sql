begin;

create table if not exists order_import_batches (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('takeapp')),
  filename text not null,
  imported_at timestamptz not null default now(),
  finalized_at timestamptz,
  row_count integer not null check (row_count >= 0),
  order_count integer not null check (order_count >= 0),
  summary jsonb not null default '{}'::jsonb
);

alter table orders
  add column if not exists order_source text not null default 'pos',
  add column if not exists external_order_key text,
  add column if not exists external_order_number text,
  add column if not exists external_order_name text,
  add column if not exists scheduled_for timestamptz,
  add column if not exists release_at timestamptz,
  add column if not exists prep_due_at timestamptz,
  add column if not exists preorder_payment_status text,
  add column if not exists preorder_fulfillment_status text,
  add column if not exists preorder_collected_at timestamptz,
  add column if not exists import_batch_id uuid references order_import_batches(id),
  add column if not exists external_raw jsonb;

alter table order_items
  add column if not exists external_lineitem_name text,
  add column if not exists external_lineitem_options text,
  add column if not exists external_lineitem_raw jsonb,
  add column if not exists prep_required boolean not null default true;

alter table orders
  drop constraint if exists orders_order_source_check;

alter table orders
  add constraint orders_order_source_check
  check (order_source in ('pos', 'preorder'));

alter table orders
  drop constraint if exists orders_preorder_required_fields_check;

alter table orders
  add constraint orders_preorder_required_fields_check
  check (
    order_source = 'pos'
    or (
      external_order_number is not null
      and external_order_key is not null
      and scheduled_for is not null
      and release_at is not null
      and prep_due_at is not null
    )
  );

create unique index if not exists idx_orders_preorder_external_number
  on orders (external_order_key)
  where order_source = 'preorder';

create index if not exists idx_orders_live_source_release
  on orders (status, order_source, release_at, created_at);

create index if not exists idx_orders_preorder_schedule
  on orders (order_source, scheduled_for);

create or replace function mark_station_ready(
  p_order_id uuid,
  p_categories text[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer := 0;
begin
  update order_items as oi
  set ready_at = now()
  from products as p
  where oi.order_id = p_order_id
    and oi.ready_at is null
    and oi.prep_required = true
    and oi.product_id = p.id
    and p.category = any(p_categories);

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

revoke all on function mark_station_ready(uuid, text[]) from public;
revoke all on function mark_station_ready(uuid, text[]) from anon;
revoke all on function mark_station_ready(uuid, text[]) from authenticated;
grant execute on function mark_station_ready(uuid, text[]) to service_role;

drop function if exists complete_order(uuid);

create or replace function complete_order(
  p_order_id uuid
)
returns table (
  id uuid,
  ticket_number text,
  created_at timestamptz,
  completed_at timestamptz,
  status text,
  subtotal numeric,
  total numeric,
  payment_method text,
  notes text,
  staff_name text,
  order_type text,
  customer_name text,
  order_source text,
  external_order_key text,
  external_order_number text,
  external_order_name text,
  scheduled_for timestamptz,
  release_at timestamptz,
  prep_due_at timestamptz,
  preorder_payment_status text,
  preorder_fulfillment_status text,
  preorder_collected_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_order orders%rowtype;
begin
  update orders as o
  set
    status = 'completed',
    completed_at = now()
  where o.id = p_order_id
    and o.status = 'live'
  returning * into updated_order;

  if not found then
    return;
  end if;

  return query
  select
    updated_order.id,
    updated_order.ticket_number,
    updated_order.created_at,
    updated_order.completed_at,
    updated_order.status,
    updated_order.subtotal,
    updated_order.total,
    updated_order.payment_method,
    updated_order.notes,
    updated_order.staff_name,
    updated_order.order_type,
    updated_order.customer_name,
    updated_order.order_source,
    updated_order.external_order_key,
    updated_order.external_order_number,
    updated_order.external_order_name,
    updated_order.scheduled_for,
    updated_order.release_at,
    updated_order.prep_due_at,
    updated_order.preorder_payment_status,
    updated_order.preorder_fulfillment_status,
    updated_order.preorder_collected_at;
end;
$$;

drop function if exists collect_preorder(uuid);

create or replace function collect_preorder(
  p_order_id uuid
)
returns table (
  id uuid,
  ticket_number text,
  created_at timestamptz,
  completed_at timestamptz,
  status text,
  subtotal numeric,
  total numeric,
  payment_method text,
  notes text,
  staff_name text,
  order_type text,
  customer_name text,
  order_source text,
  external_order_key text,
  external_order_number text,
  external_order_name text,
  scheduled_for timestamptz,
  release_at timestamptz,
  prep_due_at timestamptz,
  preorder_payment_status text,
  preorder_fulfillment_status text,
  preorder_collected_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_order orders%rowtype;
begin
  update orders as o
  set
    status = 'completed',
    completed_at = now(),
    preorder_collected_at = now()
  where o.id = p_order_id
    and o.status = 'live'
    and o.order_source = 'preorder'
  returning * into updated_order;

  if not found then
    return;
  end if;

  return query
  select
    updated_order.id,
    updated_order.ticket_number,
    updated_order.created_at,
    updated_order.completed_at,
    updated_order.status,
    updated_order.subtotal,
    updated_order.total,
    updated_order.payment_method,
    updated_order.notes,
    updated_order.staff_name,
    updated_order.order_type,
    updated_order.customer_name,
    updated_order.order_source,
    updated_order.external_order_key,
    updated_order.external_order_number,
    updated_order.external_order_name,
    updated_order.scheduled_for,
    updated_order.release_at,
    updated_order.prep_due_at,
    updated_order.preorder_payment_status,
    updated_order.preorder_fulfillment_status,
    updated_order.preorder_collected_at;
end;
$$;

grant update (
  status,
  completed_at,
  preorder_collected_at
) on table orders to service_role;

grant execute on function complete_order(uuid) to service_role;
grant execute on function collect_preorder(uuid) to service_role;

notify pgrst, 'reload schema';

commit;
