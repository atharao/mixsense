# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MixSense is a Mixer Batch Reporting Software for manufacturing environments. It's a full-stack TypeScript application with a React frontend and Node.js/Express backend, designed to manage batch mixing processes with real-time weight monitoring via load cells and QR code verification.

**Tech Stack:**
- Frontend: React 18 + Vite + Redux Toolkit + TailwindCSS
- Backend: Node.js + Express + Prisma ORM
- Database: MySQL
- Authentication: JWT + bcrypt
- Hardware Integration: Web Serial API (load cells), HID keyboard mode (QR scanners)

## Development Commands

### Root Level (Monorepo)
```bash
npm run prepare              # Install husky hooks (runs automatically)
```

### Client (Frontend)
```bash
cd client
npm run dev                  # Start dev server on http://localhost:5173
npm run build                # Build for production (runs TypeScript compiler + Vite)
npm run preview              # Preview production build
npm run lint                 # Run ESLint with auto-fix
```

### Server (Backend)
```bash
cd server
npm run dev                  # Start dev server with hot reload (ts-node-dev)
npm run build                # Compile TypeScript to dist/
npm start                    # Run compiled code from dist/
npm run lint                 # Run ESLint

# Database (Prisma)
npm run prisma:generate      # Generate Prisma client after schema changes
npm run prisma:migrate       # Create and apply migration (dev)
npm run prisma:migrate:prod  # Apply migrations (production)
npm run prisma:studio        # Open Prisma Studio GUI
npm test                     # Run Jest tests
```

### Git Workflow
The project uses Husky + lint-staged for pre-commit hooks:
- Client TypeScript/TSX files are linted before commit
- Server TypeScript files are linted before commit
- Hooks are installed automatically via `npm run prepare`

## Architecture Overview

### Backend Structure (server/src/)
The backend follows a **modular 3-layer architecture**:

```
modules/
├── auth/         # Authentication & user management
├── batches/      # Batch execution & logging
├── dashboard/    # Dashboard statistics
├── materials/    # Materials (ingredients & equipment)
├── qr/          # QR code generation
├── recipes/     # Recipe management
└── reports/     # Report generation (Excel/PDF)
```

Each module contains:
- `*.routes.ts` - URL routing + middleware application
- `*.controller.ts` - HTTP request/response handling
- `*.service.ts` - Business logic + database operations

**Key Patterns:**
- **Middleware Chain**: CORS → JSON Parser → JWT Auth → Role Check → Validation → Controller
- **Prisma Transactions**: Critical operations use `prisma.$transaction()` for atomicity
- **Snapshot Pattern**: `batch_logs` stores `setpointSnapshot` and `toleranceSnapshot` to preserve historical data even if recipes are modified later

### Frontend Structure (client/src/)

```
src/
├── api/          # Axios instance with interceptors
├── components/   # Reusable UI components
├── hooks/        # Custom React hooks (useLoadCell, useQrScanner)
├── pages/        # Page components (Dashboard, RunBatch, etc.)
├── store/        # Redux slices (auth, batch, materials, recipes, ui)
└── types/        # TypeScript type definitions
```

**Key Patterns:**
- **Redux State Management**: Global state for auth, active batch, current weight, materials, recipes
- **Axios Interceptors**: Auto-attach JWT token to requests, handle 401 errors globally
- **Custom Hooks**: Hardware integration abstracted into reusable hooks
- **Path Aliases**: Use `@/` for imports (configured in tsconfig.json and vite.config.ts)

### Database Schema (Prisma)

**Core Models:**
- `User` - Authentication (ADMIN/OPERATOR roles)
- `Material` - Both ingredients and equipment (type: INGREDIENT/EQUIPMENT)
- `Recipe` - Mixing procedures with soft delete (deletedAt)
- `RecipeStep` - Individual steps with setpoint, tolerance, QR code
- `Batch` - Execution instances (status: IN_PROGRESS/COMPLETED/ABORTED/PROCESSED)
- `BatchLog` - Historical step logs with snapshots

**Critical Relationships:**
- Recipe → RecipeSteps (cascade delete)
- Batch → BatchLogs (cascade delete)
- Material referenced by RecipeSteps (both as material and equipment)
- BatchLog stores snapshots of setpoint/tolerance for historical accuracy

**Important Notes:**
- Prisma returns `Decimal` types for weight fields - convert with `Number()` before calculations
- Soft delete is used only for recipes (via `deletedAt`)
- Materials cannot be deleted if used in recipes (enforced in service layer)

