# MixSense - Mixer Batch Reporting Software
## Implementation Plan

---

## 1. Project Overview

**Purpose**: A comprehensive web-based batch reporting system for ingredient-based mixing operations with robust user management, traceability, and analytics.

**Key Features**:
- User authentication and role-based access control (Admin/Operator)
- Material and recipe management
- Real-time batch execution with load cell integration
- QR code scanning and generation
- Comprehensive reporting and analytics
- Dashboard with equipment status monitoring

---

## 2. Tech Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express
- **Language**: TypeScript
- **Database**: MySQL
- **ORM**: Prisma
- **Authentication**: JWT (HS256) + bcrypt
- **Validation**: Express-validator

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **State Management**: Redux Toolkit
- **Styling**: TailwindCSS
- **HTTP Client**: Axios
- **Charts**: Recharts (for analytics)
- **QR Generation**: qrcode.react
- **Reporting**: SheetJS (xlsx), jsPDF + jspdf-autotable

### Hardware Integration
- **Load Cell**: Web Serial API (browser-based)
- **QR Scanner**: HID keyboard wedge mode

### Development Tools
- **API Testing**: Postman/Thunder Client
- **Code Quality**: ESLint, Prettier
- **Version Control**: Git

---

## 3. System Architecture

### Deployment Model
- Monorepo structure with two main directories:
  - `server/` - REST API, business logic, background jobs
  - `client/` - React SPA, hardware integration
- On-premise or cloud deployment
- MySQL database in same LAN for low latency

### User Roles
1. **ADMIN**: Full access to all modules (users, materials, recipes, reports)
2. **OPERATOR**: Limited to batch execution and viewing reports

---

## 4. Database Schema (MySQL)

### Tables

#### `users`
```sql
- id (PK, INT, AUTO_INCREMENT)
- username (VARCHAR(50), UNIQUE, NOT NULL)
- password_hash (VARCHAR(255), NOT NULL)
- role (ENUM('ADMIN', 'OPERATOR'), NOT NULL)
- created_at (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
```

#### `materials`
```sql
- id (PK, INT, AUTO_INCREMENT)
- name (VARCHAR(100), NOT NULL)
- code (VARCHAR(50), UNIQUE, NOT NULL)
- type (ENUM('INGREDIENT', 'EQUIPMENT'), NOT NULL)
- created_by_user_id (FK -> users.id, INT)
- created_at (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
```

#### `recipes`
```sql
- id (PK, INT, AUTO_INCREMENT)
- name (VARCHAR(100), NOT NULL)
- created_by_user_id (FK -> users.id, INT)
- created_at (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
- deleted_at (TIMESTAMP, NULL) -- soft delete
```

#### `recipe_steps`
```sql
- id (PK, INT, AUTO_INCREMENT)
- recipe_id (FK -> recipes.id, INT, NOT NULL)
- material_id (FK -> materials.id, INT, NOT NULL)
- equipment_id (FK -> materials.id, INT, NULL)
- step_order (INT, NOT NULL)
- setpoint (DECIMAL(10,3), NOT NULL)
- tolerance_percent (DECIMAL(5,2), NOT NULL)
```

#### `batches`
```sql
- id (PK, INT, AUTO_INCREMENT)
- recipe_id (FK -> recipes.id, INT, NOT NULL)
- operator_user_id (FK -> users.id, INT, NOT NULL)
- equipment_id (FK -> materials.id, INT, NULL)
- start_time (TIMESTAMP, NOT NULL)
- end_time (TIMESTAMP, NULL)
- status (ENUM('IN_PROGRESS', 'COMPLETED', 'ABORTED'), NOT NULL)
```

#### `batch_logs`
```sql
- id (PK, INT, AUTO_INCREMENT)
- batch_id (FK -> batches.id, INT, NOT NULL)
- step_id (FK -> recipe_steps.id, INT, NOT NULL)
- material_id (FK -> materials.id, INT, NOT NULL)
- actual_weight (DECIMAL(10,3), NOT NULL)
- setpoint_snapshot (DECIMAL(10,3), NOT NULL)
- tolerance_snapshot (DECIMAL(5,2), NOT NULL)
- scanned_qr_code (TEXT)
- timestamp (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
```

