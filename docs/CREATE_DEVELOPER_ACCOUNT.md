# Creating DEVELOPER Accounts

DEVELOPER accounts have all SUPERADMIN privileges plus access to system documentation. **DEVELOPER accounts CANNOT be created via the UI** - they must be created using the provided script.

## Prerequisites

1. **Run the migration** to add DEVELOPER to the account_type enum:
   ```bash
   # Using Supabase CLI
   supabase migration up 022_add_developer_account_type

   # Or manually in Supabase SQL Editor
   # Run: supabase/migrations/022_add_developer_account_type.sql
   ```

2. **Set environment variables**:
   ```bash
   export SUPABASE_URL='https://your-project.supabase.co'
   export SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'
   ```

   Or create a `.env.local` file:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

## Usage

### Method 1: Using npm script (recommended)

```bash
npm run create:developer <email> <password>
```

Example:
```bash
npm run create:developer developer@woms.com dev123456
```

### Method 2: Direct execution

```bash
npx tsx scripts/create-developer-account.ts <email> <password>
```

Example:
```bash
npx tsx scripts/create-developer-account.ts developer@woms.com dev123456
```

## Requirements

- **Email**: Valid email address format
- **Password**: Minimum 6 characters
- **Database**: Migration `022_add_developer_account_type.sql` must be applied
- **Environment**: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` must be set

## What the Script Does

1. Validates email format and password length
2. Checks if account with that email already exists
3. Hashes the password using bcrypt (10 rounds)
4. Creates a DEVELOPER account with:
   - `account_type`: `DEVELOPER`
   - `org_id`: `NULL` (no organization)
   - `is_active`: `true`
5. Displays account details and login credentials

## DEVELOPER Account Privileges

- ✅ All SUPERADMIN privileges:
  - Full access to all organizations, vendors, plants, work orders
  - Can create, read, update, delete all resources
- ✅ Documentation access:
  - Can access `/superadmin/system-flow` documentation
  - SUPERADMIN accounts **cannot** access documentation

## Security Notes

- DEVELOPER accounts are intended for technical team members who need documentation access
- Keep DEVELOPER account credentials secure
- Use strong passwords (minimum 6 characters, but recommend 12+)
- Consider using a password manager for storing credentials

## Troubleshooting

### Error: "invalid input value for enum account_type"

**Solution**: Run migration `022_add_developer_account_type.sql` first:
```bash
supabase migration up 022_add_developer_account_type
```

### Error: "Account with email already exists"

**Solution**: The email is already in use. Use a different email or delete the existing account first.

### Error: "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables must be set"

**Solution**: Set the environment variables:
```bash
export SUPABASE_URL='https://your-project.supabase.co'
export SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'
```

Or add them to `.env.local` file in the project root.

## Example Output

```
🔧 Creating DEVELOPER account...
   Email: developer@woms.com

🔐 Hashing password...
📝 Inserting DEVELOPER account into database...

✅ DEVELOPER account created successfully!

Account Details:
   ID: 123e4567-e89b-12d3-a456-426614174000
   Email: developer@woms.com
   Account Type: DEVELOPER
   Organization ID: NULL (no organization)
   Active: Yes
   Created At: 2025-01-15T10:30:00.000Z

🔐 Login Credentials:
   Email: developer@woms.com
   Password: dev123456

⚠️  Important:
   - DEVELOPER accounts have all SUPERADMIN privileges
   - DEVELOPER accounts can access documentation at /superadmin/system-flow
   - SUPERADMIN accounts CANNOT access documentation
   - Keep these credentials secure!
```

## Related Files

- Script: `scripts/create-developer-account.ts`
- Migration: `supabase/migrations/022_add_developer_account_type.sql`
- RBAC: `lib/rbac.ts`
- API Route: `app/api/accounts/route.ts` (rejects DEVELOPER creation)