## Configuration & Environment

### Server Environment Variables (server/.env)
```bash
NODE_ENV=development
PORT=5000
DATABASE_URL="mysql://username:password@localhost:3306/mixer_db"
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=8h
CORS_ORIGIN=http://localhost:5173
LOG_LEVEL=info
```

### Client Environment Variables (client/.env)
```bash
VITE_API_URL=http://localhost:5000/api

# Node-RED WebSocket Configuration
VITE_WEIGHT_WS_URL=ws://localhost:1880/ws/weight

# ZPL Printer Service (optional)
VITE_ZPL_PRINTER_URL=http://localhost:9100/
```

**Copy from examples:**
```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

## Key Features & Implementation Details

### 1. Batch Execution Flow (Process Batch)
Operators execute recipe steps with real-time weight monitoring via Node-RED WebSocket and ZPL label printing:

1. **Select Recipe**: User selects recipe from dropdown
2. **Start Process Batch**: POST `/api/batches/process/start` creates batch with IN_PROGRESS status
3. **Display All Steps**: All recipe steps are displayed at once, with current step highlighted
4. **Weight Monitoring**: Real-time weight data from Node-RED via WebSocket (ws://localhost:1880/ws/weight)
5. **Step Execution**:
   - System auto-displays: material code, material name, setpoint, tolerance
   - Weight updates in real-time from Node-RED WebSocket
   - Operator monitors weight until satisfied
   - Click **NEXT** button when ready
6. **On NEXT Click**:
   - Generate QR code with format: `Saumya|stepNumber|materialCode|materialName|weight`
   - Display QR code on screen temporarily
   - Call ZPL Printer API (POST http://localhost:9100/) to print label with:
     - Material Name
     - Final Weight
     - QR Code
   - After successful print: Log step via POST `/api/batches/process/:id/log-step`
   - Move to next step (highlight next, clear QR)
7. **After All Steps**: Navigate to Batch Summary screen
8. **Complete Batch**: User confirms completion, status set to PROCESSED

**ZPL Label Format:**
```zpl
^XA
^MMT
^PW886
^LL591
^FT50,50^A0N,40,40^FDMaterial name: {materialName}^FS
^FT50,120^A0N,35,35^FDWeight: {weight} KG^FS
^FT50,200^BQN,2,8
^FDQA,{qrData}^FS
^XZ
```

**Tolerance Calculation:**
```typescript
toleranceRange = setpoint * (tolerancePercent / 100)
isWithinTolerance = actualWeight >= (setpoint - toleranceRange)
                 && actualWeight <= (setpoint + toleranceRange)