### Indexes
- Foreign keys on all FK columns
- Index on `batches.status` for dashboard queries
- Index on `batches.equipment_id` for equipment status
- Index on `batch_logs.batch_id` for reporting

---

## 5. Backend Design

### Folder Structure
```
server/
├── src/
│   ├── config/
│   │   ├── env.ts              # Environment configuration
│   │   ├── db.ts               # Database connection
│   │   └── jwt.ts              # JWT configuration
│   ├── middleware/
│   │   ├── auth.ts             # JWT verification
│   │   ├── roles.ts            # Role-based access control
│   │   ├── errorHandler.ts    # Global error handler
│   │   └── validation.ts       # Request validation
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   └── auth.routes.ts
│   │   ├── materials/
│   │   │   ├── materials.controller.ts
│   │   │   ├── materials.service.ts
│   │   │   └── materials.routes.ts
│   │   ├── recipes/
│   │   │   ├── recipes.controller.ts
│   │   │   ├── recipes.service.ts
│   │   │   └── recipes.routes.ts
│   │   ├── batches/
│   │   │   ├── batches.controller.ts
│   │   │   ├── batches.service.ts
│   │   │   └── batches.routes.ts
│   │   ├── reports/
│   │   │   ├── reports.controller.ts
│   │   │   ├── reports.service.ts
│   │   │   └── reports.routes.ts
│   │   ├── dashboard/
│   │   │   ├── dashboard.controller.ts
│   │   │   ├── dashboard.service.ts
│   │   │   └── dashboard.routes.ts
│   │   └── qr/
│   │       ├── qr.controller.ts
│   │       ├── qr.service.ts
│   │       └── qr.routes.ts
│   ├── types/
│   │   └── express.ts          # Extended Express types
│   ├── utils/
│   │   ├── logger.ts           # Winston logger
│   │   └── validators.ts       # Common validators
│   ├── app.ts                  # Express app setup
│   └── server.ts               # Server entry point
├── prisma/
│   ├── schema.prisma           # Prisma schema
│   └── migrations/             # Database migrations
├── scripts/
│   └── backup_db.sh            # Database backup script
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

### REST API Endpoints

#### Authentication
- `POST /api/auth/login` - User login (returns JWT)
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user info

#### Materials (ADMIN only)
- `GET /api/materials` - List all materials
- `GET /api/materials/:id` - Get material by ID
- `POST /api/materials` - Create new material
- `PUT /api/materials/:id` - Update material
- `DELETE /api/materials/:id` - Delete material

#### Recipes (ADMIN only)
- `GET /api/recipes` - List all recipes (summary)
- `GET /api/recipes/:id` - Get recipe with steps
- `POST /api/recipes` - Create new recipe with steps
- `PUT /api/recipes/:id` - Update recipe and steps
- `DELETE /api/recipes/:id` - Soft delete recipe

#### Batches (OPERATOR)
- `POST /api/batches/start` - Start new batch
- `POST /api/batches/log-step` - Log a step entry
- `PUT /api/batches/:id/end` - End batch
- `GET /api/batches/:id` - Get batch details with logs
- `GET /api/batches/active` - Get active batches

#### Reports (ADMIN/OPERATOR read)
- `GET /api/reports` - List batches with filters
- `GET /api/reports/:batchId` - Get detailed batch report
- `GET /api/reports/:batchId/export/excel` - Export to Excel
- `GET /api/reports/:batchId/export/pdf` - Export to PDF

#### QR Utilities
- `POST /api/qr/generate` - Generate QR code
- `POST /api/qr/validate` - Validate scanned QR code

#### Dashboard
- `GET /api/dashboard/status` - Get dashboard data
  - Active batch count
  - Equipment status (equipmentId, name, status, batchId)

---

## 6. Frontend Design

### Folder Structure
```
client/
├── src/
│   ├── api/
│   │   ├── http.ts             # Axios instance with interceptors
│   │   ├── authApi.ts          # Auth API calls
│   │   ├── materialsApi.ts     # Materials API calls
│   │   ├── recipesApi.ts       # Recipes API calls
│   │   ├── batchesApi.ts       # Batches API calls
│   │   ├── reportsApi.ts       # Reports API calls
│   │   ├── dashboardApi.ts     # Dashboard API calls
│   │   └── qrApi.ts            # QR API calls
│   ├── store/
│   │   ├── index.ts            # Redux store configuration
│   │   ├── authSlice.ts        # Auth state
│   │   ├── batchSlice.ts       # Batch execution state
│   │   └── uiSlice.ts          # UI state (modals, toasts)
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx   # Main layout with navigation
│   │   │   ├── AdminLayout.tsx # Admin-specific layout
│   │   │   └── OperatorLayout.tsx # Operator-specific layout
│   │   ├── common/
│   │   │   ├── DataGrid.tsx    # Reusable data grid
│   │   │   ├── Button.tsx      # Custom button component
│   │   │   ├── Input.tsx       # Custom input component
│   │   │   ├── Modal.tsx       # Modal component
│   │   │   ├── Toast.tsx       # Toast notifications
│   │   │   └── ProtectedRoute.tsx # Route protection
│   │   ├── dashboard/
│   │   │   ├── DashboardPage.tsx
│   │   │   └── EquipmentStatusCard.tsx
│   │   ├── auth/
│   │   │   └── LoginPage.tsx
│   │   ├── materials/
│   │   │   ├── MaterialListPage.tsx
│   │   │   ├── MaterialForm.tsx
│   │   │   └── MaterialGrid.tsx
│   │   ├── recipes/
│   │   │   ├── RecipeListPage.tsx
│   │   │   ├── RecipeBuilderPage.tsx
│   │   │   ├── RecipeStepsGrid.tsx
│   │   │   └── StepForm.tsx
│   │   ├── batch/
│   │   │   ├── RunBatchPage.tsx
│   │   │   ├── ActiveStepView.tsx
│   │   │   ├── StepListPanel.tsx
│   │   │   ├── HistoryTable.tsx
│   │   │   └── QrScanSection.tsx
│   │   ├── reports/
│   │   │   ├── ReportsPage.tsx
│   │   │   ├── ReportFilters.tsx
│   │   │   ├── BatchReportModal.tsx
│   │   │   └── AnalyticsChart.tsx
│   │   └── qr/
│   │       ├── QrGeneratorPage.tsx
│   │       └── QrPreview.tsx
│   ├── hooks/
│   │   ├── useAuth.ts          # Auth hook
│   │   ├── useLoadCell.ts      # Load cell integration hook
│   │   └── useQrScanner.ts     # QR scanner hook
│   ├── types/
│   │   ├── models.ts           # Type definitions for models
│   │   └── api.ts              # API response types
│   ├── utils/
│   │   ├── formatters.ts       # Data formatters
│   │   ├── validators.ts       # Form validators
│   │   └── constants.ts        # App constants
│   ├── styles/
│   │   └── index.css           # Global styles with Tailwind
│   ├── App.tsx                 # Main App component
│   ├── main.tsx                # Entry point
│   └── router.tsx              # React Router configuration
├── public/
│   └── logo.svg
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
├── vite.config.ts
└── README.md
```

### Key Pages and Features

#### 1. Login Page
- Username and password fields
- JWT token stored in Redux + localStorage
- Redirect based on role (Admin/Operator)

#### 2. Dashboard (Home Screen)
- **Top Bar**: Logo, app name, logged-in user, real-time clock, logout button
- **Navigation Buttons**: Create Recipe, Material Management, Run Batch, Reports
- **Status Panel**:
  - Active batches count
  - Equipment status cards (equipment name, status, current batch ID)

#### 3. Material Management (ADMIN only)
- **Form Section**: Material name, material code, Save button
- **Data Grid**: Material name, code, timestamp, created by username
- **Controls**: Add, Delete, Refresh buttons
- **Validation**: Material code must be unique

#### 4. Recipe Management (ADMIN only)
- **Recipe Info Section**: Recipe name, created by (auto-fill), created on (auto)
- **Steps Grid**:
  - Ingredient (dropdown from materials)
  - Setpoint (numeric input)
  - Equipment (dropdown from equipment materials)
  - Step order
  - Tolerance (%)
- **Controls**: Add Step, Delete Step, Reorder Steps, Save Recipe
- **Side Panel**: List of existing recipes with Edit/Delete buttons

#### 5. Run Batch Screen (OPERATOR)
- **Batch Info**: Recipe dropdown, operator (auto-fill), Start Batch button
- **Active Step View**:
  - Current ingredient highlighted
  - Setpoint display
  - Equipment name
  - Large weight display from load cell
  - Tolerance indicator (green/red)
- **Step List Panel**: All recipe steps with current step highlighted
- **QR Scan Section**:
  - QR input field (HID scanner)
  - Actual value display (from load cell)
  - Log Entry button (enabled when QR validated + stable weight + within tolerance)
  - Weighing Acknowledge button (for out-of-tolerance)
  - Print QR button (for out-of-tolerance preview)
- **History Table**: Timestamp, scanned QR, actual value for all logged steps
- **Controls**: End Batch, Print Report, Back

**Validation Logic**:
- QR code must match expected material for current step
- Load cell must show stable reading
- Within tolerance: green indicator, enable Log Entry
- Out of tolerance: red indicator, show Acknowledge + Preview QR buttons

#### 6. Reports Module (ADMIN/OPERATOR)
- **Filters**: Batch ID, date range, recipe name
- **Results Table**: Batch ID, recipe name, operator, start/end time, Export button
- **Detail Panel**: Step-by-step data (ingredient, setpoint, actual, equipment, timestamp)
- **Export Options**: Export to Excel, Export to PDF
- **Analytics Chart**: Bar chart showing setpoint vs actual values per step

#### 7. QR Generator Page
- **Input Fields**: Material code, setpoint, actual value, material name, equipment
- **QR Format**: `11000012,580.25,498.25,Material-X,Equipment-A`
- **Preview**: Live QR code preview
- **Controls**: Generate, Print

---

## 7. Hardware Integration

### Load Cell Integration (Web Serial API)
**Implementation**: `client/src/hooks/useLoadCell.ts`

**Features**:
- Connect to load cell via Web Serial API
- Parse weight data from serial stream
- Detect stable readings
- Real-time weight updates in Redux state

**Browser Requirements**:
- Chrome/Edge (Web Serial API support)
- HTTPS or localhost

**Sample Data Format** (to be configured based on actual load cell):
```
Weight: 123.45 kg [STABLE]
```

### QR Scanner Integration (HID Keyboard Wedge)
**Implementation**: `client/src/hooks/useQrScanner.ts`

**Features**:
- Listen for keyboard events
- Buffer characters until Enter key
- Parse QR code format
- Validate against expected material

**QR Code Format**:
```
MaterialCode,Setpoint,ActualValue,MaterialName,Equipment
Example: 11000012,580.25,498.25,Material-X,Equipment-A
```

---

## 8. Security & Authentication

### JWT Authentication
- **Algorithm**: HS256
- **Token Contents**: userId, username, role
- **Expiration**: 8 hours (configurable)
- **Storage**: localStorage + Redux state

### Password Security
- **Hashing**: bcrypt with salt rounds = 10
- **Policy**: Minimum 8 characters (can be enhanced)

### Role-Based Access Control
- Middleware checks JWT + role before allowing access
- Admin routes: `/api/materials/*`, `/api/recipes/*`
- Operator routes: `/api/batches/*`
- Shared routes: `/api/reports/*` (read-only for both)

---

## 9. Data Backup & Maintenance

### Database Backup
**Script**: `server/scripts/backup_db.sh`

```bash
#!/bin/bash
BACKUP_DIR="/backups"
DB_USER="dbuser"
DB_PASS="dbpass"
DB_NAME="mixer_db"
DATE=$(date +%F_%H-%M-%S)

mysqldump -u $DB_USER -p$DB_PASS $DB_NAME | gzip > $BACKUP_DIR/mixer_db_$DATE.sql.gz

# Keep backups for 30 days
find $BACKUP_DIR -name "mixer_db_*.sql.gz" -mtime +30 -delete
```

**Cron Job** (daily at midnight):
```bash
0 0 * * * /bin/bash /opt/mixer/server/scripts/backup_db.sh
```

### Logging
- **Backend**: Winston for structured logging
- **Log Levels**: error, warn, info, debug
- **Log Files**:
  - `error.log` - errors only
  - `combined.log` - all logs
  - Daily rotation with 14-day retention

### Monitoring
- Health check endpoint: `GET /api/health`
- Returns: database status, uptime, memory usage

---

## 10. Development Setup

### Prerequisites
- Node.js >= 18.x
- MySQL >= 8.0
- npm or yarn
- Git

### Environment Variables

**Server** (`.env`):
```env
NODE_ENV=development
PORT=5000
DATABASE_URL="mysql://user:password@localhost:3306/mixer_db"
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=8h
CORS_ORIGIN=http://localhost:5173
```

**Client** (`.env`):
```env
VITE_API_URL=http://localhost:5000/api
```

### Installation Commands

**Server Setup**:
```bash
cd server
npm init -y
npm install express typescript ts-node ts-node-dev @types/node @types/express
npm install prisma @prisma/client
npm install dotenv cors jsonwebtoken bcrypt express-validator
npm install @types/cors @types/jsonwebtoken @types/bcrypt --save-dev
npm install winston
npx prisma init
```

**Client Setup**:
```bash
cd client
npm create vite@latest . -- --template react-ts
npm install axios @reduxjs/toolkit react-redux react-router-dom
npm install tailwindcss postcss autoprefixer
npm install recharts xlsx jspdf jspdf-autotable qrcode.react
npm install @types/qrcode.react --save-dev
npx tailwindcss init -p
```

### Development Scripts

**Server** (`package.json`):
```json
{
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:studio": "prisma studio"
  }
}
```

**Client** (`package.json`):
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext ts,tsx"
  }
}
```

---

## 11. Implementation Phases

### Phase 1: Project Setup & Authentication (Week 1)
- [x] Initialize server and client projects
- [x] Set up Prisma with MySQL
- [x] Create database schema and migrations
- [x] Implement JWT authentication
- [x] Create login page and protected routes
- [x] Set up Redux store with auth slice

### Phase 2: Core Backend Modules (Week 2)
- [ ] Implement Materials module (CRUD)
- [ ] Implement Recipes module (CRUD with steps)
- [ ] Implement Batches module (start, log, end)
- [ ] Implement Reports module (queries and exports)
- [ ] Implement Dashboard module (status queries)
- [ ] Add request validation and error handling

### Phase 3: Frontend UI Development (Week 3)
- [ ] Create dashboard with navigation
- [ ] Build Material Management page
- [ ] Build Recipe Builder page with dynamic steps
- [ ] Create Run Batch page with step tracking
- [ ] Implement Reports page with filters and export
- [ ] Add QR Generator page

### Phase 4: Hardware Integration (Week 4)
- [ ] Implement Web Serial API for load cell
- [ ] Implement QR scanner keyboard listener
- [ ] Integrate load cell data into Run Batch page
- [ ] Add real-time weight display and stability detection
- [ ] Implement tolerance validation logic
- [ ] Test with actual hardware devices

### Phase 5: Reporting & Analytics (Week 5)
- [ ] Implement Excel export with SheetJS
- [ ] Implement PDF export with jsPDF
- [ ] Create analytics charts with Recharts
- [ ] Add batch history visualization
- [ ] Implement detailed batch reports

### Phase 6: Testing & Deployment (Week 6)
- [ ] Write unit tests for critical services
- [ ] End-to-end testing of batch execution flow
- [ ] Performance testing with large datasets
- [ ] Set up database backup scripts
- [ ] Create deployment documentation
- [ ] User training materials

---

## 12. Testing Strategy

### Backend Testing
- **Unit Tests**: Services and utilities
- **Integration Tests**: API endpoints
- **Tools**: Jest, Supertest

### Frontend Testing
- **Component Tests**: React Testing Library
- **E2E Tests**: Playwright or Cypress
- **Tools**: Vitest, React Testing Library

### Hardware Testing
- **Load Cell**: Test with different baud rates and data formats
- **QR Scanner**: Test scan speed and accuracy
- **Integration**: Test complete batch execution flow

---

## 13. Deployment Architecture

### On-Premise Deployment
```
┌─────────────────────────────────────┐
│         Nginx (Reverse Proxy)       │
│         SSL/TLS Termination         │
└────────────┬────────────────────────┘
             │
     ┌───────┴────────┐
     │                │
┌────▼─────┐   ┌─────▼──────┐
│  Client  │   │   Server   │
│  (React) │   │  (Express) │
│  :5173   │   │   :5000    │
└──────────┘   └─────┬──────┘
                     │
              ┌──────▼───────┐
              │    MySQL     │
              │    :3306     │
              └──────────────┘
```

### Production Checklist
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] SSL certificates installed
- [ ] Firewall rules configured
- [ ] Backup cron jobs scheduled
- [ ] Log rotation configured
- [ ] Health monitoring set up
- [ ] Admin user created

---

## 14. Future Enhancements

### Phase 2 Features (Post-MVP)
- Two-factor authentication (2FA)
- User management UI for admins
- Audit logs for all operations
- Email notifications for batch completion
- Mobile responsive design
- Offline mode with sync
- Multiple language support
- Advanced analytics dashboard
- Batch scheduling system
- Integration with external ERP systems

---

## 15. Success Criteria

### Functional Requirements
- ✅ Users can log in with role-based access
- ✅ Admins can manage materials and recipes
- ✅ Operators can execute batches following recipes
- ✅ System validates QR codes and weight tolerances
- ✅ Load cell data is integrated in real-time
- ✅ Reports can be generated and exported
- ✅ Dashboard shows real-time equipment status

### Non-Functional Requirements
- **Performance**: Page load < 2 seconds, API response < 500ms
- **Reliability**: 99.9% uptime for production
- **Security**: No critical vulnerabilities, encrypted data
- **Usability**: Intuitive UI, minimal training required
- **Maintainability**: Well-documented code, modular architecture

---

## 16. Documentation Deliverables

### Technical Documentation
1. **API Documentation**: Swagger/OpenAPI specs for all endpoints
2. **Database Schema**: ERD diagrams and table definitions
3. **Architecture Diagrams**: System architecture and data flow
4. **Deployment Guide**: Step-by-step deployment instructions

### User Documentation
1. **Admin Manual**: User management, material/recipe management
2. **Operator Manual**: Batch execution workflow, troubleshooting
3. **Training Materials**: Video tutorials, quick-start guides
4. **FAQ**: Common questions and solutions

---

## 17. Contact & Support

### Development Team
- **Project Lead**: TBD
- **Backend Developer**: TBD
- **Frontend Developer**: TBD
- **QA Engineer**: TBD

### Support Channels
- **Email**: support@mixsense.com
- **Documentation**: https://docs.mixsense.com
- **Issue Tracker**: GitHub Issues

---

## 18. Appendix

### Glossary
- **Batch**: A single execution of a recipe to produce a mixed product
- **Recipe**: A defined sequence of steps with ingredients and setpoints
- **Setpoint**: Target weight for an ingredient in a recipe step
- **Tolerance**: Acceptable variance from setpoint (percentage)
- **Load Cell**: Electronic scale that provides real-time weight measurements
- **QR Code**: Quick Response code containing material/batch information

### References
- Business Requirements Document (BRD)
- Web Serial API Documentation
- Prisma Documentation
- React + TypeScript Best Practices
- MySQL Performance Tuning Guide

---

**Document Version**: 1.0
**Last Updated**: 2025-11-21
**Status**: Implementation Ready
