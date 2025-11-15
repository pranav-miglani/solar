# Troubleshooting Migration Errors

## Error: "alerts" does not exist

### Cause

This error typically occurs when:
1. The migration script fails partway through
2. The `alerts` table creation is skipped due to an earlier error
3. Running migrations in the wrong order
4. Transaction rollback due to an error

### Solution

#### Step 1: Check Current State

Run this in Supabase SQL Editor to see what tables exist:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

#### Step 2: Check for Errors

Look for any error messages in the migration output. Common issues:
- Missing ENUM types
- Foreign key constraint violations
- Syntax errors

#### Step 3: Run Migration Again

The migration script now includes:
- ✅ Safe DROP statements (check table existence first)
- ✅ Verification at the end to confirm all tables were created
- ✅ Better error handling

**Run the complete migration:**

1. Copy the entire contents of `supabase/migrations/001_initial_schema.sql`
2. Paste into Supabase SQL Editor
3. Run the script
4. Check for the success message: `✅ All 8 tables created successfully`

#### Step 4: Verify Tables Created

After running the migration, verify all tables exist:

```sql
-- Should return 8 rows
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'accounts', 'organizations', 'vendors', 'plants',
    'work_orders', 'work_order_plants', 'alerts', 'work_order_plant_eff'
  )
ORDER BY table_name;
```

#### Step 5: Check Alerts Table Specifically

```sql
-- Check if alerts table exists and has correct structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'alerts'
ORDER BY ordinal_position;
```

**Expected columns:**
- id (integer)
- plant_id (integer)
- vendor_alert_id (text)
- title (text)
- description (text)
- severity (alert_severity)
- status (alert_status)
- metadata (jsonb)
- created_at (timestamp with time zone)
- updated_at (timestamp with time zone)
- resolved_at (timestamp with time zone)

### If Migration Still Fails

#### Option A: Run in Parts

If the full migration fails, try running it in sections:

1. **Drop section** (lines 1-40)
2. **ENUM types** (lines 42-54)
3. **Tables** (one at a time):
   - accounts
   - organizations
   - vendors
   - plants
   - work_orders
   - work_order_plants
   - **alerts** ← Check this one specifically
   - work_order_plant_eff
4. **Indexes**
5. **Triggers**

#### Option B: Manual Table Creation

If the alerts table specifically fails, create it manually:

```sql
-- First ensure ENUMs exist
CREATE TYPE alert_severity AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE alert_status AS ENUM ('ACTIVE', 'RESOLVED', 'ACKNOWLEDGED');

-- Then create alerts table
CREATE TABLE alerts (
  id SERIAL PRIMARY KEY,
  plant_id INTEGER NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  vendor_alert_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  severity alert_severity NOT NULL DEFAULT 'MEDIUM',
  status alert_status NOT NULL DEFAULT 'ACTIVE',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX idx_alerts_plant_id ON alerts(plant_id);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_created_at ON alerts(created_at);

-- Create trigger
CREATE TRIGGER update_alerts_updated_at BEFORE UPDATE ON alerts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Common Issues

#### Issue: "relation 'plants' does not exist"

**Cause**: Alerts table references plants table, which must be created first.

**Solution**: Ensure tables are created in this order:
1. organizations
2. accounts
3. vendors
4. **plants** (must exist before alerts)
5. work_orders
6. work_order_plants
7. **alerts** (depends on plants)
8. work_order_plant_eff

#### Issue: "type 'alert_severity' does not exist"

**Cause**: ENUM types must be created before tables that use them.

**Solution**: Ensure ENUMs are created first:
```sql
CREATE TYPE alert_severity AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE alert_status AS ENUM ('ACTIVE', 'RESOLVED', 'ACKNOWLEDGED');
```

#### Issue: Transaction Rollback

**Cause**: An error earlier in the script causes the entire transaction to rollback.

**Solution**: 
- Check for error messages before the "alerts" error
- Fix the earlier error first
- Run migration again

### Verification Queries

After successful migration, run these to verify:

```sql
-- 1. Check all tables exist
SELECT COUNT(*) as table_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'accounts', 'organizations', 'vendors', 'plants',
    'work_orders', 'work_order_plants', 'alerts', 'work_order_plant_eff'
  );
-- Should return: 8

-- 2. Check alerts table structure
\d alerts
-- Or
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'alerts';

-- 3. Check ENUM types
SELECT typname 
FROM pg_type 
WHERE typname IN ('alert_severity', 'alert_status');
-- Should return 2 rows

-- 4. Check foreign keys
SELECT
  tc.table_name, 
  kcu.column_name, 
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'alerts';
-- Should show plant_id references plants(id)
```

### Quick Fix Script

If you just need to create the alerts table:

```sql
-- Quick fix: Create alerts table if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'alerts'
  ) THEN
    -- Ensure ENUMs exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_severity') THEN
      CREATE TYPE alert_severity AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_status') THEN
      CREATE TYPE alert_status AS ENUM ('ACTIVE', 'RESOLVED', 'ACKNOWLEDGED');
    END IF;
    
    -- Create alerts table
    CREATE TABLE alerts (
      id SERIAL PRIMARY KEY,
      plant_id INTEGER NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
      vendor_alert_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      severity alert_severity NOT NULL DEFAULT 'MEDIUM',
      status alert_status NOT NULL DEFAULT 'ACTIVE',
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_at TIMESTAMPTZ
    );
    
    -- Create indexes
    CREATE INDEX idx_alerts_plant_id ON alerts(plant_id);
    CREATE INDEX idx_alerts_status ON alerts(status);
    CREATE INDEX idx_alerts_created_at ON alerts(created_at);
    
    -- Create trigger (if function exists)
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
      CREATE TRIGGER update_alerts_updated_at BEFORE UPDATE ON alerts
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    RAISE NOTICE '✅ Alerts table created successfully';
  ELSE
    RAISE NOTICE 'ℹ️  Alerts table already exists';
  END IF;
END $$;
```

## Other Common Migration Errors

### Error: "relation 'accounts' already exists"

**Solution**: The DROP statements should handle this, but if it persists:
```sql
DROP TABLE IF EXISTS accounts CASCADE;
```

### Error: "type 'account_type' already exists"

**Solution**: 
```sql
DROP TYPE IF EXISTS account_type CASCADE;
```

### Error: "function update_updated_at_column() does not exist"

**Solution**: The function is created in the migration. Ensure it runs before triggers are created.

## Best Practices

1. **Run migrations in order**: 001 → 002 → 003
2. **Check for errors**: Read the entire error message
3. **Verify after each migration**: Run verification queries
4. **Use transactions**: The migration uses BEGIN/COMMIT for safety
5. **Backup first**: Always backup before running migrations in production

## Getting Help

If migrations continue to fail:

1. Check Supabase logs for detailed error messages
2. Run verification queries to see current state
3. Try running sections of the migration individually
4. Check for conflicting objects (tables, types, functions)