```

**Key Differences from Old Flow:**
- No more Web Serial API load cell integration
- No more QR scanner validation
- Node-RED WebSocket provides weight data instead
- ZPL API prints labels instead of generating/saving QR codes in DB
- All steps visible at once (not step-by-step navigation)
- Summary screen shown after completion

### 2. Hardware Integration

**Node-RED WebSocket Weight Monitor:**
- Located in `client/src/hooks/useWebSocket.ts`
- **Connects directly to Node-RED WebSocket endpoint** (ws://localhost:1880/ws/weight)
- Receives real-time weight data every second from Node-RED
- Supports message formats:
  - Simple numeric: "1234.56"
  - JSON: `{"weight": 1234.56, "stable": true}`
  - With units: "1234.56 kg"
- Updates Redux store with `dispatch(updateLoadCellData())`
- Auto-connects on component mount
- Implements stability checking algorithm

**Node-RED Setup:**
- Configure Node-RED to expose weight data via WebSocket on `/ws/weight`
- Typical port: 1880 (default Node-RED HTTP/WebSocket port)
- Data should be published every second for real-time monitoring

**ZPL Printer Integration:**
- Located in `client/src/services/zplPrinter.ts`
- Prints labels via HTTP API (POST http://localhost:9100/)
- Printer: ZDesigner ZD421-300dpi ZPL
- Generates ZPL code with:
  - Material name
  - Final weight (in KG)
  - QR code with data format: `Saumya|step|material|weight`
- Label dimensions: 886x591 dots
- QR codes generated client-side using `qrcode` library
- No QR codes saved to database (temporary generation only)

**Legacy Hardware (No Longer Used in Process Batch):**
- Load Cell via Web Serial API (still available in `useLoadCell.ts` for other features)
- QR Scanner HID mode (still available in `useQrScanner.ts` for other features)
- MQTT broker integration (replaced by direct Node-RED WebSocket connection)

### 3. Authentication & Authorization

**Backend:**
- JWT tokens with 8h expiration
- Middleware: `authenticateToken()` verifies JWT and attaches `req.user`
- Role middleware: `requireRole(['ADMIN'])` or `requireRole(['OPERATOR'])`
- Password hashing: bcrypt with salt rounds = 10

**Frontend:**
- Token stored in localStorage and Redux
- Axios interceptor auto-attaches token to all requests
- 401 response triggers automatic logout
- Protected routes check `isAuthenticated` state

**Type Safety:**
- Express Request extended in `server/src/types/express.ts` to include `user` property

### 4. Report Generation

**Excel Export (ExcelJS):**
- Located in `server/src/modules/reports/reports.service.ts`
- Generates batch reports with conditional formatting
- Color codes cells based on tolerance (green = within, red = outside)
- Auto-fits columns

**PDF Export (jsPDF + jsPDF-AutoTable):**
- Similar service pattern for PDF generation
- Used for archival and printing

## Common Development Patterns

### Adding a New Backend Module

1. Create module directory: `server/src/modules/mymodule/`
2. Create files:
   - `mymodule.routes.ts` - Define routes
   - `mymodule.controller.ts` - Handle HTTP
   - `mymodule.service.ts` - Business logic
3. Register routes in `server/src/app.ts`

### Adding a New Frontend Page

1. Create page component: `client/src/pages/MyPage.tsx`
2. Add route in `client/src/App.tsx`
3. Create Redux slice if needed: `client/src/store/mySlice.ts`
4. Register slice in `client/src/store/index.ts`

### Database Changes

1. Modify `server/prisma/schema.prisma`
2. Run `npm run prisma:migrate` (creates migration + applies)
3. Run `npm run prisma:generate` (updates Prisma client types)
4. Update TypeScript types if needed

### Prisma Transaction Pattern

```typescript
return await prisma.$transaction(async (tx) => {
  // Step 1: Delete old data
  await tx.recipeStep.deleteMany({ where: { recipeId } });

  // Step 2: Create new data
  await tx.recipeStep.createMany({ data: newSteps });

  // If ANY step fails, EVERYTHING rolls back automatically
  return await tx.recipe.findUnique({ where: { id: recipeId } });
});
```

## Linting & Code Quality

### ESLint Configuration

**Client (.eslintrc.cjs):**
- React plugin with hooks rules
- TypeScript strict mode
- Prettier integration
- React 18 JSX transform (no import React needed)
- Allows `any` type, warns on unused vars with `_` prefix

**Server:**
- TypeScript strict mode
- Prettier integration
- CommonJS module format

**Pre-commit Hooks:**
- Automatically lint client/**/*.{ts,tsx} before commit
- Automatically lint server/**/*.ts before commit
- Configured via lint-staged in root package.json

### TypeScript Strict Mode
Both client and server use strict TypeScript settings:
- `strict: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `strictNullChecks: true`

When working with existing code that may have null safety issues, check the git history:
- Recent commit: "fix: Resolve TypeScript null-safety errors in ProcessBatch component"

## Hardware Requirements & Browser Compatibility

- **Web Serial API**: Chrome/Edge only (not Firefox/Safari)
- **QR Scanner**: Any USB HID keyboard mode scanner
- **Load Cell**: RS-232 or USB serial connection

## Important Conventions

1. **Never modify historical data**: BatchLog snapshots preserve what actually happened
2. **Check foreign key usage before deletion**: Services validate that materials/recipes aren't in use
3. **Use transactions for multi-step operations**: Especially recipe updates and batch operations
4. **Convert Prisma Decimals**: Always use `Number()` before arithmetic operations
5. **Validate QR codes client-side first**: Match against current step before allowing log
6. **Path aliases**: Import with `@/` for cleaner imports (e.g., `import api from '@/api/http'`)

## Debugging Tips

- **Redux DevTools**: Install browser extension to inspect state
- **Prisma Studio**: Run `npm run prisma:studio` for database GUI
- **Server Logs**: Winston logger configured (check LOG_LEVEL in .env)
- **Network Tab**: Check axios interceptor is attaching Authorization header
- **Serial Connection**: Check Chrome flags if Web Serial API not working

## Testing

- Server has Jest configured but tests need to be implemented
- Use `npm test` in server directory when tests are added
