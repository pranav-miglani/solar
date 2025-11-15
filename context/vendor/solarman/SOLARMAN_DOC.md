🌞 Solarman Vendor API — Full Technical Specification (Remote Control Removed)

Purpose:
This Markdown defines the complete Solarman integration contract for your unified vendor adapter layer.
Only Authentication Types A (username) and B (username + orgId) are supported.
Remote Control functionality is fully removed.

1. Vendor Authentication

Solarman uses POST-based JSON token authentication.

Authentication URL for both login types:

POST https://globalapi.solarmanpv.com/account/v1.0/token?appId=<appId>

Required Input Fields
Field	Required	Description
appId	Yes	App ID from Solarman
appSecret	Yes	Secret Key
username	Yes	Solarman account username
passwordSha256	Yes	SHA256 hashed password
orgId	Optional	Solarman internal orgId (not your organisationId)
baseUrl	Optional	Default: https://globalapi.solarmanpv.com
A) Username Login (User-Level)
curl --location 'https://globalapi.solarmanpv.com/account/v1.0/token?appId=312407175808914' \
--header 'Content-Type: application/json' \
--data '{
    "appSecret": "fc3911dcb140edc90bdd98ef90ad47f6",
    "username": "DharmaGroup50",
    "password": "f276995c017af71630c7c42cc33ca260a72d76616839ffc07a8b66bcad322512"
}'

B) Username + orgId Login (Org-Scoped Login)

⚠ orgId is a Solarman org mapping id, not your organisationId.

curl --location 'https://globalapi.solarmanpv.com/account/v1.0/token?appId=312407175808914' \
--header 'Content-Type: application/json' \
--data '{
    "appSecret": "fc3911dcb140edc90bdd98ef90ad47f6",
    "username": "Gigasolarchd",
    "orgId": 10702070,
    "password": "bc1f73e998a3a6195fdd8ce101fbdd339d301800b64f9e043bf28a61764a17d5"
}'

2. Headers Required for All API Calls
Authorization: Bearer <access_token>
Content-Type: application/json

3. Station (Plant) APIs
3.1 Get Plant Base Information
Endpoint
POST /station/v1.0/base?language=en

Request
{
  "stationId": 895
}

Response
{
  "stationId": 895,
  "name": "XYZ Solar Plant",
  "location": {
    "lat": "28.144826",
    "lng": "111.651442",
    "address": "Nanjie village No.8"
  },
  "installedCapacity": 50000,
  "startOperatingTime": 1681536000,
  "ownerName": "John",
  "ownerCompany": "ABC Energy Pvt Ltd",
  "picSmall": "https://...",
  "picBig": "https://..."
}

3.2 Get Plant Device List
Endpoint
POST /station/v1.0/device

Request
{ "stationId": 895 }

Response
[
  {
    "deviceId": 12345,
    "deviceSn": "INV1234567",
    "deviceType": "INVERTER",
    "deviceState": 1,
    "updateTime": 1681567200
  }
]

Device State Mapping
Value	Meaning
1	ONLINE
2	ALARM
3	OFFLINE
4. Real-Time Device Telemetry (currentData)
4.1 Endpoint
POST /device/v1.0/currentData

Request
{ "deviceId": 12345 }


or

{ "deviceSn": "1800800121-Igen" }

Response
{
  "deviceId": 12345,
  "deviceSn": "1800800121-Igen",
  "collectionTime": 1615900034,
  "connectStatus": 1,
  "dataList": [
    { "key": "APo_t1", "name": "Active Power", "value": "4510", "unit": "W" },
    { "key": "Et_ge0", "name": "Total Energy", "value": "2456", "unit": "kWh" },
    { "key": "INV_T0", "name": "Inverter Temperature", "value": "45", "unit": "℃" }
  ]
}

5. Inverter Parameter Keys (dataList)
key	Meaning	Unit
APo_t1	AC Active Power	W
P_PV	DC Power	W
Et_ge0	Total Energy	kWh
Etdy_ge1	Today Energy	kWh
INV_T0	Inverter Temperature	°C
INV_ST1	Inverter Status Code	raw
t_w_hou1	Total Running Hours	hours
AV1/AV2/AV3	Phase Voltage	V
AC1/AC2/AC3	Phase Current	A
PF0	Power Factor	-
PG_V_ERR0	Grid Voltage Error	raw
PG_F_ERR0	Grid Frequency Error	raw
ELC_ERR1	Leakage Current Error	raw
N_I_ERR1	Insulation Impedance	raw
MAC_T_ERRin1	Temperature Error	raw
6. Normalized Mapping (Recommended)
Solarman key	Normalized key	Notes
APo_t1	power_ac_w	number
P_PV	power_dc_w	number
Et_ge0	energy_total_kwh	number
Etdy_ge1	energy_today_kwh	number
INV_T0	temperature_c	number
INV_ST1	device_status_raw	internal mapping
t_w_hou1	running_hours_h	number
AV1/2/3	voltage_v_phase_1/2/3	number
AC1/2/3	current_a_phase_1/2/3	number
PF0	power_factor	float
PG_V_ERR0	grid_voltage_error	raw
PG_F_ERR0	grid_frequency_error	raw
ELC_ERR1	leak_current_error	raw
7. Historical Data (historical)
7.1 Endpoint
POST /device/v1.0/historical

Request
{
  "deviceId": 252525,
  "startTime": "2019-11-18",
  "endTime": "2019-11-18",
  "timeType": 1
}

timeType Mapping
timeType	Meaning
1	Frame-level (5-min)
2	Daily summary
3	Monthly summary
4	Yearly summary
Response
{
  "deviceId": 252525,
  "deviceSn": "dev1800078101",
  "timeType": 1,
  "paramDataList": [
    {
      "collectTime": "2019-11-18 13:00:00",
      "dataList": [
        { "key": "PG_Pt1", "name": "Grid Power", "value": "55", "unit": "W" }
      ]
    }
  ]
}

8. Alerts / Alarms (alertList)
8.1 Endpoint
POST /device/v1.0/alertList

Request
{
  "deviceId": 200203179,
  "startTimestamp": 1580540643,
  "endTimestamp": 1580886244,
  "page": 1,
  "size": 10
}

Response
{
  "deviceSn": "dev1800078101",
  "deviceId": 200203179,
  "total": 5,
  "alertList": [
    {
      "alertId": 2,
      "alertName": "Error: 99+x",
      "addr": "ERR1",
      "code": "1",
      "level": 0,
      "influence": 0,
      "alertTime": 1580621658,
      "description": ""
    }
  ]
}

Severity Mapping
Value	Meaning
0	Info
1	Warning
2	Error
Influence Mapping
Value	Meaning
0	No impact
1	Production impact
2	Safety impact
3	Production + safety
9. Adapter Responsibilities (Cursor)

Cursor must generate a Solarman integration adapter implementing:

login()

refreshToken()

getPlants()

getDevices()

getRealtimeTelemetry()

getHistoricalTelemetry()

getAlerts()

No control commands.
No command callbacks.
No sendControlCommand.

10. Onboarding Prompt (Cursor)

When onboarding a Solarman vendor, Cursor must ask:

Provide:
- appId
- appSecret
- username
- passwordSha256


If org-based login:

Provide:
- orgId (Solarman orgId)

