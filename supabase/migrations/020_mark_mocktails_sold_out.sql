begin;

update products
set stock_quantity = 0
where category = 'Mocktail';

notify pgrst, 'reload schema';

commit;
