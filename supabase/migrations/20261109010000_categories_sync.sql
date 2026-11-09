-- POS category chips: translated names and owner-set order, synced to devices.
alter table categories
  add column name_si text,
  add column name_ta text,
  add column sort_order integer not null default 0;

alter table categories alter column id drop default;

alter publication powersync add table categories;
