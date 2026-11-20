\set n random(1, 5000)
select apply_to_opportunity(('bbbbbbbb-0000-0000-0000-' || lpad(:n::text, 12, '0'))::uuid, 'ffffffff-0000-0000-0000-000000000001');
