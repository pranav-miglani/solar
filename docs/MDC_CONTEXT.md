# MDC (Mapped Diagnostic Context)

## Overview

MDC (Mapped Diagnostic Context) is a context propagation mechanism similar to Java's MDC. It allows you to store contextual information (like request source, user ID, operation type) that automatically propagates through all async operations without explicitly passing it around.

## Key Features

- **Automatic Context Propagation**: Context is automatically propagated through all async operations
- **No If/Else Checks**: Access context anywhere without conditionals
- **Thread-Local Like**: Each async operation chain has its own context
- **Type-Safe**: Full TypeScript support

## Usage

### Setting Context

#### In API Routes (Cron)

```typescript
import MDC from "@/lib/context/mdc"
import { randomUUID } from "crypto"

export async function GET(request: NextRequest) {
  const requestId = randomUUID()
  
  return MDC.runAsync(
    {
      source: "cron",  // or "user", "system", "api"
      requestId,
      operation: "sync-plants",
    },
    async () => {
      // All code here has access to the context
      // Context automatically propagates to all async operations
      await syncAllPlants()
    }
  )
}
```

#### In API Routes (User)

```typescript
export async function POST(request: NextRequest) {
  const requestId = randomUUID()
  
  return MDC.runAsync(
    {
      source: "user",
      requestId,
      operation: "sync-vendor-plants",
      vendorId: parseInt(params.id),
    },
    async () => {
      // Get session and update context
      const sessionData = getSessionData(request)
      
      MDC.withContext({
        userId: sessionData.accountId,
        accountType: sessionData.accountType,
        orgId: sessionData.orgId,
      }, () => {
        // Context updated for this scope
        await syncVendorPlants()
      })
    }
  )
}
```

### Accessing Context

#### Anywhere in Your Code

```typescript
import MDC from "@/lib/context/mdc"
import { logger } from "@/lib/context/logger"

// Get full context
const context = MDC.getContext()
// { source: "cron", requestId: "...", operation: "sync-plants", ... }

// Get specific value
const source = MDC.getSource()  // "cron" | "user" | "system" | "api"
const userId = MDC.get("userId")
const vendorId = MDC.get("vendorId")

// Check source type
if (MDC.isCronOperation()) {
  // This is a cron operation
}

if (MDC.isUserOperation()) {
  // This is a user operation
}

// Use context-aware logger (automatically includes context in logs)
logger.info("Processing plants")  
// Output: [2024-01-01T00:00:00.000Z] [CRON] [sync-plants] [INFO] Processing plants
```

### Context Propagation

Context automatically propagates through:
- `async/await` calls
- `Promise.all()` and `Promise.allSettled()`
- `setTimeout()` and `setInterval()`
- All async operations within the context

**Example:**

```typescript
// In API route
MDC.runAsync({ source: "cron" }, async () => {
  await syncAllPlants()  // Context available here
})

// In syncAllPlants()
export async function syncAllPlants() {
  const source = MDC.getSource()  // "cron" - automatically propagated!
  logger.info("Starting sync")  // Logs include context
  
  await Promise.all(
    vendors.map(vendor => 
      syncVendorPlants(vendor)  // Context still available here!
    )
  )
}

// In syncVendorPlants()
async function syncVendorPlants(vendor: any) {
  const source = MDC.getSource()  // Still "cron"!
  logger.info(`Syncing vendor ${vendor.name}`)  // Context in logs
}
```

### Creating Child Contexts

You can create nested contexts that inherit from parent:

```typescript
MDC.runAsync({ source: "cron" }, async () => {
  // Parent context: { source: "cron", operation: "sync-plants" }
  
  await Promise.all(
    vendors.map(vendor =>
      MDC.withContextAsync(
        {
          vendorId: vendor.id,
          vendorName: vendor.name,
          operation: `sync-vendor-${vendor.id}`,
        },
        async () => {
          // Child context: { 
          //   source: "cron",           // Inherited
          //   operation: "sync-vendor-1", // Overridden
          //   vendorId: 1,              // Added
          //   vendorName: "Vendor 1"    // Added
          // }
          await syncVendorPlants(vendor)
        }
      )
    )
  )
})
```

