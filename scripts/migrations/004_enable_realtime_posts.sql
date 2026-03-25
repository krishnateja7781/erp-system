-- ============================================================================
-- Migration 004: Enable Supabase Realtime for classroom tables
-- This allows INSERT/DELETE events to be broadcast to all connected clients
-- so messages from any member appear instantly without polling.
-- ============================================================================

-- Enable REPLICA IDENTITY so DELETE events include the old row data
ALTER TABLE "classroom_posts" REPLICA IDENTITY FULL;
ALTER TABLE "classroom_assignments" REPLICA IDENTITY FULL;
ALTER TABLE "classroom_submissions" REPLICA IDENTITY FULL;
ALTER TABLE "classroom_notes" REPLICA IDENTITY FULL;

-- Add to the Supabase Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE "classroom_posts";
ALTER PUBLICATION supabase_realtime ADD TABLE "classroom_assignments";
ALTER PUBLICATION supabase_realtime ADD TABLE "classroom_submissions";
ALTER PUBLICATION supabase_realtime ADD TABLE "classroom_notes";
