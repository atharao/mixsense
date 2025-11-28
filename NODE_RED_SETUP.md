# Node-RED WebSocket Setup Guide

## Problem You're Experiencing

Your Node-RED is currently sending **weight data** to **BOTH** WebSocket endpoints:

```json
{"weight":"46.26","timestamp":"2025-11-28T21:06:32.914Z"}
```

This is causing the barcode scanner to fail because it expects **barcode data**, not weight data.

---

## Solution: Two Separate WebSocket Endpoints

You need to configure **TWO different WebSocket endpoints** in Node-RED:

### 1. Weight Data Endpoint (for Process Recipe)
**Endpoint**: `ws://localhost:1880/ws/weight`
**Used by**: Process Recipe page
**Data Format**: Weight JSON

### 2. Barcode Data Endpoint (for Process Batch)
**Endpoint**: `ws://localhost:1880/ws/barcode`
**Used by**: Process Batch page
**Data Format**: Barcode pipe-delimited string or JSON

---

## Node-RED Flow Configuration

### Endpoint 1: `/ws/weight` (Weight Data)

**Flow Structure**:
```
[Inject] → [Function: Generate Weight] → [WebSocket Out: /ws/weight]
```

**Inject Node**:
- Repeat: interval
- Every: 1 second

**Function Node - "Generate Weight"**:
```javascript
// Generate random weight data for testing
msg.payload = {
    weight: (Math.random() * 50 + 10).toFixed(2),  // Random weight between 10-60 KG
    stable: Math.random() > 0.3,  // 70% chance of stable
    timestamp: new Date().toISOString()
};
return msg;
```

**WebSocket Out Node**:
- Type: Listen on
- Path: `/ws/weight`

---

### Endpoint 2: `/ws/barcode` (Barcode Scanner Data)

**Flow Structure**:
```
[Inject: Manual] → [Function: Generate Barcode] → [WebSocket Out: /ws/barcode]
```

**Inject Node**:
- **IMPORTANT**: Set to **Manual trigger only** (click button to simulate scan)
- Do NOT set to repeat/interval

**Function Node - "Generate Barcode Data"**:

**CRITICAL**: Replace the values below with ACTUAL data from your database!

```javascript
// IMPORTANT: Get these values from your database first!
// Run this SQL query to get real values:
// SELECT r.id, r.name, rs.id as stepId, rs.step_order,
//        m.code, m.name, rs.setpoint, rs.tolerance_percent
// FROM recipes r
// JOIN recipe_steps rs ON rs.recipe_id = r.id
// JOIN materials m ON m.id = rs.material_id
// WHERE r.id = 1  -- Your test recipe
// ORDER BY rs.step_order;

// Initialize step counter (cycles through steps)
var currentStep = context.get('currentStep') || 0;

// REPLACE THESE WITH YOUR ACTUAL DATABASE VALUES!
var mockRecipeSteps = [
    {
        recipeId: 1,                      // Must match your recipe ID
        recipeName: "Test Recipe",         // Must match your recipe name
        stepId: 1,                         // Must match recipe_step.id from DB
        stepOrder: 1,
        materialCode: "MAT001",            // Must match material.code from DB
        materialName: "Sugar",             // Must match material.name from DB
        actualWeight: 2.5,                 // Simulated weight
        userId: 2,                         // Your operator user ID
        setpoint: 2.4,                     // From recipe_step.setpoint
        tolerance: 5                       // From recipe_step.tolerance_percent
    },
    {
        recipeId: 1,
        recipeName: "Test Recipe",
        stepId: 2,
        stepOrder: 2,
        materialCode: "MAT002",
        materialName: "Flour",
        actualWeight: 5.2,
        userId: 2,
        setpoint: 5.0,
        tolerance: 3
    },
    {
        recipeId: 1,
        recipeName: "Test Recipe",
        stepId: 3,
        stepOrder: 3,
        materialCode: "MAT003",
        materialName: "Cocoa Powder",
        actualWeight: 0.8,
        userId: 2,
        setpoint: 0.75,
        tolerance: 10
    }
];

// Get current step
var step = mockRecipeSteps[currentStep % mockRecipeSteps.length];

// Add timestamp
step.timestamp = new Date().toISOString();

// Format as pipe-delimited string (RECOMMENDED)
msg.payload =
    step.recipeId + "|" +
    step.recipeName + "|" +
    step.stepId + "|" +
    step.stepOrder + "|" +
    step.materialCode + "|" +
    step.materialName + "|" +
    step.actualWeight + "|" +
    step.userId + "|" +
    step.timestamp + "|" +
    step.setpoint + "|" +
    step.tolerance;

// OR use JSON format (also supported):
// msg.payload = step;

// Move to next step
context.set('currentStep', currentStep + 1);

node.warn("Sending barcode for step " + step.stepOrder + ": " + step.materialName);

return msg;
```

**WebSocket Out Node**:
- Type: Listen on
- Path: `/ws/barcode`

---

## How to Get Real Database Values

### Step 1: Connect to your MySQL database

```bash
mysql -u your_username -p mixer_db
```

### Step 2: Run this query to get your recipe data

