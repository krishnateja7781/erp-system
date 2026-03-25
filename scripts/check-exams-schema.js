
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

async function checkExamsSchema() {
    try {
        const { data, error } = await supabase.from('exam_schedules').select('*').limit(1);
        if (error) {
            console.error('Error fetching exams:', error);
        } else if (data && data.length > 0) {
            console.log('Exam Record Keys:', Object.keys(data[0]));
            console.log('Sample Record:', data[0]);
        } else {
            console.log('No exam records found.');
        }
    } catch (err) {
        console.error('Script error:', err);
    }
}

checkExamsSchema();
