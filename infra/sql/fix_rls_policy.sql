-- Fix RLS policies for subscribers table
-- Run this in your Supabase SQL Editor

-- Verify RLS is enabled
ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;

-- Ensure INSERT policy exists (for inserting emails)
DROP POLICY IF EXISTS "Allow public inserts" ON subscribers;
CREATE POLICY "Allow public inserts" ON subscribers
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Add SELECT policy (needed for .select() after insert)
-- This allows anon users to read the row they just inserted
DROP POLICY IF EXISTS "Allow anon select" ON subscribers;
CREATE POLICY "Allow anon select" ON subscribers
  FOR SELECT
  TO anon
  USING (true);
