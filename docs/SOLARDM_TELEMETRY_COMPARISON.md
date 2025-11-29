# SolarDM Telemetry Implementation Comparison

## Overview
This document compares the telemetry implementation requirements between Solarman and SolarDM adapters.

## Solarman Telemetry Methods

### 1. `getDailyTelemetryRecords(systemId, year, month, day)`
- **Purpose**: Fetch 15-minute interval telemetry data for a specific day
- **Endpoint**: `GET /maintain-s/history/power/{systemId}/record?year={year}&month={month}&day={day}`
- **Returns**:
  - `statistics`: Daily totals (generationValue in kWh, fullPowerHoursDay)
  - `records`: Array of 15-minute interval records with:
    - `generationPower` (in W, converted to kW)
    - `dateTime` (Unix timestamp)
    - `generationCapacity` (0-1)
    - `timeZoneOffset` (seconds)

### 2. `getMonthlyTelemetryRecords(systemId, year, month)`
- **Purpose**: Fetch daily aggregated telemetry data for a specific month
- **Endpoint**: `GET /maintain-s/history/power/{systemId}/stats/month?year={year}&month={month}`
- **Returns**:
  - `statistics`: Monthly totals (generationValue in kWh, fullPowerHoursDay)
  - `records`: Array of daily records with:
    - `day`: Day of month
    - `generationValue` (daily generation in kWh)
    - `fullPowerHoursDay`

### 3. `getYearlyTelemetryRecords(systemId, year)`
- **Purpose**: Fetch monthly aggregated telemetry data for a specific year
- **Endpoint**: `GET /maintain-s/history/power/{systemId}/stats/year?year={year}`
- **Returns**:
  - `statistics`: Yearly totals (generationValue in kWh, fullPowerHoursDay)
  - `records`: Array of monthly records with:
    - `month`: Month number (1-12)
    - `generationValue` (monthly generation in kWh)
    - `fullPowerHoursDay`

### 4. `getTotalTelemetryRecords(systemId, startYear, endYear)`
- **Purpose**: Fetch yearly aggregated telemetry data across multiple years
- **Endpoint**: `GET /maintain-s/history/power/{systemId}/stats/total?startYear={startYear}&endYear={endYear}`
- **Returns**:
  - `statistics`: Total statistics (generationValue in kWh, fullPowerHoursDay, etc.)
  - `records`: Array of yearly records with:
    - `year`: Year number
    - `generationValue` (yearly generation in kWh)
  - `operatingTotalDays`: Total operating days

## SolarDM Telemetry Requirements

### Required API Endpoints (to be confirmed)

1. **Daily Telemetry** (15-minute intervals)
   - Endpoint: `TBD`
   - Parameters: `plantId`, `year`, `month`, `day`
   - Expected Response Format: Similar to Solarman's daily records

2. **Monthly Telemetry** (daily aggregation)
   - Endpoint: `TBD`
   - Parameters: `plantId`, `year`, `month`
   - Expected Response Format: Similar to Solarman's monthly records

3. **Yearly Telemetry** (monthly aggregation)
   - Endpoint: `TBD`
   - Parameters: `plantId`, `year`
   - Expected Response Format: Similar to Solarman's yearly records

4. **Total Telemetry** (yearly aggregation)
   - Endpoint: `TBD`
   - Parameters: `plantId`, `startYear`, `endYear`
   - Expected Response Format: Similar to Solarman's total records

## Implementation Status

- ✅ **Solarman**: Fully implemented with all 4 methods
- ⏳ **SolarDM**: Placeholder implementations added, awaiting API endpoint details

## Data Mapping Notes

### Key Differences:
- **Solarman** uses `systemId` (numeric) as plant identifier
- **SolarDM** uses `id` (string) as plant identifier - may need conversion to numeric if API requires it

### Common Requirements:
- All methods must return data in the same format as Solarman for consistency
- Power values should be in kW (convert from W if needed)
- Energy values should be in kWh for daily, MWh for monthly/yearly/total
- Timestamps should be ISO strings or Unix timestamps (seconds)
- Statistics should include generation totals and full power hours

## Next Steps

1. Obtain SolarDM API documentation for telemetry endpoints
2. Confirm endpoint URLs and request/response formats
3. Update placeholder implementations with actual API calls
4. Test with real SolarDM plant data
5. Verify data mapping and unit conversions

