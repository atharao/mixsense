# CLAUDE.md

This file provides deep technical guidance for understanding every line of code in the MixSense repository.

## Project Overview

MixSense is a full-stack mixer batch reporting system designed for manufacturing environments. It tracks the execution of recipes (mixing procedures) through batches, integrating real-time hardware (load cells and QR scanners) to ensure compliance and traceability.

**Core Concept**: A `Recipe` defines steps with ingredients, setpoints (target weights), and tolerances. A `Batch` is an execution instance of a recipe by an operator. Each step is validated via QR codes and weighed on load cells. All data is logged for compliance.

## Technology Stack Deep Dive

### Backend Stack
- **Node.js + TypeScript**: Server runtime with type safety
- **Express**: Web framework for building REST APIs
- **Prisma ORM**: Type-safe database access layer with migrations
- **MySQL**: Relational database for structured data
- **JWT (jsonwebtoken)**: Token-based authentication using HS256 algorithm
- **bcrypt**: Password hashing with salt rounds
- **Winston**: Structured logging with multiple transports
- **ExcelJS**: Excel file generation for reports
- **jsPDF + jspdf-autotable**: PDF generation for reports
- **qrcode**: Server-side QR code generation

### Frontend Stack
- **React 18**: Component-based UI library with Concurrent features
- **TypeScript**: Type safety for frontend code
- **Vite**: Fast build tool and dev server
- **Redux Toolkit**: State management with simplified API
- **React Router DOM**: Client-side routing
- **Axios**: HTTP client with interceptors
- **TailwindCSS**: Utility-first CSS framework
- **Recharts**: Chart library for analytics visualization
- **qrcode.react**: QR code rendering component
- **jsQR**: QR code scanning/decoding library
- **Web Serial API**: Browser API for load cell communication
- **xlsx**: Excel file parsing and generation

---

## Backend Architecture - Line by Line

### 1. Server Entry Point (`server/src/server.ts`)

```typescript
import app from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/db';
import { logger } from './utils/logger';
```
**Lines 1-4**: Import the Express app configuration, environment variables, database functions, and logging utility.

```typescript
const startServer = async () => {
```
**Line 6**: Define async function to handle server startup with proper error handling.

```typescript
  await connectDatabase();
```
**Line 9**: Connect to MySQL database using Prisma. This also seeds default admin/operator users if they don't exist.

```typescript
  const server = app.listen(env.PORT, () => {
    logger.info(`Server is running on port ${env.PORT} in ${env.NODE_ENV} mode`);
    logger.info(`CORS enabled for: ${env.CORS_ORIGIN}`);
  });
```
**Lines 12-15**: Start Express server on configured port (default 5000) and log startup information.

```typescript
  const gracefulShutdown = async (signal: string) => {
    logger.info(`${signal} received. Starting graceful shutdown...`);
```
**Lines 18-19**: Define graceful shutdown handler. This ensures the server closes cleanly when terminated.

```typescript
    server.close(async () => {
      logger.info('HTTP server closed');
      await disconnectDatabase();
```
**Lines 21-24**: Close HTTP server and disconnect from database cleanly. This prevents data corruption.

```typescript
      logger.info('Graceful shutdown completed');
      process.exit(0);
    });
```
**Lines 26-28**: Exit process with code 0 (success) after cleanup.

```typescript
    setTimeout(() => {
      logger.error('Forcing shutdown after timeout');
      process.exit(1);
    }, 10000);
```
**Lines 31-34**: Force shutdown after 10 seconds if graceful shutdown hangs. Exit code 1 indicates error.

```typescript
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```
**Lines 39-40**: Listen for termination signals. SIGTERM is sent by process managers, SIGINT is sent by Ctrl+C.

```typescript
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception:', error);
    gracefulShutdown('uncaughtException');
  });
```
**Lines 43-46**: Catch unhandled exceptions (bugs that throw errors). Log and shutdown gracefully.

```typescript
  process.on('unhandledRejection', (reason: any) => {
    logger.error('Unhandled Rejection:', reason);
    gracefulShutdown('unhandledRejection');
  });
```
**Lines 49-52**: Catch unhandled promise rejections (async errors not caught). Log and shutdown.

---

### 2. Environment Configuration (`server/src/config/env.ts`)

```typescript
import dotenv from 'dotenv';
import path from 'path';
```
**Lines 1-2**: Import dotenv to load `.env` file and path for file system operations.

```typescript
dotenv.config({ path: path.join(__dirname, '../../.env') });
```
**Line 5**: Load environment variables from `.env` file located two directories up from compiled code.

```typescript
interface EnvConfig {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  CORS_ORIGIN: string;
  LOG_LEVEL: string;
}
```
**Lines 7-15**: TypeScript interface defining required environment variables. Provides autocomplete and type safety.

```typescript
const getEnvVariable = (key: string, defaultValue?: string): string => {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(`Environment variable ${key} is not defined`);
  }
  return value;
};
```
**Lines 17-23**: Helper function to get environment variables. Throws error if required variable is missing and no default provided. This ensures critical configs aren't forgotten.

```typescript
export const env: EnvConfig = {
  NODE_ENV: getEnvVariable('NODE_ENV', 'development'),
  PORT: parseInt(getEnvVariable('PORT', '5000'), 10),
  DATABASE_URL: getEnvVariable('DATABASE_URL'),
  JWT_SECRET: getEnvVariable('JWT_SECRET'),
  JWT_EXPIRES_IN: getEnvVariable('JWT_EXPIRES_IN', '8h'),
  CORS_ORIGIN: getEnvVariable('CORS_ORIGIN', 'http://localhost:5173'),
  LOG_LEVEL: getEnvVariable('LOG_LEVEL', 'info'),
};
```
**Lines 25-33**: Export configuration object. PORT is parsed to integer. DATABASE_URL and JWT_SECRET have no defaults (required). Others have sensible defaults.

```typescript
export const isDevelopment = env.NODE_ENV === 'development';
export const isProduction = env.NODE_ENV === 'production';
```
**Lines 35-36**: Convenience boolean flags for environment checks throughout the app.

---

### 3. Database Configuration (`server/src/config/db.ts`)

```typescript
export const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
});
```
**Lines 6-21**: Create Prisma client instance with event-based logging. Events are emitted instead of console.log, allowing custom handling.

```typescript
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query' as never, (e: any) => {
    logger.debug('Database Query:', {
      query: e.query,
      params: e.params,
      duration: `${e.duration}ms`,
    });
  });
}
```
**Lines 24-32**: In development mode, log all SQL queries with parameters and duration. Helps debug performance issues. `as never` is a TypeScript workaround for Prisma's event typing.

```typescript
prisma.$on('error' as never, (e: any) => {
  logger.error('Database Error:', e);
});

prisma.$on('warn' as never, (e: any) => {
  logger.warn('Database Warning:', e);
});
```
**Lines 35-42**: Log database errors and warnings. These are always logged regardless of environment.

