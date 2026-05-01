begin;

alter table products
  add column if not exists stock_quantity integer;

alter table products
  drop constraint if exists products_stock_quantity_check;

alter table products
  add constraint products_stock_quantity_check
  check (stock_quantity is null or stock_quantity >= 0);

update products
set stock_quantity = case
  when name = 'Spam Musubi' then 11
  when name = 'Tater Tots' then 20
  else stock_quantity
end
where name in ('Spam Musubi', 'Tater Tots');

create or replace function apply_product_stock_adjustments(
  p_adjustments jsonb
)
returns table (
  product_id uuid,
  stock_quantity integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  adjustment record;
  current_stock integer;
  product_name text;
begin
  if p_adjustments is null then
    return;
  end if;

  if jsonb_typeof(p_adjustments) <> 'array' then
    raise exception 'stock adjustments must be an array';
  end if;

  for adjustment in
    select
      (entry->>'product_id')::uuid as product_id,
      sum((entry->>'delta')::integer)::integer as delta
    from jsonb_array_elements(p_adjustments) as entry
    where coalesce(entry->>'product_id', '') <> ''
      and coalesce(entry->>'delta', '') <> ''
    group by (entry->>'product_id')::uuid
    having sum((entry->>'delta')::integer) <> 0
  loop
    select p.name, p.stock_quantity
    into product_name, current_stock
    from products as p
    where p.id = adjustment.product_id
    for update;

    if not found then
      raise exception 'product not found: %', adjustment.product_id;
    end if;

    if current_stock is null then
      continue;
    end if;

    if current_stock + adjustment.delta < 0 then
      raise exception '% has only % left', product_name, current_stock;
    end if;

    update products as p
    set stock_quantity = current_stock + adjustment.delta
    where p.id = adjustment.product_id;
  end loop;

  return query
  select p.id, p.stock_quantity
  from products as p
  where p.id in (
    select (entry->>'product_id')::uuid
    from jsonb_array_elements(p_adjustments) as entry
    where coalesce(entry->>'product_id', '') <> ''
  );
end;
$$;

revoke all on function apply_product_stock_adjustments(jsonb) from public;
revoke all on function apply_product_stock_adjustments(jsonb) from anon;
revoke all on function apply_product_stock_adjustments(jsonb) from authenticated;
grant execute on function apply_product_stock_adjustments(jsonb) to service_role;

notify pgrst, 'reload schema';

commit;
