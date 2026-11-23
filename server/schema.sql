CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  phone_e164 text UNIQUE,
  password_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_users_login_method CHECK (
    (email IS NOT NULL AND password_hash IS NOT NULL)
    OR phone_e164 IS NOT NULL
  )
);

CREATE TABLE IF NOT EXISTS app_sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  admin_verified_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_sessions
  ADD COLUMN IF NOT EXISTS admin_verified_until timestamptz;

CREATE INDEX IF NOT EXISTS app_sessions_user_idx ON app_sessions (user_id);
CREATE INDEX IF NOT EXISTS app_sessions_expiry_idx ON app_sessions (expires_at);

CREATE TABLE IF NOT EXISTS parking_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_number text NOT NULL,
  vehicle_number text NOT NULL,
  arrival_at timestamptz NOT NULL,
  expected_exit_at timestamptz NOT NULL,
  hold_until timestamptz NOT NULL,
  owner_token uuid NOT NULL,
  status text NOT NULL DEFAULT 'reserved'
    CHECK (status IN ('reserved', 'cancelled', 'expired', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT parking_reservations_valid_window
    CHECK (arrival_at < expected_exit_at AND expected_exit_at <= hold_until)
);

ALTER TABLE parking_reservations
  DROP CONSTRAINT IF EXISTS parking_reservations_status_check;

ALTER TABLE parking_reservations
  ADD CONSTRAINT parking_reservations_status_check
  CHECK (status IN ('reserved', 'cancelled', 'expired', 'completed'));

ALTER TABLE parking_reservations
  DROP CONSTRAINT IF EXISTS parking_reservations_no_overlap;

ALTER TABLE parking_reservations
  ADD CONSTRAINT parking_reservations_no_overlap
  EXCLUDE USING gist (
    slot_number WITH =,
    tstzrange(arrival_at, hold_until, '[)') WITH &&
  ) WHERE (status = 'reserved');

CREATE INDEX IF NOT EXISTS parking_reservations_live_idx
  ON parking_reservations (hold_until)
  WHERE status = 'reserved';

CREATE TABLE IF NOT EXISTS parking_sensor_states (
  slot_number text PRIMARY KEY,
  occupied boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION record_parking_sensor_reading(
  p_slot_number text,
  p_occupied boolean
)
RETURNS TABLE(previous_occupied boolean, reservation_completed boolean)
LANGUAGE plpgsql
AS $$
DECLARE
  v_previous_occupied boolean;
  v_updated_reservations integer := 0;
BEGIN
  INSERT INTO parking_sensor_states (slot_number, occupied)
  VALUES (p_slot_number, false)
  ON CONFLICT (slot_number) DO NOTHING;

  SELECT sensor_state.occupied
  INTO v_previous_occupied
  FROM parking_sensor_states AS sensor_state
  WHERE sensor_state.slot_number = p_slot_number
  FOR UPDATE;

  UPDATE parking_sensor_states
  SET occupied = p_occupied, updated_at = now()
  WHERE slot_number = p_slot_number;

  IF v_previous_occupied AND NOT p_occupied THEN
    UPDATE parking_reservations
    SET status = 'completed'
    WHERE slot_number = p_slot_number
      AND status = 'reserved'
      AND arrival_at <= now()
      AND hold_until > now();
    GET DIAGNOSTICS v_updated_reservations = ROW_COUNT;
  END IF;

  RETURN QUERY
  SELECT v_previous_occupied, v_updated_reservations > 0;
END;
$$;