```typescript
export const seedDefaultUsers = async (): Promise<void> => {
  try {
    const SALT_ROUNDS = 10;
    const defaultUsers = [
      { username: 'admin', password: 'admin', role: 'ADMIN' as const },
      { username: 'operator', password: 'operator', role: 'OPERATOR' as const },
    ];
```
**Lines 45-59**: Define default users to seed on first startup. SALT_ROUNDS = 10 means bcrypt will perform 2^10 (1024) hashing iterations. `as const` ensures TypeScript treats 'ADMIN'/'OPERATOR' as literal types, not just strings.

```typescript
    for (const defaultUser of defaultUsers) {
      const existingUser = await prisma.user.findUnique({
        where: { username: defaultUser.username },
      });

      if (!existingUser) {
        const passwordHash = await bcrypt.hash(defaultUser.password, SALT_ROUNDS);
```
**Lines 61-69**: Check if user already exists. If not, hash the password using bcrypt with 10 salt rounds. bcrypt automatically generates a salt and includes it in the hash.

```typescript
        await prisma.user.create({
          data: {
            username: defaultUser.username,
            passwordHash,
            role: defaultUser.role,
          },
        });
```
**Lines 72-78**: Create user in database using Prisma.

```typescript
        logger.info(`Default user created: ${defaultUser.username} (${defaultUser.role})`);
      } else {
        logger.debug(`Default user already exists: ${defaultUser.username}`);
      }
    }
```
**Lines 80-84**: Log creation or skip. `info` level for creation, `debug` for skip (less important).

---

### 4. JWT Configuration (`server/src/config/jwt.ts`)

```typescript
export interface JwtPayload {
  userId: number;
  username: string;
  role: string;
}
```
**Lines 4-8**: Define JWT payload structure. This data is encoded in the token.

```typescript
export const generateToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as string | number,
    algorithm: 'HS256',
  } as jwt.SignOptions);
};
```
**Lines 10-15**: Generate JWT token. `jwt.sign()` creates a token with:
- `payload`: User data to encode
- `env.JWT_SECRET`: Secret key for signing (must be kept secure)
- `expiresIn`: Token validity duration (default 8h)
- `algorithm`: HS256 (HMAC-SHA256 symmetric signing)

**Security**: Token is signed, not encrypted. Anyone can decode it (base64), but cannot modify it without the secret.

```typescript
export const verifyToken = (token: string): JwtPayload => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ['HS256'],
    }) as JwtPayload;
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};
```
**Lines 17-26**: Verify JWT token. `jwt.verify()` checks:
- Signature is valid (not tampered)
- Token hasn't expired
- Algorithm matches (prevents algorithm confusion attacks)

Throws if invalid or expired.

```typescript
export const decodeToken = (token: string): JwtPayload | null => {
  try {
    const decoded = jwt.decode(token) as JwtPayload;
    return decoded;
  } catch (error) {
    return null;
  }
};
```
**Lines 28-35**: Decode token WITHOUT verification. Used for debugging or reading expired tokens. Never use for authentication.

---

### 5. Authentication Middleware (`server/src/middleware/auth.ts`)

```typescript
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
```
**Lines 6-12**: Extend Express Request type to include `user` property. This allows TypeScript to recognize `req.user` in controllers.

```typescript
export const auth = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
```
**Lines 14-17**: Middleware function. Extract Authorization header from request.

```typescript
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'No token provided',
      });
      return;
    }
```
**Lines 19-25**: Check if Authorization header exists and follows format: `Bearer <token>`. Return 401 Unauthorized if not.

```typescript
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
```
**Line 27**: Extract token by removing first 7 characters ('Bearer '). Example: `Bearer abc123` → `abc123`

```typescript
    const decoded = verifyToken(token);
```
**Line 30**: Verify token signature and expiration. Throws if invalid.

```typescript
    req.user = decoded;
```
**Line 33**: Attach decoded user data to request object. Now available in all subsequent middleware and route handlers.

```typescript
    next();
  } catch (error) {
    logger.error('Auth middleware error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
};
```
**Lines 35-43**: Call next middleware if successful. If error (invalid token), log and return 401.

---

### 6. Role-Based Access Control (`server/src/middleware/roles.ts`)

```typescript
export const requireRole = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
```
**Lines 4-5**: Higher-order function (function returning function). Takes allowed roles as arguments, returns middleware function. Allows: `requireRole('ADMIN', 'OPERATOR')`.

```typescript
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
        return;
      }
```
**Lines 6-13**: Check if user exists on request. Should always exist if auth middleware ran first, but defensive check.

```typescript
      const userRole = req.user.role;

      if (!allowedRoles.includes(userRole)) {
        logger.warn(`Access denied for user ${req.user.username} with role ${userRole}`);
        res.status(403).json({
          success: false,
          message: 'Access denied. Insufficient permissions.',
        });
        return;
      }
```
**Lines 15-24**: Check if user's role is in allowed roles array. Return 403 Forbidden if not. **Important**: 401 = not authenticated, 403 = authenticated but no permission.

```typescript
      next();
```
**Line 26**: User has required role, proceed to route handler.

```typescript
export const requireAdmin = requireRole('ADMIN');
export const requireOperator = requireRole('OPERATOR');
export const requireAuthenticated = requireRole('ADMIN', 'OPERATOR');
```
**Lines 38-44**: Convenience middleware presets. `requireAuthenticated` allows both roles.

---

### 7. Authentication Service (`server/src/modules/auth/auth.service.ts`)

```typescript
const SALT_ROUNDS = 10;
```
**Line 6**: Salt rounds for bcrypt. Each round doubles computation time. 10 rounds ≈ 100ms on modern hardware. Good balance between security and performance.

```typescript
async login(credentials: LoginCredentials): Promise<AuthResponse> {
  const { username, password } = credentials;

  const user = await prisma.user.findUnique({
    where: { username },
  });
```
**Lines 23-29**: Find user by username. `findUnique` returns one record or null. Username has UNIQUE constraint in database.

```typescript
  if (!user) {
    logger.warn(`Login attempt failed: User not found - ${username}`);
    throw new Error('Invalid username or password');
  }
```
**Lines 31-34**: If user doesn't exist, log warning and throw generic error. **Security**: Don't reveal whether username or password is wrong (prevents username enumeration).

```typescript
  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordValid) {
    logger.warn(`Login attempt failed: Invalid password - ${username}`);
    throw new Error('Invalid username or password');
  }
```
**Lines 37-42**: Compare provided password with stored hash. `bcrypt.compare()` hashes the input and compares. Same generic error message.

```typescript
  const token = generateToken({
    userId: user.id,
    username: user.username,
    role: user.role,
  });
```
**Lines 45-49**: Generate JWT token with user data.

```typescript
  logger.info(`User logged in successfully: ${username}`);

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
  };
```
**Lines 51-61**: Log success and return token + user data. **Note**: Don't return password hash.

```typescript
async createUser(
  username: string,
  password: string,
  role: 'ADMIN' | 'OPERATOR'
): Promise<{ id: number; username: string; role: string }> {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      username,
      passwordHash,
      role,
    },
  });
```
**Lines 63-78**: Create new user. Hash password before storing. Never store plaintext passwords.

