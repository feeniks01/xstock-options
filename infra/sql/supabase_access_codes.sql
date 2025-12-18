-- Access Codes table for early access/waitlist bypass
-- Run this in your Supabase SQL Editor

-- Create access_codes table
CREATE TABLE IF NOT EXISTS access_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  email TEXT,                                    -- Optional: associate with a specific user
  description TEXT,                              -- Optional: note about who this code is for
  is_active BOOLEAN DEFAULT true,                -- Can disable codes without deleting
  used_at TIMESTAMP WITH TIME ZONE,              -- When the code was first used
  used_count INTEGER DEFAULT 0,                  -- How many times the code has been used
  max_uses INTEGER DEFAULT 1,                    -- Max times code can be used (null = unlimited)
  expires_at TIMESTAMP WITH TIME ZONE,           -- Optional expiration date
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on code for fast lookups
CREATE INDEX IF NOT EXISTS idx_access_codes_code ON access_codes(code);

-- Enable Row Level Security
ALTER TABLE access_codes ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anon to read codes (for verification)
-- Note: This only allows checking if a code exists, not listing all codes
DROP POLICY IF EXISTS "Allow anon to verify codes" ON access_codes;
CREATE POLICY "Allow anon to verify codes" ON access_codes
  FOR SELECT
  TO anon
  USING (true);

-- Policy: Allow anon to update used_at and used_count (for tracking usage)
DROP POLICY IF EXISTS "Allow anon to update usage" ON access_codes;
CREATE POLICY "Allow anon to update usage" ON access_codes
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Insert some example codes (optional - delete or modify these)
-- INSERT INTO access_codes (code, description, max_uses) VALUES
--   ('EARLY2024', 'General early access code', 100),
--   ('VIP-INVESTOR', 'For investors', null),
--   ('BETA-TESTER', 'For beta testers', 50);
