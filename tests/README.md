# Testing Guide

This directory contains tests for the WOMS system. Tests are organized by type and component.

## Test Structure

```
tests/
├── unit/              # Unit tests for individual components
│   ├── vendors/       # Vendor adapter tests
│   ├── lib/           # Utility function tests
│   └── components/    # React component tests
├── integration/       # Integration tests for API routes
│   ├── api/          # API endpoint tests
│   └── database/     # Database integration tests
└── e2e/              # End-to-end tests
    └── flows/        # User flow tests
```

## Running Tests

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run e2e tests only
npm run test:e2e

# Run tests with coverage
npm run test:coverage
```

## Test Examples

### Unit Test Example (Vendor Adapter)

```typescript
// tests/unit/vendors/solarmanAdapter.test.ts
import { SolarmanAdapter } from "@/lib/vendors/solarmanAdapter"
import type { VendorConfig } from "@/lib/vendors/types"

describe("SolarmanAdapter", () => {
  const config: VendorConfig = {
    vendorType: "SOLARMAN",
    apiBaseUrl: "https://api.solarmanpv.com",
    credentials: {
      appId: "test_app_id",
      appSecret: "test_secret",
      username: "test_user",
      passwordSha256: "test_hash",
    },
  }

  let adapter: SolarmanAdapter

  beforeEach(() => {
    adapter = new SolarmanAdapter(config)
  })

  it("should authenticate successfully", async () => {
    // Mock API response
    // Test authentication
  })

  it("should normalize telemetry data", () => {
    // Test data normalization
  })
})
```

### Integration Test Example (API Route)

```typescript
// tests/integration/api/dashboard.test.ts
import { createMocks } from "node-mocks-http"
import { GET } from "@/app/api/dashboard/route"

describe("GET /api/dashboard", () => {
  it("should return dashboard data for SUPERADMIN", async () => {
    // Create mock request with session cookie
    // Test dashboard response
  })

  it("should filter data by org for ORG accounts", async () => {
    // Test org-specific filtering
  })
})
```

## Test Coverage Goals

- **Unit Tests**: >80% coverage
- **Integration Tests**: All critical API routes
- **E2E Tests**: All major user flows

## Mocking

- Use MSW (Mock Service Worker) for API mocking
- Use Jest mocks for Supabase client
- Use React Testing Library for component tests

## Continuous Integration

Tests run automatically on:
- Pull requests
- Pushes to main branch
- Scheduled nightly runs

## Writing Tests

1. **Unit Tests**: Test individual functions/components in isolation
2. **Integration Tests**: Test API routes with database interactions
3. **E2E Tests**: Test complete user workflows

Follow the AAA pattern:
- **Arrange**: Set up test data and mocks
- **Act**: Execute the code being tested
- **Assert**: Verify the expected outcome