```typescript
async changePassword(userId: number, oldPassword: string, newPassword: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const isPasswordValid = await bcrypt.compare(oldPassword, user.passwordHash);

  if (!isPasswordValid) {
    throw new Error('Current password is incorrect');
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });
```
**Lines 107-130**: Change password workflow:
1. Verify user exists
2. Verify old password is correct (security)
3. Hash new password
4. Update in database

---

### 8. Batch Service - Critical Business Logic (`server/src/modules/batches/batches.service.ts`)

```typescript
function transformRecipeSteps(steps: (RecipeStep & { material?: Material; equipment?: Material | null })[]) {
  return steps.map(step => ({
    ...step,
    setpoint: Number(step.setpoint),
    tolerancePercent: Number(step.tolerancePercent),
  }));
}
```
**Lines 6-12**: Transform Prisma Decimal types to JavaScript numbers. Prisma returns Decimal objects for precision, but frontend needs numbers. **Important**: Decimal preserves exact precision (no floating point errors), but less convenient for calculations.

```typescript
async startBatch(data: { recipeId: number; operatorId: number; equipmentId?: number }) {
  const recipe = await prisma.recipe.findUnique({
    where: { id: data.recipeId },
    include: {
      steps: true,
    },
  });

  if (!recipe) {
    throw new Error('Recipe not found');
  }

  if (recipe.steps.length === 0) {
    throw new Error('Recipe has no steps');
  }
```
**Lines 170-184**: Validate recipe exists and has steps. `include: { steps: true }` loads related steps (JOIN). Without include, only recipe fields are loaded.

```typescript
  const operator = await prisma.user.findUnique({
    where: { id: data.operatorId },
  });

  if (!operator) {
    throw new Error('Operator not found');
  }
```
**Lines 187-193**: Validate operator user exists. **Security**: Prevents creating batches with non-existent operators.

```typescript
  if (data.equipmentId) {
    const equipment = await prisma.material.findFirst({
      where: {
        id: data.equipmentId,
        type: 'EQUIPMENT',
      },
    });

    if (!equipment) {
      throw new Error('Equipment not found or not of type EQUIPMENT');
    }
  }
```
**Lines 196-207**: Validate equipment if provided. `findFirst` returns first match or null. Ensures equipment is type EQUIPMENT (not INGREDIENT).

```typescript
  const batch = await prisma.batch.create({
    data: {
      recipeId: data.recipeId,
      operatorUserId: data.operatorId,
      equipmentId: data.equipmentId,
      startTime: new Date(),
      status: 'IN_PROGRESS',
    },
```
**Lines 210-217**: Create batch record with status IN_PROGRESS. `startTime` set to current timestamp.

```typescript
    include: {
      recipe: {
        include: {
          steps: {
            include: {
              material: true,
              equipment: true,
            },
            orderBy: {
              stepOrder: 'asc',
            },
          },
        },
      },
      operator: {
        select: {
          id: true,
          username: true,
          role: true,
        },
      },
      equipment: true,
      logs: true,
    },
  });
```
**Lines 219-242**: Nested include to load all related data in single query:
- Recipe with steps (ordered by stepOrder)
- Each step's material and equipment
- Operator (excluding password hash via select)
- Equipment
- Logs (empty initially)

**Performance**: One query instead of multiple. Called "eager loading".

```typescript
async logStep(
  batchId: number,
  data: {
    stepId: number;
    materialId: number;
    actualWeight: number;
    setpointSnapshot: number;
    toleranceSnapshot: number;
    scannedQrCode?: string;
  }
) {
  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    include: {
      recipe: {
        include: {
          steps: true,
        },
      },
    },
  });

  if (!batch) {
    throw new Error('Batch not found');
  }

  if (batch.status !== 'IN_PROGRESS') {
    throw new Error('Batch is not in progress');
  }
```
**Lines 251-278**: Validate batch exists and is IN_PROGRESS. Can't log steps to completed/aborted batches.

```typescript
  const step = batch.recipe.steps.find((s) => s.id === data.stepId);
  if (!step) {
    throw new Error('Step not found in batch recipe');
  }
```
**Lines 283-286**: Validate step belongs to batch's recipe. **Security**: Prevents logging steps from different recipes.

```typescript
  const material = await prisma.material.findUnique({
    where: { id: data.materialId },
  });

  if (!material) {
    throw new Error('Material not found');
  }

  if (material.id !== step.materialId) {
    throw new Error('Material does not match step requirements');
  }
```
**Lines 289-299**: Validate material exists and matches step. **Compliance**: Ensures correct ingredient was used.

```typescript
  const log = await prisma.batchLog.create({
    data: {
      batchId,
      stepId: data.stepId,
      materialId: data.materialId,
      actualWeight: data.actualWeight,
      setpointSnapshot: data.setpointSnapshot,
      toleranceSnapshot: data.toleranceSnapshot,
      scannedQrCode: data.scannedQrCode,
    },
```
**Lines 309-318**: Create batch log entry. **Critical**: Stores snapshot of setpoint/tolerance at time of execution (in case recipe is edited later). Creates immutable audit trail.

```typescript
async endBatch(batchId: number, data: { status: 'COMPLETED' | 'ABORTED' }) {
  // ... validation ...

  if (data.status === 'COMPLETED') {
    const recipeStepIds = batch.recipe.steps.map((s) => s.id);
    const loggedStepIds = new Set(batch.logs.map((l) => l.stepId));

    const missingSteps = recipeStepIds.filter((id) => !loggedStepIds.has(id));

    if (missingSteps.length > 0) {
      throw new Error(
        `Cannot complete batch: steps ${missingSteps.join(', ')} have not been logged`
      );
    }
  }
```
**Lines 369-379**: When completing (not aborting), validate all steps were logged. **Compliance**: Ensures recipe was followed completely. Using Set for O(1) lookup instead of array's O(n).

```typescript
  const updatedBatch = await prisma.batch.update({
    where: { id: batchId },
    data: {
      status: data.status,
      endTime: new Date(),
    },
    // ... include ...
  });
```
**Lines 383-388**: Update batch status and set endTime. **Important**: endTime is null during IN_PROGRESS, set when ended.

---

## Frontend Architecture - Line by Line

### 1. HTTP Client Configuration (`client/src/api/http.ts`)

```typescript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
```
**Line 4**: Get API URL from environment variable. Vite uses `import.meta.env` instead of `process.env`. Prefix must be `VITE_` for security (only exposed vars). Fallback to localhost for development.

```typescript
const http: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});
```
**Lines 7-13**: Create axios instance with:
- `baseURL`: Prepended to all requests (`/batches` → `http://localhost:5000/api/batches`)
- `timeout`: Abort request after 30 seconds
- `headers`: Default Content-Type for JSON APIs

```typescript
http.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);
```
**Lines 16-27**: Request interceptor runs before every request:
1. Get JWT token from localStorage
2. Add to Authorization header if exists
3. Return modified config
4. Catch errors (rare at this stage)

