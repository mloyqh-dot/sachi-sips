begin;

update products
set
  is_available = true,
  stock_quantity = null
where name in (
  'Spam Musubi',
  'Classic Shio Pan',
  'Scallion Cream Cheese Onion Shio Pan'
);

notify pgrst, 'reload schema';

commit;
