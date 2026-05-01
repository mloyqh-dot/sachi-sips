begin;

update products
set stock_quantity = 0
where name in (
  'Spam Musubi',
  'Iced Banana Hojicha Latte'
);

notify pgrst, 'reload schema';

commit;
