# Migration Files Summary

This document explains what each migration file does and when to use them.

## Core Migrations (Required)

### 001_initial_schema.sql
**Purpose**: Creates the main database schema  
**When to run**: First, on a fresh database  
**What it does**:
- Creates all tables (accounts, organizations, vendors, plants, work_orders, alerts, etc.)
- Creates ENUM types (account_type, vendor_type, etc.)
- Creates indexes for performance
- Creates triggers for updated_at timestamps
- Includes DROP statements for clean setup

**Run this first!**

### 002_rls_policies.sql
**Purpose**: Sets up Row-Level Security policies  
**When to run**: After 001_initial_schema.sql  
**What it does**:
- Enables RLS on all tables
- Creates helper functions (get_account_type, etc.)
- Creates policies for each table based on user roles
- Includes DROP statements for clean setup

**Run this second!**

### 003_telemetry_db_schema.sql
**Purpose**: Creates telemetry database schema  
**When to run**: On a separate Supabase project (telemetry DB)  
**What it does**:
- Creates telemetry_readings table
- Creates indexes for fast queries
- Creates cleanup function for 24h retention
- Includes DROP statements for clean setup

**Run this on your telemetry database project!**

## User Setup (Choose One)

### 004_manual_user_setup.sql
**Purpose**: Creates default user accounts  
**When to run**: After 001 and 002 are complete  
**What it does**:
- Deletes all existing accounts
- Creates organizations (if needed)
- Creates 3 accounts with plain text passwords:
  - `admin@woms.com` / `admin123` (Super Admin)
  - `govt@woms.com` / `govt123` (Government)
  - `org1@woms.com` / `org1123` (Organization)

**Use this to create users!**

## Utility Scripts

### 005_delete_all_accounts.sql
**Purpose**: Deletes all accounts (cleanup utility)  
**When to run**: When you need to clear all accounts  
**What it does**:
- Deletes all rows from accounts table
- Shows count of remaining accounts

**Use this to reset accounts before creating new ones!**

## Migration Order

1. **Main Database**:
   - Run `001_initial_schema.sql`
   - Run `002_rls_policies.sql`
   - Run `004_manual_user_setup.sql` (to create users)

2. **Telemetry Database** (separate project):
   - Run `003_telemetry_db_schema.sql`

## Quick Reference

| File | Purpose | Required? |
|------|---------|-----------|
| 001_initial_schema.sql | Main schema | ✅ Yes |
| 002_rls_policies.sql | Security policies | ✅ Yes |
| 003_telemetry_db_schema.sql | Telemetry DB | ✅ Yes |
| 004_manual_user_setup.sql | Create users | ✅ Recommended |
| 005_delete_all_accounts.sql | Cleanup utility | ⚠️ Optional |

## Notes

- All migrations include DROP statements for clean setup
- All migrations are idempotent (can be run multiple times)
- All migrations include error handling and verification
- Passwords are stored in plain text (implement hashing for production)

