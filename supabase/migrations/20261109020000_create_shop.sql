-- Shop sign-up: a signed-in user creates a shop and becomes its owner.
-- shops has no insert policy, so this is the only way to create one; it
-- adds the first branch and the owner membership in the same transaction.
create or replace function create_shop(p_name text, p_address text default null, p_phone text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_shop uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'shop name is required' using errcode = '22023';
  end if;

  insert into shops (name, address, phone)
    values (trim(p_name), nullif(trim(p_address), ''), nullif(trim(p_phone), ''))
    returning id into v_shop;
  insert into branches (shop_id, name) values (v_shop, 'Main');
  insert into shop_members (shop_id, user_id, role) values (v_shop, auth.uid(), 'owner');
  return v_shop;
end;
$$;

revoke all on function create_shop(text, text, text) from public, anon;
grant execute on function create_shop(text, text, text) to authenticated;

-- Newer Supabase projects no longer grant table access to the API roles by
-- default. Signed-in users get table privileges; row-level security still
-- decides which rows they see. anon gets nothing.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;
