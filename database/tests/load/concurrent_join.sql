\set n random(1, 5000)
select join_classroom('LOAD123', ('aaaaaaaa-0000-0000-0000-' || lpad(:n::text, 12, '0'))::uuid);
