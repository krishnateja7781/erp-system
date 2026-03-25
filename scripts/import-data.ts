import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load variables from .env.local manually
const envPath = path.join(process.cwd(), '.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');

let url = '';
let key = '';

envFile.split('\n').forEach(line => {
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].trim();
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
});

if (!url || !key) {
    console.error('Missing Supabase URL or Key in .env.local');
    process.exit(1);
}

const supabase = createClient(url, key);

// Migration Map (Local JSON file name -> Supabase Table Name)
const collections = [
    { file: 'users.json', table: 'users' },
    { file: 'students.json', table: 'students' },
    { file: 'teachers.json', table: 'teachers' },
    { file: 'admins.json', table: 'admins' },
    { file: 'courses.json', table: 'courses' },
    { file: 'classes.json', table: 'classes' },
    { file: 'attendance.json', table: 'attendance' },
    { file: 'marks.json', table: 'marks' },
    { file: 'fees.json', table: 'fees' },
    { file: 'hostels.json', table: 'hostels' },
    { file: 'rooms.json', table: 'hostel_rooms' },
    { file: 'complaints.json', table: 'complaints' },
    { file: 'placements.json', table: 'opportunities' },
    { file: 'applications.json', table: 'applications' },
    { file: 'exams.json', table: 'exam_schedules' },
    { file: 'notifications.json', table: 'notifications' }
];

async function migrate() {
    console.log(`🚀 Starting Migration to Supabase: ${url}`);

    for (const { file, table } of collections) {
        const filePath = path.join(process.cwd(), 'src', 'data', file);
        if (!fs.existsSync(filePath)) {
            console.log(`⚠️  Skipping ${file} - does not exist locally.`);
            continue;
        }

        try {
            const rawData = fs.readFileSync(filePath, 'utf-8');
            let parsed = JSON.parse(rawData);

            if (parsed.length === 0) {
                console.log(`⏭️  Skipping ${table} - local JSON is empty.`);
                continue;
            }

            // Normalization for placement/internship merge
            if (file === 'placements.json') {
                parsed = parsed.map((p: any) => ({ ...p, type: 'placement' }));
            }
            if (file === 'internships.json') {
                parsed = parsed.map((p: any) => ({ ...p, type: 'internship' }));
            }

            // Supabase allows bulk inserts
            const { error } = await supabase.from(table).upsert(parsed);

            if (error) {
                console.error(`❌ Error migrating ${table}:`, error.message);
            } else {
                console.log(`✅ Successfully migrated ${parsed.length} rows to ${table}.`);
            }

        } catch (e: any) {
            console.error(`❌ Failed processing ${file}:`, e.message);
        }
    }

    console.log('🎉 Migration Script Completed!');
}

migrate();