```sql
SELECT
    r.id as recipeId,
    r.name as recipeName,
    rs.id as stepId,
    rs.step_order as stepOrder,
    m.code as materialCode,
    m.name as materialName,
    rs.setpoint,
    rs.tolerance_percent as tolerance
FROM recipes r
JOIN recipe_steps rs ON rs.recipe_id = r.id
JOIN materials m ON m.id = rs.material_id
WHERE r.id = 1  -- Change to your test recipe ID
ORDER BY rs.step_order;
```

### Step 3: Copy the results into the Node-RED function

Replace the `mockRecipeSteps` array with your actual data!

---

## Testing the Setup

### Test Weight Endpoint (Process Recipe)

1. **Start Node-RED** and deploy the weight flow
2. **Open MixSense** → Navigate to **Process Recipe**
3. **Select a recipe** and start
4. **Watch the weight monitor** → Should show "CONNECTED" and live weight updates every second

**Expected Console Output**:
```
📨 WebSocket message received
✓ Parsed weight: 25.43 KG
```

---

### Test Barcode Endpoint (Process Batch)

1. **Make sure your mock data matches your database** (recipe ID, step IDs, material codes)
2. **Open MixSense** → Navigate to **Process Batch**
3. **Select the SAME recipe** that matches your mock data
4. **Start the batch**
5. **Click the Inject button in Node-RED** to simulate barcode scan
6. **Watch the frontend** → Should validate and log the step

**Expected Console Output**:
```
📨 Barcode WebSocket message received
✓ Parsed barcode as pipe-delimited: {recipeId: 1, stepId: 5, ...}
```

**If validation fails, you'll see**:
```
Wrong recipe! Expected "..." but scanned "..."
Wrong step! Expected step X but scanned step Y
Wrong material! Expected "..." but scanned "..."
```

---

## Common Issues

### Issue 1: "Could not parse barcode data"
**Cause**: Wrong data format being sent to barcode endpoint
**Solution**: Make sure `/ws/barcode` sends pipe-delimited string with 11 fields, not weight JSON

### Issue 2: "Wrong recipe/step/material" validation errors
**Cause**: Mock data doesn't match your database
**Solution**: Run the SQL query above and update your Node-RED function with real values

### Issue 3: Weight not updating in Process Recipe
**Cause**: Weight WebSocket not connected or not sending data
**Solution**: Check `/ws/weight` is sending weight JSON every second

### Issue 4: Both endpoints showing same data
**Cause**: Node-RED configuration error - both WebSocket paths pointing to same source
**Solution**: Create TWO separate flows with TWO separate WebSocket Out nodes

---

## Quick Checklist

- [ ] Two separate WebSocket Out nodes in Node-RED
- [ ] `/ws/weight` sends weight JSON every 1 second
- [ ] `/ws/barcode` sends barcode string on manual trigger only
- [ ] Barcode mock data matches your database (recipeId, stepId, materialCode)
- [ ] Frontend `.env` has both WebSocket URLs configured
- [ ] Node-RED is running on port 1880

---

## Example Complete Node-RED Flow (JSON Export)

Here's a complete working flow you can import:

```json
[
  {
    "id": "weight-inject",
    "type": "inject",
    "name": "Weight Timer",
    "repeat": "1",
    "once": true,
    "wires": [["weight-function"]]
  },
  {
    "id": "weight-function",
    "type": "function",
    "name": "Generate Weight",
    "func": "msg.payload = {\n    weight: (Math.random() * 50 + 10).toFixed(2),\n    stable: Math.random() > 0.3,\n    timestamp: new Date().toISOString()\n};\nreturn msg;",
    "wires": [["weight-ws"]]
  },
  {
    "id": "weight-ws",
    "type": "websocket out",
    "name": "Weight WebSocket",
    "path": "/ws/weight",
    "wires": []
  },
  {
    "id": "barcode-inject",
    "type": "inject",
    "name": "Manual Scan Trigger",
    "wires": [["barcode-function"]]
  },
  {
    "id": "barcode-function",
    "type": "function",
    "name": "Generate Barcode",
    "func": "// REPLACE WITH YOUR DATABASE VALUES!\nvar step = {\n    recipeId: 1,\n    recipeName: \"Test Recipe\",\n    stepId: 1,\n    stepOrder: 1,\n    materialCode: \"MAT001\",\n    materialName: \"Sugar\",\n    actualWeight: 2.5,\n    userId: 2,\n    timestamp: new Date().toISOString(),\n    setpoint: 2.4,\n    tolerance: 5\n};\n\nmsg.payload = step.recipeId + \"|\" + step.recipeName + \"|\" + step.stepId + \"|\" + step.stepOrder + \"|\" + step.materialCode + \"|\" + step.materialName + \"|\" + step.actualWeight + \"|\" + step.userId + \"|\" + step.timestamp + \"|\" + step.setpoint + \"|\" + step.tolerance;\n\nreturn msg;",
    "wires": [["barcode-ws"]]
  },
  {
    "id": "barcode-ws",
    "type": "websocket out",
    "name": "Barcode WebSocket",
    "path": "/ws/barcode",
    "wires": []
  }
]
```

---

Need help? Check your browser console for detailed error messages showing which field is causing validation to fail!
