begin;

update products
set stock_quantity = 8
where name = 'Iced Hojicha Latte';

notify pgrst, 'reload schema';

commit;
