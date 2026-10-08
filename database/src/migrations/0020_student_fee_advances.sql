-- Migration: 0020_student_fee_advances.sql (AZ-05)
-- Advance fees liability tables and allocation tracking

CREATE TABLE IF NOT EXISTS student_fee_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  academic_year_id uuid REFERENCES academic_years(id) ON DELETE RESTRICT,
  advance_number text NOT NULL,
  advance_date timestamptz NOT NULL DEFAULT now(),
  amount numeric(12, 2) NOT NULL,
  allocated_amount numeric(12, 2) NOT NULL DEFAULT '0.00',
  balance_amount numeric(12, 2) NOT NULL,
  payment_method text NOT NULL DEFAULT 'CASH',
  transaction_reference text,
  bank_account_id uuid REFERENCES bank_accounts(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'UNALLOCATED',
  receipt_number text,
  remarks text,
  created_by_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_fee_advances_number_unique UNIQUE (school_id, advance_number)
);

CREATE INDEX IF NOT EXISTS idx_student_fee_advances_student ON student_fee_advances(school_id, student_id);
CREATE INDEX IF NOT EXISTS idx_student_fee_advances_status ON student_fee_advances(status);
CREATE INDEX IF NOT EXISTS idx_student_fee_advances_date ON student_fee_advances(advance_date);

CREATE TABLE IF NOT EXISTS student_fee_advance_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  advance_id uuid NOT NULL REFERENCES student_fee_advances(id) ON DELETE RESTRICT,
  fee_invoice_id uuid NOT NULL REFERENCES fee_invoices(id) ON DELETE RESTRICT,
  allocated_amount numeric(12, 2) NOT NULL,
  allocation_date timestamptz NOT NULL DEFAULT now(),
  ledger_transaction_id uuid REFERENCES account_ledger_transactions(id) ON DELETE SET NULL,
  created_by_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_advance_allocations_advance ON student_fee_advance_allocations(advance_id);
CREATE INDEX IF NOT EXISTS idx_advance_allocations_invoice ON student_fee_advance_allocations(fee_invoice_id);
CREATE INDEX IF NOT EXISTS idx_advance_allocations_school ON student_fee_advance_allocations(school_id);
