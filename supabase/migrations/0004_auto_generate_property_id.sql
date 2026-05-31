-- Auto-generate property IDs in the format P-000001 when id is omitted.
-- Keeps compatibility with existing text IDs and current app types.

create sequence if not exists public._properties_id_seq;

select setval(
  'public._properties_id_seq',
  coalesce(
    (
      select max((substring(id from '^P-([0-9]+)$'))::bigint) + 1
      from public._properties
      where id ~ '^P-([0-9]+)$'
    ),
    1
  ),
  false
);

alter table public._properties
  alter column id set default ('P-' || lpad(nextval('public._properties_id_seq')::text, 6, '0'));
