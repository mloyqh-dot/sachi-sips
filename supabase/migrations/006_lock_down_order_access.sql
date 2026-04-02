drop policy if exists "Anyone can read orders" on orders;
drop policy if exists "Anyone can read order items" on order_items;

revoke all on table orders from anon, authenticated;
revoke all on table order_items from anon, authenticated;

revoke execute on function create_order(text, text, text, numeric, numeric, jsonb) from anon;
revoke execute on function create_order(text, text, text, numeric, numeric, jsonb) from authenticated;
revoke execute on function create_order(text, text, text, numeric, numeric, jsonb) from public;

grant select on table orders to service_role;
grant select on table order_items to service_role;
grant execute on function create_order(text, text, text, numeric, numeric, jsonb) to service_role;
