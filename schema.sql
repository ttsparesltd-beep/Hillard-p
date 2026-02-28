-- ================================================================
-- Hillard Performance — My Garage App
-- Supabase Database Schema
-- Run this in your Supabase SQL editor to set up all tables
-- ================================================================

-- ── Customers ──────────────────────────────────────────────────
CREATE TABLE customers (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name                TEXT NOT NULL,
  email               TEXT NOT NULL UNIQUE,
  phone               TEXT,
  reminders_enabled   BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── Vehicles ───────────────────────────────────────────────────
CREATE TABLE vehicles (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id         UUID REFERENCES customers(id) ON DELETE CASCADE,
  registration        TEXT NOT NULL,
  make                TEXT,
  model               TEXT,
  year                INTEGER,
  colour              TEXT,
  fuel_type           TEXT,
  engine_capacity     INTEGER,           -- in cc
  mot_expiry_date     DATE,
  tax_due_date        DATE,
  service_due_date    DATE,              -- set manually by garage
  last_service_date   DATE,
  last_service_mileage INTEGER,
  active              BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── Service History ────────────────────────────────────────────
CREATE TABLE service_history (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id          UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  customer_id         UUID REFERENCES customers(id) ON DELETE CASCADE,
  service_date        DATE NOT NULL,
  service_type        TEXT NOT NULL,     -- e.g. 'Full Service', 'MOT', 'Repair'
  description         TEXT,
  mileage             INTEGER,
  technician          TEXT,
  next_service_date   DATE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── Invoices ───────────────────────────────────────────────────
CREATE TABLE invoices (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id          UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  customer_id         UUID REFERENCES customers(id) ON DELETE CASCADE,
  invoice_number      TEXT NOT NULL UNIQUE,
  invoice_date        DATE NOT NULL,
  due_date            DATE,
  line_items          JSONB DEFAULT '[]',  -- array of {description, qty, unit_price}
  subtotal            NUMERIC(10,2),
  vat_amount          NUMERIC(10,2),
  total_amount        NUMERIC(10,2) NOT NULL,
  status              TEXT DEFAULT 'unpaid',   -- unpaid | paid | overdue
  paid_at             TIMESTAMPTZ,
  pdf_url             TEXT,               -- link to stored PDF
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── Reminder Log (prevents duplicate sends) ────────────────────
CREATE TABLE reminder_log (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id          UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  customer_id         UUID REFERENCES customers(id) ON DELETE CASCADE,
  reminder_type       TEXT NOT NULL,      -- 'mot' | 'service'
  days_threshold      INTEGER NOT NULL,   -- 30
  sent_at             TIMESTAMPTZ DEFAULT NOW()
);

-- ── Row Level Security (RLS) ───────────────────────────────────
-- Customers can only see their own data

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Customers policy: users see only their own record
CREATE POLICY "Customers see own record"
  ON customers FOR SELECT
  USING (auth.email() = email);

-- Vehicles policy: users see only their own vehicles
CREATE POLICY "Customers see own vehicles"
  ON vehicles FOR SELECT
  USING (
    customer_id = (
      SELECT id FROM customers WHERE email = auth.email()
    )
  );

-- Service history policy
CREATE POLICY "Customers see own service history"
  ON service_history FOR SELECT
  USING (
    customer_id = (
      SELECT id FROM customers WHERE email = auth.email()
    )
  );

-- Invoices policy
CREATE POLICY "Customers see own invoices"
  ON invoices FOR SELECT
  USING (
    customer_id = (
      SELECT id FROM customers WHERE email = auth.email()
    )
  );

-- ── Sample Data (for testing) ──────────────────────────────────
INSERT INTO customers (name, email, phone) VALUES
  ('James Robertson', 'james@example.com', '07700 900123');

INSERT INTO vehicles (
  customer_id, registration, make, model, year,
  colour, fuel_type, engine_capacity,
  mot_expiry_date, tax_due_date, service_due_date, last_service_date
) VALUES (
  (SELECT id FROM customers WHERE email = 'james@example.com'),
  'LD21XPF', 'BMW', 'M4 Competition', 2021,
  'Black', 'Petrol', 2998,
  CURRENT_DATE + INTERVAL '30 days',   -- MOT due in exactly 30 days (will trigger reminder!)
  CURRENT_DATE + INTERVAL '90 days',
  CURRENT_DATE + INTERVAL '30 days',   -- Service also due in 30 days
  '2024-03-15'
);
