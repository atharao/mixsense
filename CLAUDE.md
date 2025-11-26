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
```

**Copy from examples:**
```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

## Key Features & Implementation Details

### 1. Batch Execution Flow
The most complex feature - operators execute recipe steps with real-time weight monitoring:

1. **Start Batch**: POST `/api/batches/start` creates batch with IN_PROGRESS status
2. **Load Cell Integration**: Web Serial API streams weight data to Redux store
3. **Step Execution**:
   - Place material on scale
   - Scan QR code (validates material code against current step)
   - Monitor weight until stable
   - Check tolerance: `actualWeight` within `setpoint ± tolerancePercent`
   - Log entry via POST `/api/batches/:id/log-step`
4. **Complete Batch**: PUT `/api/batches/:id/end` sets status to COMPLETED

**Tolerance Calculation:**
```typescript
toleranceRange = setpoint * (tolerancePercent / 100)
isWithinTolerance = actualWeight >= (setpoint - toleranceRange)
                 && actualWeight <= (setpoint + toleranceRange)
```

### 2. Hardware Integration

**Load Cell (Web Serial API):**
- Located in `client/src/hooks/useLoadCell.ts`
- Connects via `navigator.serial.requestPort()`
- Typical baud rate: 9600
- Parses incoming serial data to extract weight
- Updates Redux store with `dispatch(updateWeight())`
- Chrome flag required: `chrome://flags/#enable-experimental-web-platform-features`

**QR Scanner (HID Keyboard Mode):**
- Located in `client/src/hooks/useQrScanner.ts`
- Listens to global keyboard events
- Accumulates characters until Enter key
- Validates scanned QR format: `MaterialCode,Setpoint,ActualValue,MaterialName,Equipment`
- Timeout pattern distinguishes fast scanner input from manual typing

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
