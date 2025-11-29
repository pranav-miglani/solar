# Solarman Data Mapping Documentation

This document explains what data is stored in the database for Solarman vendors and how Solarman API attributes map to database columns.

## Data Flow Overview

```
Solarman API (/station/v1.0/list)
    ↓
SolarmanAdapter.listPlants()
    ↓
sync-plants API route
    ↓
Database (plants table)
```

---

## 1. Solarman API Response Structure

The `/station/v1.0/list` endpoint returns:

```json
{
  "total": 3,
  "stationList": [
    {
      "id": 693934,
      "name": "Bindu singla",
      "installedCapacity": 5.000000,
      "generationPower": 2196.000000,
      "locationLat": 30.740103,
      "locationLng": 76.744538,
      "locationAddress": "Chandigarh Chandigarh Chandigarh ",
      "networkStatus": "NORMAL",
      "contactPhone": "",
      "lastUpdateTime": 1763279487,
      "createdDate": 1580112893,
      "startOperatingTime": 1580112893,
      "type": "HOUSE_ROOF",
      "gridInterconnectionType": "DISTRIBUTED_FULLY",
      "regionTimezone": "Asia/Calcutta",
      "regionLevel1": 1388,
      "regionLevel2": 20188,
      "regionLevel3": null,
      "regionLevel4": null,
      "regionLevel5": null,
      "regionNationId": 105,
      "batterySoc": null,
      "ownerName": null,
      "stationImage": null
    }
  ],
  "success": true
}
```

---

## 2. Adapter Transformation (SolarmanAdapter.listPlants())

The adapter transforms Solarman API response into a normalized `Plant` format:

### Key Transformations:

| Solarman Field | Adapter Processing | Plant Object Field |
|----------------|-------------------|-------------------|
| `station.id` | Direct mapping | `id` (as string) |
| `station.name` | Direct mapping | `name` |
| `station.installedCapacity` | Direct (already in kW) | `capacityKw` |
| `station.generationPower` | **Convert W → kW** (divide by 1000) | `metadata.currentPowerKw` |
| `station.locationLat` | Combined into object | `location.lat` |
| `station.locationLng` | Combined into object | `location.lng` |
| `station.locationAddress` | Combined into object | `location.address` |
| `station.lastUpdateTime` | **Unix timestamp (seconds) → ISO string** | `metadata.lastUpdateTime` |
| `station.createdDate` | **Unix timestamp (seconds) → ISO string** | `metadata.createdDate` |
| `station.startOperatingTime` | **Unix timestamp (seconds) → ISO string** | `metadata.startOperatingTime` |
| `station.networkStatus` | **Trim whitespace** (handle ' ALL_OFFLINE') | `metadata.networkStatus` |
| `station.contactPhone` | Direct mapping | `metadata.contactPhone` |
| Other fields | Stored as-is | `metadata.*` |

### Example Adapter Output:

```typescript
{
  id: "693934",
  name: "Bindu singla",
  capacityKw: 5.0,
  location: {
    lat: 30.740103,
    lng: 76.744538,
    address: "Chandigarh Chandigarh Chandigarh "
  },
  metadata: {
    currentPowerKw: 2.196,  // 2196 W / 1000
    lastUpdateTime: "2025-11-16T10:30:00.000Z",  // Converted from Unix
    networkStatus: "NORMAL",  // Trimmed
    contactPhone: "",
    createdDate: "2020-01-28T10:30:00.000Z",
    startOperatingTime: "2020-01-28T10:30:00.000Z",
    // ... other metadata fields
  }
}
```

---

## 3. Database Storage (plants table)

The sync route maps the Plant object to database columns:

### Database Schema Mapping:

