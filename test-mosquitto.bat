@echo off
echo ========================================
echo Testing Mosquitto Configuration
echo ========================================
echo.

echo [1/4] Checking if Mosquitto is running...
netstat -an | findstr "1883" > nul
if %errorlevel% equ 0 (
    echo ✓ Port 1883 is listening (MQTT TCP)
) else (
    echo ✗ Port 1883 is NOT listening
    echo Please start Mosquitto with: mosquitto -c mosquitto.conf -v
    goto :end
)

echo.
echo [2/4] Checking WebSocket port...
netstat -an | findstr "9001" > nul
if %errorlevel% equ 0 (
    echo ✓ Port 9001 is listening (MQTT WebSocket)
) else (
    echo ✗ Port 9001 is NOT listening
    echo Mosquitto is not configured for WebSockets!
    echo.
    echo Fix: Create mosquitto.conf with:
    echo listener 1883
    echo protocol mqtt
    echo.
    echo listener 9001
    echo protocol websockets
    echo.
    echo allow_anonymous true
    goto :end
)

echo.
echo [3/4] Testing MQTT publish (you should see this in mosquitto console)...
mosquitto_pub -h localhost -t mixsense/weight -m "99.99"
if %errorlevel% equ 0 (
    echo ✓ Successfully published test message: 99.99
) else (
    echo ✗ Failed to publish message
    echo Make sure mosquitto_pub is installed
)

echo.
echo [4/4] Instructions to verify in browser:
echo 1. Run: node mqtt-mock.js (in another terminal)
echo 2. Run: cd client ^&^& npm run dev (in another terminal)
echo 3. Open: http://localhost:5173/process-batch
echo 4. Press F12 to open console
echo 5. Look for: "✓ MQTT connected successfully"
echo 6. Look for: "📨 MQTT message received" (every second)
echo.

:end
echo ========================================
echo Test complete
echo ========================================
pause
