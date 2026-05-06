-- Migration: add biweekly_start_date to routes table
-- Run this in the Supabase SQL editor or CLI
ALTER TABLE routes ADD COLUMN IF NOT EXISTS biweekly_start_date date;
