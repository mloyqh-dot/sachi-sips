alter table products
  drop constraint if exists products_category_check;

alter table products
  add column if not exists subcategory text,
  add column if not exists sort_order integer not null default 0;

alter table products
  add constraint products_category_check
  check (category in ('Matcha', 'Coffee', 'Specials', 'Savory', 'Bakery'));
