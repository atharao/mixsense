# Node-RED Flow for MixSense

This directory contains the pre-configured Node-RED flow for MixSense hardware integration.

## File: flows.json

This file contains a ready-to-use Node-RED flow configuration that provides:

### WebSocket Endpoints

1. **Weight Monitoring** (`/ws/weight`)
   - Endpoint for real-time weight data from load cells
   - Used by: Process Recipe page
   - Data format: `{"weight": 25.34, "timestamp": "2025-12-09T..."}`
   - Test generator included: Sends fake weight data every 1 second (20-50 kg range)

2. **Barcode Scanner** (`/ws/barcode`)
   - Endpoint for barcode scan data
   - Used by: Process Batch page
   - Data format: `{"recipeId": 34, "stepId": 51, "materialCode": "M-001", ...}`
   - Test generator included: Manual inject button for testing

## How to Import

### Quick Import (Recommended)

1. Open Node-RED: http://localhost:1880
2. Click menu (☰) → Import
3. Select file to import → Choose `flows.json`
4. Click Import
5. Click Deploy

### Alternative: Copy-Paste

1. Open `flows.json` in text editor
2. Copy all contents
3. Open Node-RED → Menu → Import
4. Paste JSON
5. Click Import → Deploy

## Testing with Fake Data

The imported flow includes test data generators:

- **Weight**: Automatically generates data every 1 second
- **Barcode**: Click the inject button (square icon) to send test data

You can test the MixSense application immediately without connecting real hardware!

## Connecting Real Hardware

To integrate actual load cells and barcode scanners:

### For Load Cell:
1. Add Serial Port or PLC input node
2. Add Function node to parse weight data
3. Connect to existing WebSocket Out (`/ws/weight`)
4. Disable/remove the fake data Inject node

### For Barcode Scanner:
1. Add USB HID or Serial Port input node
2. Add Function node to format data to required JSON format
3. Connect to existing WebSocket Out (`/ws/barcode`)
4. Disable/remove the fake data Inject node

## Flow Structure

The flow is organized into two groups:

### Group 1: Weight Monitoring
- **Comment**: "Weight Coming from PLC"
- **Inject Node**: Generates fake weight every 1 second (for testing)
- **Function Node**: "Generate Fake Weight" - Creates random weight data
- **Debug Node**: "debug 4" - Monitor weight data
- **WebSocket Out**: Sends to `/ws/weight` endpoint

### Group 2: Barcode Scanner
- **Comment**: "Barcode String coming from PLC"
- **Inject Node**: Manual trigger for fake barcode (for testing)
- **Function Node**: "Generate Fake BarCode" - Creates sample barcode data
- **Debug Node**: "debug 5" - Monitor barcode data
- **WebSocket Out**: Sends to `/ws/barcode` endpoint

## Troubleshooting

### Frontend shows "DISCONNECTED"
- Verify Node-RED is running: http://localhost:1880
- Check that the flow is deployed (Deploy button should not be highlighted)
- Verify WebSocket endpoints are configured correctly

### No data received
- Enable debug nodes in Node-RED to see data flow
- Check browser console for WebSocket errors
- Verify inject nodes are enabled (not disabled)

### Data format errors
- Check the Function nodes to ensure data format matches expected structure
- Use debug nodes to inspect outgoing data

## Production Deployment

For production:
1. Replace test Inject nodes with actual hardware input nodes
2. Update Function nodes to parse real data from your devices
3. Keep the WebSocket Out nodes unchanged
4. Test thoroughly before deploying

## Support

For detailed setup instructions, see the main project documentation:
- **SETUP.md**: Complete setup guide
- **CLAUDE.md**: Architecture and development guide

## Node-RED Version

This flow was created with Node-RED v3.x and should be compatible with v3.0+.

## Notes

- The fake data generators are for **testing only** and should be replaced with real hardware in production
- Debug nodes are disabled by default to reduce overhead - enable them for troubleshooting
- WebSocket endpoints must match the URLs configured in `client/.env`
