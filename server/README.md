# MixSense Server

Backend server for the MixSense Mixer Batch Reporting Software.

## Tech Stack

- **Runtime**: Node.js (>= 18.x)
- **Framework**: Express
- **Language**: TypeScript
- **Database**: MySQL (>= 8.0)
- **ORM**: Prisma
- **Authentication**: JWT (HS256)
- **Password Hashing**: bcrypt

## Prerequisites

- Node.js >= 18.x
- MySQL >= 8.0
- npm or yarn

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

3. Update the `.env` file with your configuration:
```env
NODE_ENV=development
PORT=5000
DATABASE_URL="mysql://username:password@localhost:3306/mixer_db"
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=8h
CORS_ORIGIN=http://localhost:5173
LOG_LEVEL=info
```

4. Set up the database:
```bash
# Create the database
mysql -u root -p -e "CREATE DATABASE mixer_db;"

# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate
```

5. (Optional) Seed the database with initial data:
```bash
# Create a seed script or manually create an admin user
# See Prisma documentation for seeding
```

## Development

Start the development server with hot reload:
```bash
npm run dev
```

The server will start on http://localhost:5000

## Production

1. Build the TypeScript code:
```bash
npm run build
```

2. Run migrations:
```bash
npm run prisma:migrate:prod
```

3. Start the production server:
```bash
npm start
```

## Database Management

### Prisma Studio

Open Prisma Studio to view and edit data:
```bash
npm run prisma:studio
```

### Migrations

Create a new migration:
```bash
npm run prisma:migrate
```

Deploy migrations to production:
```bash
npm run prisma:migrate:prod
```

### Backup

Run the backup script manually:
```bash
bash scripts/backup_db.sh
```

Set up automated daily backups with cron:
```bash
# Edit crontab
crontab -e

# Add this line to run daily at midnight
0 0 * * * /bin/bash /path/to/server/scripts/backup_db.sh
```

## API Documentation

### Authentication

#### POST /api/auth/login
Login with username and password.

**Request Body:**
```json
{
  "username": "admin",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "username": "admin",
      "role": "ADMIN"
    }
  }
}
```

#### GET /api/auth/me
Get current user information (requires authentication).

#### POST /api/auth/change-password
Change user password (requires authentication).

#### POST /api/auth/users
Create new user (ADMIN only).

### Materials

All material endpoints require ADMIN role.

#### GET /api/materials
List all materials.

Query parameters:
- `type` (optional): Filter by type (INGREDIENT or EQUIPMENT)

#### GET /api/materials/:id
Get material by ID.

#### POST /api/materials
Create new material.

#### PUT /api/materials/:id
Update material.

#### DELETE /api/materials/:id
Delete material.

### Additional Modules

See the main PLAN.md for complete API documentation on:
- Recipes
- Batches
- Reports
- Dashboard
- QR Utilities

## Project Structure

```
server/
├── src/
│   ├── config/          # Configuration files
│   ├── middleware/      # Express middleware
│   ├── modules/         # Feature modules
│   │   ├── auth/        # Authentication
│   │   ├── materials/   # Materials management
│   │   ├── recipes/     # Recipe management
│   │   ├── batches/     # Batch execution
│   │   ├── reports/     # Reporting
│   │   ├── dashboard/   # Dashboard data
│   │   └── qr/          # QR utilities
│   ├── types/           # TypeScript type definitions
│   ├── utils/           # Utility functions
│   ├── app.ts           # Express app setup
│   └── server.ts        # Server entry point
├── prisma/              # Prisma schema and migrations
├── scripts/             # Utility scripts
├── logs/                # Log files (generated)
└── dist/                # Compiled JavaScript (generated)
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| NODE_ENV | Environment (development/production) | development |
| PORT | Server port | 5000 |
| DATABASE_URL | MySQL connection string | - |
| JWT_SECRET | Secret key for JWT signing | - |
| JWT_EXPIRES_IN | JWT token expiration | 8h |
| CORS_ORIGIN | Allowed CORS origin | http://localhost:5173 |
| LOG_LEVEL | Logging level (error/warn/info/debug) | info |

## Logging

Logs are stored in the `logs/` directory:
- `error.log` - Errors only
- `combined.log` - All logs

In development, logs are also printed to the console with colors.

## Security

- Passwords are hashed using bcrypt with 10 salt rounds
- JWT tokens are signed with HS256 algorithm
- All sensitive routes are protected with authentication middleware
- Role-based access control for admin and operator routes
- SQL injection protection via Prisma parameterized queries
- CORS configured to allow only specified origins

## Troubleshooting

### Database Connection Issues

1. Check that MySQL is running:
```bash
systemctl status mysql
# or
brew services list | grep mysql
```

2. Verify database credentials in `.env`

3. Test connection:
```bash
mysql -u username -p
```

### Migration Issues

Reset database (WARNING: This will delete all data):
```bash
npx prisma migrate reset
```

### Port Already in Use

Change the PORT in `.env` or kill the process using the port:
```bash
lsof -ti:5000 | xargs kill -9
```

## Support

For issues and questions, please refer to the main project documentation or create an issue in the repository.

## License

ISC
