# MixSense Setup Guide

This guide provides step-by-step instructions for setting up the MixSense Mixer Batch Reporting Software on a new PC.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Initial Setup](#initial-setup)
- [Database Configuration](#database-configuration)
- [Environment Configuration](#environment-configuration)
- [Node-RED Setup](#node-red-setup)
- [ZPL Printer Setup](#zpl-printer-setup)
- [Running the Application](#running-the-application)
- [Building for Production](#building-for-production)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before setting up MixSense, ensure the following software is installed:

### Required Software

1. **Node.js** (v18 or higher)
   - Download from: https://nodejs.org/
   - Verify installation: `node --version`

2. **npm** (comes with Node.js)
   - Verify installation: `npm --version`

3. **MySQL** (v8.0 or higher)
   - Download from: https://dev.mysql.com/downloads/mysql/
   - Or use XAMPP/WAMP for Windows: https://www.apachefriends.org/

4. **Git** (optional, for version control)
   - Download from: https://git-scm.com/

5. **Node-RED** (for hardware integration)
   - Install globally: `npm install -g node-red`
   - Verify installation: `node-red --version`

### Hardware Requirements

1. **Load Cell with Serial Connection** (for weight monitoring)
   - RS-232 or USB serial connection
   - Compatible with Web Serial API

2. **QR/Barcode Scanner** (HID keyboard mode)
   - USB connection
   - Must support HID keyboard emulation mode

3. **ZPL Printer** (for label printing)
   - ZDesigner ZD421-300dpi ZPL or compatible
   - Network or USB connection

### Browser Requirements

- **Google Chrome** or **Microsoft Edge** (required for Web Serial API)
- Firefox and Safari are NOT supported due to Web Serial API limitations

---

## Initial Setup

### 1. Clone or Copy the Repository

If using Git:
```bash
git clone <repository-url>
cd mixsense
```

If copying files manually, extract to your desired location.

### 2. Install Root Dependencies

```bash
npm install
```

This will install Husky hooks for pre-commit linting.

### 3. Install Backend Dependencies

```bash
cd server
npm install
cd ..
```

### 4. Install Frontend Dependencies

```bash
cd client
npm install
cd ..
```

---

## Database Configuration

### 1. Start MySQL Server

- **XAMPP/WAMP**: Start MySQL from control panel
- **Standalone MySQL**: Ensure MySQL service is running

### 2. Create Database

Open MySQL command line or phpMyAdmin and run:

```sql
CREATE DATABASE mixer_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 3. Create Database User (Optional but Recommended)

For production, create a dedicated user:

```sql
CREATE USER 'mixsense_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON mixer_db.* TO 'mixsense_user'@'localhost';
FLUSH PRIVILEGES;
```

### 4. Configure Database Connection

Edit `server/.env` (see [Environment Configuration](#environment-configuration) section)

### 5. Run Database Migrations

```bash
cd server
npm run prisma:migrate
```

This will create all necessary tables in the database.

### 6. Verify Database Setup

```bash
npm run prisma:studio
```

This opens Prisma Studio in your browser to view database tables.

---

## Environment Configuration

### Backend Configuration (server/.env)

1. **Copy the example file:**
   ```bash
   cd server
   copy .env.example .env
   ```

2. **Edit `server/.env` with your settings:**

   ```env
   # Environment (development | production | test)
   NODE_ENV=development

   # Server Configuration
   PORT=5000

   # Database Configuration
   # IMPORTANT: Update with your MySQL credentials
   DATABASE_URL="mysql://root:your_password@localhost:3306/mixer_db"
   # For production with dedicated user:
   # DATABASE_URL="mysql://mixsense_user:secure_password@localhost:3306/mixer_db"

   # JWT Authentication
   # SECURITY: Generate a strong random secret!
   # Run: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   JWT_EXPIRES_IN=8h

   # CORS Configuration
   # Development: frontend URL
   CORS_ORIGIN=http://localhost:5173
   # Production: your production frontend URL
   # CORS_ORIGIN=http://192.168.1.100:5173

   # Logging
   LOG_LEVEL=info
   ```

3. **Generate a strong JWT secret (highly recommended):**
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
   Copy the output and replace `JWT_SECRET` value in `.env`

### Frontend Configuration (client/.env)

1. **Copy the example file:**
   ```bash
   cd client
   copy .env.example .env
   ```

2. **Edit `client/.env` with your settings:**

   ```env
   # Backend API URL
   # Development (same PC):
   VITE_API_URL=http://localhost:5000/api

   # Production (different PC on network):
   # VITE_API_URL=http://192.168.1.100:5000/api

   # Node-RED WebSocket Configuration
   # Development (same PC):
   VITE_WEIGHT_WS_URL=ws://localhost:1880/ws/weight
   VITE_BARCODE_WS_URL=ws://localhost:1880/ws/barcode

   # Production (Node-RED on different PC):
   # VITE_WEIGHT_WS_URL=ws://192.168.1.101:1880/ws/weight
   # VITE_BARCODE_WS_URL=ws://192.168.1.101:1880/ws/barcode

   # ZPL Printer Service URL
   # USB Printer (same PC):
   VITE_ZPL_PRINTER_URL=http://localhost:9100

   # Network Printer:
   # VITE_ZPL_PRINTER_URL=http://192.168.1.50:9100

   # Development Proxy Configuration (only for development mode)
   VITE_PROXY_API_TARGET=http://localhost:5000
   VITE_PROXY_ZPL_TARGET=http://localhost:9100
   ```

3. **Important Notes:**
   - For **development on same PC**: Use `localhost` for all URLs
   - For **production/network setup**: Replace with actual IP addresses
   - For **multiple PCs**: Ensure all PCs are on the same network

---

## Node-RED Setup

Node-RED handles hardware integration for load cells and barcode scanners.

### 1. Install Node-RED

If not already installed:
```bash
npm install -g node-red
```

### 2. Start Node-RED

```bash
node-red
```

Node-RED will start on http://localhost:1880

### 3. Configure WebSocket Endpoints

Open Node-RED editor: http://localhost:1880

#### Weight Monitoring Endpoint (for Process Recipe)

Create a flow that:
1. Reads weight data from load cell (via serial port)
2. Publishes to WebSocket endpoint: `/ws/weight`
3. Sends data every second in one of these formats:
   - Simple numeric: `"1234.56"`
   - JSON: `{"weight": 1234.56, "stable": true}`
   - With units: `"1234.56 kg"`

**Example Flow:**
```
[Serial Port] → [Function: Parse Weight] → [WebSocket Out: /ws/weight]
```

#### Barcode Scanner Endpoint (for Process Batch)

Create a flow that:
1. Reads barcode data from scanner (via USB HID)
2. Publishes to WebSocket endpoint: `/ws/barcode`
3. Sends data in pipe-delimited format:
   ```
   recipeId|stepId|materialCode|actualWeight|userId|timestamp
   ```

**Example Flow:**
```
[USB HID Input] → [Function: Format Barcode] → [WebSocket Out: /ws/barcode]
```

### 4. Configure Node-RED to Start on Boot (Optional)

**Windows:**
- Create a batch file `start-nodered.bat`:
  ```batch
  @echo off
  start /B node-red
  ```
- Add to Windows Startup folder: `shell:startup`

**Linux (systemd):**
```bash
sudo systemctl enable node-red
sudo systemctl start node-red
```

### 5. Verify Node-RED Connection

- Frontend will show "CONNECTED" when data is actively being received
- Check Node-RED debug panel for incoming data

---

## ZPL Printer Setup

### 1. Install ZPL Printer

1. Connect ZDesigner ZD421-300dpi ZPL printer via USB or network
2. Install printer drivers from manufacturer website
3. Set printer as default (optional)

### 2. Configure Printer Endpoint

The printer must be accessible via HTTP POST at `http://localhost:9100` (or configured IP).

**Option A: Direct USB Connection (Recommended)**

Use a ZPL print server utility:
- **Windows**: Seagull Scientific Drivers (includes print server)
- **Cross-platform**: Use a Node.js ZPL print server

**Option B: Network Printer**

1. Configure printer with static IP address
2. Update `VITE_ZPL_PRINTER_URL` in `client/.env`:
   ```env
   VITE_ZPL_PRINTER_URL=http://192.168.1.50:9100
   ```

### 3. Test Printer Connection

The application will attempt to print during "Process Recipe" workflow. If printing fails, check:
- Printer is powered on and connected
- Printer service is running on port 9100
- Firewall allows connections to printer port
- `VITE_ZPL_PRINTER_URL` is correctly configured

---

## Running the Application

### Development Mode

#### 1. Start Backend Server

```bash
cd server
npm run dev
```

Backend will run on http://localhost:5000

#### 2. Start Frontend Development Server

Open a new terminal:
```bash
cd client
npm run dev
```

Frontend will run on http://localhost:5173

#### 3. Start Node-RED (if not running)

Open a new terminal:
```bash
node-red
```

Node-RED will run on http://localhost:1880

#### 4. Access Application

Open Google Chrome or Microsoft Edge:
```
http://localhost:5173
```

**Default Login Credentials** (create via Prisma Studio or seed script):
- Username: `admin`
- Password: Set via backend user creation

### Production Mode

See [Building for Production](#building-for-production)

---

## Building for Production

### 1. Build Backend

```bash
cd server
npm run build
```

This creates compiled JavaScript in `server/dist/`

### 2. Build Frontend

```bash
cd client
npm run build
```

This creates optimized production files in `client/dist/`

### 3. Update Environment Variables for Production

**Backend (server/.env):**
```env
NODE_ENV=production
PORT=5000
DATABASE_URL="mysql://mixsense_user:secure_password@localhost:3306/mixer_db"
JWT_SECRET=<your-generated-strong-secret>
CORS_ORIGIN=http://your-production-domain.com
LOG_LEVEL=warn
```

**Frontend (client/.env):**
```env
VITE_API_URL=http://your-backend-server:5000/api
VITE_WEIGHT_WS_URL=ws://your-nodered-server:1880/ws/weight
VITE_BARCODE_WS_URL=ws://your-nodered-server:1880/ws/barcode
VITE_ZPL_PRINTER_URL=http://your-printer-ip:9100
```

### 4. Run Production Server

**Backend:**
```bash
cd server
npm start
```

**Frontend (Serve with nginx, Apache, or Node.js):**

Option A: Using `serve` (Node.js):
```bash
npm install -g serve
cd client
serve -s dist -l 5173
```

Option B: Using nginx or Apache:
- Configure web server to serve `client/dist/` directory
- Set up reverse proxy for `/api` to backend

### 5. Create Windows Service (Optional)

Use `node-windows` or NSSM to run backend as Windows service:

```bash
npm install -g node-windows
```

### 6. Database Migration for Production

```bash
cd server
npm run prisma:migrate:prod
```

---

## Troubleshooting

### Database Connection Issues

**Error:** `Can't connect to MySQL server`

**Solutions:**
1. Verify MySQL is running:
   ```bash
   # Windows (XAMPP)
   # Check XAMPP Control Panel

   # Linux
   sudo systemctl status mysql
   ```

2. Check DATABASE_URL in `server/.env`:
   - Correct username/password
   - Correct host/port
   - Database exists

3. Test connection with MySQL client:
   ```bash
   mysql -u root -p -h localhost
   ```

### WebSocket Connection Issues

**Error:** Frontend shows "DISCONNECTED" or "WAITING FOR DATA"

**Solutions:**
1. Verify Node-RED is running: http://localhost:1880
2. Check WebSocket endpoints in Node-RED are configured correctly
3. Verify `VITE_WEIGHT_WS_URL` and `VITE_BARCODE_WS_URL` in `client/.env`
4. Check browser console for WebSocket errors
5. Ensure no firewall blocking port 1880

### Printer Connection Issues

**Error:** `Could not connect to ZPL printer service`

**Solutions:**
1. Verify printer is powered on and connected
2. Check printer service is running on configured port
3. Test printer endpoint:
   ```bash
   curl -X POST http://localhost:9100 -d "test"
   ```
4. Verify `VITE_ZPL_PRINTER_URL` in `client/.env`
5. Check firewall settings

### CORS Errors

**Error:** `Access to XMLHttpRequest blocked by CORS policy`

**Solutions:**
1. Verify `CORS_ORIGIN` in `server/.env` matches frontend URL
2. For multiple origins, update backend CORS configuration in `server/src/app.ts`
3. Ensure frontend is accessing backend via configured URL

### Port Already in Use

**Error:** `Port 5000 is already in use`

**Solutions:**
1. Change `PORT` in `server/.env` to different port (e.g., 5001)
2. Update `VITE_API_URL` in `client/.env` to match new port
3. Kill process using the port:
   ```bash
   # Windows
   netstat -ano | findstr :5000
   taskkill /PID <PID> /F

   # Linux
   lsof -i :5000
   kill -9 <PID>
   ```

### Web Serial API Not Working

**Error:** Serial port connection fails

**Solutions:**
1. Use Google Chrome or Microsoft Edge (required)
2. Enable Web Serial API in browser flags (if needed):
   - Chrome: `chrome://flags/#enable-experimental-web-platform-features`
3. Grant serial port permissions when prompted
4. Check serial port is not being used by another application

### Authentication Issues

**Error:** `401 Unauthorized`

**Solutions:**
1. Verify JWT_SECRET in `server/.env` is set
2. Clear localStorage in browser (logout and login again)
3. Check token expiration (`JWT_EXPIRES_IN`)
4. Verify user exists in database (use Prisma Studio)

### Build Errors

**Error:** TypeScript compilation errors

**Solutions:**
1. Delete `node_modules` and reinstall:
   ```bash
   rm -rf node_modules
   npm install
   ```
2. Clear TypeScript cache:
   ```bash
   # Backend
   cd server
   rm -rf dist

   # Frontend
   cd client
   rm -rf dist
   ```
3. Regenerate Prisma client:
   ```bash
   cd server
   npm run prisma:generate
   ```

---

## Additional Resources

- **Project Documentation**: See `CLAUDE.md` for detailed architecture
- **Prisma Documentation**: https://www.prisma.io/docs/
- **Node-RED Documentation**: https://nodered.org/docs/
- **Vite Documentation**: https://vitejs.dev/
- **React Documentation**: https://react.dev/

---

## Quick Reference: Common Commands

### Development
```bash
# Start backend (from server/)
npm run dev

# Start frontend (from client/)
npm run dev

# Start Node-RED
node-red

# Open Prisma Studio
cd server && npm run prisma:studio
```

### Database
```bash
# Create migration
cd server && npm run prisma:migrate

# Apply migrations (production)
cd server && npm run prisma:migrate:prod

# Regenerate Prisma client
cd server && npm run prisma:generate
```

### Build
```bash
# Build backend
cd server && npm run build

# Build frontend
cd client && npm run build
```

### Linting
```bash
# Lint backend
cd server && npm run lint

# Lint frontend
cd client && npm run lint
```

---

## Support

For issues or questions, please refer to:
1. This SETUP.md guide
2. CLAUDE.md for architecture details
3. Project issue tracker (if available)
4. Team lead or project maintainer
