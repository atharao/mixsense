# MixSense System Flow Documentation

Complete end-to-end documentation of the MixSense Batch Reporting System, covering all flows from user creation to report generation.

---

## Table of Contents

1. [System Architecture Overview](#system-architecture-overview)
2. [Database Schema & Relationships](#database-schema--relationships)
3. [Flow 1: User Management](#flow-1-user-management)
4. [Flow 2: Material Management](#flow-2-material-management)
5. [Flow 3: Recipe Creation](#flow-3-recipe-creation)
6. [Flow 4: Batch Execution (Process Batch)](#flow-4-batch-execution-process-batch)
7. [Flow 5: Reports Generation](#flow-5-reports-generation)
8. [Critical Design Patterns](#critical-design-patterns)
9. [Data Flow Diagrams](#data-flow-diagrams)

---

## System Architecture Overview

### Tech Stack
- **Frontend:** React 18 + TypeScript + Redux Toolkit + TailwindCSS
- **Backend:** Node.js + Express + TypeScript
- **Database:** MySQL with Prisma ORM
- **Authentication:** JWT (JSON Web Tokens) + bcrypt
- **Hardware Integration:**
  - Node-RED WebSocket (weight data)
  - ZPL Printer API (label printing)

### Core Components
```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (React)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Users   │  │Materials │  │ Recipes  │  │  Batch   │   │
│  │   Mgmt   │  │   Mgmt   │  │   Mgmt   │  │ Process  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│         ↓            ↓             ↓             ↓          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           Redux Store (Global State)                │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────┬───────────────────────────────────────┘
                      │ Axios HTTP + JWT
                      ↓
┌─────────────────────────────────────────────────────────────┐
│                   BACKEND (Express API)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   Auth   │  │Materials │  │ Recipes  │  │ Batches  │   │
│  │  Module  │  │  Module  │  │  Module  │  │  Module  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│         ↓            ↓             ↓             ↓          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Prisma ORM Layer                       │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ↓
┌─────────────────────────────────────────────────────────────┐
│                  MySQL Database                             │
│  users | materials | recipes | recipe_steps |              │
│  batches | batch_logs                                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                 External Systems                            │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │  Node-RED        │         │  ZPL Printer     │         │
│  │  WebSocket       │         │  Service         │         │
│  │  (Weight Data)   │         │  (Label Print)   │         │
│  └──────────────────┘         └──────────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema & Relationships

### Complete Prisma Schema

```prisma
// User Model
model User {
  id        Int      @id @default(autoincrement())
  username  String   @unique
  password  String   // bcrypt hashed
  role      Role     @default(OPERATOR)
  createdAt DateTime @default(now())
  batches   Batch[]  // ← One user creates many batches
}

enum Role {
  ADMIN
  OPERATOR
}

// Material Model (both ingredients and equipment)
model Material {
  id          Int          @id @default(autoincrement())
  code        String       @unique
  name        String
  type        MaterialType
  unit        String
  createdAt   DateTime     @default(now())

  // Used as material in steps
  recipeSteps RecipeStep[] @relation("MaterialInStep")

  // Used as equipment in steps
  equipmentSteps RecipeStep[] @relation("EquipmentInStep")

  // Logged in batches
  batchLogs   BatchLog[]
}

enum MaterialType {
  INGREDIENT
  EQUIPMENT
}

// Recipe Model
model Recipe {
  id          Int          @id @default(autoincrement())
  code        String       @unique
  name        String
  description String?
  createdAt   DateTime     @default(now())
  deletedAt   DateTime?    // Soft delete
  steps       RecipeStep[] // ← One recipe has many steps
  batches     Batch[]      // ← One recipe used in many batches
}

// Recipe Step Model
model RecipeStep {
  id          Int        @id @default(autoincrement())
  recipeId    Int
  stepNumber  Int
  materialId  Int
  equipmentId Int?
  setpoint    Decimal    @db.Decimal(10, 2)  // Target weight
  tolerance   Decimal    @db.Decimal(5, 2)   // % tolerance

  recipe      Recipe     @relation(fields: [recipeId], references: [id], onDelete: Cascade)
  material    Material   @relation("MaterialInStep", fields: [materialId], references: [id])
  equipment   Material?  @relation("EquipmentInStep", fields: [equipmentId], references: [id])
  batchLogs   BatchLog[] // ← Used in many batch executions

  @@unique([recipeId, stepNumber])
}

// Batch Model
model Batch {
  id          Int         @id @default(autoincrement())
  batchNumber String      @unique
  recipeId    Int
  userId      Int
  status      BatchStatus @default(IN_PROGRESS)
  startTime   DateTime    @default(now())
  endTime     DateTime?

  recipe      Recipe      @relation(fields: [recipeId], references: [id])
  user        User        @relation(fields: [userId], references: [id])
  logs        BatchLog[]  // ← One batch has many logs (one per step)
}

enum BatchStatus {
  IN_PROGRESS
  COMPLETED
  ABORTED
  PROCESSED
}

// Batch Log Model (Historical execution data)
model BatchLog {
  id                Int      @id @default(autoincrement())
  batchId           Int
  stepId            Int
  materialId        Int
  actualWeight      Decimal  @db.Decimal(10, 2)  // Measured weight
  setpointSnapshot  Decimal  @db.Decimal(10, 2)  // Historical setpoint
  toleranceSnapshot Decimal  @db.Decimal(5, 2)   // Historical tolerance
  timestamp         DateTime @default(now())
  isWithinTolerance Boolean

  batch    Batch      @relation(fields: [batchId], references: [id], onDelete: Cascade)
  step     RecipeStep @relation(fields: [stepId], references: [id])
  material Material   @relation(fields: [materialId], references: [id])
}
```

### Relationship Diagram

```
┌──────────────┐
│     User     │
│  (ADMIN/OP)  │
└──────┬───────┘
       │ 1:N
       ↓
┌──────────────┐
│    Batch     │──────────┐
│ (execution)  │          │
└──────┬───────┘          │
       │ N:1              │ 1:N
       ↓                  ↓
┌──────────────┐    ┌─────────────┐
│    Recipe    │    │  BatchLog   │
│  (template)  │    │ (history)   │
└──────┬───────┘    └──────┬──────┘
       │ 1:N               │ N:1
       ↓                   ↓
┌──────────────┐    ┌─────────────┐
│ RecipeStep   │────│  Material   │
│  (step cfg)  │ N:1│ (ingredient)│
└──────────────┘    └─────────────┘
```

**Key Foreign Keys:**
- `batches.userId` → `users.id`
- `batches.recipeId` → `recipes.id`
- `recipe_steps.recipeId` → `recipes.id`
- `recipe_steps.materialId` → `materials.id`
- `recipe_steps.equipmentId` → `materials.id` (nullable)
- `batch_logs.batchId` → `batches.id`
- `batch_logs.stepId` → `recipe_steps.id`
- `batch_logs.materialId` → `materials.id`

---

## Flow 1: User Management

### Overview
User management is the foundation of the system. The first admin is auto-created on server startup. Only admins can create/manage other users.

### Initial Admin Creation (Server Startup)

**Location:** `server/src/index.ts` (server startup)

```typescript
// Auto-create admin on first run
const existingAdmin = await prisma.user.findFirst({
  where: { role: 'ADMIN' }
});

if (!existingAdmin) {
  const hashedPassword = await bcrypt.hash('admin123', 10);
  await prisma.user.create({
    data: {
      username: 'admin',
      password: hashedPassword,
      role: 'ADMIN'
    }
  });
  console.log('✓ Default admin created: username=admin, password=admin123');
}
```

**Default Credentials:**
- Username: `admin`
- Password: `admin123`

**Important:** This admin CANNOT be deleted (enforced in backend).

### User Creation Flow (Admin Only)

#### Step 1: Admin Login
1. Navigate to `/login`
2. Enter credentials (username: `admin`, password: `admin123`)
3. Frontend calls: `POST /api/auth/login`

**Request:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Backend Flow (`server/src/modules/auth/auth.controller.ts`):**
```typescript
// 1. Find user by username
const user = await prisma.user.findUnique({
  where: { username }
});

if (!user) {
  return res.status(401).json({ message: 'Invalid credentials' });
}

// 2. Compare password with bcrypt
const isValidPassword = await bcrypt.compare(password, user.password);

if (!isValidPassword) {
  return res.status(401).json({ message: 'Invalid credentials' });
}

// 3. Generate JWT token
const token = jwt.sign(
  { id: user.id, username: user.username, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: '8h' }
);

// 4. Return token + user data
res.json({
  token,
  user: {
    id: user.id,
    username: user.username,
    role: user.role
  }
});
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "ADMIN"
  }
}
```

**Frontend stores in:**
- `localStorage.setItem('token', token)`
- Redux state: `authSlice`

#### Step 2: Create New User
1. Admin navigates to `/users` (AdminRoute protected)
2. Clicks "Add User" button
3. Fills form:
   - Username
   - Password
   - Role (ADMIN or OPERATOR)
4. Frontend calls: `POST /api/auth/register`

**Request:**
```json
{
  "username": "operator1",
  "password": "op123456",
  "role": "OPERATOR"
}
```

**Backend Flow:**
```typescript
// server/src/modules/auth/auth.service.ts

// 1. Check if username already exists
const existing = await prisma.user.findUnique({
  where: { username }
});

if (existing) {
  throw new Error('Username already exists');
}

// 2. Hash password with bcrypt
const hashedPassword = await bcrypt.hash(password, 10);

// 3. Create user in database
const user = await prisma.user.create({
  data: {
    username,
    password: hashedPassword,
    role
  }
});

return user;
```

**SQL Equivalent:**
```sql
-- Check uniqueness
SELECT * FROM users WHERE username = 'operator1';

-- Insert new user
INSERT INTO users (username, password, role, createdAt)
VALUES ('operator1', '$2b$10$...hashedPassword...', 'OPERATOR', NOW());
```

**Response:**
```json
{
  "id": 2,
  "username": "operator1",
  "role": "OPERATOR",
  "createdAt": "2025-11-28T10:00:00.000Z"
}
```

#### Step 3: View All Users
**Frontend calls:** `GET /api/users`

**Backend:**
```typescript
const users = await prisma.user.findMany({
  select: {
    id: true,
    username: true,
    role: true,
    createdAt: true,
    _count: {
      select: { batches: true }  // Count batches created by user
    }
  },
  orderBy: { createdAt: 'desc' }
});
```

**SQL Equivalent:**
```sql
SELECT
  u.id,
  u.username,
  u.role,
  u.createdAt,
  COUNT(b.id) as batch_count
FROM users u
LEFT JOIN batches b ON u.id = b.userId
GROUP BY u.id
ORDER BY u.createdAt DESC;
```

**Response:**
```json
[
  {
    "id": 1,
    "username": "admin",
    "role": "ADMIN",
    "createdAt": "2025-11-01T08:00:00.000Z",
    "_count": { "batches": 0 }
  },
  {
    "id": 2,
    "username": "operator1",
    "role": "OPERATOR",
    "createdAt": "2025-11-28T10:00:00.000Z",
    "_count": { "batches": 15 }
  }
]
```

#### Step 4: Delete User (Admin Only)
**Frontend calls:** `DELETE /api/users/:id`

**Backend Validation:**
```typescript
// 1. Cannot delete yourself
if (userIdToDelete === req.user.id) {
  throw new Error('Cannot delete yourself');
}

// 2. Cannot delete default admin
const user = await prisma.user.findUnique({ where: { id: userIdToDelete } });
if (user.username === 'admin' && user.role === 'ADMIN') {
  throw new Error('Cannot delete default admin');
}

// 3. Check if user has batches
const batchCount = await prisma.batch.count({
  where: { userId: userIdToDelete }
});

if (batchCount > 0) {
  throw new Error(`Cannot delete user with ${batchCount} existing batches`);
}

// 4. Delete user
await prisma.user.delete({ where: { id: userIdToDelete } });
```

### Authentication Middleware Flow

Every protected route uses JWT authentication:

```typescript
// server/src/middleware/auth.ts
export const authenticateToken = (req, res, next) => {
  // 1. Extract token from Authorization header
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN"

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  // 2. Verify JWT
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }

    // 3. Attach user to request
    req.user = decoded;  // { id, username, role }
    next();
  });
};

// Role-based middleware
export const requireRole = (roles: Role[]) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    next();
  };
};
```

**Usage in routes:**
```typescript
// Only admins can access
router.post('/users', authenticateToken, requireRole(['ADMIN']), createUser);

// Both admins and operators can access
router.get('/batches', authenticateToken, requireRole(['ADMIN', 'OPERATOR']), getBatches);
```

### Frontend Route Protection

```typescript
// client/src/App.tsx
const AdminRoute = ({ children }) => {
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  return <Layout>{children}</Layout>;
};

// Usage
<Route path="/users" element={
  <AdminRoute>
    <UserManagement />
  </AdminRoute>
} />
```

### Database State After User Creation

**`users` table:**
```
+----+------------+----------------------------------+----------+---------------------+
| id | username   | password                         | role     | createdAt           |
+----+------------+----------------------------------+----------+---------------------+
| 1  | admin      | $2b$10$hash1...                   | ADMIN    | 2025-11-01 08:00:00 |
| 2  | operator1  | $2b$10$hash2...                   | OPERATOR | 2025-11-28 10:00:00 |
| 3  | operator2  | $2b$10$hash3...                   | OPERATOR | 2025-11-28 11:00:00 |
+----+------------+----------------------------------+----------+---------------------+
```

---

## Flow 2: Material Management

### Overview
Materials are the foundation for recipes. A material can be an INGREDIENT (flour, sugar) or EQUIPMENT (mixer, oven). Only admins can create/manage materials.

### Material Creation Flow

#### Step 1: Admin Creates Material
1. Admin navigates to `/materials` (AdminRoute)
2. Clicks "Add Material"
3. Fills form:
   - **Code:** Unique identifier (e.g., `FL001`)
   - **Name:** Display name (e.g., `Wheat Flour`)
   - **Type:** INGREDIENT or EQUIPMENT
   - **Unit:** Measurement unit (e.g., `KG`, `Liters`, `Unit`)
4. Frontend calls: `POST /api/materials`

**Request:**
```json
{
  "code": "FL001",
  "name": "Wheat Flour",
  "type": "INGREDIENT",
  "unit": "KG"
}
```

**Backend Flow (`server/src/modules/materials/materials.service.ts`):**
```typescript
// 1. Validate unique code
const existing = await prisma.material.findUnique({
  where: { code }
});

if (existing) {
  throw new Error('Material code already exists');
}

// 2. Create material
const material = await prisma.material.create({
  data: {
    code,
    name,
    type,
    unit
  }
});

return material;
```

**SQL Equivalent:**
```sql
-- Check uniqueness
SELECT * FROM materials WHERE code = 'FL001';

-- Insert material
INSERT INTO materials (code, name, type, unit, createdAt)
VALUES ('FL001', 'Wheat Flour', 'INGREDIENT', 'KG', NOW());
```

**Response:**
```json
{
  "id": 1,
  "code": "FL001",
  "name": "Wheat Flour",
  "type": "INGREDIENT",
  "unit": "KG",
  "createdAt": "2025-11-28T10:00:00.000Z"
}
```

#### Step 2: View All Materials
**Frontend calls:** `GET /api/materials`

**Backend:**
```typescript
const materials = await prisma.material.findMany({
  include: {
    _count: {
      select: {
        recipeSteps: true  // Count how many recipes use this material
      }
    }
  },
  orderBy: { createdAt: 'desc' }
});
```

**SQL Equivalent:**
```sql
SELECT
  m.*,
  COUNT(DISTINCT rs.id) as recipe_usage_count
FROM materials m
LEFT JOIN recipe_steps rs ON m.id = rs.materialId OR m.id = rs.equipmentId
GROUP BY m.id
ORDER BY m.createdAt DESC;
```

**Response:**
```json
[
  {
    "id": 1,
    "code": "FL001",
    "name": "Wheat Flour",
    "type": "INGREDIENT",
    "unit": "KG",
    "createdAt": "2025-11-28T10:00:00.000Z",
    "_count": { "recipeSteps": 5 }
  },
  {
    "id": 2,
    "code": "SG001",
    "name": "White Sugar",
    "type": "INGREDIENT",
    "unit": "KG",
    "_count": { "recipeSteps": 3 }
  },
  {
    "id": 3,
    "code": "MX01",
    "name": "Industrial Mixer Type-A",
    "type": "EQUIPMENT",
    "unit": "Unit",
    "_count": { "recipeSteps": 10 }
  }
]
```

#### Step 3: Update Material
**Frontend calls:** `PUT /api/materials/:id`

**Request:**
```json
{
  "name": "Premium Wheat Flour",
  "unit": "KG"
}
```

**Note:** Code and Type cannot be changed once created (enforced in backend).

#### Step 4: Delete Material
**Frontend calls:** `DELETE /api/materials/:id`

**Backend Validation:**
```typescript
// Check if material is used in any recipes
const usageCount = await prisma.recipeStep.count({
  where: {
    OR: [
      { materialId: materialId },
      { equipmentId: materialId }
    ]
  }
});

if (usageCount > 0) {
  throw new Error(`Cannot delete material used in ${usageCount} recipe steps`);
}

// Safe to delete
await prisma.material.delete({
  where: { id: materialId }
});
```

### Database State After Material Creation

**`materials` table:**
```
+----+-------+---------------------------+------------+------+---------------------+
| id | code  | name                      | type       | unit | createdAt           |
+----+-------+---------------------------+------------+------+---------------------+
| 1  | FL001 | Wheat Flour               | INGREDIENT | KG   | 2025-11-28 10:00:00 |
| 2  | SG001 | White Sugar               | INGREDIENT | KG   | 2025-11-28 10:05:00 |
| 3  | YS001 | Active Dry Yeast          | INGREDIENT | KG   | 2025-11-28 10:10:00 |
| 4  | MX01  | Industrial Mixer Type-A   | EQUIPMENT  | Unit | 2025-11-28 10:15:00 |
| 5  | OV01  | Convection Oven 500L      | EQUIPMENT  | Unit | 2025-11-28 10:20:00 |
+----+-------+---------------------------+------------+------+---------------------+
```

---

## Flow 3: Recipe Creation

### Overview
Recipes define the step-by-step process for creating a product. Each recipe consists of multiple steps, and each step specifies:
- Which material to use
- Which equipment to use (optional)
- Target weight (setpoint)
- Acceptable deviation (tolerance %)

### Recipe Creation Flow

#### Step 1: Admin Creates Recipe
1. Admin navigates to `/recipes`
2. Clicks "Create Recipe"
3. Fills basic info:
   - **Code:** Unique identifier (e.g., `RCP001`)
   - **Name:** Recipe name (e.g., `Bread Mix Type-A`)
   - **Description:** Optional description

#### Step 2: Add Recipe Steps
For each step, admin specifies:
- **Material:** Dropdown populated from `materials` where `type = 'INGREDIENT'`
- **Equipment:** Dropdown populated from `materials` where `type = 'EQUIPMENT'`
- **Setpoint:** Target weight (e.g., `50.00` KG)
- **Tolerance:** Acceptable % deviation (e.g., `5.0` means ±5%)

**Frontend State (before submission):**
```typescript
const [recipe, setRecipe] = useState({
  code: 'RCP001',
  name: 'Bread Mix Type-A',
  description: 'Standard bread mixture for production line 1',
  steps: [
    {
      materialId: 1,    // FL001 - Wheat Flour
      equipmentId: 4,   // MX01 - Mixer
      setpoint: 50.00,
      tolerance: 5.0
    },
    {
      materialId: 2,    // SG001 - Sugar
      equipmentId: 4,   // MX01 - Mixer
      setpoint: 10.00,
      tolerance: 5.0
    },
    {
      materialId: 3,    // YS001 - Yeast
      equipmentId: 4,   // MX01 - Mixer
      setpoint: 2.50,
      tolerance: 10.0   // Higher tolerance for small amounts
    }
  ]
});
```

#### Step 3: Submit Recipe
**Frontend calls:** `POST /api/recipes`

**Request:**
```json
{
  "code": "RCP001",
  "name": "Bread Mix Type-A",
  "description": "Standard bread mixture for production line 1",
  "steps": [
    {
      "materialId": 1,
      "equipmentId": 4,
      "setpoint": 50.00,
      "tolerance": 5.0
    },
    {
      "materialId": 2,
      "equipmentId": 4,
      "setpoint": 10.00,
      "tolerance": 5.0
    },
    {
      "materialId": 3,
      "equipmentId": 4,
      "setpoint": 2.50,
      "tolerance": 10.0
    }
  ]
}
```

**Backend Flow (Atomic Transaction):**
```typescript
// server/src/modules/recipes/recipes.service.ts

const recipe = await prisma.$transaction(async (tx) => {
  // 1. Create recipe
  const newRecipe = await tx.recipe.create({
    data: {
      code,
      name,
      description
    }
  });

  // 2. Create all steps (with auto-incrementing stepNumber)
  await tx.recipeStep.createMany({
    data: steps.map((step, index) => ({
      recipeId: newRecipe.id,
      stepNumber: index + 1,  // Auto-number: 1, 2, 3...
      materialId: step.materialId,
      equipmentId: step.equipmentId,
      setpoint: step.setpoint,
      tolerance: step.tolerance
    }))
  });

  // 3. Return complete recipe with steps
  return await tx.recipe.findUnique({
    where: { id: newRecipe.id },
    include: {
      steps: {
        include: {
          material: true,
          equipment: true
        },
        orderBy: { stepNumber: 'asc' }
      }
    }
  });
});
```

**SQL Equivalent:**
```sql
-- Transaction START

-- Insert recipe
INSERT INTO recipes (code, name, description, createdAt)
VALUES ('RCP001', 'Bread Mix Type-A', 'Standard bread mixture...', NOW());
-- Returns id = 1

-- Insert steps
INSERT INTO recipe_steps (recipeId, stepNumber, materialId, equipmentId, setpoint, tolerance)
VALUES
  (1, 1, 1, 4, 50.00, 5.0),   -- Step 1: Flour
  (1, 2, 2, 4, 10.00, 5.0),   -- Step 2: Sugar
  (1, 3, 3, 4, 2.50, 10.0);   -- Step 3: Yeast

-- If ANY step fails, ROLLBACK entire transaction
COMMIT;
```

**Response:**
```json
{
  "id": 1,
  "code": "RCP001",
  "name": "Bread Mix Type-A",
  "description": "Standard bread mixture for production line 1",
  "createdAt": "2025-11-28T11:00:00.000Z",
  "deletedAt": null,
  "steps": [
    {
      "id": 1,
      "stepNumber": 1,
      "materialId": 1,
      "equipmentId": 4,
      "setpoint": "50.00",
      "tolerance": "5.00",
      "material": {
        "id": 1,
        "code": "FL001",
        "name": "Wheat Flour",
        "type": "INGREDIENT",
        "unit": "KG"
      },
      "equipment": {
        "id": 4,
        "code": "MX01",
        "name": "Industrial Mixer Type-A",
        "type": "EQUIPMENT",
        "unit": "Unit"
      }
    },
    {
      "id": 2,
      "stepNumber": 2,
      "materialId": 2,
      "equipmentId": 4,
      "setpoint": "10.00",
      "tolerance": "5.00",
      "material": { /* Sugar details */ },
      "equipment": { /* Mixer details */ }
    },
    {
      "id": 3,
      "stepNumber": 3,
      "materialId": 3,
      "equipmentId": 4,
      "setpoint": "2.50",
      "tolerance": "10.00",
      "material": { /* Yeast details */ },
      "equipment": { /* Mixer details */ }
    }
  ]
}
```

#### Step 4: View All Recipes
**Frontend calls:** `GET /api/recipes`

**Backend:**
```typescript
const recipes = await prisma.recipe.findMany({
  where: { deletedAt: null },  // Only active recipes (soft delete)
  include: {
    steps: {
      include: {
        material: true,
        equipment: true
      },
      orderBy: { stepNumber: 'asc' }
    },
    _count: {
      select: { batches: true }  // Count how many batches used this recipe
    }
  },
  orderBy: { createdAt: 'desc' }
});
```

**SQL Equivalent:**
```sql
SELECT
  r.*,
  COUNT(DISTINCT b.id) as batch_count,
  rs.*,
  m.name as material_name,
  e.name as equipment_name
FROM recipes r
LEFT JOIN batches b ON r.id = b.recipeId
LEFT JOIN recipe_steps rs ON r.id = rs.recipeId
LEFT JOIN materials m ON rs.materialId = m.id
LEFT JOIN materials e ON rs.equipmentId = e.id
WHERE r.deletedAt IS NULL
GROUP BY r.id, rs.id
ORDER BY r.createdAt DESC, rs.stepNumber ASC;
```

#### Step 5: Update Recipe (Replace All Steps)
**Frontend calls:** `PUT /api/recipes/:id`

**Request:**
```json
{
  "name": "Premium Bread Mix Type-A",
  "description": "Updated description",
  "steps": [
    { "materialId": 1, "equipmentId": 4, "setpoint": 55.00, "tolerance": 3.0 },
    { "materialId": 2, "equipmentId": 4, "setpoint": 12.00, "tolerance": 3.0 }
    // Step 3 removed, setpoints changed
  ]
}
```

**Backend Flow (Atomic Transaction):**
```typescript
await prisma.$transaction(async (tx) => {
  // 1. Update recipe metadata
  await tx.recipe.update({
    where: { id: recipeId },
    data: { name, description }
  });

  // 2. DELETE all existing steps
  await tx.recipeStep.deleteMany({
    where: { recipeId }
  });

  // 3. CREATE new steps
  await tx.recipeStep.createMany({
    data: steps.map((step, index) => ({
      recipeId,
      stepNumber: index + 1,
      materialId: step.materialId,
      equipmentId: step.equipmentId,
      setpoint: step.setpoint,
      tolerance: step.tolerance
    }))
  });
});
```

**Why Delete + Create?** Easier than trying to match old steps with new steps. Transaction ensures atomicity.

#### Step 6: Soft Delete Recipe
**Frontend calls:** `DELETE /api/recipes/:id`

**Backend:**
```typescript
// Soft delete - set deletedAt timestamp
await prisma.recipe.update({
  where: { id: recipeId },
  data: { deletedAt: new Date() }
});
```

**Why Soft Delete?** Historical batches still reference this recipe. Hard delete would break foreign keys.

### Database State After Recipe Creation

**`recipes` table:**
```
+----+---------+----------------------+--------------------------------+---------------------+-----------+
| id | code    | name                 | description                    | createdAt           | deletedAt |
+----+---------+----------------------+--------------------------------+---------------------+-----------+
| 1  | RCP001  | Bread Mix Type-A     | Standard bread mixture...      | 2025-11-28 11:00:00 | NULL      |
| 2  | RCP002  | Cake Mix Type-B      | Chocolate cake mixture         | 2025-11-28 12:00:00 | NULL      |
+----+---------+----------------------+--------------------------------+---------------------+-----------+
```

**`recipe_steps` table:**
```
+----+----------+------------+------------+-------------+----------+-----------+
| id | recipeId | stepNumber | materialId | equipmentId | setpoint | tolerance |
+----+----------+------------+------------+-------------+----------+-----------+
| 1  | 1        | 1          | 1 (Flour)  | 4 (Mixer)   | 50.00    | 5.00      |
| 2  | 1        | 2          | 2 (Sugar)  | 4 (Mixer)   | 10.00    | 5.00      |
| 3  | 1        | 3          | 3 (Yeast)  | 4 (Mixer)   | 2.50     | 10.00     |
| 4  | 2        | 1          | 1 (Flour)  | 4 (Mixer)   | 40.00    | 5.00      |
| 5  | 2        | 2          | 2 (Sugar)  | 4 (Mixer)   | 20.00    | 5.00      |
+----+----------+------------+------------+-------------+----------+-----------+
```

---

## Flow 4A: Batch Execution - Process Batch (Production Flow)

### Overview
**Process Batch** is the **primary production flow** where operators create finished products and generate QR-coded labels for tracking. This flow uses:
- **Node-RED WebSocket:** Real-time weight data every second
- **ZPL Printer API:** Label printing for each step with QR codes
- **Database Logging:** Historical record with generated QR codes

**Final Status:** `PROCESSED` (ready for use in Run Batch flow)

---

## Flow 4B: Batch Execution - Run Batch (Verification Flow)

### Overview
**Run Batch** is the **verification/consumption flow** where operators use materials from processed batches by scanning their QR codes. This flow uses:
- **Web Serial API Load Cell:** Direct USB/Serial connection for weight measurement
- **Camera QR Scanner:** Validates QR codes from processed batch labels
- **Database Logging:** Historical record with scanned QR codes

**Final Status:** `COMPLETED` or `ABORTED`

---

## Comparison: Process Batch vs Run Batch

| Feature | Process Batch | Run Batch |
|---------|--------------|-----------|
| **Purpose** | Create finished products | Verify and consume products |
| **Weight Source** | Node-RED WebSocket (`ws://localhost:1880/ws/weight`) | Web Serial API (USB/Serial direct) |
| **QR Code Action** | **Generate** QR codes | **Scan/Validate** QR codes |
| **Printer** | ZPL Printer API (HTTP POST to `localhost:9100`) | None |
| **QR Scanner** | None | Camera-based scanner |
| **API Endpoints** | `/api/batches/process/*` | `/api/batches/*` |
| **Final Status** | `PROCESSED` | `COMPLETED` or `ABORTED` |
| **Database Field** | `batch_logs.generatedQrCode` | `batch_logs.scannedQrCode` |
| **Connection** | Auto-connect on mount | Manual connect via button |
| **UI Location** | `/process-batch` | `/batch` (RunBatch) |
| **Typical User** | Production operators | Quality control / Secondary operators |

---

## Flow 4A Details: Process Batch (Complete Flow)

### Complete Batch Execution Flow

#### Step 1: Operator Login
1. Operator navigates to `/login`
2. Enters credentials (e.g., username: `operator1`, password: `op123456`)
3. Frontend calls: `POST /api/auth/login`
4. Receives JWT token
5. Redirected to `/dashboard`

#### Step 2: Navigate to Process Batch
1. Operator clicks "Process Batch" menu item
2. Frontend navigates to `/process-batch`
3. **ProcessBatch component mounts**

#### Step 3: Auto-Connect to Node-RED WebSocket
**Location:** `client/src/hooks/useWebSocket.ts`

```typescript
// Automatically runs on component mount
useEffect(() => {
  console.log('🔌 Auto-connecting to Node-RED WebSocket...');
  connect();

  return () => {
    console.log('🔌 Cleaning up WebSocket connection...');
    disconnect();
  };
}, [wsUrl]);

const connect = useCallback(() => {
  // Prevent duplicate connections
  if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
    console.log('⚠️ WebSocket already connected');
    return true;
  }

  const ws = new WebSocket('ws://localhost:1880/ws/weight');
  wsRef.current = ws;

  ws.onopen = () => {
    console.log('✓ WebSocket connected successfully');
    setIsConnected(true);
  };

  ws.onmessage = handleMessage;

  ws.onclose = () => {
    console.log('🔌 WebSocket closed, reconnecting in 3s...');
    setTimeout(() => connect(), 3000);
  };
}, [wsUrl]);
```

**Node-RED sends data every second:**
```json
{"weight": "42.67", "timestamp": "2025-11-28T10:30:45.123Z"}
```

#### Step 4: Select Recipe
1. Operator sees dropdown of available recipes
2. **Frontend fetches recipes:** `GET /api/recipes`

**Backend returns:**
```json
[
  {
    "id": 1,
    "code": "RCP001",
    "name": "Bread Mix Type-A",
    "steps": [
      {
        "id": 1,
        "stepNumber": 1,
        "materialId": 1,
        "material": { "code": "FL001", "name": "Wheat Flour" },
        "equipment": { "code": "MX01", "name": "Industrial Mixer Type-A" },
        "setpoint": "50.00",
        "tolerance": "5.00"
      },
      // ... more steps
    ]
  }
]
```

3. Operator selects "Bread Mix Type-A" from dropdown

#### Step 5: Start Batch
1. Operator clicks **"Start Batch"** button
2. **Frontend calls:** `POST /api/batches/process/start`

**Request:**
```json
{
  "recipeId": 1
}
```

**Backend Flow:**
```typescript
// server/src/modules/batches/batches.service.ts

// 1. Generate unique batch number
const batchNumber = `BATCH-${Date.now()}`;

// 2. Create batch in database
const batch = await prisma.batch.create({
  data: {
    batchNumber,
    recipeId,
    userId: req.user.id,  // From JWT token
    status: 'IN_PROGRESS',
    startTime: new Date()
  },
  include: {
    recipe: {
      include: {
        steps: {
          include: {
            material: true,
            equipment: true
          },
          orderBy: { stepNumber: 'asc' }
        }
      }
    },
    user: {
      select: { id: true, username: true }
    }
  }
});

return batch;
```

**SQL Equivalent:**
```sql
-- Insert batch
INSERT INTO batches (batchNumber, recipeId, userId, status, startTime)
VALUES ('BATCH-1732789845123', 1, 2, 'IN_PROGRESS', NOW());
-- Returns id = 101

-- Fetch complete batch data with joins
SELECT
  b.*,
  r.code as recipe_code,
  r.name as recipe_name,
  u.username,
  rs.id as step_id,
  rs.stepNumber,
  rs.setpoint,
  rs.tolerance,
  m.code as material_code,
  m.name as material_name,
  e.code as equipment_code,
  e.name as equipment_name
FROM batches b
JOIN recipes r ON b.recipeId = r.id
JOIN users u ON b.userId = u.id
JOIN recipe_steps rs ON r.id = rs.recipeId
JOIN materials m ON rs.materialId = m.id
LEFT JOIN materials e ON rs.equipmentId = e.id
WHERE b.id = 101
ORDER BY rs.stepNumber ASC;
```

**Response:**
```json
{
  "id": 101,
  "batchNumber": "BATCH-1732789845123",
  "recipeId": 1,
  "userId": 2,
  "status": "IN_PROGRESS",
  "startTime": "2025-11-28T10:30:00.000Z",
  "endTime": null,
  "recipe": {
    "id": 1,
    "code": "RCP001",
    "name": "Bread Mix Type-A",
    "steps": [
      {
        "id": 1,
        "stepNumber": 1,
        "materialId": 1,
        "equipmentId": 4,
        "setpoint": "50.00",
        "tolerance": "5.00",
        "material": {
          "id": 1,
          "code": "FL001",
          "name": "Wheat Flour",
          "type": "INGREDIENT",
          "unit": "KG"
        },
        "equipment": {
          "id": 4,
          "code": "MX01",
          "name": "Industrial Mixer Type-A"
        }
      },
      // ... 2 more steps
    ]
  },
  "user": {
    "id": 2,
    "username": "operator1"
  }
}
```

#### Step 6: Display All Steps + Real-Time Weight
**Frontend renders all steps at once:**

```typescript
// client/src/pages/ProcessBatch.tsx

const { currentWeight, isStable, isConnected } = useWebSocket();

return (
  <div>
    {/* Header: Batch Info */}
    <div>
      <h2>Batch: {batch.batchNumber}</h2>
      <p>Recipe: {batch.recipe.name}</p>
      <p>Operator: {batch.user.username}</p>
    </div>

    {/* Real-Time Weight Display */}
    <div className="weight-display">
      <p>Current Weight</p>
      <h1 className={isStable ? 'text-green-500' : 'text-gray-500'}>
        {currentWeight ? `${currentWeight.toFixed(2)} KG` : '--'}
      </h1>
      {isStable && <span>📊 Stable</span>}
      {!isConnected && <span className="text-red-500">⚠️ Not Connected</span>}
    </div>

    {/* All Steps Displayed */}
    {batch.recipe.steps.map((step, index) => (
      <div
        key={step.id}
        className={currentStepIndex === index ? 'bg-blue-100 border-blue-500' : 'bg-gray-50'}
      >
        <h3>Step {step.stepNumber}</h3>
        <p><strong>Material:</strong> {step.material.name} ({step.material.code})</p>
        <p><strong>Equipment:</strong> {step.equipment?.name || 'None'}</p>
        <p><strong>Target:</strong> {step.setpoint} KG</p>
        <p><strong>Tolerance:</strong> ±{step.tolerance}%</p>

        {/* Tolerance Range Calculation */}
        <p><strong>Acceptable Range:</strong>
          {(Number(step.setpoint) * (1 - Number(step.tolerance)/100)).toFixed(2)} -
          {(Number(step.setpoint) * (1 + Number(step.tolerance)/100)).toFixed(2)} KG
        </p>

        {/* Current weight indicator for current step */}
        {currentStepIndex === index && (
          <div className={isWithinTolerance(currentWeight, step) ? 'text-green-600' : 'text-red-600'}>
            Current: {currentWeight?.toFixed(2) || '--'} KG
            {isWithinTolerance(currentWeight, step) ? ' ✓ Within Range' : ' ⚠️ Outside Range'}
          </div>
        )}
      </div>
    ))}

    {/* NEXT Button */}
    <button
      onClick={handleNextStep}
      disabled={!currentWeight || currentStepIndex >= batch.recipe.steps.length}
      className="btn-primary"
    >
      NEXT STEP
    </button>
  </div>
);
```

**Tolerance Calculation:**
```typescript
const isWithinTolerance = (actualWeight: number, step: RecipeStep): boolean => {
  const setpoint = Number(step.setpoint);
  const tolerance = Number(step.tolerance);

  const toleranceRange = setpoint * (tolerance / 100);
  const minWeight = setpoint - toleranceRange;
  const maxWeight = setpoint + toleranceRange;

  return actualWeight >= minWeight && actualWeight <= maxWeight;
};

// Example: setpoint=50, tolerance=5%
// toleranceRange = 50 * 0.05 = 2.5
// minWeight = 50 - 2.5 = 47.5 KG
// maxWeight = 50 + 2.5 = 52.5 KG
// actualWeight=50.25 → 47.5 <= 50.25 <= 52.5 → TRUE ✓
```

#### Step 7: Real-Time Weight Updates
**WebSocket continuously receives data:**

```typescript
// useWebSocket.ts line 122-149
const handleMessage = useCallback((event: MessageEvent) => {
  const messageStr = event.data;
  // Node-RED sends: {"weight":"50.25","timestamp":"2025-11-28T10:35:12.123Z"}

  const { weight, stable } = parseWeightData(messageStr);

  if (weight !== null) {
    // Update local state
    setCurrentWeight(weight);  // 50.25
    checkStability(weight);

    // Update Redux store (for global access)
    dispatch(updateLoadCellData({
      weight: weight,
      isStable: stable || stabilityCountRef.current >= 3,
      timestamp: Date.now()
    }));
  }
}, [parseWeightData, checkStability, dispatch]);
```

**Stability Detection:**
```typescript
const checkStability = useCallback((weight: number) => {
  const STABILITY_THRESHOLD = 0.1;  // 0.1 KG difference
  const STABILITY_REQUIRED_READINGS = 3;

  if (previousWeightRef.current !== null) {
    const diff = Math.abs(weight - previousWeightRef.current);

    if (diff <= STABILITY_THRESHOLD) {
      stabilityCountRef.current++;

      if (stabilityCountRef.current >= STABILITY_REQUIRED_READINGS) {
        setIsStable(true);  // ✓ Stable after 3 consistent readings
      }
    } else {
      stabilityCountRef.current = 0;
      setIsStable(false);
    }
  }

  previousWeightRef.current = weight;
}, []);

// Example:
// Reading 1: 50.20 KG → diff = N/A, count = 0
// Reading 2: 50.22 KG → diff = 0.02 (≤ 0.1), count = 1
// Reading 3: 50.21 KG → diff = 0.01 (≤ 0.1), count = 2
// Reading 4: 50.23 KG → diff = 0.02 (≤ 0.1), count = 3 → STABLE ✓
// Reading 5: 50.50 KG → diff = 0.27 (> 0.1), count = 0 → UNSTABLE
```

**UI updates in real-time:**
- Weight display shows `50.25 KG`
- If stable: Shows green + "📊 Stable"
- If within tolerance: Shows "✓ Within Range" in green
- If outside tolerance: Shows "⚠️ Outside Range" in red

#### Step 8: Operator Clicks NEXT
When operator is satisfied with the weight, clicks **NEXT** button.

**Frontend Flow:**
```typescript
// ProcessBatch.tsx line 132-230
const handleNextStep = async () => {
  const currentStep = batch.recipe.steps[currentStepIndex];

  // 1. Generate QR code data
  const qrData = `Saumya|${currentStep.stepNumber}|${currentStep.material.code}|${currentStep.material.name}|${currentWeight}`;
  // Example: "Saumya|1|FL001|Wheat Flour|50.25"

  // 2. Display QR code on screen (temporary)
  setShowQrCode(true);
  setQrCodeData(qrData);

  try {
    // 3. **PRINT LABEL FIRST** (via ZPL Printer API)
    await printLabel({
      materialName: currentStep.material.name,
      weight: currentWeight,
      qrData: qrData
    });

    console.log('✓ Label printed successfully');

    // 4. **THEN Save to database**
    await batchesApi.logProcessStep(batch.id, {
      stepId: currentStep.id,
      materialId: currentStep.materialId,
      actualWeight: currentWeight,
      setpointSnapshot: Number(currentStep.setpoint),
      toleranceSnapshot: Number(currentStep.tolerance),
      isWithinTolerance: isWithinTolerance(currentWeight, currentStep)
    });

    console.log('✓ Step logged to database');

    // 5. Move to next step
    setCurrentStepIndex(currentStepIndex + 1);

    // 6. Clear QR code after 2 seconds
    setTimeout(() => {
      setShowQrCode(false);
      setQrCodeData(null);
    }, 2000);

    // 7. Check if all steps completed
    if (currentStepIndex + 1 >= batch.recipe.steps.length) {
      // Navigate to batch summary
      navigate('/batch-summary', { state: { batchId: batch.id } });
    }

  } catch (error) {
    console.error('❌ Error in step execution:', error);
    alert('Failed to complete step. Please try again.');
  }
};
```

**ZPL Printer API Call:**
```typescript
// client/src/services/zplPrinter.ts

export const printLabel = async ({ materialName, weight, qrData }: PrintLabelParams) => {
  // 1. Generate QR code as base64 image
  const qrCodeBase64 = await QRCode.toDataURL(qrData, {
    width: 200,
    margin: 2
  });

  // 2. Generate ZPL code
  const zplCode = `
^XA
^MMT
^PW886
^LL591

^FT50,50^A0N,40,40^FDMaterial: ${materialName}^FS
^FT50,120^A0N,35,35^FDWeight: ${weight.toFixed(2)} KG^FS

^FT50,200^BQN,2,8
^FDQA,${qrData}^FS

^XZ
  `.trim();

  // 3. Send to ZPL printer service
  const response = await axios.post('http://localhost:9100/', zplCode, {
    headers: { 'Content-Type': 'text/plain' }
  });

  return response.data;
};
```

**Backend Receives Log Request:**
```typescript
// POST /api/batches/process/:id/log-step
// Request body:
{
  "stepId": 1,
  "materialId": 1,
  "actualWeight": 50.25,
  "setpointSnapshot": 50.00,
  "toleranceSnapshot": 5.00,
  "isWithinTolerance": true
}
```

**Backend Saves to Database:**
```typescript
// server/src/modules/batches/batches.service.ts

const log = await prisma.batchLog.create({
  data: {
    batchId,
    stepId,
    materialId,
    actualWeight,
    setpointSnapshot,      // ← Snapshot preserves original recipe values
    toleranceSnapshot,     // ← Even if recipe is modified later
    timestamp: new Date(),
    isWithinTolerance
  },
  include: {
    step: {
      include: { material: true }
    }
  }
});

return log;
```

**SQL Equivalent:**
```sql
INSERT INTO batch_logs (
  batchId, stepId, materialId, actualWeight,
  setpointSnapshot, toleranceSnapshot, timestamp, isWithinTolerance
)
VALUES (
  101,       -- Batch ID
  1,         -- Step ID (Step 1: Flour)
  1,         -- Material ID (Wheat Flour)
  50.25,     -- Actual measured weight
  50.00,     -- Snapshot of original setpoint
  5.00,      -- Snapshot of original tolerance
  NOW(),
  true       -- Within tolerance: 47.5 <= 50.25 <= 52.5
);
```

**Database State After Step 1:**

**`batches` table:**
```
+-----+------------------------+----------+--------+-------------+---------------------+---------+
| id  | batchNumber            | recipeId | userId | status      | startTime           | endTime |
+-----+------------------------+----------+--------+-------------+---------------------+---------+
| 101 | BATCH-1732789845123    | 1        | 2      | IN_PROGRESS | 2025-11-28 10:30:00 | NULL    |
+-----+------------------------+----------+--------+-------------+---------------------+---------+
```

**`batch_logs` table:**
```
+----+---------+--------+------------+--------------+-------------------+-------------------+---------------------+-------------------+
| id | batchId | stepId | materialId | actualWeight | setpointSnapshot  | toleranceSnapshot | timestamp           | isWithinTolerance |
+----+---------+--------+------------+--------------+-------------------+-------------------+---------------------+-------------------+
| 1  | 101     | 1      | 1          | 50.25        | 50.00             | 5.00              | 2025-11-28 10:35:12 | true              |
+----+---------+--------+------------+--------------+-------------------+-------------------+---------------------+-------------------+
```

#### Step 9: Repeat for All Steps
Operator repeats steps 7-8 for:
- **Step 2:** Sugar (10.00 KG target)
- **Step 3:** Yeast (2.50 KG target)

**After all steps, `batch_logs` table:**
```
+----+---------+--------+------------+--------------+-------------------+-------------------+---------------------+-------------------+
| id | batchId | stepId | materialId | actualWeight | setpointSnapshot  | toleranceSnapshot | timestamp           | isWithinTolerance |
+----+---------+--------+------------+--------------+-------------------+-------------------+---------------------+-------------------+
| 1  | 101     | 1      | 1 (Flour)  | 50.25        | 50.00             | 5.00              | 2025-11-28 10:35:12 | true              |
| 2  | 101     | 2      | 2 (Sugar)  | 9.87         | 10.00             | 5.00              | 2025-11-28 10:38:45 | true              |
| 3  | 101     | 3      | 3 (Yeast)  | 2.68         | 2.50              | 10.00             | 2025-11-28 10:42:18 | true              |
+----+---------+--------+------------+--------------+-------------------+-------------------+---------------------+-------------------+
```

#### Step 10: Navigate to Batch Summary
After last step, frontend navigates to `/batch-summary` with `batchId`.

**Frontend calls:** `GET /api/batches/:id`

**Backend:**
```typescript
const batch = await prisma.batch.findUnique({
  where: { id: batchId },
  include: {
    recipe: true,
    user: true,
    logs: {
      include: {
        step: {
          include: { material: true, equipment: true }
        }
      },
      orderBy: { timestamp: 'asc' }
    }
  }
});
```

**SQL Equivalent:**
```sql
SELECT
  b.*,
  r.code as recipe_code,
  r.name as recipe_name,
  u.username,
  bl.id as log_id,
  bl.actualWeight,
  bl.setpointSnapshot,
  bl.toleranceSnapshot,
  bl.isWithinTolerance,
  bl.timestamp,
  rs.stepNumber,
  m.name as material_name,
  m.code as material_code
FROM batches b
JOIN recipes r ON b.recipeId = r.id
JOIN users u ON b.userId = u.id
LEFT JOIN batch_logs bl ON b.id = bl.batchId
LEFT JOIN recipe_steps rs ON bl.stepId = rs.id
LEFT JOIN materials m ON bl.materialId = m.id
WHERE b.id = 101
ORDER BY bl.timestamp ASC;
```

**Frontend displays:**
```
Batch Summary
=============
Batch Number: BATCH-1732789845123
Recipe: Bread Mix Type-A
Operator: operator1
Status: IN_PROGRESS
Start Time: 2025-11-28 10:30:00

Step Details:
+------+-------------+--------+----------+-----------+-------------------+--------+
| Step | Material    | Target | Actual   | Tolerance | Range             | Status |
+------+-------------+--------+----------+-----------+-------------------+--------+
| 1    | Wheat Flour | 50.00  | 50.25 KG | ±5%       | 47.50 - 52.50 KG  | ✓ PASS |
| 2    | Sugar       | 10.00  | 9.87 KG  | ±5%       | 9.50 - 10.50 KG   | ✓ PASS |
| 3    | Yeast       | 2.50   | 2.68 KG  | ±10%      | 2.25 - 2.75 KG    | ✓ PASS |
+------+-------------+--------+----------+-----------+-------------------+--------+

Total Weight: 62.80 KG
All steps within tolerance: ✓ YES

[Complete Batch] [Abort Batch]
```

#### Step 11: Complete Batch
Operator clicks **"Complete Batch"** button.

**Frontend calls:** `POST /api/batches/:id/complete`

**Backend:**
```typescript
const batch = await prisma.batch.update({
  where: { id: batchId },
  data: {
    status: 'PROCESSED',
    endTime: new Date()
  },
  include: {
    recipe: true,
    user: true,
    logs: true
  }
});

return batch;
```

**SQL Equivalent:**
```sql
UPDATE batches
SET status = 'PROCESSED', endTime = NOW()
WHERE id = 101;
```

**Final `batches` table:**
```
+-----+------------------------+----------+--------+-----------+---------------------+---------------------+
| id  | batchNumber            | recipeId | userId | status    | startTime           | endTime             |
+-----+------------------------+----------+--------+-----------+---------------------+---------------------+
| 101 | BATCH-1732789845123    | 1        | 2      | PROCESSED | 2025-11-28 10:30:00 | 2025-11-28 10:45:00 |
+-----+------------------------+----------+--------+-----------+---------------------+---------------------+
```

**Final `batch_logs` table (Process Batch):**
```
+----+---------+--------+------------+--------------+-------------------+-------------------+---------------------+-------------------+-----------------+
| id | batchId | stepId | materialId | actualWeight | setpointSnapshot  | toleranceSnapshot | timestamp           | generatedQrCode   | scannedQrCode   |
+----+---------+--------+------------+--------------+-------------------+-------------------+---------------------+-------------------+-----------------+
| 1  | 101     | 1      | 1 (Flour)  | 50.25        | 50.00             | 5.00              | 2025-11-28 10:35:12 | Saumya|1|FL001... | NULL            |
| 2  | 101     | 2      | 2 (Sugar)  | 9.87         | 10.00             | 5.00              | 2025-11-28 10:38:45 | Saumya|2|SG001... | NULL            |
| 3  | 101     | 3      | 3 (Yeast)  | 2.68         | 2.50              | 10.00             | 2025-11-28 10:42:18 | Saumya|3|YS001... | NULL            |
+----+---------+--------+------------+--------------+-------------------+-------------------+---------------------+-------------------+-----------------+
```

**Key Points:**
- Process Batch generates QR codes and stores them in `generatedQrCode` column
- These QR codes are printed on labels via ZPL printer
- Status changes from `IN_PROGRESS` → `PROCESSED`
- No QR scanning involved - only generation

---

## Flow 4B Details: Run Batch (Complete Flow)

### Overview of Run Batch Flow
Run Batch is used when operators need to **verify and use materials from processed batches**. The key difference is that instead of generating QR codes, operators **scan existing QR codes** from labels created in Process Batch.

### Complete Run Batch Execution Flow

#### Step 1: Operator Login
Same as Process Batch - operator logs in and receives JWT token.

#### Step 2: Navigate to Run Batch
1. Operator clicks "Run Batch" menu item
2. Frontend navigates to `/batch`
3. **RunBatch component mounts**

#### Step 3: Select Recipe
1. Operator sees dropdown of available recipes
2. **Frontend fetches recipes:** `GET /api/recipes`
3. Operator selects a recipe (e.g., "Bread Mix Type-A")

#### Step 4: Connect Load Cell (Manual)
**Unlike Process Batch (auto-connect), Run Batch requires manual connection:**

```typescript
// RunBatch.tsx line 258-280
<div className="border-t pt-4">
  <h3 className="font-semibold mb-3">Load Cell Connection</h3>
  {!isConnected ? (
    <div>
      <p className="text-sm text-gray-600 mb-3">
        Connect to your load cell via USB/Serial to enable real-time weight monitoring.
      </p>
      <button onClick={connect} className="btn-primary">
        Connect Load Cell
      </button>
    </div>
  ) : (
    <div className="bg-success-50 border border-success-200 rounded-lg p-4">
      <p className="text-success-700 font-semibold">✓ Load cell connected</p>
      <p className="text-sm text-success-600 mt-1">
        Current weight: {currentWeight?.toFixed(2) || '0.00'}g
        {isStable && <span className="ml-2">(Stable)</span>}
      </p>
      <button onClick={tare} className="btn-secondary mt-2 text-sm">
        Tare/Zero
      </button>
    </div>
  )}
</div>
```

**Web Serial API Connection:**
```typescript
// useLoadCell.ts (Web Serial API)
const connect = async () => {
  try {
    // Request serial port from browser
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });

    // Read data from serial port
    const reader = port.readable.getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      // Parse weight data
      const text = new TextDecoder().decode(value);
      const weight = parseFloat(text);

      setCurrentWeight(weight);
      dispatch(updateLoadCellData({ weight, timestamp: Date.now() }));
    }
  } catch (error) {
    console.error('Failed to connect to load cell:', error);
  }
};
```

#### Step 5: Start Batch
1. Operator clicks **"Start Batch"** button
2. **Frontend calls:** `POST /api/batches/start`

**Request:**
```json
{
  "recipeId": 1
}
```

**Backend creates batch:**
```typescript
// server/src/modules/batches/batches.service.ts

// Check if operator already has an active batch
const existingActive = await prisma.batch.findFirst({
  where: {
    operatorUserId: operatorId,
    status: 'IN_PROGRESS'
  }
});

if (existingActive) {
  throw new Error('You already have an active batch. Complete or abort it first.');
}

const batch = await prisma.batch.create({
  data: {
    recipeId,
    operatorUserId: operatorId,
    status: 'IN_PROGRESS',
    startTime: new Date()
  },
  include: {
    recipe: {
      include: {
        steps: {
          include: {
            material: true,
            equipment: true
          },
          orderBy: { stepOrder: 'asc' }
        }
      }
    }
  }
});
```

#### Step 6: Execute Steps with QR Scanning

**Critical Difference:** Run Batch requires scanning a **valid QR code from a processed batch** before logging each step.

**UI Flow:**
```typescript
// RunBatch.tsx line 363-404
<div>
  <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-3 mb-2">
    <p className="text-sm text-yellow-800 font-semibold">⚠ QR Code Required</p>
    <p className="text-xs text-yellow-700 mt-1">
      You must scan a QR code from a processed batch before logging this step.
    </p>
  </div>

  {!isQrValid ? (
    <>
      <button
        onClick={() => setShowQrScanner(!showQrScanner)}
        className={`w-full mb-2 ${showQrScanner ? 'btn-danger' : 'btn-primary'}`}
      >
        {showQrScanner ? 'Close QR Scanner' : '📱 Scan QR Code (Required)'}
      </button>

      {showQrScanner && (
        <div className="border-2 border-gray-300 rounded-lg overflow-hidden">
          <video ref={videoRef} className="w-full" autoPlay playsInline muted />
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}
    </>
  ) : (
    <div className="bg-green-50 border-2 border-green-200 rounded-lg p-3 mb-2">
      <p className="text-sm text-green-800 font-semibold">✓ QR Code Validated</p>
      <p className="text-xs text-green-700 mt-1">
        Valid QR code from processed batch detected.
      </p>
    </div>
  )}
</div>
```

**QR Code Validation Flow:**
```typescript
// RunBatch.tsx line 122-151
const handleQrCodeScanned = async (code: string) => {
  const currentStep = currentRecipe.steps[currentStepIndex];

  try {
    // Validate QR code from processed batch
    const response = await qrApi.validateProcessed({
      qrCode: code,
      expectedStepId: currentStep.id,
    });

    if (response.data.success) {
      setQrValidationMessage('✓ QR Code from processed batch validated successfully');
      setIsQrValid(true);
      setValidatedQrCode(code);
      setShowQrScanner(false);
    } else {
      setQrValidationMessage(`✗ ${response.data.message}`);
      setIsQrValid(false);
    }
  } catch (error: any) {
    setQrValidationMessage(`✗ ${error.response?.data?.message || 'QR validation failed'}`);
    setIsQrValid(false);
  }
};
```

**Backend QR Validation:**
```typescript
// server/src/modules/qr/qr.service.ts

async validateProcessed(qrCode: string, expectedStepId: number) {
  // Parse QR code format: "Saumya|stepNumber|materialCode|materialName|weight"
  const parts = qrCode.split('|');
  if (parts.length !== 5 || parts[0] !== 'Saumya') {
    throw new Error('Invalid QR code format');
  }

  const [, stepNumberStr, materialCode, materialName, weightStr] = parts;

  // Find in batch_logs where this QR was generated
  const log = await prisma.batchLog.findFirst({
    where: {
      generatedQrCode: qrCode,
      batch: {
        status: 'PROCESSED'  // Only from processed batches
      }
    },
    include: {
      batch: true,
      step: {
        include: { material: true }
      }
    }
  });

  if (!log) {
    throw new Error('QR code not found or not from a processed batch');
  }

  // Verify expected step matches
  if (log.stepId !== expectedStepId) {
    throw new Error('QR code is for a different step');
  }

  return {
    valid: true,
    batchId: log.batchId,
    stepId: log.stepId,
    materialCode: log.step.material.code,
    actualWeight: log.actualWeight
  };
}
```

**SQL Query:**
```sql
SELECT
  bl.*,
  b.status,
  rs.stepOrder,
  m.code as material_code,
  m.name as material_name
FROM batch_logs bl
JOIN batches b ON bl.batchId = b.id
JOIN recipe_steps rs ON bl.stepId = rs.id
JOIN materials m ON bl.materialId = m.id
WHERE bl.generatedQrCode = 'Saumya|1|FL001|Wheat Flour|50.25'
  AND b.status = 'PROCESSED';
```

#### Step 7: Log Step (After QR Validation)
Once QR is validated and weight is stable:

```typescript
// RunBatch.tsx line 153-196
const handleLogStep = async () => {
  const currentStep = currentRecipe.steps[currentStepIndex];

  if (loadCellData.weight === null) {
    alert('No weight data available');
    return;
  }

  if (!isQrValid || !validatedQrCode) {
    alert('Please scan a valid QR code from a processed batch before logging this step');
    return;
  }

  try {
    // Log step with scanned QR code
    await batchesApi.logStep(activeBatch.id, {
      stepId: currentStep.id,
      materialId: currentStep.materialId,
      actualWeight: loadCellData.weight,
      setpointSnapshot: currentStep.setpoint,
      toleranceSnapshot: currentStep.tolerancePercent,
      scannedQrCode: validatedQrCode,  // ← Store scanned QR
    });

    // Move to next step or complete
    if (currentStepIndex < currentRecipe.steps.length - 1) {
      dispatch(nextStep());
      resetQr();
      setIsQrValid(false);
      setValidatedQrCode('');
      await tare(); // Auto-tare for next step
    } else {
      // All steps done
      if (confirm('All steps completed! Do you want to complete this batch?')) {
        await handleCompleteBatch();
      }
    }
  } catch (error: any) {
    alert(error.message || 'Failed to log step');
  }
};
```

**Backend saves with scanned QR:**
```typescript
// server/src/modules/batches/batches.service.ts

const log = await prisma.batchLog.create({
  data: {
    batchId,
    stepId,
    materialId,
    actualWeight,
    setpointSnapshot,
    toleranceSnapshot,
    scannedQrCode,      // ← Stores the QR that was scanned
    generatedQrCode: null,  // ← NULL for Run Batch
    timestamp: new Date()
  }
});
```

**SQL Equivalent:**
```sql
INSERT INTO batch_logs (
  batchId, stepId, materialId, actualWeight,
  setpointSnapshot, toleranceSnapshot, scannedQrCode, generatedQrCode, timestamp
)
VALUES (
  202,                                -- New Run Batch ID
  1,                                  -- Step ID
  1,                                  -- Material ID
  50.30,                              -- Measured weight
  50.00,                              -- Snapshot
  5.00,                               -- Snapshot
  'Saumya|1|FL001|Wheat Flour|50.25', -- Scanned from Process Batch 101
  NULL,                               -- No generation in Run Batch
  NOW()
);
```

#### Step 8: Complete or Abort Batch
```typescript
// RunBatch.tsx line 198-223
const handleCompleteBatch = async () => {
  if (!activeBatch) return;

  try {
    await batchesApi.end(activeBatch.id, { status: 'COMPLETED' });
    dispatch(endBatch());
    disconnect();
    alert('Batch completed successfully!');
  } catch (error: any) {
    alert(error.message || 'Failed to complete batch');
  }
};

const handleAbortBatch = async () => {
  if (!activeBatch) return;
  if (!confirm('Are you sure you want to abort this batch?')) return;

  try {
    await batchesApi.end(activeBatch.id, { status: 'ABORTED' });
    dispatch(endBatch());
    disconnect();
    alert('Batch aborted');
  } catch (error: any) {
    alert(error.message || 'Failed to abort batch');
  }
};
```

**Backend:**
```typescript
// server/src/modules/batches/batches.service.ts

async endBatch(batchId: number, data: { status: 'COMPLETED' | 'ABORTED' }) {
  const batch = await prisma.batch.findUnique({
    where: { id: batchId }
  });

  if (!batch) {
    throw new Error('Batch not found');
  }

  if (batch.status !== 'IN_PROGRESS') {
    throw new Error('Can only end batches that are in progress');
  }

  // If completing, verify all steps are logged
  if (data.status === 'COMPLETED') {
    const recipe = await prisma.recipe.findUnique({
      where: { id: batch.recipeId },
      include: { steps: true }
    });

    const logCount = await prisma.batchLog.count({
      where: { batchId }
    });

    if (logCount < recipe.steps.length) {
      throw new Error(`Cannot complete batch: only ${logCount} of ${recipe.steps.length} steps logged`);
    }
  }

  return await prisma.batch.update({
    where: { id: batchId },
    data: {
      status: data.status,
      endTime: new Date()
    }
  });
}
```

### Database State After Run Batch

**`batches` table:**
```
+-----+------------------------+----------+--------+-----------+---------------------+---------------------+
| id  | batchNumber            | recipeId | userId | status    | startTime           | endTime             |
+-----+------------------------+----------+--------+-----------+---------------------+---------------------+
| 101 | BATCH-1732789845123    | 1        | 2      | PROCESSED | 2025-11-28 10:30:00 | 2025-11-28 10:45:00 |
| 202 | BATCH-1732798123456    | 1        | 3      | COMPLETED | 2025-11-28 14:00:00 | 2025-11-28 14:15:00 |
+-----+------------------------+----------+--------+-----------+---------------------+---------------------+
```

**`batch_logs` table (showing both flows):**
```
+----+---------+--------+------------+--------------+-------------------+-------------------+---------------------+--------------------------+-----------------+
| id | batchId | stepId | materialId | actualWeight | setpointSnapshot  | toleranceSnapshot | timestamp           | generatedQrCode          | scannedQrCode   |
+----+---------+--------+------------+--------------+-------------------+-------------------+---------------------+--------------------------+-----------------+
| 1  | 101     | 1      | 1          | 50.25        | 50.00             | 5.00              | 2025-11-28 10:35:12 | Saumya|1|FL001|...|50.25 | NULL            |
| 2  | 101     | 2      | 2          | 9.87         | 10.00             | 5.00              | 2025-11-28 10:38:45 | Saumya|2|SG001|...|9.87  | NULL            |
| 3  | 101     | 3      | 3          | 2.68         | 2.50              | 10.00             | 2025-11-28 10:42:18 | Saumya|3|YS001|...|2.68  | NULL            |
| 4  | 202     | 1      | 1          | 50.30        | 50.00             | 5.00              | 2025-11-28 14:05:22 | NULL                     | Saumya|1|FL001|...|50.25 |
| 5  | 202     | 2      | 2          | 9.95         | 10.00             | 5.00              | 2025-11-28 14:09:15 | NULL                     | Saumya|2|SG001|...|9.87  |
| 6  | 202     | 3      | 3          | 2.55         | 2.50              | 10.00             | 2025-11-28 14:12:48 | NULL                     | Saumya|3|YS001|...|2.68  |
+----+---------+--------+------------+--------------+-------------------+-------------------+---------------------+--------------------------+-----------------+
```

**Analysis:**
- **Batch 101 (Process Batch):**   - `generatedQrCode` filled with QR data  - `scannedQrCode` is NULL
  - Status: `PROCESSED`
  - Created physical labels with QR codes

- **Batch 202 (Run Batch):**
  - `scannedQrCode` filled with QR from Batch 101
  - `generatedQrCode` is NULL
  - Status: `COMPLETED`
  - Validated materials from Batch 101

**Key Insight:** Run Batch verifies that materials used come from valid processed batches, creating full traceability.

### Traceability Chain

```
Process Batch 101 (PROCESSED)
  ├─ Step 1: Generated QR "Saumya|1|FL001|Wheat Flour|50.25"
  ├─ Step 2: Generated QR "Saumya|2|SG001|White Sugar|9.87"
  └─ Step 3: Generated QR "Saumya|3|YS001|Active Yeast|2.68"
           ↓
      (Labels printed with QR codes)
           ↓
Run Batch 202 (COMPLETED)
  ├─ Step 1: Scanned QR "Saumya|1|FL001|Wheat Flour|50.25" (from Batch 101)
  ├─ Step 2: Scanned QR "Saumya|2|SG001|White Sugar|9.87" (from Batch 101)
  └─ Step 3: Scanned QR "Saumya|3|YS001|Active Yeast|2.68" (from Batch 101)
```

**Traceability Query:**
```sql
-- Find which Run Batches used materials from Process Batch 101
SELECT
  rb.id as run_batch_id,
  rb.startTime as run_time,
  rbl.scannedQrCode as used_qr,
  pb.id as source_process_batch,
  pbl.actualWeight as source_weight
FROM batch_logs rbl
JOIN batches rb ON rbl.batchId = rb.id
JOIN batch_logs pbl ON rbl.scannedQrCode = pbl.generatedQrCode
JOIN batches pb ON pbl.batchId = pb.id
WHERE pb.id = 101
  AND rb.status = 'COMPLETED';
```

---

## Flow 5: Reports Generation

### Overview
Reports allow admins and operators to analyze batch execution history. Reports can be generated as:
- **Excel:** Color-coded cells (green = within tolerance, red = outside)
- **PDF:** Printable format for archival

### Report Generation Flow

#### Step 1: Navigate to Reports
1. User navigates to `/reports`
2. Frontend displays filters:
   - **Date Range:** Start Date - End Date
   - **Recipe Filter:** Dropdown of all recipes
   - **Status Filter:** ALL, PROCESSED, ABORTED

#### Step 2: Fetch Batch Data
**Frontend calls:** `GET /api/reports/batches?startDate=2025-11-01&endDate=2025-11-30&recipeId=1&status=PROCESSED`

**Backend:**
```typescript
// server/src/modules/reports/reports.service.ts

const batches = await prisma.batch.findMany({
  where: {
    startTime: {
      gte: new Date(startDate),
      lte: new Date(endDate)
    },
    ...(recipeId && { recipeId: parseInt(recipeId) }),
    ...(status && { status: status as BatchStatus })
  },
  include: {
    recipe: true,
    user: {
      select: { username: true }
    },
    logs: {
      include: {
        step: {
          include: {
            material: true,
            equipment: true
          }
        }
      },
      orderBy: { timestamp: 'asc' }
    }
  },
  orderBy: { startTime: 'desc' }
});
```

**SQL Equivalent:**
```sql
SELECT
  b.id,
  b.batchNumber,
  b.status,
  b.startTime,
  b.endTime,
  r.code as recipe_code,
  r.name as recipe_name,
  u.username,
  bl.id as log_id,
  bl.actualWeight,
  bl.setpointSnapshot,
  bl.toleranceSnapshot,
  bl.isWithinTolerance,
  bl.timestamp,
  rs.stepNumber,
  m.name as material_name,
  m.code as material_code,
  m.unit as material_unit
FROM batches b
JOIN recipes r ON b.recipeId = r.id
JOIN users u ON b.userId = u.id
LEFT JOIN batch_logs bl ON b.id = bl.batchId
LEFT JOIN recipe_steps rs ON bl.stepId = rs.id
LEFT JOIN materials m ON bl.materialId = m.id
WHERE b.startTime >= '2025-11-01 00:00:00'
  AND b.startTime <= '2025-11-30 23:59:59'
  AND b.recipeId = 1
  AND b.status = 'PROCESSED'
ORDER BY b.startTime DESC, bl.timestamp ASC;
```

#### Step 3: Generate Excel Report
**Frontend calls:** `GET /api/reports/excel?startDate=...&endDate=...`

**Backend Flow:**
```typescript
// server/src/modules/reports/reports.service.ts

import ExcelJS from 'exceljs';

const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet('Batch Report');

// Define columns
sheet.columns = [
  { header: 'Batch Number', key: 'batchNumber', width: 20 },
  { header: 'Recipe', key: 'recipe', width: 25 },
  { header: 'Step', key: 'step', width: 8 },
  { header: 'Material', key: 'material', width: 20 },
  { header: 'Target (KG)', key: 'target', width: 12 },
  { header: 'Actual (KG)', key: 'actual', width: 12 },
  { header: 'Tolerance (%)', key: 'tolerance', width: 12 },
  { header: 'Status', key: 'status', width: 12 },
  { header: 'Timestamp', key: 'timestamp', width: 20 },
  { header: 'Operator', key: 'operator', width: 15 }
];

// Style header row
sheet.getRow(1).font = { bold: true };
sheet.getRow(1).fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF4472C4' }
};
sheet.getRow(1).font = { color: { argb: 'FFFFFFFF' } };

// Add data rows
batches.forEach(batch => {
  batch.logs.forEach(log => {
    const row = sheet.addRow({
      batchNumber: batch.batchNumber,
      recipe: batch.recipe.name,
      step: log.step.stepNumber,
      material: log.step.material.name,
      target: Number(log.setpointSnapshot),
      actual: Number(log.actualWeight),
      tolerance: Number(log.toleranceSnapshot),
      status: log.isWithinTolerance ? 'PASS' : 'FAIL',
      timestamp: log.timestamp.toLocaleString(),
      operator: batch.user.username
    });

    // Color code status column
    const statusCell = row.getCell('status');
    if (log.isWithinTolerance) {
      statusCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF92D050' }  // Green
      };
      statusCell.font = { color: { argb: 'FF006100' } };
    } else {
      statusCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFF0000' }  // Red
      };
      statusCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
    }
  });
});

// Generate buffer and return
const buffer = await workbook.xlsx.writeBuffer();

res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
res.setHeader('Content-Disposition', `attachment; filename=batch-report-${Date.now()}.xlsx`);
res.send(buffer);
```

**Example Excel Output:**
```
+-------------------+-----------------+------+-------------+--------+--------+-----------+--------+---------------------+-----------+
| Batch Number      | Recipe          | Step | Material    | Target | Actual | Tolerance | Status | Timestamp           | Operator  |
+-------------------+-----------------+------+-------------+--------+--------+-----------+--------+---------------------+-----------+
| BATCH-17327898451 | Bread Mix       | 1    | Wheat Flour | 50.00  | 50.25  | 5.00      | PASS   | 11/28/2025 10:35:12 | operator1 |
| BATCH-17327898451 | Bread Mix       | 2    | Sugar       | 10.00  | 9.87   | 5.00      | PASS   | 11/28/2025 10:38:45 | operator1 |
| BATCH-17327898451 | Bread Mix       | 3    | Yeast       | 2.50   | 2.68   | 10.00     | PASS   | 11/28/2025 10:42:18 | operator1 |
| BATCH-17327912345 | Cake Mix        | 1    | Flour       | 40.00  | 42.50  | 5.00      | FAIL   | 11/28/2025 14:10:22 | operator2 |
+-------------------+-----------------+------+-------------+--------+--------+-----------+--------+---------------------+-----------+
```
**Colors:**
- Green cells: PASS (within tolerance)
- Red cells: FAIL (outside tolerance)

#### Step 4: Generate PDF Report
**Frontend calls:** `GET /api/reports/pdf?startDate=...&endDate=...`

**Backend Flow:**
```typescript
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const doc = new jsPDF();

// Add title
doc.setFontSize(18);
doc.text('Batch Execution Report', 14, 20);

doc.setFontSize(11);
doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
doc.text(`Date Range: ${startDate} to ${endDate}`, 14, 36);

// Build table data
const tableData = [];
batches.forEach(batch => {
  batch.logs.forEach(log => {
    tableData.push([
      batch.batchNumber,
      batch.recipe.name,
      log.step.stepNumber,
      log.step.material.name,
      Number(log.setpointSnapshot).toFixed(2),
      Number(log.actualWeight).toFixed(2),
      log.isWithinTolerance ? 'PASS' : 'FAIL',
      batch.user.username
    ]);
  });
});

// Generate table
autoTable(doc, {
  head: [['Batch', 'Recipe', 'Step', 'Material', 'Target', 'Actual', 'Status', 'Operator']],
  body: tableData,
  startY: 45,
  styles: { fontSize: 9 },
  headStyles: { fillColor: [68, 114, 196] },
  didParseCell: (data) => {
    // Color code status column
    if (data.column.index === 6 && data.section === 'body') {
      if (data.cell.raw === 'PASS') {
        data.cell.styles.textColor = [0, 97, 0];
        data.cell.styles.fillColor = [146, 208, 80];
      } else {
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.fillColor = [255, 0, 0];
        data.cell.styles.fontStyle = 'bold';
      }
    }
  }
});

// Generate buffer
const buffer = doc.output('arraybuffer');

res.setHeader('Content-Type', 'application/pdf');
res.setHeader('Content-Disposition', `attachment; filename=batch-report-${Date.now()}.pdf`);
res.send(Buffer.from(buffer));
```

#### Step 5: Dashboard Statistics
**Frontend calls:** `GET /api/dashboard/stats`

**Backend:**
```typescript
// server/src/modules/dashboard/dashboard.service.ts

const stats = await prisma.$transaction(async (tx) => {
  // Total batches
  const totalBatches = await tx.batch.count();

  // Batches by status
  const batchesByStatus = await tx.batch.groupBy({
    by: ['status'],
    _count: { id: true }
  });

  // Recent batches (last 10)
  const recentBatches = await tx.batch.findMany({
    take: 10,
    orderBy: { startTime: 'desc' },
    include: {
      recipe: { select: { name: true } },
      user: { select: { username: true } }
    }
  });

  // Average batch duration
  const completedBatches = await tx.batch.findMany({
    where: { status: 'PROCESSED', endTime: { not: null } },
    select: { startTime: true, endTime: true }
  });

  const avgDuration = completedBatches.reduce((acc, batch) => {
    const duration = batch.endTime.getTime() - batch.startTime.getTime();
    return acc + duration;
  }, 0) / completedBatches.length;

  // Steps within/outside tolerance
  const toleranceStats = await tx.batchLog.groupBy({
    by: ['isWithinTolerance'],
    _count: { id: true }
  });

  return {
    totalBatches,
    batchesByStatus,
    recentBatches,
    avgDurationMinutes: avgDuration / 60000,
    toleranceStats
  };
});

return stats;
```

**SQL Equivalent:**
```sql
-- Total batches
SELECT COUNT(*) as total FROM batches;

-- Batches by status
SELECT status, COUNT(*) as count
FROM batches
GROUP BY status;

-- Recent batches
SELECT b.batchNumber, b.startTime, r.name as recipe, u.username
FROM batches b
JOIN recipes r ON b.recipeId = r.id
JOIN users u ON b.userId = u.id
ORDER BY b.startTime DESC
LIMIT 10;

-- Average duration
SELECT AVG(TIMESTAMPDIFF(MINUTE, startTime, endTime)) as avg_duration_minutes
FROM batches
WHERE status = 'PROCESSED' AND endTime IS NOT NULL;

-- Tolerance statistics
SELECT isWithinTolerance, COUNT(*) as count
FROM batch_logs
GROUP BY isWithinTolerance;
```

**Response:**
```json
{
  "totalBatches": 125,
  "batchesByStatus": [
    { "status": "PROCESSED", "_count": { "id": 100 } },
    { "status": "IN_PROGRESS", "_count": { "id": 5 } },
    { "status": "ABORTED", "_count": { "id": 20 } }
  ],
  "recentBatches": [
    {
      "batchNumber": "BATCH-1732789845123",
      "startTime": "2025-11-28T10:30:00.000Z",
      "recipe": { "name": "Bread Mix Type-A" },
      "user": { "username": "operator1" }
    }
    // ... 9 more
  ],
  "avgDurationMinutes": 15.5,
  "toleranceStats": [
    { "isWithinTolerance": true, "_count": { "id": 350 } },
    { "isWithinTolerance": false, "_count": { "id": 25 } }
  ]
}
```

---

## Critical Design Patterns

### 1. Snapshot Pattern (Historical Accuracy)

**Problem:** If a recipe is modified after batch execution, historical reports would show incorrect targets.

**Solution:** Store snapshots of setpoint and tolerance in `batch_logs`.

**Example:**
```
Timeline:
1. Nov 28, 10:00 - Recipe created: Flour setpoint = 50 KG
2. Nov 28, 10:30 - Batch executed: Actual = 50.25 KG (stored snapshot: 50 KG)
3. Nov 28, 15:00 - Recipe updated: Flour setpoint = 60 KG
4. Dec 1, 09:00 - Report generated

WITHOUT snapshots:
Report shows: Target=60 KG, Actual=50.25 KG → FAIL ❌ (WRONG!)

WITH snapshots:
Report shows: Target=50 KG (snapshot), Actual=50.25 KG → PASS ✓ (CORRECT!)
```

**Implementation:**
```prisma
model BatchLog {
  setpointSnapshot  Decimal  // ← Preserves original setpoint
  toleranceSnapshot Decimal  // ← Preserves original tolerance
}
```

### 2. Soft Delete (Data Integrity)

**Problem:** Hard deleting recipes would break foreign key relationships with historical batches.

**Solution:** Soft delete via `deletedAt` timestamp.

**Example:**
```sql
-- Soft delete (preferred)
UPDATE recipes SET deletedAt = NOW() WHERE id = 1;

-- Recipe still exists in database, but filtered out
SELECT * FROM recipes WHERE deletedAt IS NULL;

-- Historical batches still valid
SELECT * FROM batches WHERE recipeId = 1;  -- ✓ Works!
```

### 3. Transaction Pattern (Atomicity)

**Problem:** Multi-step operations can fail halfway, leaving database inconsistent.

**Solution:** Wrap in Prisma transactions - all or nothing.

**Example:**
```typescript
// Recipe update: Delete old steps + Create new steps
await prisma.$transaction(async (tx) => {
  await tx.recipeStep.deleteMany({ where: { recipeId } });
  await tx.recipeStep.createMany({ data: newSteps });
});

// If createMany fails, deleteMany is rolled back automatically
```

### 4. Eager Loading (Performance)

**Problem:** Multiple database queries slow down response time.

**Solution:** Use Prisma `include` to fetch related data in one query.

**Example:**
```typescript
// ❌ BAD: Multiple queries (N+1 problem)
const batch = await prisma.batch.findUnique({ where: { id } });
const recipe = await prisma.recipe.findUnique({ where: { id: batch.recipeId } });
const logs = await prisma.batchLog.findMany({ where: { batchId: batch.id } });

// ✓ GOOD: Single query with joins
const batch = await prisma.batch.findUnique({
  where: { id },
  include: {
    recipe: {
      include: { steps: { include: { material: true } } }
    },
    logs: { include: { step: true } }
  }
});
```

### 5. Middleware Chain (Authentication & Authorization)

**Flow:**
```
Request → CORS → JSON Parser → JWT Auth → Role Check → Validation → Controller → Response
```

**Example:**
```typescript
// Admin-only endpoint
router.post(
  '/materials',
  authenticateToken,          // ← Verify JWT
  requireRole(['ADMIN']),     // ← Check role
  validateMaterial,           // ← Validate request body
  createMaterial              // ← Execute logic
);

// If ANY middleware fails, request is rejected
```

---

## Data Flow Diagrams

### Complete User Journey

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SYSTEM INITIALIZATION                        │
├─────────────────────────────────────────────────────────────────────┤
│  Server Startup → Auto-create admin (username: admin, pwd: admin123)│
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      FLOW 1: USER MANAGEMENT                         │
├─────────────────────────────────────────────────────────────────────┤
│  1. Admin login → JWT token generated                               │
│  2. Admin creates operators                                         │
│  3. Operators can login                                             │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    FLOW 2: MATERIAL MANAGEMENT                       │
├─────────────────────────────────────────────────────────────────────┤
│  1. Admin creates materials (ingredients + equipment)               │
│  2. Materials stored in database                                    │
│  3. Materials ready for use in recipes                              │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ↓
┌─────────────────────────────────────────────────────────────────────┐
│                     FLOW 3: RECIPE CREATION                          │
├─────────────────────────────────────────────────────────────────────┤
│  1. Admin creates recipe                                            │
│  2. Admin adds steps (each step references materials)               │
│  3. Recipe stored with all steps                                    │
│  4. Recipe ready for batch execution                                │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ↓
┌─────────────────────────────────────────────────────────────────────┐
│                   FLOW 4: BATCH EXECUTION                            │
├─────────────────────────────────────────────────────────────────────┤
│  1. Operator selects recipe                                         │
│  2. System creates batch record (IN_PROGRESS)                       │
│  3. WebSocket connects to Node-RED (weight data every 1s)           │
│  4. For each step:                                                  │
│     a. Display material, target, tolerance                          │
│     b. Show real-time weight from Node-RED                          │
│     c. Operator monitors until satisfied                            │
│     d. Click NEXT → Print ZPL label → Save log to database          │
│  5. After all steps → Navigate to summary                           │
│  6. Complete batch → Status = PROCESSED                             │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    FLOW 5: REPORTS GENERATION                        │
├─────────────────────────────────────────────────────────────────────┤
│  1. User selects date range + filters                               │
│  2. System fetches batches with logs (using snapshots)              │
│  3. Generate Excel/PDF with color coding                            │
│  4. Download report                                                 │
│  5. Dashboard shows statistics (total batches, avg duration, etc.)  │
└─────────────────────────────────────────────────────────────────────┘
```

### Database Relationship Flow

```
User (admin) creates Material
              │
              ↓
User (admin) creates Recipe
              │
              ├──→ Recipe has many RecipeSteps
              │    │
              │    └──→ Each RecipeStep references Material (ingredient + equipment)
              │
              ↓
User (operator) executes Batch
              │
              ├──→ Batch references Recipe
              │
              ├──→ Batch belongs to User
              │
              └──→ Batch has many BatchLogs
                   │
                   ├──→ Each BatchLog references RecipeStep
                   │
                   ├──→ Each BatchLog references Material
                   │
                   └──→ Each BatchLog stores snapshots (setpoint, tolerance)
```

---

## Summary: Complete Data Flow

### 1. Foundation Layer
- Server auto-creates admin
- Admin creates users (operators)
- Admin creates materials (ingredients + equipment)

### 2. Configuration Layer
- Admin creates recipes
- Recipes consist of steps
- Each step references materials and defines targets

### 3. Execution Layer
- Operator starts batch (creates `batches` record)
- WebSocket connects to Node-RED for real-time weight
- For each step:
  - Display targets and real-time weight
  - Print ZPL label
  - Log execution to `batch_logs` with snapshots
- Complete batch (update status to PROCESSED)

### 4. Analysis Layer
- Fetch batches with all logs
- Generate Excel/PDF reports with color coding
- Display dashboard statistics

**Key Insight:** The snapshot pattern ensures historical accuracy even when recipes are modified post-execution. Every piece of data is traceable through foreign key relationships, and transactions ensure database consistency.

---

---

## Visual Comparison: Process Batch vs Run Batch

### Process Batch Flow (Production)
```
┌─────────────────────────────────────────────────────────────────┐
│                    PROCESS BATCH FLOW                           │
│                  (Production/Manufacturing)                     │
└─────────────────────────────────────────────────────────────────┘

Step 1: Select Recipe
   ↓
Step 2: Start Process Batch (API: POST /api/batches/process/start)
   ↓
Step 3: Auto-connect to Node-RED WebSocket
   │     ws://localhost:1880/ws/weight
   │     Receives: {"weight":"50.25","timestamp":"..."}
   ↓
Step 4: For Each Recipe Step:
   │
   ├─→ Display Material Info (name, code, target, tolerance)
   │
   ├─→ Monitor Real-Time Weight from Node-RED
   │     Weight updates every second
   │     Stability detection (3 consistent readings)
   │
   ├─→ Operator Monitors Until Satisfied
   │
   ├─→ Click NEXT Button
   │
   ├─→ Generate QR Code
   │     Format: "Saumya|stepNum|materialCode|materialName|weight"
   │     Example: "Saumya|1|FL001|Wheat Flour|50.25"
   │
   ├─→ Print ZPL Label (FIRST!)
   │     API: POST http://localhost:9100/
   │     Label contains: Material name, Weight, QR code
   │
   └─→ Save to Database (AFTER printing)
         API: POST /api/batches/process/:id/log-step
         Stores: generatedQrCode = "Saumya|1|FL001|..."
                 scannedQrCode = NULL
   ↓
Step 5: After All Steps → Navigate to Batch Summary
   ↓
Step 6: Complete Batch
   │     API: PUT /api/batches/process/:id/complete
   │     Status: IN_PROGRESS → PROCESSED
   ↓
RESULT: Batch with status PROCESSED
        Physical labels with QR codes
        Database logs with generatedQrCode populated
```

### Run Batch Flow (Verification/Consumption)
```
┌─────────────────────────────────────────────────────────────────┐
│                      RUN BATCH FLOW                             │
│                (Verification/Quality Control)                   │
└─────────────────────────────────────────────────────────────────┘

Step 1: Select Recipe
   ↓
Step 2: Manual Connect to Load Cell
   │     Uses Web Serial API (USB/Serial)
   │     User clicks "Connect Load Cell" button
   │     Browser requests serial port access
   ↓
Step 3: Start Batch (API: POST /api/batches/start)
   ↓
Step 4: For Each Recipe Step:
   │
   ├─→ Display Material Info (name, code, target, tolerance)
   │
   ├─→ Monitor Real-Time Weight from Load Cell
   │     Direct serial connection
   │     Weight updates continuously
   │
   ├─→ ⚠️ SCAN QR CODE (REQUIRED!)
   │     Click "Scan QR Code" button
   │     Camera opens for QR scanning
   │     Scans label from PROCESSED batch
   │
   ├─→ Validate QR Code
   │     API: POST /api/qr/validate-processed
   │     Backend checks:
   │       - QR exists in batch_logs.generatedQrCode
   │       - Source batch status is PROCESSED
   │       - Step ID matches current step
   │
   ├─→ If Valid: Show ✓ "QR Code Validated"
   │   If Invalid: Show ✗ Error message, retry scan
   │
   ├─→ Operator Monitors Weight Until Satisfied
   │
   └─→ Click "Log Step" Button (only enabled if QR valid)
         API: POST /api/batches/:id/log-step
         Stores: scannedQrCode = "Saumya|1|FL001|..."
                 generatedQrCode = NULL
   ↓
Step 5: After All Steps → Prompt to Complete
   ↓
Step 6: Complete or Abort Batch
   │     API: PUT /api/batches/:id/end
   │     Status: IN_PROGRESS → COMPLETED or ABORTED
   ↓
RESULT: Batch with status COMPLETED/ABORTED
        Database logs with scannedQrCode populated
        Full traceability to source PROCESSED batch
```

---

## Complete System Data Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                         COMPLETE SYSTEM FLOW                           │
└────────────────────────────────────────────────────────────────────────┘

1. USER MANAGEMENT
   └─→ Admin creates operators → Users stored in database

2. MATERIAL MANAGEMENT
   └─→ Admin creates materials → Materials stored (ingredients + equipment)

3. RECIPE CREATION
   └─→ Admin creates recipes with steps → Recipes reference materials

4A. PROCESS BATCH (Production)
    └─→ Operator executes recipe
        ├─ Node-RED WebSocket provides weight
        ├─ Generates QR codes
        ├─ Prints ZPL labels
        └─ Status: PROCESSED

        Result: Physical labeled products with QR codes

4B. RUN BATCH (Verification)
    └─→ Operator uses products from Process Batch
        ├─ Web Serial API load cell provides weight
        ├─ Scans QR codes from Process Batch labels
        ├─ Validates QR against PROCESSED batches
        └─ Status: COMPLETED

        Result: Verified consumption with traceability

5. REPORTS
   └─→ Excel/PDF reports showing:
       ├─ Process Batches: What was produced + QR codes generated
       ├─ Run Batches: What was consumed + QR codes scanned
       └─ Full traceability chain (which Run Batches used which Process Batches)
```

---

## Key Takeaways

### Database Design
- **Single `batches` table** handles both flows
- **Single `batch_logs` table** with TWO QR fields:
  - `generatedQrCode` → Populated by Process Batch
  - `scannedQrCode` → Populated by Run Batch
- **Status differentiation:**
  - Process Batch: `PROCESSED`
  - Run Batch: `COMPLETED` or `ABORTED`

### API Separation
- **Process Batch APIs:**
  - `POST /api/batches/process/start`
  - `POST /api/batches/process/:id/log-step`
  - `PUT /api/batches/process/:id/complete`

- **Run Batch APIs:**
  - `POST /api/batches/start`
  - `POST /api/batches/:id/log-step`
  - `PUT /api/batches/:id/end`

### Hardware Integration
- **Process Batch:** Modern (WebSocket) → Node-RED → Auto-connect
- **Run Batch:** Traditional (Serial) → Direct USB → Manual connect

### QR Code Flow
- **Process Batch:** Creates QR codes → Stores in `generatedQrCode`
- **Run Batch:** Reads QR codes → Validates → Stores in `scannedQrCode`
- **Traceability:** Run Batch QR scan links back to Process Batch via matching QR codes

### Use Cases
- **Process Batch:** "We're manufacturing 100kg of Bread Mix"
- **Run Batch:** "We're using Bread Mix from Batch 101 to make final product"

---

**End of Documentation**
