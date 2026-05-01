begin;

update products
set stock_quantity = 0
where name in (
  'Momotarō - Hot',
  'Momotarō - Iced',
  'Sticker Sheet'
);

notify pgrst, 'reload schema';

commit;
