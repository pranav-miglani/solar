# Quick Fix: No Users in Database

## Problem

You're seeing this error when trying to login:
```
❌ [LOGIN] Database error: { code: 'PGRST116', message: 'Cannot coerce the result to a single JSON object' }
✅ [LOGIN] Database connection successful { totalAccounts: 0 }
```

**Root Cause**: No users have been created in the `accounts` table yet.

## Solution

### Step 1: Create Users via SQL Script

1. **Open Supabase SQL Editor**
   - Go to your Supabase project dashboard
   - Click "SQL Editor" in the left sidebar
   - Click "New query"

2. **Run the Setup Script**
   - Open `supabase/migrations/004_manual_user_setup.sql`
   - Copy the entire file content
   - Paste into SQL Editor
   - Click "Run"
   - This creates users with plain text passwords

3. **Verify Users Were Created**

   Run this query in SQL Editor:
   ```sql
   SELECT email, account_type, org_id FROM accounts ORDER BY email;
   ```

   You should see:
   - `admin@woms.com` (SUPERADMIN)
   - `govt@woms.com` (GOVT)
   - `org1@woms.com` (ORG)

### Step 2: Test Login

After creating users, try logging in again:

```bash
# Test with curl
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@woms.com","password":"admin123"}' \
  -v
```

Or use the browser:
- Go to `http://localhost:3000`
- Login with:
  - Email: `admin@woms.com`
  - Password: `admin123`

## Default Accounts Created

After running the setup script, these accounts are available:

| Account Type | Email | Password | Access Level |
|-------------|-------|----------|--------------|
| Super Admin | `admin@woms.com` | `admin123` | Full system access |
| Government | `govt@woms.com` | `govt123` | Read-only global view |
| Organization | `org1@woms.com` | `org1123` | Read-only org view |

## Troubleshooting

### Still Getting "Account not found"?

1. **Check if users exist:**
   ```sql
   SELECT COUNT(*) as total FROM accounts;
   ```

2. **Check specific user:**
   ```sql
   SELECT * FROM accounts WHERE email = 'admin@woms.com';
   ```

3. **If no users found:**
   - Re-run the setup script
   - Check for errors in SQL Editor
   - Verify you're running it in the correct Supabase project (main DB, not telemetry DB)

### Password Not Working?

- Ensure you ran `004_manual_user_setup.sql`
- Check password in database: `SELECT email, password_hash FROM accounts WHERE email = 'admin@woms.com';`
- Password should be exactly `admin123` (plain text)

## Next Steps

Once login works:
1. ✅ Test all three account types
2. ✅ Verify dashboard loads correctly
3. ✅ Check role-based access
4. ✅ For production: Implement proper password hashing (bcrypt, argon2, etc.)

## Related Documentation

- [SETUP_GUIDE.md](./SETUP_GUIDE.md) - Complete setup instructions
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - More troubleshooting help