| Database Column | Source | Transformation | Notes |
|----------------|--------|----------------|-------|
| `id` | Auto-generated (SERIAL) | - | Internal DB ID |
| `org_id` | From vendor | - | Organization this plant belongs to |
| `vendor_id` | From vendor | - | Vendor this plant came from |
| `vendor_plant_id` | `plant.id` | Convert to string | Solarman station ID (693934) |
| `name` | `plant.name` | Direct | "Bindu singla" |
| `capacity_kw` | `plant.capacityKw` | Direct | 5.0 (already in kW) |
| `location` | `plant.location` | JSONB object | `{"lat": 30.740103, "lng": 76.744538, "address": "..."}` |
| `current_power_kw` | `metadata.currentPowerKw` | Direct | 2.196 (converted from W in adapter) |
| `daily_energy_mwh` | `metadata.dailyEnergyMwh` | Direct | NULL (not in /station/v1.0/list) |
| `monthly_energy_mwh` | `metadata.monthlyEnergyMwh` | Direct | NULL (not in /station/v1.0/list) |
| `yearly_energy_mwh` | `metadata.yearlyEnergyMwh` | Direct | NULL (not in /station/v1.0/list) |
| `total_energy_mwh` | `metadata.totalEnergyMwh` | Direct | NULL (not in /station/v1.0/list) |
| `last_update_time` | `metadata.lastUpdateTime` | **Handle both ISO string and Unix timestamp** | TIMESTAMPTZ |
| `last_refreshed_at` | **Current timestamp** | `NOW()` | When synced to DB |
| `contact_phone` | `metadata.contactPhone` | Direct | "" (empty string or phone number) |
| `network_status` | `metadata.networkStatus` | **Trim whitespace** | "NORMAL", "ALL_OFFLINE", "PARTIAL_OFFLINE" |
| `vendor_created_date` | `metadata.createdDate` | **Handle both ISO string and Unix timestamp** | TIMESTAMPTZ |
| `start_operating_time` | `metadata.startOperatingTime` | **Handle both ISO string and Unix timestamp** | TIMESTAMPTZ |
| `created_at` | Auto-generated | `NOW()` | When record created in DB |
| `updated_at` | Auto-generated | `NOW()` | When record updated in DB |

---

## 4. Complete Attribute Mapping Table

### Direct Mappings (No Transformation):

| Solarman API Field | Database Column | Type | Notes |
|-------------------|----------------|------|-------|
| `station.id` | `vendor_plant_id` | TEXT | Unique per vendor |
| `station.name` | `name` | TEXT | Plant name |
| `station.installedCapacity` | `capacity_kw` | NUMERIC(10,2) | Already in kW |
| `station.contactPhone` | `contact_phone` | TEXT | Can be empty string |
| `station.networkStatus` | `network_status` | TEXT | Trimmed, normalized |

### Transformed Mappings:

| Solarman API Field | Transformation | Database Column | Type |
|-------------------|----------------|-----------------|------|
| `station.generationPower` | W → kW (÷1000) | `current_power_kw` | NUMERIC(10,3) |
| `station.lastUpdateTime` | Unix (sec) → ISO → TIMESTAMPTZ | `last_update_time` | TIMESTAMPTZ |
| `station.createdDate` | Unix (sec) → ISO → TIMESTAMPTZ | `vendor_created_date` | TIMESTAMPTZ |
| `station.startOperatingTime` | Unix (sec) → ISO → TIMESTAMPTZ | `start_operating_time` | TIMESTAMPTZ |

### Location Mapping:

| Solarman API Fields | Combined Into | Database Column | Type |
|---------------------|---------------|-----------------|------|
| `station.locationLat` | `location` JSONB | `location.lat` | JSONB |
| `station.locationLng` | `location` JSONB | `location.lng` | JSONB |
| `station.locationAddress` | `location` JSONB | `location.address` | JSONB |

### Not Stored (Available in metadata only):

These fields are available in the adapter's `metadata` object but are **NOT stored in the database**:

- `type` (e.g., "HOUSE_ROOF")
- `gridInterconnectionType` (e.g., "DISTRIBUTED_FULLY")
- `regionTimezone` (e.g., "Asia/Calcutta")
- `regionLevel1`, `regionLevel2`, `regionLevel3`, `regionLevel4`, `regionLevel5`
- `regionNationId`
- `batterySoc`
- `ownerName`
- `stationImage`

**Note:** These fields are available during sync but are not persisted. If needed, they would require additional database columns.

### Not Available in `/station/v1.0/list`:

These fields are in the database schema but are **NOT available** from the `/station/v1.0/list` endpoint:

- `daily_energy_mwh` - NULL
- `monthly_energy_mwh` - NULL
- `yearly_energy_mwh` - NULL
- `total_energy_mwh` - NULL

**Note:** These would need to be fetched from other Solarman endpoints (e.g., `/station/v1.0/base` or device-level endpoints).

---

## 5. Special Handling

### Timestamp Conversion:

1. **Adapter Level**: Converts Unix timestamps (seconds) to ISO strings
   ```typescript
   lastUpdateTime = new Date(station.lastUpdateTime * 1000).toISOString()
   ```

