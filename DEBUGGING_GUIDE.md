# Debugging Guide for WOMS

This guide covers all debugging methods available for the WOMS application.

## Table of Contents

- [VS Code Debugger Setup](#vs-code-debugger-setup)
- [Browser DevTools](#browser-devtools)
- [Console Logging](#console-logging)
- [API Route Debugging](#api-route-debugging)
- [Client Component Debugging](#client-component-debugging)
- [Database Debugging](#database-debugging)
- [Vendor Adapter Debugging](#vendor-adapter-debugging)
- [Common Debugging Scenarios](#common-debugging-scenarios)

## VS Code Debugger Setup

### Quick Start

1. **Open VS Code** in the project root
2. **Press F5** or go to Run → Start Debugging
3. **Select a debug configuration**:
   - `Next.js: Debug Full Stack` - Debug both server and client
   - `Next.js: Debug Server` - Debug server-side code only
   - `Next.js: Debug Client` - Debug client-side React components
   - `Next.js: Debug API Route` - Debug specific API routes

### Available Debug Configurations

#### 1. Debug Full Stack (Recommended)
- **Name**: `Next.js: Debug Full Stack`
- **What it does**: Launches Next.js dev server with Node.js inspector, then opens Chrome for client debugging
- **Use when**: You need to debug both server and client code
- **How to use**:
  1. Set breakpoints in your code (click left of line number)
  2. Press F5
  3. Select "Next.js: Debug Full Stack"
  4. Open `http://localhost:3000` in Chrome
  5. Breakpoints will hit in VS Code

#### 2. Debug Server Only
- **Name**: `Next.js: Debug Server`
- **What it does**: Debugs Next.js API routes and server components
- **Use when**: Debugging authentication, database queries, API routes
- **How to use**:
  1. Set breakpoints in API routes (e.g., `app/api/login/route.ts`)
  2. Press F5 → Select "Next.js: Debug Server"
  3. Make API requests (via browser or curl)
  4. Breakpoints will hit in VS Code

#### 3. Debug Client Only
- **Name**: `Next.js: Debug Client`
- **What it does**: Opens Chrome DevTools for React component debugging
- **Use when**: Debugging React components, hooks, state
- **How to use**:
  1. Set breakpoints in client components
  2. Press F5 → Select "Next.js: Debug Client"
  3. Chrome DevTools will open
  4. Breakpoints will hit in Chrome DevTools

#### 4. Debug API Route
- **Name**: `Next.js: Debug API Route`
- **What it does**: Debugs a specific API route with breakpoints
- **Use when**: Deep debugging of a specific API endpoint
- **How to use**:
  1. Set breakpoints in the API route file
  2. Press F5 → Select "Next.js: Debug API Route"
  3. Make requests to that endpoint
  4. Breakpoints will hit

### Setting Breakpoints

1. **Click left of line number** in VS Code (red dot appears)
2. **Conditional breakpoints**: Right-click → Add Conditional Breakpoint
3. **Logpoints**: Right-click → Add Logpoint (logs without stopping)

### Debug Console

- **View Variables**: Hover over variables in code
- **Watch Expressions**: Add expressions to watch panel
- **Call Stack**: See function call hierarchy
- **Debug Console**: Execute code in current context

## Browser DevTools

### Chrome DevTools

1. **Open DevTools**: `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)
2. **Console Tab**: View logs and errors
3. **Network Tab**: Monitor API requests
4. **Sources Tab**: Set breakpoints in client code
5. **React DevTools**: Install extension for React component inspection

### Useful DevTools Features

#### Console Logging
```javascript
// In browser console
console.log('Debug info:', data)
console.table(arrayData)
console.group('Group Name')
console.groupEnd()
```

#### Network Monitoring
- Filter by XHR/Fetch to see API calls
- Click request → Preview/Response tabs
- Check Headers for authentication cookies

#### React DevTools
- Install Chrome extension: "React Developer Tools"
- Inspect component props, state, hooks
- See component tree hierarchy

## Console Logging

### Server-Side Logging (API Routes)

```typescript
// app/api/login/route.ts
export async function POST(request: NextRequest) {
  console.log('🔐 [LOGIN] Login attempt started')
  console.log('🔐 [LOGIN] Request body:', await request.json())
  
  try {
    // Your code
    console.log('✅ [LOGIN] Success')
  } catch (error) {
    console.error('❌ [LOGIN] Error:', error)
    console.error('❌ [LOGIN] Stack:', error.stack)
  }
}
```

### Client-Side Logging (React Components)

```typescript
'use client'

export function MyComponent() {
  useEffect(() => {
    console.log('🔍 [COMPONENT] Component mounted')
    console.log('🔍 [COMPONENT] Props:', props)
  }, [])
  
  const handleClick = () => {
    console.log('🔍 [COMPONENT] Button clicked')
  }
}
```

### Logging Best Practices

1. **Use Emojis for Quick Scanning**:
   - 🔐 Authentication
   - ✅ Success
   - ❌ Error
   - 🔍 Debug
   - 📊 Data
   - 🔄 Process

2. **Include Context**:
   ```typescript
   console.log('[API:LOGIN] User:', email)
   console.log('[API:LOGIN] Status:', status)
   ```

3. **Log Objects, Not Strings**:
   ```typescript
   // Good
   console.log('Data:', data)
   
   // Bad
   console.log('Data: ' + JSON.stringify(data))
   ```

4. **Use console.error for Errors**:
   ```typescript
   console.error('Error:', error)
   console.error('Stack:', error.stack)
   ```

## API Route Debugging

### Debugging Authentication

```typescript
// app/api/login/route.ts
export async function POST(request: NextRequest) {
  // 1. Set breakpoint here
  const { email, password } = await request.json()
  
  // 2. Inspect variables
  console.log('Email:', email)
  console.log('Password length:', password?.length)
  
  // 3. Check database query
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('email', email)
    .single()
  
  // 4. Inspect query result
  console.log('Query result:', { data, error })
  
  // 5. Check password comparison
  const isValid = await bcrypt.compare(password, data.password_hash)
  console.log('Password valid:', isValid)
}
```

### Debugging Database Queries

```typescript
// Enable query logging
const { data, error } = await supabase
  .from('vendors')
  .select('*, organizations(*)')
  .eq('id', vendorId)

// Log query details
console.log('📊 [DB] Query:', {
  table: 'vendors',
  filters: { id: vendorId },
  resultCount: data?.length,
  error: error?.message
})

// Log full response
console.log('📊 [DB] Full response:', JSON.stringify(data, null, 2))
```

### Debugging Vendor API Calls

```typescript
// lib/vendors/solarmanAdapter.ts
async authenticate(): Promise<string> {
  console.log('🔐 [Solarman] Starting authentication')
  console.log('🔐 [Solarman] Base URL:', this.getApiBaseUrl())
  console.log('🔐 [Solarman] Credentials:', {
    appId: credentials.appId,
    username: credentials.username,
    // Don't log password
  })
  
  const response = await fetch(url, options)
  console.log('🔐 [Solarman] Response status:', response.status)
  console.log('🔐 [Solarman] Response headers:', Object.fromEntries(response.headers))
  
  const data = await response.json()
  console.log('🔐 [Solarman] Response data:', data)
  
  return data.access_token
}
```

## Client Component Debugging

### Debugging React Components

```typescript
'use client'

import { useEffect, useState } from 'react'

export function MyComponent() {
  const [data, setData] = useState(null)
  
  useEffect(() => {
    console.log('🔍 [COMPONENT] Mounted')
    console.log('🔍 [COMPONENT] Initial state:', data)
    
    return () => {
      console.log('🔍 [COMPONENT] Unmounting')
    }
  }, [])
  
  useEffect(() => {
    console.log('🔍 [COMPONENT] State changed:', data)
  }, [data])
  
  const handleClick = async () => {
    console.log('🔍 [COMPONENT] Button clicked')
    
    try {
      const response = await fetch('/api/data')
      const result = await response.json()
      console.log('🔍 [COMPONENT] API response:', result)
      setData(result)
    } catch (error) {
      console.error('🔍 [COMPONENT] Error:', error)
    }
  }
  
  return <button onClick={handleClick}>Click me</button>
}
```

### Debugging Form Submissions

```typescript
const handleSubmit = async (data: FormData) => {
  console.log('📝 [FORM] Submitting:', data)
  
  const response = await fetch('/api/submit', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  
  console.log('📝 [FORM] Response status:', response.status)
  const result = await response.json()
  console.log('📝 [FORM] Response data:', result)
}
```

## Database Debugging

### Using Supabase SQL Editor

1. **Open Supabase Dashboard** → SQL Editor
2. **Run queries directly**:
   ```sql
   -- Check accounts
   SELECT * FROM accounts WHERE email = 'admin@woms.com';
   
   -- Check vendors
   SELECT id, name, org_id, access_token IS NOT NULL as has_token 
   FROM vendors;
   
   -- Check plants
   SELECT id, name, vendor_id, current_power_kw 
   FROM plants 
   WHERE org_id = 1;
   ```

### Testing RLS Policies

```sql
-- Test as different roles
SET ROLE authenticated;
SELECT * FROM accounts; -- Should fail if RLS blocks

-- Test with service role (bypasses RLS)
-- Done automatically in API routes
```

## Vendor Adapter Debugging

### Debugging Solarman Authentication

```typescript
// Set breakpoint in lib/vendors/solarmanAdapter.ts
async authenticate(): Promise<string> {
  // Breakpoint 1: Check DB token
  const dbToken = await this.getTokenFromDB()
  console.log('🔐 [Solarman] DB token exists:', !!dbToken)
  
  // Breakpoint 2: Before API call
  console.log('🔐 [Solarman] Making auth request to:', url)
  
  // Breakpoint 3: After API response
  console.log('🔐 [Solarman] Auth response:', data)
  
  // Breakpoint 4: After storing token
  console.log('🔐 [Solarman] Token stored in DB')
}
```

### Debugging Plant Sync

```typescript
// app/api/vendors/[id]/sync-plants/route.ts
export async function POST(request, { params }) {
  console.log('🔄 [SYNC] Starting plant sync for vendor:', params.id)
  
  // Breakpoint: After fetching vendor
  console.log('🔄 [SYNC] Vendor config:', vendorConfig)
  
  // Breakpoint: After adapter creation
  console.log('🔄 [SYNC] Adapter created:', adapter.constructor.name)
  
  // Breakpoint: After fetching plants
  console.log('🔄 [SYNC] Plants fetched:', vendorPlants.length)
  
  // Breakpoint: During sync loop
  for (const plant of vendorPlants) {
    console.log('🔄 [SYNC] Processing plant:', plant.name)
    // Set breakpoint here to inspect each plant
  }
}
```

## Common Debugging Scenarios

### Scenario 1: Login Not Working

1. **Set breakpoint** in `app/api/login/route.ts`
2. **Check request body**:
   ```typescript
   const { email, password } = await request.json()
   // Inspect: email, password
   ```
3. **Check database query**:
   ```typescript
   const { data, error } = await supabase.from('accounts')...
   // Inspect: data, error
   ```
4. **Check password comparison**:
   ```typescript
   const isValid = await bcrypt.compare(password, data.password_hash)
   // Inspect: isValid
   ```

### Scenario 2: API Route Returns 500

1. **Check server logs** in terminal
2. **Set breakpoint** at start of route handler
3. **Step through** each line
4. **Check error stack trace**:
   ```typescript
   catch (error) {
     console.error('Full error:', error)
     console.error('Stack:', error.stack)
   }
   ```

### Scenario 3: Component Not Rendering

1. **Open React DevTools** in Chrome
2. **Check component tree** - is component mounted?
3. **Check props** - are props being passed?
4. **Check state** - is state initialized?
5. **Add console.log** in useEffect:
   ```typescript
   useEffect(() => {
     console.log('Component rendered with props:', props)
   }, [props])
   ```

### Scenario 4: Database Query Returns Empty

1. **Check query in Supabase SQL Editor**:
   ```sql
   SELECT * FROM vendors WHERE org_id = 1;
   ```
2. **Check RLS policies** - are they blocking?
3. **Check service role key** - is it set?
4. **Log query details**:
   ```typescript
   console.log('Query:', { table, filters, select })
   console.log('Result:', { data, error })
   ```

## Debugging Tips

1. **Use VS Code Debugger** for server-side code
2. **Use Chrome DevTools** for client-side code
3. **Use console.log strategically** - not everywhere
4. **Check terminal logs** for Next.js server output
5. **Use Network tab** to inspect API requests
6. **Use React DevTools** for component debugging
7. **Set conditional breakpoints** for specific conditions
8. **Use logpoints** instead of console.log when possible

## Quick Debug Commands

```bash
# Start with debugger
npm run dev:debug

# Or use VS Code debugger (F5)

# Check logs in terminal
# Watch for emoji-prefixed logs: 🔐 ✅ ❌ 🔍 📊 🔄
```

## Environment Variables for Debugging

Add to `.env.local`:
```env
# Enable verbose logging
NODE_ENV=development

# Next.js debug mode
DEBUG=*
```

## Next Steps

1. **Set up VS Code debugger** (launch.json already created)
2. **Install React DevTools** Chrome extension
3. **Practice with breakpoints** on a simple API route
4. **Use console.log** strategically for quick debugging
5. **Check terminal logs** regularly during development

---

**Happy Debugging! 🐛🔍**