**Why**: Avoids manually adding auth header to every API call.

```typescript
http.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error: AxiosError<ApiResponse>) => {
```
**Lines 30-34**: Response interceptor runs after every response. First function handles success (just pass through). Second handles errors.

```typescript
    if (error.response) {
      const { status, data } = error.response;

      if (status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
```
**Lines 36-44**: If error has response (server responded with error status):
- Extract status code and data
- If 401 Unauthorized: clear auth data and redirect to login
- **Why**: Auto-logout on expired/invalid token

```typescript
      if (status === 403) {
        console.error('Access denied:', data.message);
      }

      if (status >= 500) {
        console.error('Server error:', data.message);
      }
```
**Lines 47-53**: Log 403 Forbidden (no permission) and 5xx server errors.

```typescript
      return Promise.reject({
        status,
        message: data.message || 'An error occurred',
        errors: data.errors,
      });
```
**Lines 55-59**: Reject promise with normalized error object. Components can catch with `.catch()`.

```typescript
    } else if (error.request) {
      console.error('Network error:', error.message);
      return Promise.reject({
        status: 0,
        message: 'Network error. Please check your connection.',
      });
```
**Lines 61-67**: If error has request but no response: network error (server unreachable, DNS failure, etc.). Status 0 indicates network issue.

```typescript
export const get = <T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<ApiResponse<T>>> => {
  return http.get(url, config);
};
```
**Lines 80-82**: Generic GET helper with TypeScript generics. `<T>` specifies expected response data type. Example: `get<Batch[]>('/batches')` returns `Promise<AxiosResponse<ApiResponse<Batch[]>>>`.

---

### 2. Load Cell Hook (`client/src/hooks/useLoadCell.ts`)

```typescript
const DEFAULT_CONFIG: LoadCellConfig = {
  baudRate: 9600,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  flowControl: 'none',
};
```
**Lines 20-26**: Default serial port configuration:
- `baudRate`: 9600 bits/second (common for load cells, may need adjustment)
- `dataBits`: 8 bits per character (standard)
- `stopBits`: 1 stop bit (standard)
- `parity`: No parity checking (error detection)
- `flowControl`: No flow control (hardware handshaking)

```typescript
export const useLoadCell = (config: LoadCellConfig = DEFAULT_CONFIG) => {
  const dispatch = useDispatch();
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentWeight, setCurrentWeight] = useState<number | null>(null);
  const [isStable, setIsStable] = useState(false);
```
**Lines 28-33**: Custom React hook. Uses Redux dispatch for global state updates. Local state for connection status, errors, weight, and stability.

```typescript
  const portRef = useRef<SerialPort | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const decoderRef = useRef(new TextDecoder());
  const bufferRef = useRef('');
  const stabilityCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousWeightRef = useRef<number | null>(null);
  const stabilityCountRef = useRef(0);
```
**Lines 35-41**: useRef for values that persist across renders but don't cause re-renders:
- `portRef`: Serial port instance
- `readerRef`: Stream reader for incoming data
- `decoderRef`: Converts Uint8Array bytes to string
- `bufferRef`: Accumulates partial data until complete line
- `stabilityCheckRef`: Timer reference
- `previousWeightRef`: Previous weight for stability calculation
- `stabilityCountRef`: Consecutive stable readings count

**Why ref**: These change frequently but don't need to trigger UI updates.

```typescript
  const parseWeightData = useCallback((data: string): { weight: number | null; stable: boolean } => {
    const normalized = data.trim().toUpperCase();

    const isStable = normalized.startsWith('ST') || (!normalized.startsWith('US') && !normalized.includes('UNSTABLE'));

    const numericMatch = normalized.match(/[-+]?\d+\.?\d*/);
    if (!numericMatch) {
      return { weight: null, stable: false };
    }

    const weight = parseFloat(numericMatch[0]);
    return {
      weight: isNaN(weight) ? null : weight,
      stable: isStable,
    };
  }, []);
```
**Lines 51-69**: Parse load cell data. Supports formats:
- `ST 123.45` (stable indicator)
- `US 123.45` (unstable indicator)
- `123.45` (assumes stable)
- `+123.45` or `-123.45` (with sign)

**Regex**: `[-+]?\d+\.?\d*` matches optional sign, digits, optional decimal point, optional digits. Returns null if no number found.

**useCallback**: Memoizes function so it doesn't change between renders (prevents unnecessary effects).

```typescript
  const checkStability = useCallback((weight: number) => {
    const STABILITY_THRESHOLD = 0.1; // grams
    const STABILITY_REQUIRED_READINGS = 3;

    if (previousWeightRef.current !== null) {
      const diff = Math.abs(weight - previousWeightRef.current);

      if (diff <= STABILITY_THRESHOLD) {
        stabilityCountRef.current++;
        if (stabilityCountRef.current >= STABILITY_REQUIRED_READINGS) {
          setIsStable(true);
        }
      } else {
        stabilityCountRef.current = 0;
        setIsStable(false);
      }
    }

    previousWeightRef.current = weight;
  }, []);
```
**Lines 74-93**: Check weight stability algorithm:
1. Calculate difference from previous weight
2. If difference ≤ 0.1g, increment stable counter
3. If counter reaches 3, mark as stable
4. If difference > 0.1g, reset counter and mark unstable
5. Update previous weight

**Why**: Load cells fluctuate. Require 3 consecutive stable readings (≈300ms) to confirm stability. Prevents logging fluctuating weights.

```typescript
  const processData = useCallback(
    (chunk: string) => {
      bufferRef.current += chunk;

      const lines = bufferRef.current.split(/[\r\n]+/);

      bufferRef.current = lines.pop() || '';

      lines.forEach((line) => {
        if (!line.trim()) return;

        const { weight, stable } = parseWeightData(line);

        if (weight !== null) {
          setCurrentWeight(weight);
          checkStability(weight);

          const loadCellData: LoadCellData = {
            weight,
            isStable: stable,
            timestamp: Date.now(),
          };

          dispatch(updateLoadCellData(loadCellData));
        }
      });
    },
    [parseWeightData, checkStability, dispatch]
  );
```
**Lines 98-130**: Process incoming serial data:
1. Add chunk to buffer (may be partial line)
2. Split by newline/carriage return
3. Pop last item (partial line) back to buffer
4. Process complete lines
5. Parse weight, check stability, dispatch to Redux

**Why buffer**: Serial data arrives in chunks, not complete lines. Buffer accumulates until newline received.

```typescript
  const readData = useCallback(async () => {
    if (!portRef.current?.readable) return;

    try {
      const reader = portRef.current.readable.getReader();
      readerRef.current = reader;

      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          reader.releaseLock();
          break;
        }

        const chunk = decoderRef.current.decode(value, { stream: true });
        processData(chunk);
      }
```
**Lines 135-152**: Read data from serial port:
1. Get readable stream from port
2. Get reader (locks stream, only one reader allowed)
3. Loop infinitely (until done or error)
4. Read next chunk (async, waits for data)
5. If done, release lock and break
6. Decode bytes to string (`stream: true` handles multi-byte characters spanning chunks)
7. Process data

