begin;

alter table products
  drop constraint if exists products_category_check;

truncate table products cascade;

alter table products
  add constraint products_category_check
  check (category in ('Matcha', 'Filter Coffee', 'Mocktail', 'Bites', 'Bakes', 'Merch'));

insert into products (name, price, category, subcategory, sort_order, is_available) values
  ('Iced Matcha Latte', 7.50, 'Matcha', 'Matcha Latte', 10, true),
  ('Iced Strawberry Matcha Latte', 8.50, 'Matcha', 'Matcha Latte', 20, true),
  ('Iced Lychee Matcha Latte', 8.50, 'Matcha', 'Matcha Latte', 30, true),
  ('Iced Hojicha Latte', 7.00, 'Matcha', 'Hojicha Latte', 40, true),
  ('Iced Banana Hojicha Latte', 8.00, 'Matcha', 'Hojicha Latte', 50, true),
  ('Momotarō - Hot', 6.00, 'Filter Coffee', 'Momotarō', 10, true),
  ('Momotarō - Iced', 6.00, 'Filter Coffee', 'Momotarō', 20, true),
  ('Orthodox - Hot', 8.00, 'Filter Coffee', 'Orthodox', 30, true),
  ('Orthodox - Iced', 8.00, 'Filter Coffee', 'Orthodox', 40, true),
  ('Mocktail Flight (Set of 3 mini drinks)', 10.00, 'Mocktail', 'Flights', 10, true),
  ('Tater Tots', 5.00, 'Bites', 'Hot Bites', 10, true),
  ('Spam Musubi', 5.00, 'Bites', 'Hot Bites', 20, true),
  ('Classic Shio Pan', 4.00, 'Bakes', 'Bakes', 10, true),
  ('Scallion Cream Cheese Onion Shio Pan', 6.00, 'Bakes', 'Bakes', 20, true),
  ('Sachi''s Postcard', 2.00, 'Merch', 'Sachi Sips Collection', 10, true),
  ('Sachi''s Sticker', 3.50, 'Merch', 'Sachi Sips Collection', 20, true),
  ('Sachi''s Starter Pack', 5.00, 'Merch', 'Sachi Sips Collection', 30, true),
  ('Sachi''s Tote', 20.00, 'Merch', 'Sachi Sips Collection', 40, true),
  ('Scrunchie', 6.00, 'Merch', 'Esther House Collection', 50, true),
  ('Hair Clip', 6.50, 'Merch', 'Esther House Collection', 60, true),
  ('Magnet', 6.50, 'Merch', 'Esther House Collection', 70, true),
  ('Pouch', 9.00, 'Merch', 'Esther House Collection', 80, true),
  ('Sticker Sheet', 10.00, 'Merch', 'Friends of Sachi Collection', 90, true);

commit;
