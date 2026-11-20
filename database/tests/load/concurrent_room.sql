\set n random(1, 5000)
select allocate_hostel_room('51000000-0000-0000-0000-0000000000aa', ('bbbbbbbb-0000-0000-0000-' || lpad(:n::text, 12, '0'))::uuid);
