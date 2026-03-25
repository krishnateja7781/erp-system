-- SQL Migration for Fees Management (CLEAN REINSTALL)
-- WARNING: This will delete existing fee records if any exist.
-- Run this in your Supabase SQL Editor

-- 1. Drop existing table to ensure clean schema
DROP TABLE IF EXISTS fees CASCADE;

-- 2. Create the 'fees' table with double-quoted case-sensitive columns
CREATE TABLE fees (
    id TEXT PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
    "studentName" TEXT,
    "studentCollegeId" TEXT,
    "program" TEXT,
    "branch" TEXT,
    "year" INTEGER,
    "collegeFees" JSONB DEFAULT '{"total": 150000, "paid": 0, "balance": 150000}'::jsonb,
    "hostelFees" JSONB, 
    "totalFees" NUMERIC,
    "amountPaid" NUMERIC DEFAULT 0,
    "balance" NUMERIC,
    "transactions" JSONB DEFAULT '[]'::jsonb,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now()
);

-- 3. Initialize records for existing students
INSERT INTO fees (
    id, 
    "studentName", 
    "studentCollegeId", 
    "program", 
    "branch", 
    "year", 
    "collegeFees", 
    "hostelFees", 
    "totalFees", 
    "amountPaid", 
    "balance", 
    "transactions",
    "createdAt",
    "updatedAt"
)
SELECT 
    s.id, 
    s.name, 
    s."collegeId", -- Fixed: using double quotes for case-sensitive column
    s.program, 
    s.branch, 
    s.year,
    '{"total": 150000, "paid": 0, "balance": 150000}'::jsonb,
    CASE WHEN s.type = 'Hosteler' THEN '{"total": 50000, "paid": 0, "balance": 50000}'::jsonb ELSE NULL END,
    CASE WHEN s.type = 'Hosteler' THEN 200000 ELSE 150000 END,
    0,
    CASE WHEN s.type = 'Hosteler' THEN 200000 ELSE 150000 END,
    '[]'::jsonb,
    now(),
    now()
FROM students s
LEFT JOIN fees f ON s.id = f.id
WHERE f.id IS NULL;
