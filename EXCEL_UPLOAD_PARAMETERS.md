# Excel Upload Parameters

## Overview
The system supports Excel uploads for three entities: **Work Orders**, **Vendors**, and **Accounts**. All uploads require:
- File format: `.xlsx` or `.xls`
- First row must be headers
- Authentication: SUPERADMIN or DEVELOPER role (except work orders which also allow ORG role with create permission)

---

## 1. Work Orders Import (`/api/workorders/import`)

### Three Import Formats Supported

#### **Format Option 1a: Vendor ID + Vendor Plant ID (New Format)**
| Header Name | Required | Type | Description |
|------------|----------|------|-------------|
| **Title** | ✅ Yes | String | Work order title |
| **Organization ID** | ✅ Yes | Integer | Organization ID for the work order |
| **Vendor ID** | ✅ Yes | Integer | Vendor ID (must belong to the same organization) |
| **Vendor Plant ID** | ✅ Yes | String | Vendor-specific plant identifier |

#### **Format Option 1b: Vendor Type + Vendor Plant ID (Original Format - Backward Compatible)**
| Header Name | Required | Type | Description |
|------------|----------|------|-------------|
| **Title** | ✅ Yes | String | Work order title |
| **Organization ID** | ✅ Yes | Integer | Organization ID for the work order |
| **Vendor Type** | ✅ Yes | String | Vendor type (SOLARMAN, SUNGROW, OTHER) |
| **Vendor Plant ID** | ✅ Yes | String | Vendor-specific plant identifier |

#### **Format Option 2: Internal Plant ID (Recommended)**
| Header Name | Required | Type | Description |
|------------|----------|------|-------------|
| **Title** | ✅ Yes | String | Work order title |
| **Organization ID** | ✅ Yes | Integer | Organization ID for the work order |
| **Plant ID** | ✅ Yes | Integer | Internal plant ID (plants.id from database) |

### Optional Parameters (All Formats)
| Header Name | Type | Description |
|------------|------|-------------|
| Work Order ID | Integer | For reference only (not used for updates) |
| Description | String | Work order description |
| Location | String | Physical location of work order |
| Organization Name | String | For reference only |
| Plant Name | String | For reference only |
| Vendor Name | String | For reference only |
| Vendor Type | String | Optional for Format 1a (validated if provided) |
| Vendor ID | Integer | Optional for Format 1b (validated if provided) |
| Capacity (kW) | Number | For reference only |

### Validation Rules
- Work orders are grouped by `Title` + `Organization ID` combination
- All plants in a work order must belong to the same organization
- **Format Option 1a (Vendor ID + Vendor Plant ID):**
  - Vendor ID must exist and belong to the same organization as the work order (or be a global vendor)
  - Vendor Plant ID must exist for the specified Vendor ID
  - If Vendor Type is provided, it must match the vendor's actual type
- **Format Option 1b (Vendor Type + Vendor Plant ID - Original Format):**
  - Vendor Type must be valid (SOLARMAN, SUNGROW, OTHER)
  - At least one vendor of the specified type must exist for the organization (or be a global vendor)
  - Vendor Plant ID must exist for a vendor of the specified type
  - If multiple vendors of the same type exist, the system will match based on the plant's vendor_id
- **Format Option 2 (Plant ID):**
  - Plant ID must exist in the database
  - Plant must belong to the same organization as the work order
- Plants cannot be in another active work order
- Existing work orders are not updated (only new ones are created)
- **Recommendation**: Use Format Option 2 (Plant ID) for simpler, less error-prone imports

### Example Excel Structures

**Format Option 1a (Vendor ID + Vendor Plant ID - New Format):**
```
Title | Organization ID | Vendor ID | Vendor Plant ID | Description | Location
------|-----------------|-----------|-----------------|-------------|----------
WO-001| 1              | 5         | PLANT-123       | Maintenance  | Site A
WO-001| 1              | 5         | PLANT-456       | Maintenance  | Site A
```

**Format Option 1b (Vendor Type + Vendor Plant ID - Original Format):**
```
Title | Organization ID | Vendor Type | Vendor Plant ID | Description | Location
------|-----------------|-------------|-----------------|-------------|----------
WO-001| 1              | SOLARMAN    | PLANT-123       | Maintenance  | Site A
WO-001| 1              | SOLARMAN    | PLANT-456       | Maintenance  | Site A
```

**Format Option 2 (Plant ID - Recommended):**
```
Title | Organization ID | Plant ID | Description | Location
------|-----------------|----------|-------------|----------
WO-001| 1              | 42       | Maintenance  | Site A
WO-001| 1              | 43       | Maintenance  | Site A
```

