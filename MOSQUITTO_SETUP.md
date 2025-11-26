# Mosquitto MQTT Broker Setup for WebSocket Support

## Problem
The browser cannot connect to MQTT via standard TCP protocol (port 1883). Browsers require **WebSocket** protocol for MQTT connections.

## Solution

### Step 1: Create Mosquitto Configuration File

Create a file named `mosquitto.conf` with the following content:

```conf
# Standard MQTT over TCP (for other clients)
listener 1883
protocol mqtt

# MQTT over WebSockets (for browser/web clients)
listener 9001
protocol websockets

# Allow anonymous connections (for development)
allow_anonymous true

# Log settings (optional)
log_type all
log_dest stdout
```

### Step 2: Start Mosquitto with Configuration

#### Windows:
```bash
mosquitto -c mosquitto.conf -v
```

#### Linux/Mac:
```bash
mosquitto -c mosquitto.conf -v
```

**Note:** The `-v` flag enables verbose logging to help debug connection issues.

### Step 3: Verify WebSocket Listener is Running

You should see output similar to:
```
1234567890: mosquitto version 2.x.x starting
1234567890: Opening websockets listen socket on port 9001.
1234567890: Opening ipv4 listen socket on port 1883.
```

### Step 4: Test MQTT Connection

#### Test WebSocket Connection (Browser):
Open your browser's developer console and navigate to your app. You should see:
```
Connecting to MQTT broker at ws://localhost:9001...
✓ MQTT connected successfully
✓ Subscribed to topic: mixsense/weight
```

#### Publish Test Message:
In a separate terminal, publish a test weight value:
```bash
mosquitto_pub -h localhost -t mixsense/weight -m "12.5"
```

Your web app should receive and display the weight: **12.5 KG**

## Troubleshooting

### Issue: "Connection refused" or "Disconnected"

**Check 1:** Verify Mosquitto is running with WebSocket support
```bash
netstat -an | grep 9001
```
You should see port 9001 listening.

**Check 2:** Check firewall settings
Make sure port 9001 is not blocked by your firewall.

**Check 3:** Check browser console
Open Developer Tools (F12) and look for MQTT connection logs.

### Issue: "Cannot bind to port 9001"

Another service might be using port 9001. Change the port in `mosquitto.conf`:
```conf
listener 9002
protocol websockets
```

And update your `.env` file:
```bash
VITE_MQTT_PORT=9002
```

### Issue: Messages not received

**Check 1:** Verify topic name matches
Make sure you're publishing to `mixsense/weight` (the exact topic the app subscribes to).

**Check 2:** Test subscription separately
```bash
mosquitto_sub -h localhost -t mixsense/weight -v
```

Then publish:
```bash
mosquitto_pub -h localhost -t mixsense/weight -m "15.3"
```

You should see: `mixsense/weight 15.3`

## Production Configuration

For production, disable anonymous access and use authentication:

```conf
listener 1883
protocol mqtt

listener 9001
protocol websockets

allow_anonymous false
password_file /path/to/mosquitto_passwd
```

Create password file:
```bash
mosquitto_passwd -c mosquitto_passwd username
```

Update your web app to use authentication:
```typescript
const client = mqtt.connect('ws://localhost:9001', {
  username: 'your-username',
  password: 'your-password'
});
```

## Data Format Examples

Your MQTT client should publish weight data in one of these formats:

### Simple Numeric (Recommended):
```bash
mosquitto_pub -h localhost -t mixsense/weight -m "12.5"
```

### JSON Format:
```bash
mosquitto_pub -h localhost -t mixsense/weight -m '{"weight": 12.5, "stable": true}'
```

### With Units:
```bash
mosquitto_pub -h localhost -t mixsense/weight -m "12.5 kg"
```

All formats will be parsed correctly by the web app.
