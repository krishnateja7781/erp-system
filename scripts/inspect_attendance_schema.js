const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load .env.local from project root
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectAttendanceSchema() {
    console.log('Trying minimal upsert...');
    const testId = 'test_minimal_' + Date.now();
    const { error } = await supabase.from('attendance').upsert([{
        id: testId,
        classId: 'test_class',
        studentId: 'test_student',
        status: 'Present',
        date: '2026-03-02',
        period: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    }]);

    if (error) {
        console.error('Minimal upsert FAILED:', error.message);
    } else {
        console.log('Minimal upsert SUCCESS!');
        // Clean up
        await supabase.from('attendance').delete().eq('id', testId);
    }
}

inspectAttendanceSchema();
