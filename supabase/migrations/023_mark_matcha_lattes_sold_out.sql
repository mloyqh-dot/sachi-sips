begin;

update products
set stock_quantity = 0
where subcategory = 'Matcha Latte';

notify pgrst, 'reload schema';

commit;
