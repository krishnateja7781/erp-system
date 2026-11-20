\set n random(1, 300)
select record_fee_payment(('bbbbbbbb-0000-0000-0000-' || lpad(:n::text, 12, '0'))::uuid, 'college', 1, 10, 'UPI', null, null, null);
