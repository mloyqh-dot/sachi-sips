alter table donations
  add column if not exists donor_name text;

create index if not exists idx_donations_donor_name on donations(donor_name);