**Infinite loop**: Continuously reads until port closed or error. `await reader.read()` suspends until data available (non-blocking).

```typescript
  const connect = useCallback(async () => {
    if (!('serial' in navigator)) {
      setError('Web Serial API is not supported in this browser');
      return false;
    }

    try {
      const port = await navigator.serial.requestPort();
      portRef.current = port;

      await port.open({
        baudRate: (config.baudRate || DEFAULT_CONFIG.baudRate) as number,
        dataBits: config.dataBits || DEFAULT_CONFIG.dataBits,
        stopBits: config.stopBits || DEFAULT_CONFIG.stopBits,
        parity: config.parity || DEFAULT_CONFIG.parity,
        flowControl: config.flowControl || DEFAULT_CONFIG.flowControl,
      });

      setIsConnected(true);
      setError(null);

      readData();

      return true;
```
**Lines 166-192**: Connect to load cell:
1. Check Web Serial API support (Chrome/Edge only)
2. Request port (opens browser dialog for user to select port)
3. Open port with configuration
4. Update state
5. Start reading data
6. Return true on success

**User interaction required**: `requestPort()` must be called from user gesture (click) due to browser security.

```typescript
  const tare = useCallback(async () => {
    if (!portRef.current?.writable) {
      setError('Load cell not connected');
      return false;
    }

    try {
      const writer = portRef.current.writable.getWriter();

      const tareCommand = new TextEncoder().encode('T\r\n');
      await writer.write(tareCommand);

      writer.releaseLock();

      setCurrentWeight(0);
      previousWeightRef.current = 0;
      stabilityCountRef.current = 0;

      return true;
```
**Lines 232-252**: Tare (zero) load cell:
1. Check port is writable
2. Get writer
3. Encode command to bytes (`T\r\n` is common tare command)
4. Write to port
5. Release lock
6. Reset weight to 0

**Note**: Tare command varies by load cell model. May need `TARE`, `Z`, etc.

---

### 3. QR Scanner Hook (`client/src/hooks/useQrScanner.ts`)

```typescript
export const useQrScanner = (config: QRScannerConfig = DEFAULT_CONFIG) => {
  const dispatch = useDispatch();
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onScanRef = useRef<((data: string) => void) | null>(null);
```
**Lines 20-31**: Hook state and refs:
- State: scanning status, errors, last scan, camera ready
- Refs: video element, canvas (for frame capture), media stream, scan interval timer, custom callback

**Why video + canvas**: QR scanning requires extracting image data from video frames.

```typescript
  const scanFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    if (video.readyState !== video.HAVE_ENOUGH_DATA) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });
```
**Lines 36-61**: Scan current video frame:
1. Get video and canvas elements
2. Get 2D rendering context
3. Check video has loaded data
4. Set canvas size to match video
5. Draw video frame to canvas
6. Extract image data (pixel array)
7. Scan for QR code with jsQR library

**inversionAttempts**: Don't try inverted colors (faster). Set to `'attemptBoth'` if QR codes are white-on-black.

```typescript
    if (code && code.data) {
      if (code.data !== lastScannedCode) {
        setLastScannedCode(code.data);
        dispatch(setScannedQRCode(code.data));

        if (onScanRef.current) {
          onScanRef.current(code.data);
        }

        context.strokeStyle = '#00FF00';
        context.lineWidth = 4;
        context.strokeRect(
          code.location.topLeftCorner.x,
          code.location.topLeftCorner.y,
          code.location.bottomRightCorner.x - code.location.topLeftCorner.x,
          code.location.bottomRightCorner.y - code.location.topLeftCorner.y
        );
      }
    }
```
**Lines 63-84**: If QR code found:
1. Check if it's different from last scan (debounce)
2. Update state
3. Dispatch to Redux
4. Call custom callback if set
5. Draw green rectangle around QR code (visual feedback)

**Debounce**: Prevents processing same code multiple times per second.

```typescript
  const startScanning = useCallback(
    async (videoElement: HTMLVideoElement, canvasElement: HTMLCanvasElement) => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Camera access is not supported in this browser');
        return false;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: config.width || DEFAULT_CONFIG.width },
            height: { ideal: config.height || DEFAULT_CONFIG.height },
            facingMode: config.facingMode || DEFAULT_CONFIG.facingMode,
          },
          audio: false,
        });

        streamRef.current = stream;
        videoRef.current = videoElement;
        canvasRef.current = canvasElement;

        videoElement.srcObject = stream;

        await new Promise<void>((resolve) => {
          videoElement.onloadedmetadata = () => {
            videoElement.play();
            setCameraReady(true);
            resolve();
          };
        });

        setIsScanning(true);
        setError(null);

        scanIntervalRef.current = setInterval(() => {
          scanFrame();
        }, config.scanInterval || DEFAULT_CONFIG.scanInterval);

        return true;
```
**Lines 90-132**: Start camera scanning:
1. Check browser support
2. Request camera access with constraints:
   - `ideal`: Preferred resolution (may get lower)
   - `facingMode: 'environment'`: Back camera on mobile, front camera on desktop
3. Store stream and elements
4. Attach stream to video element
5. Wait for video metadata loaded (async)
6. Play video
7. Start scan interval (every 100ms by default)

**Why interval**: Camera streams continuously, but QR scanning is CPU-intensive. Scan every 100ms instead of every frame (60fps = every 16ms).

---

### 4. Redux Batch Slice (`client/src/store/batchSlice.ts`)

```typescript
interface BatchState {
  activeBatch: Batch | null;
  currentRecipe: Recipe | null;
  currentStepIndex: number;
  loadCellData: LoadCellData;
  scannedQRCode: string | null;
  localHistory: BatchLog[];
  isWithinTolerance: boolean;
  isQRValidated: boolean;
}
```
**Lines 10-19**: Batch state structure:
- `activeBatch`: Current batch being executed
- `currentRecipe`: Recipe being followed
- `currentStepIndex`: Which step operator is on (0-based)
- `loadCellData`: Real-time weight from load cell
- `scannedQRCode`: Last scanned QR code
- `localHistory`: Logged steps (synced to server)
- `isWithinTolerance`: Current weight within tolerance
- `isQRValidated`: Scanned QR matches expected material

**Why local state**: Real-time UI updates during batch execution. Server-side validation on submit.

```typescript
const batchSlice = createSlice({
  name: 'batch',
  initialState,
  reducers: {
```
**Lines 36-39**: Create Redux slice with Redux Toolkit. Slice = piece of Redux state with reducers. Replaces old Redux boilerplate.

