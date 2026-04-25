create table if not exists donations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  amount numeric(10, 2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('cash', 'card', 'other')),
  staff_name text not null check (length(trim(staff_name)) > 0),
  note text
);

create index if not exists idx_donations_created_at on donations(created_at desc);
create index if not exists idx_donations_payment_method on donations(payment_method);
create index if not exists idx_donations_staff_name on donations(staff_name);

alter table donations enable row level security;

revoke all on table donations from anon;
revoke all on table donations from authenticated;
grant select, insert on table donations to service_role;
