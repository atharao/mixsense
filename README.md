# MixSense - Mixer Batch Reporting Software

A comprehensive web-based batch reporting system for ingredient-based mixing operations with robust user management, traceability, and analytics.

## 📋 Overview

MixSense is a full-stack application designed to facilitate the creation, execution, and reporting of ingredient-based mixing batches. It provides real-time hardware integration with load cells and QR scanners, ensuring accurate batch tracking and compliance.

## ✨ Key Features

- **User Management**: Role-based access control (Admin/Operator)
- **Material Management**: Track ingredients and equipment
- **Recipe Builder**: Create multi-step recipes with tolerances
- **Batch Execution**: Step-by-step guidance with real-time validation
- **Hardware Integration**: Load cell (Web Serial API) and QR scanner support
- **Reporting & Analytics**: Comprehensive reports with Excel/PDF export
- **Dashboard**: Real-time equipment status and batch monitoring

## 🏗️ Architecture

### Tech Stack

#### Backend
- **Runtime**: Node.js (>= 18.x)
- **Framework**: Express with TypeScript
- **Database**: MySQL (>= 8.0)
- **ORM**: Prisma
- **Authentication**: JWT (HS256) + bcrypt

#### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **State Management**: Redux Toolkit
- **Styling**: TailwindCSS
- **Hardware**: Web Serial API (load cell), HID keyboard (QR scanner)

### Project Structure

```
mixsense/
├── server/               # Backend API
│   ├── src/
│   │   ├── config/       # Configuration
│   │   ├── middleware/   # Express middleware
│   │   ├── modules/      # Feature modules
│   │   ├── types/        # TypeScript types
│   │   └── utils/        # Utilities
│   ├── prisma/           # Database schema & migrations
│   └── scripts/          # Utility scripts
├── client/               # Frontend application
│   ├── src/
│   │   ├── api/          # API clients
│   │   ├── store/        # Redux store
│   │   ├── components/   # React components
│   │   ├── hooks/        # Custom hooks
│   │   ├── types/        # TypeScript types
│   │   └── styles/       # Global styles
│   └── public/           # Static assets
├── PLAN.md               # Detailed implementation plan
└── README.md             # This file
```

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.x
- MySQL >= 8.0
- npm or yarn
- Chrome/Edge browser (for load cell integration)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/mixsense.git
cd mixsense
```

2. **Set up the backend**
```bash
cd server
npm install
cp .env.example .env
# Edit .env with your configuration
```

3. **Set up the database**
```bash
# Create MySQL database
mysql -u root -p -e "CREATE DATABASE mixer_db;"

# Run migrations
npm run prisma:migrate
```

4. **Set up the frontend**
```bash
cd ../client
npm install
cp .env.example .env
# Edit .env with your API URL
```

5. **Start the development servers**

Terminal 1 (Backend):
```bash
cd server
npm run dev
```

Terminal 2 (Frontend):
```bash
cd client
npm run dev
```

6. **Access the application**
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000
- API Health: http://localhost:5000/health

## 📖 Documentation

### Detailed Documentation

- **[Implementation Plan](./PLAN.md)**: Comprehensive architecture and implementation details
- **[Server README](./server/README.md)**: Backend setup and API documentation
- **[Client README](./client/README.md)**: Frontend setup and component documentation

### User Roles

#### Admin
- Full access to all modules
- Manage users, materials, and recipes
- View and export all reports
- Access to analytics and dashboard

#### Operator
- Execute batches following recipes
- View reports
- Generate QR codes
- Access to dashboard

### Core Modules

#### 1. Material Management (Admin)
Create and manage materials (ingredients and equipment) with unique codes.

#### 2. Recipe Management (Admin)
Build multi-step recipes with:
- Ingredient selection
- Setpoint definitions
- Tolerance ranges
- Equipment assignment
- Step ordering

#### 3. Batch Execution (Operator)
Execute batches with:
- Real-time weight monitoring from load cell
- QR code validation
- Tolerance checking (green/red indicators)
- Step-by-step guidance
- Automatic logging

#### 4. Reports & Analytics
- Filter by batch, date range, recipe, operator
- Detailed step-by-step reports
- Export to Excel (xlsx)
- Export to PDF
- Bar charts (setpoint vs actual)

#### 5. Dashboard
- Active batch count
- Equipment status (idle/in-use)
- Real-time clock
- Quick navigation

## 🔧 Hardware Integration

### Load Cell Integration

MixSense integrates with load cells using the **Web Serial API**:

- **Requirements**: Chrome/Edge browser, HTTPS or localhost
- **Connection**: Automatic serial port selection
- **Data**: Real-time weight with stability detection
- **Format**: Configurable based on load cell protocol

### QR Scanner Integration

QR scanners work as **HID keyboard devices**:

- **Mode**: Keyboard wedge mode
- **Format**: `MaterialCode,Setpoint,ActualValue,MaterialName,Equipment`
- **Validation**: Automatic material and step validation
- **Feedback**: Visual indicators for success/error

## 🗄️ Database Schema

Key tables:
- `users`: Authentication and roles
- `materials`: Ingredients and equipment
- `recipes`: Recipe definitions
- `recipe_steps`: Individual recipe steps
- `batches`: Batch execution records
- `batch_logs`: Step-by-step batch logs

See [PLAN.md](./PLAN.md) for detailed schema.

## 🔐 Security

- JWT-based authentication with HS256
- bcrypt password hashing (10 rounds)
- Role-based access control
- SQL injection protection via Prisma
- CORS configuration
- Secure session management

## 🧪 Testing

### Backend Testing
```bash
cd server
npm test
```

### Frontend Testing
```bash
cd client
npm test
```

## 📦 Deployment

### Production Build

1. **Backend**
```bash
cd server
npm run build
npm run prisma:migrate:prod
npm start
```

2. **Frontend**
```bash
cd client
npm run build
# Serve the dist/ folder with nginx or similar
```

### Environment Configuration

**Server (.env)**:
```env
NODE_ENV=production
PORT=5000
DATABASE_URL="mysql://user:pass@localhost:3306/mixer_db"
JWT_SECRET=your-production-secret
JWT_EXPIRES_IN=8h
CORS_ORIGIN=https://yourdomain.com
```

**Client (.env)**:
```env
VITE_API_URL=https://api.yourdomain.com/api
```

### Database Backup

Set up automated daily backups:
```bash
# Edit crontab
crontab -e

