alter table orders
  add column if not exists completed_at timestamptz;

alter table orders
  drop constraint if exists orders_status_check;

alter table orders
  add constraint orders_status_check
  check (
    (status = 'live' and completed_at is null)
    or (status = 'completed' and completed_at is not null)
  );

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
  staff_name text
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
    updated_order.staff_name;
end;
$$;

grant update (status, completed_at) on table orders to service_role;
grant execute on function complete_order(uuid) to service_role;