```typescript
    startBatch: (state, action: PayloadAction<{ batch: Batch; recipe: Recipe }>) => {
      state.activeBatch = action.payload.batch;
      state.currentRecipe = action.payload.recipe;
      state.currentStepIndex = 0;
      state.localHistory = [];
      state.scannedQRCode = null;
      state.isQRValidated = false;
      state.isWithinTolerance = false;
    },
```
**Lines 40-48**: Start batch reducer:
1. Store batch and recipe
2. Reset step index to 0 (first step)
3. Clear history, QR code, validation flags

**Immer**: Redux Toolkit uses Immer for immutable updates. Can write `state.activeBatch = ...` instead of `return { ...state, activeBatch: ... }`.

```typescript
    updateLoadCellData: (state, action: PayloadAction<LoadCellData>) => {
      state.loadCellData = action.payload;

      if (state.currentRecipe && state.currentRecipe.steps) {
        const currentStep = state.currentRecipe.steps[state.currentStepIndex];
        if (currentStep && action.payload.weight !== null) {
          const setpoint = Number(currentStep.setpoint);
          const tolerance = Number(currentStep.tolerancePercent);
          const weight = action.payload.weight;

          const toleranceRange = (setpoint * tolerance) / 100;
          const lowerBound = setpoint - toleranceRange;
          const upperBound = setpoint + toleranceRange;

          state.isWithinTolerance = weight >= lowerBound && weight <= upperBound;
        }
      }
    },
```
**Lines 77-95**: Update load cell data and check tolerance:
1. Store weight data
2. Get current step
3. Calculate tolerance range
   - Example: setpoint=100, tolerance=5%
   - toleranceRange = (100 * 5) / 100 = 5
   - lowerBound = 100 - 5 = 95
   - upperBound = 100 + 5 = 105
4. Check if weight is within bounds
5. Update isWithinTolerance flag

**Real-time**: This runs every time load cell sends weight (multiple times per second). Updates UI indicator instantly.

---

### 5. App Routing (`client/src/App.tsx`)

```typescript
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Layout>{children}</Layout>;
};
```
**Lines 16-24**: Protected route component:
1. Check if user is authenticated (from Redux)
2. If not, redirect to login (replace prevents back button returning)
3. If authenticated, wrap in Layout (navigation, header, etc.)

**Why component**: Reusable route protection pattern.

```typescript
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  return <Layout>{children}</Layout>;
};
```
**Lines 27-39**: Admin-only route:
1. Check authentication
2. Check role is ADMIN
3. If operator, redirect to dashboard (not login)

**Why separate**: Some routes need authentication, others need admin role.

```typescript
<Route
  path="/materials"
  element={
    <AdminRoute>
      <Materials />
    </AdminRoute>
  }
/>
```
**Lines 59-66**: Materials route (admin-only). Wrap page in AdminRoute component.

---

## Development Workflow Explained

### Starting Development Servers

**Terminal 1 - Backend:**
```bash
cd server
npm run dev
```
This runs `ts-node-dev --respawn --transpile-only src/server.ts`:
- `ts-node-dev`: Like `nodemon` but for TypeScript
- `--respawn`: Restart on file changes
- `--transpile-only`: Skip type checking (faster, rely on IDE)
- Watches all `.ts` files in `src/`

**Terminal 2 - Frontend:**
```bash
cd client
npm run dev
```
This runs `vite`:
- Starts dev server on port 5173
- Hot Module Replacement (HMR): Updates code without page reload
- Watches all files in `src/`

### Database Migrations

**Create migration:**
```bash
cd server
npm run prisma:migrate
```
This runs `prisma migrate dev`:
1. Reads `prisma/schema.prisma`
2. Compares with current database schema
3. Generates SQL migration in `prisma/migrations/`
4. Prompts for migration name
5. Applies migration to database
6. Regenerates Prisma Client

**Apply migrations (production):**
```bash
npm run prisma:migrate:prod
```
This runs `prisma migrate deploy`:
- Applies pending migrations without interactive prompts
- Safe for CI/CD pipelines

**Prisma Studio (database GUI):**
```bash
npm run prisma:studio
```
Opens browser GUI at `http://localhost:5555` to view/edit data.

### Building for Production

**Backend:**
```bash
cd server
npm run build
```
This runs `tsc`:
- Compiles TypeScript to JavaScript in `dist/` folder
- Uses `tsconfig.json` configuration
- Checks types (errors prevent build)

**Run production build:**
```bash
npm start
```
This runs `node dist/server.js`:
- No TypeScript compilation
- No file watching
- Production mode (less logging, optimizations)

**Frontend:**
```bash
cd client
npm run build
```
This runs `tsc && vite build`:
1. TypeScript compiler checks types
2. Vite bundles for production:
   - Minifies JavaScript
   - Optimizes CSS
   - Compresses images
   - Outputs to `dist/` folder

**Preview production build:**
```bash
npm run preview
```
Serves production build locally to test before deployment.

---

## Key Architectural Patterns Explained

### 1. Service Layer Pattern (Backend)

**Structure:**
```
Controller → Service → Prisma → Database
```

**Example: Batches Module**

**Route** (`batches.routes.ts`):
```typescript
router.post('/start', auth, batchController.startBatch);
```
Defines HTTP endpoint, applies auth middleware, calls controller.

**Controller** (`batches.controller.ts`):
```typescript
async startBatch(req: Request, res: Response) {
  const { recipeId, equipmentId } = req.body;
  const operatorId = req.user!.userId;

  const batch = await batchService.startBatch({
    recipeId,
    operatorId,
    equipmentId
  });

  res.json({ success: true, data: batch });
}
```
Responsibilities:
- Extract data from request
- Call service
- Format response
- Handle HTTP concerns (status codes, headers)

**Service** (`batches.service.ts`):
```typescript
async startBatch(data: { recipeId, operatorId, equipmentId? }) {
  // 1. Validate recipe exists
  // 2. Validate operator exists
  // 3. Validate equipment if provided
  // 4. Create batch record
  // 5. Return batch with related data
}
```
Responsibilities:
- Business logic
- Validation
- Database operations
- Error handling

**Why separate**: Controllers are thin HTTP handlers. Services contain reusable business logic. Could call same service from GraphQL, CLI, cron job, etc.

### 2. Redux Toolkit State Management (Frontend)

**Structure:**
```
Component → dispatch(action) → Reducer → State → Component
```

**Example: Batch Execution**

**Component:**
```typescript
const dispatch = useDispatch();
const { isWithinTolerance } = useSelector(state => state.batch);

const handleWeightUpdate = (weight: number) => {
  dispatch(updateLoadCellData({
    weight,
    isStable: true,
    timestamp: Date.now()
  }));
};
```

**Slice (Reducer + Actions):**
```typescript
const batchSlice = createSlice({
  name: 'batch',
  initialState,
  reducers: {
    updateLoadCellData: (state, action) => {
      // Update state immutably
      state.loadCellData = action.payload;
      // Recalculate tolerance
      state.isWithinTolerance = calculateTolerance();
    }
  }
});
```

**Store:**
```typescript
const store = configureStore({
  reducer: {
    auth: authSlice,
    batch: batchSlice,
    materials: materialsSlice,
    recipes: recipesSlice,
    ui: uiSlice,
  }
});
```

