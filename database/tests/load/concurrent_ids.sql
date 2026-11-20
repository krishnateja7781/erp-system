-- 50 clients generating IDs in the SAME prefix at once: every ID must be unique.
select generate_college_id('B.Tech', 'Cyber Security', 2027);
