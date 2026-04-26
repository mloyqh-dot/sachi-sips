-- The transactions table from 002_create_transactions.sql was the original
-- single-table cart receipt store. It was superseded by the orders +
-- order_items workflow in 004 and is no longer referenced by any app code.
-- Its open RLS policies allowed anyone with the anon key to insert/read,
-- so dropping it removes that public write surface.

drop policy if exists "Anyone can insert transactions" on transactions;
drop policy if exists "Anyone can read transactions" on transactions;

drop table if exists transactions;
