
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase credentials not found in env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkAttendanceSchema() {
    try {
        const { data: attData, error: attError } = await supabase.from('attendance').select('*').limit(1);
        if (attError) console.error('Attendance error:', attError);
        else console.log('Attendance keys:', Object.keys(attData[0] || {}));

        const { data: classData, error: classError } = await supabase.from('classes').select('*').limit(1);
        if (classError) console.error('Classes error:', classError);
        else console.log('Classes keys:', Object.keys(classData[0] || {}));
    } catch (err) {
        console.error('Script error:', err);
    }
}

checkAttendanceSchema();