**Why Redux Toolkit**:
- Less boilerplate than Redux
- Immer for immutable updates
- DevTools for debugging
- Centralized state (accessible from any component)

### 3. Custom Hooks Pattern (Frontend)

**Example: useLoadCell**

**Without hook:**
```typescript
function BatchPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [weight, setWeight] = useState(null);
  const portRef = useRef(null);

  const connect = async () => { /* 50 lines */ };
  const disconnect = async () => { /* 20 lines */ };
  const readData = async () => { /* 30 lines */ };

  // ... component logic mixed with serial port logic
}
```

**With hook:**
```typescript
function BatchPage() {
  const { isConnected, currentWeight, connect, disconnect } = useLoadCell();

  // Clean component logic, hardware abstracted
}
```

**Benefits:**
- Reusable across components
- Easier testing (mock hook)
- Separation of concerns
- Cleaner components

### 4. Axios Interceptors Pattern (Frontend)

**Without interceptors:**
```typescript
// Every API call:
const token = localStorage.getItem('token');
const response = await axios.get('/batches', {
  headers: { Authorization: `Bearer ${token}` }
});

if (response.status === 401) {
  localStorage.removeItem('token');
  window.location.href = '/login';
}
```

**With interceptors:**
```typescript
// Once in http.ts:
http.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API calls are clean:
const response = await http.get('/batches');
```

