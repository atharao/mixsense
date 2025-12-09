# MixSense Quick Start Guide

This guide will get you up and running with MixSense in the shortest time possible.

## Prerequisites

- Node.js v18+ installed
- MySQL installed and running
- Chrome or Edge browser

## Quick Setup (5 Steps)

### 1. Install Dependencies
```bash
# Root
npm install

# Backend
cd server
npm install

# Frontend
cd ../client
npm install
cd ..
```

### 2. Configure Environment Files
```bash
# Backend
cd server
copy .env.example .env
# Edit .env: Update DATABASE_URL with your MySQL credentials

# Frontend
cd ../client
copy .env.example .env
# Default values work for localhost setup
cd ..
```

### 3. Setup Database
```bash
# Create database
CREATE DATABASE mixer_db;

# Run migrations
cd server
npm run prisma:migrate
```

### 4. Import Node-RED Flow
```bash
# Install Node-RED globally
npm install -g node-red

# Start Node-RED
node-red
```

Then:
1. Open http://localhost:1880
2. Click menu (☰) → Import
3. Select file: `node-red/flows.json`
4. Click Import → Deploy

**The flow includes test data generators - you can test immediately without hardware!**

### 5. Start the Application
```bash
# Terminal 1: Backend
cd server
npm run dev

# Terminal 2: Frontend
cd client
npm run dev
```

Open Chrome/Edge: http://localhost:5173

## Testing Without Hardware

The imported Node-RED flow includes fake data generators:

- **Weight Data**: Automatically sent every 1 second (20-50 kg)
- **Barcode Data**: Click inject button in Node-RED to test

You can test the entire application flow without connecting any hardware!

## What's Next?

- **Full Setup Guide**: See `SETUP.md` for detailed instructions
- **Architecture Details**: See `CLAUDE.md` for development information
- **Node-RED Configuration**: See `node-red/README.md` for hardware integration

## Default Environment Configuration

### Backend (server/.env)
```env
NODE_ENV=development
PORT=5000
DATABASE_URL="mysql://root:your_password@localhost:3306/mixer_db"
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=8h
CORS_ORIGIN=http://localhost:5173
LOG_LEVEL=info
```

### Frontend (client/.env)
```env
VITE_API_URL=http://localhost:5000/api
VITE_WEIGHT_WS_URL=ws://localhost:1880/ws/weight
VITE_BARCODE_WS_URL=ws://localhost:1880/ws/barcode
VITE_ZPL_PRINTER_URL=http://localhost:9100
VITE_PROXY_API_TARGET=http://localhost:5000
VITE_PROXY_ZPL_TARGET=http://localhost:9100
```

## Network Setup (Multiple PCs)

If running on different PCs:

1. Replace `localhost` with actual IP addresses in `.env` files
2. Ensure all PCs are on the same network
3. Configure firewalls to allow required ports (5000, 1880, 9100)

Example for 3-PC setup:
- **PC1 (Backend)**: 192.168.1.100
- **PC2 (Frontend + Node-RED)**: 192.168.1.101
- **PC3 (Printer)**: 192.168.1.102

Update `client/.env`:
```env
VITE_API_URL=http://192.168.1.100:5000/api
VITE_WEIGHT_WS_URL=ws://192.168.1.101:1880/ws/weight
VITE_BARCODE_WS_URL=ws://192.168.1.101:1880/ws/barcode
VITE_ZPL_PRINTER_URL=http://192.168.1.102:9100
```

## Troubleshooting

### Database Connection Failed
- Verify MySQL is running
- Check DATABASE_URL credentials in `server/.env`
- Ensure database `mixer_db` exists

### WebSocket Shows "DISCONNECTED"
- Verify Node-RED is running: http://localhost:1880
- Check Node-RED flow is imported and deployed
- Enable debug nodes in Node-RED to monitor data

### CORS Errors
- Verify CORS_ORIGIN in `server/.env` matches frontend URL
- Default: `http://localhost:5173`

### Port Already in Use
- Change PORT in `server/.env`
- Update VITE_API_URL in `client/.env` accordingly

## Common Commands

```bash
# Start backend dev server
cd server && npm run dev

# Start frontend dev server
cd client && npm run dev

# Start Node-RED
node-red

# Database migrations
cd server && npm run prisma:migrate

# View database
cd server && npm run prisma:studio

# Build for production
cd server && npm run build
cd client && npm run build
```

## Need More Help?

- **Detailed Setup**: `SETUP.md`
- **Architecture Guide**: `CLAUDE.md`
- **Node-RED Integration**: `node-red/README.md`
