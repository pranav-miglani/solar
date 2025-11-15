# API Testing Guide - Login Endpoint

This guide provides curl commands and Postman setup instructions for testing the WOMS login API.

## Login API Endpoint

**URL**: `http://localhost:3000/api/login`  
**Method**: `POST`  
**Content-Type**: `application/json`

## Quick Test Commands

### 1. Successful Login (Super Admin)

**cURL:**
```bash
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@woms.com","password":"admin123"}' \
  -v
```

**Postman Setup:**
- **Method**: POST
- **URL**: `http://localhost:3000/api/login`
- **Headers**:
  - `Content-Type: application/json`
- **Body** (raw JSON):
  ```json
  {
    "email": "admin@woms.com",
    "password": "admin123"
  }
  ```

**Expected Response (200 OK):**
```json
{
  "account": {
    "id": "uuid-here",
    "email": "admin@woms.com",
    "accountType": "SUPERADMIN",
    "orgId": null
  }
}
```

**Response Headers:**
- `Set-Cookie: session=...` (HTTP-only cookie)

---

### 2. Successful Login (Government)

**cURL:**
```bash
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"govt@woms.com","password":"govt123"}' \
  -v
```

**Postman Body:**
```json
{
  "email": "govt@woms.com",
  "password": "govt123"
}
```

**Expected Response (200 OK):**
```json
{
  "account": {
    "id": "uuid-here",
    "email": "govt@woms.com",
    "accountType": "GOVT",
    "orgId": null
  }
}
```

---

### 3. Successful Login (Organization)

**cURL:**
```bash
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"org1@woms.com","password":"org1123"}' \
  -v
```

**Postman Body:**
```json
{
  "email": "org1@woms.com",
  "password": "org1123"
}
```

**Expected Response (200 OK):**
```json
{
  "account": {
    "id": "uuid-here",
    "email": "org1@woms.com",
    "accountType": "ORG",
    "orgId": 1
  }
}
```

---

## Error Test Cases

### 4. Wrong Password

**cURL:**
```bash
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@woms.com","password":"wrongpassword"}' \
  -v
```

**Postman Body:**
```json
{
  "email": "admin@woms.com",
  "password": "wrongpassword"
}
```

**Expected Response (401 Unauthorized):**
```json
{
  "error": "Invalid credentials"
}
```

---

### 5. Non-existent Email

**cURL:**
```bash
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"nonexistent@woms.com","password":"admin123"}' \
  -v
```

**Postman Body:**
```json
{
  "email": "nonexistent@woms.com",
  "password": "admin123"
}
```

**Expected Response (401 Unauthorized):**
```json
{
  "error": "Invalid credentials",
  "hint": "No account found. Ensure users are created in the database."
}
```

---

### 6. Missing Email

**cURL:**
```bash
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"password":"admin123"}' \
  -v
```

**Postman Body:**
```json
{
  "password": "admin123"
}
```

**Expected Response (400 Bad Request):**
```json
{
  "error": "Email and password are required"
}
```

---

### 7. Missing Password

**cURL:**
```bash
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@woms.com"}' \
  -v
```

**Postman Body:**
```json
{
  "email": "admin@woms.com"
}
```

**Expected Response (400 Bad Request):**
```json
{
  "error": "Email and password are required"
}
```

---

### 8. Empty Body

**cURL:**
```bash
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{}' \
  -v
```

**Postman Body:**
```json
{}
```

**Expected Response (400 Bad Request):**
```json
{
  "error": "Email and password are required"
}
```

---

## Postman Collection Setup

### Step 1: Create New Collection

1. Open Postman
2. Click "New" → "Collection"
3. Name it "WOMS API"

### Step 2: Create Login Request

1. Click "Add Request" in the collection
2. Name it "Login - Super Admin"
3. Set method to **POST**
4. Set URL to: `http://localhost:3000/api/login`

### Step 3: Configure Headers

Go to "Headers" tab and add:
- Key: `Content-Type`
- Value: `application/json`

### Step 4: Configure Body

1. Go to "Body" tab
2. Select "raw"
3. Select "JSON" from dropdown
4. Paste:
   ```json
   {
     "email": "admin@woms.com",
     "password": "admin123"
   }
   ```

### Step 5: Save and Test