**Benefits:**
- DRY (Don't Repeat Yourself)
- Centralized auth handling
- Automatic token refresh (could add)
- Global error handling

---

## Critical Business Logic Explained

### Tolerance Validation Algorithm

**Location:** `client/src/store/batchSlice.ts:88-92`, server should re-validate

**Formula:**
```
toleranceRange = (setpoint × tolerance%) ÷ 100
lowerBound = setpoint - toleranceRange
upperBound = setpoint + toleranceRange
isValid = actualWeight >= lowerBound AND actualWeight <= upperBound
```

**Example:**
- Setpoint: 500g
- Tolerance: 2%
- Tolerance range: (500 × 2) ÷ 100 = 10g
- Lower bound: 500 - 10 = 490g
- Upper bound: 500 + 10 = 510g
- Valid range: 490g to 510g

**If weight = 495g:** ✅ Within tolerance (green indicator)
**If weight = 515g:** ❌ Out of tolerance (red indicator, require acknowledgment)

### Batch Completion Validation

**Location:** `server/src/modules/batches/batches.service.ts:369-379`

**Algorithm:**
```typescript
// Get all required step IDs from recipe
const recipeStepIds = [1, 2, 3, 4, 5];

// Get all logged step IDs from batch logs
const loggedStepIds = new Set([1, 2, 3, 5]); // Missing step 4

// Find missing steps
const missingSteps = recipeStepIds.filter(id => !loggedStepIds.has(id));
// Result: [4]

if (missingSteps.length > 0) {
  throw new Error('Cannot complete batch: steps 4 have not been logged');
}
```

**Why Set:** O(1) lookup time. Array would be O(n) for each `includes()` check.

**Business rule:** Cannot complete batch unless ALL recipe steps are logged. Ensures recipe was followed completely.

### QR Code Format

**Location:** QR generation/parsing throughout

**Format:**
```
MaterialCode,Setpoint,ActualValue,MaterialName,Equipment
```

**Example:**
```
MAT001,500.000,495.250,Sugar,LoadCell-1
```

**Parsing:**
```typescript
const parts = qrCode.split(',');
const materialCode = parts[0];
const setpoint = parseFloat(parts[1]);
const actualValue = parseFloat(parts[2]);
const materialName = parts[3];
const equipment = parts[4];
```

**Validation:**
1. Material code must match current step's material code
2. Used for audit trail (printed on containers)
3. Can be scanned to verify correct ingredient used

---

## Security Considerations

### 1. Password Storage
- **Never store plaintext passwords**
- Use bcrypt with 10 salt rounds
- Hash is stored in `passwordHash` column
- Salt is included in hash (automatic with bcrypt)

### 2. JWT Security
- **Secret must be strong**: Use random 64+ character string
- **Algorithm pinned**: HS256 prevents algorithm confusion attacks
- **Token expiration**: Default 8 hours
- **Stateless**: Server doesn't store tokens (can't revoke without blacklist)
- **Not encrypted**: Anyone can decode payload (don't put sensitive data)

### 3. SQL Injection Prevention
- **Prisma ORM**: All queries parameterized automatically
- **Never use raw SQL with user input**
- Example safe query:
  ```typescript
  prisma.user.findUnique({ where: { username } })
  // Generates: SELECT * FROM users WHERE username = ? (parameterized)
  ```

### 4. CORS Configuration
- `CORS_ORIGIN` environment variable
- Default: `http://localhost:5173` (development)
- Production: Set to actual frontend domain
- **Never use `*`** (allows any origin)

### 5. Input Validation
- Express-validator in routes (not implemented in all routes yet)
- TypeScript types (compile-time validation)
- Prisma schema constraints (database validation)

### 6. Authentication Flow
1. User submits username + password
2. Server verifies with bcrypt
3. Server generates JWT
4. Client stores token in localStorage
5. Client includes token in Authorization header
6. Server verifies token on each request

---

## Performance Optimizations

### 1. Database Query Optimization

**Problem: N+1 Queries**
```typescript
// BAD: N+1 queries
const batches = await prisma.batch.findMany();
for (const batch of batches) {
  const recipe = await prisma.recipe.findUnique({ where: { id: batch.recipeId } });
  // 1 query for batches + N queries for recipes = N+1
}
```

**Solution: Eager Loading**
```typescript
// GOOD: 1 query with JOIN
const batches = await prisma.batch.findMany({
  include: { recipe: true }
});
// Single query with JOIN
```

**Used throughout services** with `include` clauses.

### 2. React Re-render Optimization

**useCallback:**
```typescript
const expensiveFunction = useCallback(() => {
  // ...
}, [dependency]);
```
Prevents function recreation on every render. Stable reference for child components.

**useMemo:**
```typescript
const expensiveCalculation = useMemo(() => {
  return complexCalculation(data);
}, [data]);
```
Caches calculation result until dependencies change.

**useRef for non-rendering state:**
```typescript
const bufferRef = useRef('');
bufferRef.current += chunk; // Doesn't trigger re-render
```

### 3. Frontend Bundle Optimization

**Code splitting:**
```typescript
const LazyComponent = lazy(() => import('./Component'));
```
Loads component only when needed (not implemented yet).

**Vite optimizations:**
- Tree shaking (removes unused code)
- Minification (reduces file size)
- Code splitting (separate bundles per route)
- Asset optimization (compresses images)

---

## Testing Strategy

### Backend Testing (Jest)
```typescript
describe('AuthService', () => {
  it('should login user with valid credentials', async () => {
    const result = await authService.login({
      username: 'admin',
      password: 'admin'
    });

    expect(result.token).toBeDefined();
    expect(result.user.username).toBe('admin');
  });

  it('should throw error with invalid password', async () => {
    await expect(authService.login({
      username: 'admin',
      password: 'wrong'
    })).rejects.toThrow('Invalid username or password');
  });
});
```

### Frontend Testing (Vitest + React Testing Library)
```typescript
describe('BatchSlice', () => {
  it('should calculate tolerance correctly', () => {
    const state = {
      currentRecipe: {
        steps: [{
          setpoint: 100,
          tolerancePercent: 5
        }]
      },
      currentStepIndex: 0
    };

    const newState = batchSlice.reducer(
      state,
      updateLoadCellData({ weight: 97, isStable: true, timestamp: Date.now() })
    );

    expect(newState.isWithinTolerance).toBe(true); // 97 in [95, 105]
  });
});
```

---

## Common Development Tasks - Step by Step

### Adding a New API Endpoint

**Example: Add "get batch statistics" endpoint**

**1. Add route** (`server/src/modules/batches/batches.routes.ts`):
```typescript
router.get('/statistics', auth, batchController.getStatistics);
```

**2. Add controller** (`batches.controller.ts`):
```typescript
async getStatistics(req: Request, res: Response) {
  try {
    const stats = await batchService.getStatistics();
    res.json({ success: true, data: stats });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}
```

**3. Add service method** (`batches.service.ts`):
```typescript
async getStatistics() {
  const total = await prisma.batch.count();
  const completed = await prisma.batch.count({ where: { status: 'COMPLETED' } });
  return { total, completed, percentage: (completed / total) * 100 };
}
```

**4. Add client API call** (`client/src/api/batches.api.ts`):
```typescript
export const getBatchStatistics = async () => {
  const response = await http.get<{ total: number; completed: number; percentage: number }>('/batches/statistics');
  return response.data.data;
};
```

**5. Use in component:**
```typescript
const [stats, setStats] = useState(null);

useEffect(() => {
  getBatchStatistics().then(setStats);
}, []);
```

### Adding a New Database Field

**Example: Add "notes" field to Batch**

**1. Edit Prisma schema** (`server/prisma/schema.prisma`):
```prisma
model Batch {
  // ... existing fields ...
  notes String? @db.Text
}
```

**2. Create migration:**
```bash
cd server
npm run prisma:migrate
# Enter migration name: add_notes_to_batch
```
This creates `migrations/YYYYMMDDHHMMSS_add_notes_to_batch/migration.sql`:
```sql
ALTER TABLE batches ADD COLUMN notes TEXT NULL;
```

**3. Update TypeScript types** (`client/src/types/models.ts`):
```typescript
export interface Batch {
  // ... existing fields ...
  notes?: string;
}
```

**4. Update forms/UI to accept notes:**
```typescript
<textarea
  value={notes}
  onChange={(e) => setNotes(e.target.value)}
  placeholder="Batch notes"
/>
```

**5. Update service to accept notes:**
```typescript
async startBatch(data: { recipeId, operatorId, equipmentId?, notes? }) {
  const batch = await prisma.batch.create({
    data: {
      // ... existing fields ...
      notes: data.notes
    }
  });
}
```

---

## Troubleshooting Guide

### "Port already in use" Error

**Problem:** Another process using port 5000 or 5173

**Solution (Windows):**
```powershell
# Find process on port 5000
netstat -ano | findstr :5000
# Kill process (replace PID)
taskkill /PID <PID> /F
```

**Solution (Mac/Linux):**
```bash
# Find and kill process on port 5000
lsof -ti:5000 | xargs kill -9
```

### "Prisma Client not generated"

**Problem:** After schema changes, Prisma Client not updated

**Solution:**
```bash
cd server
npm run prisma:generate
```

**When needed:**
- After pulling schema changes from git
- After editing `schema.prisma` manually
- After running migrations

### "Web Serial API not available"

**Problem:** Load cell integration not working

**Causes:**
1. Using Firefox/Safari (not supported)
2. Not using HTTPS or localhost
3. Browser security settings

**Solutions:**
- Use Chrome or Edge
- Ensure site is HTTPS in production
- For localhost, ensure using `http://localhost:5173` not `http://127.0.0.1:5173`

### "JWT expired" Errors

**Problem:** Token expired (default 8 hours)

**Solution:**
1. Log out and log back in
2. Increase expiration in `.env`: `JWT_EXPIRES_IN=24h`
3. Implement token refresh (advanced)

### Database Connection Errors

**Problem:** Can't connect to MySQL

**Checklist:**
1. MySQL server running?
   ```bash
   # Windows
   net start MySQL80

   # Mac
   brew services start mysql

   # Linux
   sudo systemctl start mysql
   ```

2. Correct credentials in `.env`?
   ```
   DATABASE_URL="mysql://root:password@localhost:3306/mixer_db"
   ```

3. Database exists?
   ```sql
   mysql -u root -p
   CREATE DATABASE mixer_db;
   ```

4. Migrations applied?
   ```bash
   cd server
   npm run prisma:migrate
   ```

---

## Deployment Checklist

### Backend Deployment

1. **Set environment variables:**
   ```
   NODE_ENV=production
   PORT=5000
   DATABASE_URL=mysql://user:pass@db-server:3306/mixer_db
   JWT_SECRET=<64-character-random-string>
   JWT_EXPIRES_IN=8h
   CORS_ORIGIN=https://yourdomain.com
   ```

2. **Build application:**
   ```bash
   cd server
   npm run build
   ```

3. **Run migrations:**
   ```bash
   npm run prisma:migrate:prod
   ```

4. **Start server:**
   ```bash
   npm start
   ```

5. **Setup process manager** (PM2):
   ```bash
   npm install -g pm2
   pm2 start dist/server.js --name mixsense-api
   pm2 startup
   pm2 save
   ```

### Frontend Deployment

1. **Set environment variable** (`.env.production`):
   ```
   VITE_API_URL=https://api.yourdomain.com/api
   ```

2. **Build application:**
   ```bash
   cd client
   npm run build
   ```

3. **Deploy `dist/` folder** to:
   - Nginx (static files)
   - Vercel (automatic)
   - Netlify (automatic)
   - AWS S3 + CloudFront
   - Any static hosting

### Database Backup Setup

**Cron job** (`crontab -e`):
```bash
0 0 * * * /bin/bash /path/to/server/scripts/backup_db.sh
```

**Backup script** (`server/scripts/backup_db.sh`):
```bash
#!/bin/bash
BACKUP_DIR="/backups"
DB_USER="root"
DB_PASS="password"
DB_NAME="mixer_db"
DATE=$(date +%F_%H-%M-%S)

mysqldump -u $DB_USER -p$DB_PASS $DB_NAME | gzip > $BACKUP_DIR/mixer_db_$DATE.sql.gz

# Keep backups for 30 days
find $BACKUP_DIR -name "mixer_db_*.sql.gz" -mtime +30 -delete
```

---

This completes the deep technical explanation of every aspect of the MixSense codebase. Each section explains the "what", "why", and "how" of the implementation.
