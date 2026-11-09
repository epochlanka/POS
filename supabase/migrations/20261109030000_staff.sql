-- Staff who use a shop's devices. Owners and managers sign in with an email
-- account (shop_members); everyone, cashiers included, unlocks the till with
-- a PIN. Profiles sync to every device in the shop so PIN unlock works
-- offline. pin_hash is PBKDF2-SHA256 with a per-profile salt, made on the
-- device (src/auth/pin.ts); the PIN itself never leaves the device.
create table staff (
  id uuid primary key,
  shop_id uuid not null references shops(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null, -- set for staff who also have an account
  name text not null,
  role member_role not null default 'cashier',
  pin_hash text not null,
  is_active integer not null default 1,
  created_at timestamptz not null default now()
);
create index staff_shop on staff (shop_id);

alter table staff enable row level security;
create policy staff_read on staff for select using (is_shop_member(shop_id));
create policy staff_write on staff for all
  using (has_shop_role(shop_id, '{owner,manager}')) with check (has_shop_role(shop_id, '{owner,manager}'));

grant select, insert, update, delete on staff to authenticated;
alter publication powersync add table staff;
