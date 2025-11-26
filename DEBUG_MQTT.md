# MQTT Connection Debugging Guide

## Current Setup

✅ **mqtt-mock.js** → Publishing to `mqtt://localhost:1883` (TCP)
✅ **Mosquitto Broker** → Should receive on port 1883 and bridge to port 9001 (WebSocket)
❓ **Frontend App** → Should connect to `ws://localhost:9001` (WebSocket)

## Step-by-Step Debugging

### Step 1: Verify Mosquitto Configuration

**Check if Mosquitto is running with WebSocket support:**

```bash
netstat -an | findstr "9001"
```

**Expected output:**
```
TCP    0.0.0.0:9001           0.0.0.0:0              LISTENING
```

If you DON'T see port 9001, Mosquitto is NOT configured for WebSockets!

**Fix:** Create `mosquitto.conf` with:
```conf
listener 1883
protocol mqtt

listener 9001
protocol websockets

allow_anonymous true
log_type all
log_dest stdout
```

**Restart Mosquitto:**
```bash
mosquitto -c mosquitto.conf -v
```

---

### Step 2: Test Mosquitto is Receiving Mock Data

**Terminal 1 - Run mock sender:**
```bash
node mqtt-mock.js
```

You should see:
```
Mock MQTT connected
Published weight: 12.34
Published weight: 45.67
...
```

**Terminal 2 - Subscribe to verify data:**
```bash
mosquitto_sub -h localhost -t mixsense/weight -v
```

You should see:
```
mixsense/weight 12.34
mixsense/weight 45.67
...
```

If you DON'T see data here, the mock isn't working properly.

---

### Step 3: Test WebSocket Connection

**Open a new terminal and subscribe via WebSocket:**

Unfortunately, `mosquitto_sub` uses TCP by default. To test WebSocket, we'll use the browser.

---

### Step 4: Check Frontend Connection

**Start your React app:**
```bash
cd client
npm run dev
```

**Open browser and navigate to:**
```
http://localhost:5173/process-batch
```

**Open Developer Console (F12) and check for:**

✅ **Success messages:**
```
Connecting to MQTT broker at ws://localhost:9001...
✓ MQTT connected successfully
✓ Subscribed to topic: mixsense/weight
```

❌ **Error messages:**
```
MQTT connection error: ...
WebSocket connection failed
```

---

### Step 5: Common Issues and Fixes

#### Issue 1: "WebSocket connection to 'ws://localhost:9001/' failed"

**Cause:** Mosquitto not configured with WebSocket listener

**Fix:**
1. Stop Mosquitto (Ctrl+C)
2. Create/update `mosquitto.conf` with WebSocket config
3. Restart: `mosquitto -c mosquitto.conf -v`
4. Verify you see: `Opening websockets listen socket on port 9001`

---

#### Issue 2: "Connected" but no weight data showing

**Cause:** Frontend not updating UI or topic mismatch

**Check:**
1. Open browser console
2. Look for weight updates in Redux DevTools
3. Verify topic name matches exactly: `mixsense/weight`

**Test with manual publish:**
```bash
mosquitto_pub -h localhost -t mixsense/weight -m "99.99"
```

---

#### Issue 3: Port 9001 already in use

**Cause:** Another service using port 9001

**Fix Option A - Kill the process:**
```bash
# Windows
netstat -ano | findstr :9001
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:9001 | xargs kill -9
```

**Fix Option B - Use different port:**

Update `mosquitto.conf`:
```conf
listener 9002
protocol websockets
```

Update `client/.env`:
```bash
VITE_MQTT_PORT=9002
```

Restart both Mosquitto and React app.

---

## Complete Test Flow

### Terminal 1: Mosquitto
```bash
mosquitto -c mosquitto.conf -v
```

Expected:
```
Opening websockets listen socket on port 9001.
Opening ipv4 listen socket on port 1883.
```

### Terminal 2: Mock Publisher
```bash
node mqtt-mock.js
```

Expected:
```
Mock MQTT connected
Published weight: 12.34
Published weight: 23.45
```

### Terminal 3: Verify Reception
```bash
mosquitto_sub -h localhost -t mixsense/weight -v
```

Expected:
```
mixsense/weight 12.34
mixsense/weight 23.45
```

### Browser: React App
```
http://localhost:5173/process-batch
```

**Console should show:**
```
Connecting to MQTT broker at ws://localhost:9001...
✓ MQTT connected successfully
✓ Subscribed to topic: mixsense/weight
```

**UI should show:**
```
Current Weight: 12.34 KG (updating every second)
```

---

## Still Not Working?

Add detailed logging to the frontend hook. Check the next file for enhanced debugging version.
