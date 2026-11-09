-- Lanka POS core schema (Phase 1).
-- Every table carries shop_id; row-level security limits each user to the
-- shops they are a member of. Money is integer cents (bigint).
-- Must stay in step with src/db/schema.ts.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tenancy
create table shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  phone text,
  created_at timestamptz not null default now()
);

create table branches (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create type member_role as enum ('owner', 'manager', 'cashier');

create table shop_members (
  shop_id uuid not null references shops(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role member_role not null default 'cashier',
  primary key (shop_id, user_id)
);

-- A counter/device. prefix (C1, C2...) goes into bill numbers so offline
-- counters never issue the same number.
create table devices (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  branch_id uuid not null references branches(id),
  prefix text not null check (prefix ~ '^[A-Z0-9]{1,4}$'),
  name text,
  created_at timestamptz not null default now(),
  unique (shop_id, prefix)
);

create or replace function is_shop_member(p_shop uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from shop_members where shop_id = p_shop and user_id = auth.uid())
$$;

create or replace function has_shop_role(p_shop uuid, p_roles member_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from shop_members where shop_id = p_shop and user_id = auth.uid() and role = any(p_roles))
$$;

-- ---------------------------------------------------------------- catalogue
create table categories (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  name text not null,
  parent_id uuid references categories(id)
);

create table products (
  id uuid primary key,
  shop_id uuid not null references shops(id) on delete cascade,
  category_id uuid references categories(id),
  name text not null,
  name_si text,
  name_ta text,
  tracks_batches integer not null default 0,
  is_active integer not null default 1,
  created_at timestamptz not null default now()
);

create table product_variants (
  id uuid primary key,
  shop_id uuid not null references shops(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  label text not null default '',
  sku text,
  barcode text,
  cost_price bigint not null default 0,
  sell_price bigint not null default 0,
  low_stock_level numeric,
  is_active integer not null default 1
);
create index product_variants_barcode on product_variants (shop_id, barcode);

create table batches (
  id uuid primary key,
  shop_id uuid not null references shops(id) on delete cascade,
  variant_id uuid not null references product_variants(id),
  batch_no text,
  expiry_date date,
  unit_cost bigint,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- stock ledger
-- Append-only. Current stock = sum(qty). Corrections are new rows.
create table stock_movements (
  id uuid primary key,
  shop_id uuid not null references shops(id) on delete cascade,
  branch_id uuid not null,
  variant_id uuid not null references product_variants(id),
  batch_id uuid references batches(id),
  qty numeric not null,
  kind text not null check (kind in ('sale', 'return', 'receive', 'adjust', 'transfer_in', 'transfer_out', 'opening')),
  ref_id uuid,
  unit_cost bigint,
  user_id uuid,
  device_id uuid,
  created_at timestamptz not null default now()
);
create index stock_movements_variant on stock_movements (shop_id, branch_id, variant_id);

-- ---------------------------------------------------------------- sales
create table sales (
  id uuid primary key,
  shop_id uuid not null references shops(id) on delete cascade,
  branch_id uuid not null,
  device_id uuid not null,
  bill_no text not null,
  customer_id uuid,
  cashier_id uuid,
  shift_id uuid,
  subtotal bigint not null,
  discount bigint not null default 0,
  total bigint not null,
  status text not null default 'completed' check (status in ('completed', 'voided')),
  created_at timestamptz not null default now(),
  unique (shop_id, bill_no)
);
create index sales_created on sales (shop_id, created_at);

create table sale_lines (
  id uuid primary key,
  shop_id uuid not null references shops(id) on delete cascade,
  sale_id uuid not null references sales(id),
  variant_id uuid not null references product_variants(id),
  batch_id uuid references batches(id),
  name text not null,
  qty numeric not null,
  unit_price bigint not null,
  unit_cost bigint,
  discount bigint not null default 0,
  total bigint not null
);

create table sale_payments (
  id uuid primary key,
  shop_id uuid not null references shops(id) on delete cascade,
  sale_id uuid not null references sales(id),
  method text not null check (method in ('cash', 'card', 'lankaqr', 'credit')),
  amount bigint not null,
  reference text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- audit
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  user_id uuid,
  device_id uuid,
  action text not null, -- void | discount | price_override | stock_adjust ...
  entity text,
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- RLS
alter table shops enable row level security;
alter table branches enable row level security;
alter table shop_members enable row level security;
alter table devices enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table product_variants enable row level security;
alter table batches enable row level security;
alter table stock_movements enable row level security;
alter table sales enable row level security;
alter table sale_lines enable row level security;
alter table sale_payments enable row level security;
alter table audit_log enable row level security;

create policy shops_read on shops for select using (is_shop_member(id));
create policy shops_update on shops for update using (has_shop_role(id, '{owner}'));

create policy members_read on shop_members for select using (is_shop_member(shop_id));
create policy members_manage on shop_members for all
  using (has_shop_role(shop_id, '{owner}')) with check (has_shop_role(shop_id, '{owner}'));

create policy branches_read on branches for select using (is_shop_member(shop_id));
create policy branches_manage on branches for all
  using (has_shop_role(shop_id, '{owner,manager}')) with check (has_shop_role(shop_id, '{owner,manager}'));

create policy devices_read on devices for select using (is_shop_member(shop_id));
create policy devices_manage on devices for all
  using (has_shop_role(shop_id, '{owner,manager}')) with check (has_shop_role(shop_id, '{owner,manager}'));

-- Catalogue: everyone in the shop reads; owners/managers change it.
create policy categories_read on categories for select using (is_shop_member(shop_id));
create policy categories_write on categories for all
  using (has_shop_role(shop_id, '{owner,manager}')) with check (has_shop_role(shop_id, '{owner,manager}'));
create policy products_read on products for select using (is_shop_member(shop_id));
create policy products_write on products for all
  using (has_shop_role(shop_id, '{owner,manager}')) with check (has_shop_role(shop_id, '{owner,manager}'));
create policy variants_read on product_variants for select using (is_shop_member(shop_id));
create policy variants_write on product_variants for all
  using (has_shop_role(shop_id, '{owner,manager}')) with check (has_shop_role(shop_id, '{owner,manager}'));
create policy batches_read on batches for select using (is_shop_member(shop_id));
create policy batches_write on batches for insert with check (is_shop_member(shop_id));

-- Ledger and sales: any member can read and insert; no updates or deletes
-- (append-only). Voids are a status change, allowed for owners/managers.
create policy movements_read on stock_movements for select using (is_shop_member(shop_id));
create policy movements_insert on stock_movements for insert with check (is_shop_member(shop_id));

create policy sales_read on sales for select using (is_shop_member(shop_id));
create policy sales_insert on sales for insert with check (is_shop_member(shop_id));
create policy sales_void on sales for update
  using (has_shop_role(shop_id, '{owner,manager}')) with check (has_shop_role(shop_id, '{owner,manager}'));

create policy sale_lines_read on sale_lines for select using (is_shop_member(shop_id));
create policy sale_lines_insert on sale_lines for insert with check (is_shop_member(shop_id));
create policy sale_payments_read on sale_payments for select using (is_shop_member(shop_id));
create policy sale_payments_insert on sale_payments for insert with check (is_shop_member(shop_id));

create policy audit_read on audit_log for select using (has_shop_role(shop_id, '{owner,manager}'));
create policy audit_insert on audit_log for insert with check (is_shop_member(shop_id));

-- PowerSync replicates from this publication.
create publication powersync for table
  shop_members, products, product_variants, batches, stock_movements, sales, sale_lines, sale_payments;