1. Click "Save"
2. Click "Send"
3. Check response status (should be 200)
4. Check response body for account data
5. Check "Cookies" tab for session cookie

---

## Testing with Session Cookie

After successful login, you can use the session cookie for authenticated requests:

### Get Session Cookie from Response

1. After login, check the "Cookies" tab in Postman
2. Copy the `session` cookie value
3. Or check response headers for `Set-Cookie`

### Use Cookie in Next Request

**cURL:**
```bash
curl -X GET http://localhost:3000/api/me \
  -H "Cookie: session=your-session-cookie-here" \
  -v
```

**Postman:**
- Postman automatically saves cookies from responses
- Just make the next request and the cookie will be sent automatically
- Or manually add in "Headers":
  - Key: `Cookie`
  - Value: `session=your-session-cookie-here`

---

## Environment Variables (Postman)

Create a Postman environment for easier testing:

1. Click "Environments" → "Create Environment"
2. Add variables:
   - `base_url`: `http://localhost:3000`
   - `admin_email`: `admin@woms.com`
   - `admin_password`: `admin123`
3. Use in requests: `{{base_url}}/api/login`

---

## Complete Test Suite

### All Test Cases in One Script

Save this as `test-login.sh`:

```bash
#!/bin/bash

BASE_URL="http://localhost:3000"
API_URL="${BASE_URL}/api/login"

echo "🧪 Testing WOMS Login API"
echo "=========================="
echo ""

# Test 1: Valid login - Super Admin
echo "Test 1: Valid login (Super Admin)"
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@woms.com","password":"admin123"}' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq .

echo ""
echo "---"
echo ""

# Test 2: Valid login - Government
echo "Test 2: Valid login (Government)"
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"email":"govt@woms.com","password":"govt123"}' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq .

echo ""
echo "---"
echo ""

# Test 3: Valid login - Organization
echo "Test 3: Valid login (Organization)"
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"email":"org1@woms.com","password":"org1123"}' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq .

echo ""
echo "---"
echo ""

# Test 4: Wrong password
echo "Test 4: Wrong password (should fail)"
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@woms.com","password":"wrong"}' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq .

echo ""
echo "---"
echo ""

# Test 5: Non-existent email
echo "Test 5: Non-existent email (should fail)"
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"email":"nonexistent@woms.com","password":"admin123"}' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq .

echo ""
echo "=========================="
echo "✅ Testing complete!"
```

Run with:
```bash
chmod +x test-login.sh
./test-login.sh
```

---

## Server Logs

When testing, watch your server terminal for detailed logs:

```
🔐 [LOGIN] Login attempt started
🔐 [LOGIN] Request URL: http://localhost:3000/api/login
🔐 [LOGIN] Request Method: POST
🔐 [LOGIN] Request Headers: { content-type: 'application/json', ... }
🔐 [LOGIN] Request received: { email: 'admin@woms.com', passwordLength: 8 }
✅ [LOGIN] Database connection successful
✅ [LOGIN] Account found: { email: 'admin@woms.com', ... }
✅ [LOGIN] Login successful, session cookie set
```

---

## Troubleshooting

### Connection Refused

**Error**: `curl: (7) Failed to connect to localhost port 3000`

**Solution**: 
- Ensure development server is running: `npm run dev`
- Check server is on port 3000

### 404 Not Found

**Error**: `404` response

**Solution**:
- Verify URL is correct: `http://localhost:3000/api/login`
- Check API route exists: `app/api/login/route.ts`

### 500 Internal Server Error

**Error**: `500` response

**Solution**:
- Check server logs for detailed error
- Verify database connection
- Ensure users exist in database

### No Response

**Error**: Request hangs or times out

**Solution**:
- Check server is running
- Verify network connectivity
- Check firewall settings

---

## Production Testing

For production/testing on different hosts:

**Replace `localhost:3000` with your actual URL:**
- Development: `http://localhost:3000`
- Staging: `https://staging.yourdomain.com`
- Production: `https://yourdomain.com`

**Example:**
```bash
curl -X POST https://yourdomain.com/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@woms.com","password":"admin123"}' \
  -v
```

---

## Additional Resources

- [SETUP_GUIDE.md](./SETUP_GUIDE.md) - Setup instructions
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Troubleshooting guide
- [QUICK_FIX_NO_USERS.md](./QUICK_FIX_NO_USERS.md) - Fix for "no users" error

