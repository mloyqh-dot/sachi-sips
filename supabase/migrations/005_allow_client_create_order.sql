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
  computed_subtotal numeric(10, 2);
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

  if exists (
    select 1
    from jsonb_array_elements(p_items) as item
    where coalesce(item->>'product_id', '') = ''
      or coalesce(item->>'name', '') = ''
      or coalesce((item->>'quantity')::integer, 0) <= 0
      or coalesce((item->>'unit_price')::numeric, -1) < 0
  ) then
    raise exception 'invalid order item payload';
  end if;

  select coalesce(sum(
    ((item->>'quantity')::integer * (item->>'unit_price')::numeric(10, 2))::numeric(10, 2)
  ), 0)::numeric(10, 2)
  into computed_subtotal
  from jsonb_array_elements(p_items) as item;

  if p_subtotal is distinct from computed_subtotal or p_total is distinct from computed_subtotal then
    raise exception 'order totals do not match item totals';
  end if;

  insert into orders (
    subtotal,
    total,
    payment_method,
    notes,
    staff_name
  ) values (
    computed_subtotal,
    computed_subtotal,
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

grant execute on function create_order(text, text, text, numeric, numeric, jsonb) to anon;
grant execute on function create_order(text, text, text, numeric, numeric, jsonb) to authenticated;