---

## 2. Vendors Import (`/api/vendors/import`)

### Required Parameters (Excel Headers)
| Header Name | Required | Type | Description |
|------------|----------|------|-------------|
| **Name** | ✅ Yes | String | Vendor name |
| **Vendor Type** | ✅ Yes | String | Must be: SOLARMAN, SOLARDM, SHINEMONITOR, PVBLINK, FOXESSCLOUD, or OTHER |
| **Organization ID** | ✅ Yes | Integer | Organization ID (can be NULL for global vendors) |
| **Credentials (JSON)** | ✅ Yes | JSON String | Vendor API credentials as JSON string |

### Optional Parameters
| Header Name | Type | Description |
|------------|------|-------------|
| Vendor ID | Integer | For reference only (not used for updates) |
| Is Active | Boolean/String | "yes"/true for active, defaults to true |
| Plant Sync Mode | String | LIST_PLANTS or PER_PLANT |
| Per Plant Sync Interval (minutes) | Integer | Default: 15 |
| Plant List Sync Morning (IST) | String | Time in IST format (e.g., "09:00") |
| Plant List Sync Evening (IST) | String | Time in IST format (e.g., "18:00") |
| Telemetry Sync Mode | String | LIST_PLANTS or PER_PLANT, default: LIST_PLANTS |
| Telemetry Sync Interval (minutes) | Integer | Default: 15 |

### Credentials JSON Format Examples

**Solarman:**
```json
{
  "appId": "your_app_id",
  "appSecret": "your_app_secret",
  "username": "your_username",
  "password": "your_password"
}
```

**SolarDM:**
```json
{
  "email": "your_email",
  "passwordRSA": "your_rsa_password"
}
```

### Notes
- Duplicate vendors (same name + org_id) are rejected
- Existing vendors are not updated (only new ones are created)
- Organization must exist in the database

### Example Excel Structure
```
Name | Vendor Type | Organization ID | Credentials (JSON) | Is Active
-----|-------------|----------------|-------------------|----------
Vendor1 | SOLARMAN | 1 | {"appId":"x","appSecret":"y"} | yes
```

---

## 3. Accounts Import (`/api/accounts/import`)

### Required Parameters (Excel Headers)
| Header Name | Required | Type | Description |
|------------|----------|------|-------------|
| **Email** | ✅ Yes | String | Account email (must be unique) |
| **Password** | ✅ Yes | String | Plain text password (will be hashed) |
| **Account Type** | ✅ Yes | String | Must be: SUPERADMIN, ORG, or GOVT (DEVELOPER cannot be imported) |

### Conditional Parameters
| Header Name | Required When | Type | Description |
|------------|---------------|------|-------------|
| **Organization ID** | Account Type = ORG | Integer | Required for ORG accounts, must be NULL for SUPERADMIN/GOVT |

### Optional Parameters
| Header Name | Type | Description |
|------------|------|-------------|
| Account ID | UUID String | For reference only (not used for updates) |
| Display Name | String | Display name for the account |
| Logo URL | String | URL to organization logo |
| Is Active | Boolean/String | "yes"/true for active, defaults to true |

### Account Type Rules
- **SUPERADMIN**: `org_id` must be NULL
- **GOVT**: `org_id` must be NULL
- **ORG**: `org_id` is required and must exist in organizations table
- **DEVELOPER**: Cannot be created via import

### Notes
- Duplicate emails are rejected
- Each organization can only have one ORG account
- Passwords are automatically hashed with bcrypt
- Existing accounts are not updated (only new ones are created)

### Example Excel Structure
```
Email | Password | Account Type | Organization ID | Display Name
------|---------|--------------|-----------------|-------------
admin@example.com | admin123 | SUPERADMIN | | Admin User
org1@example.com | org123 | ORG | 1 | Organization 1
govt@example.com | govt123 | GOVT | | Government User
```

---

## Common Validation Rules

1. **File Format**: Must be `.xlsx` or `.xls`
2. **Header Row**: First row must contain column headers (case-sensitive)
3. **Empty Rows**: Rows missing required fields are skipped
4. **No Updates**: Import only creates new records, never updates existing ones
5. **Error Reporting**: Returns detailed results with row numbers and error messages
6. **Batch Processing**: Processes all rows and returns summary with success/error counts

---

## API Endpoints

- **Work Orders**: `POST /api/workorders/import`
- **Vendors**: `POST /api/vendors/import`
- **Accounts**: `POST /api/accounts/import`

All endpoints:
- Require authentication via session cookie
- Accept `multipart/form-data` with `file` field
- Return JSON response with `summary` and `results` array

