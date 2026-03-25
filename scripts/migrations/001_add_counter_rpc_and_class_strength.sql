-- ============================================================================
-- Migration 001: Add atomic counter RPC + class maxStrength column
-- Run this on an EXISTING database — no data is dropped.
-- Date: 2026-03-03
-- ============================================================================

-- 1. Atomic counter increment function (single-roundtrip from client)
--    Inserts a new counter with value=1 if it doesn't exist,
--    or increments the existing value by 1.
CREATE OR REPLACE FUNCTION increment_counter(counter_key TEXT)
RETURNS INTEGER AS $$
DECLARE
  next_val INTEGER;
BEGIN
  INSERT INTO "counters" ("id", "value")
  VALUES (counter_key, 1)
  ON CONFLICT ("id")
  DO UPDATE SET "value" = "counters"."value" + 1
  RETURNING "value" INTO next_val;
  RETURN next_val;
END;
$$ LANGUAGE plpgsql;

-- 2. Add maxStrength column to classes table (default 15 students per section)
--    Safe to run even if column already exists — DO NOTHING on error.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'classes' AND column_name = 'maxStrength'
  ) THEN
    ALTER TABLE "classes" ADD COLUMN "maxStrength" NUMERIC DEFAULT 15;
  END IF;
END $$;