## Context-Aware Logging

The logger automatically includes MDC context in all log messages:

```typescript
import { logger } from "@/lib/context/logger"

logger.info("Starting sync")
// Output: [2024-01-01T00:00:00.000Z] [CRON] [sync-plants] [INFO] Starting sync

logger.error("Sync failed", error)
// Output: [2024-01-01T00:00:00.000Z] [CRON] [sync-plants] [ERROR] Sync failed
```

## Context Fields

| Field | Type | Description |
|-------|------|-------------|
| `source` | `"user" \| "cron" \| "system" \| "api"` | Source of the operation |
| `requestId` | `string` | Unique request identifier |
| `userId` | `string` | User ID (for user operations) |
| `accountType` | `string` | Account type (SUPERADMIN, GOVT, ORG) |
| `orgId` | `number` | Organization ID |
| `operation` | `string` | Operation name |
| `vendorId` | `number` | Vendor ID (if applicable) |
| `vendorName` | `string` | Vendor name (if applicable) |
| `timestamp` | `string` | Context creation timestamp |
| `metadata` | `Record<string, any>` | Additional metadata |

## Best Practices

1. **Always set context at entry points**: API routes, cron jobs, background tasks
2. **Use child contexts for nested operations**: Add vendor/org-specific context when processing
3. **Use context-aware logger**: Automatically includes context in logs
4. **Don't pass context explicitly**: Let it propagate automatically
5. **Check source when needed**: Use `MDC.isCronOperation()` or `MDC.isUserOperation()`

## Examples

### Example 1: Cron Job

```typescript
// app/api/cron/sync-plants/route.ts
export async function GET(request: NextRequest) {
  return MDC.runAsync(
    { source: "cron", requestId: randomUUID(), operation: "sync-plants" },
    async () => {
      logger.info("Cron triggered")  // [CRON] [sync-plants] [INFO] Cron triggered
      await syncAllPlants()  // Context propagated automatically
    }
  )
}
```

### Example 2: User-Initiated Sync

```typescript
// app/api/vendors/[id]/sync-plants/route.ts
export async function POST(request: NextRequest, { params }) {
  return MDC.runAsync(
    { source: "user", requestId: randomUUID(), operation: "sync-vendor-plants" },
    async () => {
      const sessionData = getSessionData(request)
      MDC.withContext({ userId: sessionData.accountId }, () => {
        logger.info("User sync triggered")  // [USER] [sync-vendor-plants] [INFO] User sync triggered
      })
      await syncVendorPlants(params.id)  // Context propagated
    }
  )
}
```

### Example 3: Service Layer

```typescript
// lib/services/plantSyncService.ts
export async function syncAllPlants() {
  // Context automatically available from caller
  const source = MDC.getSource()  // "cron" or "user"
  logger.info(`Starting sync (source: ${source})`)
  
  // Process vendors with child contexts
  await Promise.all(
    vendors.map(vendor =>
      MDC.withContextAsync(
        { vendorId: vendor.id, operation: `sync-vendor-${vendor.id}` },
        () => syncVendorPlants(vendor)  // Child context propagated
      )
    )
  )
}
```

## Technical Details

- Uses Node.js `AsyncLocalStorage` for context propagation
- Context is isolated per async operation chain
- No performance overhead (AsyncLocalStorage is optimized)
- Works with all async patterns (async/await, Promises, callbacks)

## Migration Guide

### Before (Without MDC)

```typescript
export async function syncPlants(source: "user" | "cron") {
  if (source === "cron") {
    console.log("[CRON] Syncing plants")
  } else {
    console.log("[USER] Syncing plants")
  }
  // ... rest of code
}
```

### After (With MDC)

```typescript
export async function syncPlants() {
  const source = MDC.getSource()  // No parameter needed!
  logger.info("Syncing plants")  // Context automatically in logs
  // ... rest of code
}
```