# Add backup job (runs daily at midnight)
0 0 * * * /bin/bash /path/to/server/scripts/backup_db.sh
```

## 🛠️ Development

### Code Style

- **Backend**: TypeScript with strict mode
- **Frontend**: React with TypeScript, functional components
- **Styling**: TailwindCSS utility-first approach
- **State**: Redux Toolkit for global state

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes and commit
git add .
git commit -m "feat: description of changes"

# Push to remote
git push origin feature/your-feature-name
```

### Commit Convention

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `style:` Formatting, styling
- `refactor:` Code refactoring
- `test:` Tests
- `chore:` Maintenance

## 📊 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/change-password` - Change password

### Materials (Admin)
- `GET /api/materials` - List materials
- `POST /api/materials` - Create material
- `PUT /api/materials/:id` - Update material
- `DELETE /api/materials/:id` - Delete material

### Recipes (Admin)
- `GET /api/recipes` - List recipes
- `GET /api/recipes/:id` - Get recipe details
- `POST /api/recipes` - Create recipe
- `PUT /api/recipes/:id` - Update recipe
- `DELETE /api/recipes/:id` - Delete recipe

### Batches (Operator)
- `POST /api/batches/start` - Start batch
- `POST /api/batches/log-step` - Log step
- `PUT /api/batches/:id/end` - End batch
- `GET /api/batches/:id` - Get batch details

### Reports
- `GET /api/reports` - List batches with filters
- `GET /api/reports/:batchId` - Get detailed report
- `GET /api/reports/:batchId/export/excel` - Export Excel
- `GET /api/reports/:batchId/export/pdf` - Export PDF

### Dashboard
- `GET /api/dashboard/status` - Get dashboard data

See [Server README](./server/README.md) for complete API documentation.

## 🐛 Troubleshooting

### Common Issues

**Database Connection Error**
```bash
# Check MySQL is running
systemctl status mysql

# Test connection
mysql -u username -p
```

**Port Already in Use**
```bash
# Kill process on port 5000
lsof -ti:5000 | xargs kill -9
```

**Web Serial API Not Working**
- Use Chrome or Edge browser
- Ensure HTTPS or localhost
- Grant serial port permissions

**Build Errors**
```bash
# Clear and reinstall
rm -rf node_modules package-lock.json
npm install
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

ISC

## 👥 Support

For issues and questions:
- Create an issue on GitHub
- Check the documentation in PLAN.md
- Review the module-specific READMEs

## 🎯 Roadmap

### Phase 1 (Current)
- ✅ Project setup and architecture
- ✅ Basic authentication
- ⏳ Material and recipe management
- ⏳ Batch execution
- ⏳ Reporting

### Phase 2 (Future)
- Two-factor authentication (2FA)
- User management UI
- Audit logs
- Email notifications
- Mobile responsive design
- Offline mode with sync

### Phase 3 (Future)
- Advanced analytics dashboard
- Batch scheduling
- Multi-language support
- ERP integration
- Mobile app

## 🙏 Acknowledgments

- Built with modern web technologies
- Inspired by industry best practices
- Designed for manufacturing excellence

---

**Version**: 1.0.0
**Last Updated**: 2025-11-21
**Status**: Development
