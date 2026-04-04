alter table order_items
  add column if not exists ready_at timestamptz default null;

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
