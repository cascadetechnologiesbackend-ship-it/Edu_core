-- Migration: 0021_worker_heartbeats.sql (AZ-02)
-- Tracks background automation worker liveness and heartbeat telemetry

CREATE TABLE IF NOT EXISTS worker_heartbeats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_name text NOT NULL,
  last_seen_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'alive',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT worker_heartbeats_worker_name_unique UNIQUE (worker_name)
);

CREATE INDEX IF NOT EXISTS idx_worker_heartbeats_last_seen ON worker_heartbeats(last_seen_at);
