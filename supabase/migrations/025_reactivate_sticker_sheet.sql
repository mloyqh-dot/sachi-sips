begin;

update products
set stock_quantity = null
where name = 'Sticker Sheet';

notify pgrst, 'reload schema';

commit;