2. **Sync Route Level**: Handles both ISO strings and Unix timestamps (defensive)
   ```typescript
   if (typeof metadata.lastUpdateTime === 'string') {
     lastUpdateTime = metadata.lastUpdateTime  // Already ISO
   } else if (typeof metadata.lastUpdateTime === 'number') {
     lastUpdateTime = new Date(metadata.lastUpdateTime * 1000).toISOString()  // Convert
   }
   ```

### Network Status Normalization:

- **Adapter**: Trims whitespace: `String(station.networkStatus).trim()`
- **Sync Route**: Trims again (defensive): `String(metadata.networkStatus).trim()`
- **Valid Values**: `"NORMAL"`, `"ALL_OFFLINE"`, `"PARTIAL_OFFLINE"`
- **Unknown Values**: Displayed as "N/A" in UI

### Location Address:

- If `location.address` is missing but `metadata.locationAddress` exists, it's copied:
  ```typescript
  if (metadata.locationAddress && !location.address) {
    location.address = metadata.locationAddress
  }
  ```

---

## 6. Database Record Example

```sql
SELECT * FROM plants WHERE vendor_plant_id = '693934';
```

Result:

| Column | Value | Source |
|--------|-------|--------|
| `id` | 1 | Auto-generated |
| `org_id` | 2 | From vendor |
| `vendor_id` | 1 | From vendor |
| `vendor_plant_id` | "693934" | `station.id` |
| `name` | "Bindu singla" | `station.name` |
| `capacity_kw` | 5.0 | `station.installedCapacity` |
| `location` | `{"lat": 30.740103, "lng": 76.744538, "address": "Chandigarh..."}` | Combined from `locationLat`, `locationLng`, `locationAddress` |
| `current_power_kw` | 2.196 | `station.generationPower / 1000` |
| `daily_energy_mwh` | NULL | Not available |
| `monthly_energy_mwh` | NULL | Not available |
| `yearly_energy_mwh` | NULL | Not available |
| `total_energy_mwh` | NULL | Not available |
| `last_update_time` | `2025-11-16 10:30:00+00` | `station.lastUpdateTime` (Unix → TIMESTAMPTZ) |
| `last_refreshed_at` | `2025-11-16 17:13:30+00` | `NOW()` (when synced) |
| `contact_phone` | "" | `station.contactPhone` |
| `network_status` | "NORMAL" | `station.networkStatus` (trimmed) |
| `vendor_created_date` | `2020-01-28 10:30:00+00` | `station.createdDate` (Unix → TIMESTAMPTZ) |
| `start_operating_time` | `2020-01-28 10:30:00+00` | `station.startOperatingTime` (Unix → TIMESTAMPTZ) |
| `created_at` | `2025-11-16 10:00:00+00` | Auto-generated |
| `updated_at` | `2025-11-16 17:13:30+00` | Auto-updated |

---

## 7. Summary

### What Gets Stored:

✅ **Stored in DB:**
- Basic info: `id`, `name`, `capacity_kw`
- Location: `location` (JSONB with lat, lng, address)
- Current power: `current_power_kw` (converted from W)
- Timestamps: `last_update_time`, `vendor_created_date`, `start_operating_time`
- Metadata: `contact_phone`, `network_status`
- Sync tracking: `last_refreshed_at`

❌ **NOT Stored in DB:**
- Energy metrics (daily/monthly/yearly/total) - not in `/station/v1.0/list`
- Performance ratio - not in `/station/v1.0/list`
- Region fields (regionLevel1-5, regionNationId, regionTimezone)
- Type fields (type, gridInterconnectionType)
- Owner info (ownerName, batterySoc, stationImage)

### Key Transformations:

1. **Power**: W → kW (divide by 1000)
2. **Timestamps**: Unix (seconds) → ISO string → TIMESTAMPTZ
3. **Network Status**: Trim whitespace, normalize
4. **Location**: Combine separate fields into JSONB object

---

## 8. References

- **Adapter**: `lib/vendors/solarmanAdapter.ts` (lines 275-435)
- **Sync Route**: `app/api/vendors/[id]/sync-plants/route.ts` (lines 129-195)
- **Database Schema**: `supabase/migrations/001_initial_schema.sql` (lines 141-165)
- **Solarman API**: `/station/v1.0/list` endpoint

