CREATE TABLE IF NOT EXISTS gestio_enrollment_devices (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  code_hash char(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  device_id uuid UNIQUE,
  computer_name text,
  enrolled_at timestamptz,
  token_hash char(64) UNIQUE,
  request_id uuid,
  recovery_hash char(64),
  response_salt char(64),
  revoked_at timestamptz
);
