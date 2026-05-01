begin;

update products
set stock_quantity = 0
where name = 'Tater Tots';

notify pgrst, 'reload schema';

commit;
