# MixSense Client

Frontend application for the MixSense Mixer Batch Reporting Software.

## Tech Stack

- **Framework**: React 18
- **Build Tool**: Vite
- **Language**: TypeScript
- **State Management**: Redux Toolkit
- **Routing**: React Router v6
- **Styling**: TailwindCSS
- **HTTP Client**: Axios
- **Charts**: Recharts
- **QR Generation**: qrcode.react
- **Reporting**: SheetJS (xlsx), jsPDF

## Prerequisites

- Node.js >= 18.x
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

3. Update the `.env` file with your API URL:
```env
VITE_API_URL=http://localhost:5000/api
```

## Development

Start the development server:
```bash
npm run dev
```

The application will start on http://localhost:5173

## Production

Build for production:
```bash
npm run build
```

Preview the production build:
```bash
npm run preview
```

## Project Structure

```
client/
├── src/
│   ├── api/              # API client and service functions
│   │   ├── http.ts       # Axios instance with interceptors
│   │   ├── authApi.ts    # Authentication API calls
│   │   ├── materialsApi.ts
│   │   ├── recipesApi.ts
│   │   ├── batchesApi.ts
│   │   ├── reportsApi.ts
│   │   └── dashboardApi.ts
│   ├── store/            # Redux store and slices
│   │   ├── index.ts      # Store configuration
│   │   ├── authSlice.ts  # Authentication state
│   │   ├── batchSlice.ts # Batch execution state
│   │   └── uiSlice.ts    # UI state (toasts, modals)
│   ├── components/       # React components
│   │   ├── layout/       # Layout components
│   │   ├── common/       # Reusable components
│   │   ├── dashboard/    # Dashboard components
│   │   ├── auth/         # Authentication components
│   │   ├── materials/    # Material management components
│   │   ├── recipes/      # Recipe management components
│   │   ├── batch/        # Batch execution components
│   │   ├── reports/      # Reporting components
│   │   └── qr/           # QR code components
│   ├── hooks/            # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useLoadCell.ts
│   │   └── useQrScanner.ts
│   ├── types/            # TypeScript type definitions
│   │   ├── models.ts     # Data models
│   │   └── api.ts        # API request/response types
│   ├── utils/            # Utility functions
│   ├── styles/           # Global styles
│   │   └── index.css     # Tailwind CSS with custom styles
│   ├── App.tsx           # Main App component with routing
│   └── main.tsx          # Application entry point
├── public/               # Static assets
├── index.html            # HTML template
├── vite.config.ts        # Vite configuration
├── tailwind.config.js    # Tailwind CSS configuration
├── tsconfig.json         # TypeScript configuration
└── package.json          # Project dependencies
```

## Features

### Authentication
- JWT-based authentication
- Role-based access control (Admin/Operator)
- Persistent login with localStorage
- Auto-redirect on token expiration

### Material Management (Admin Only)
- Create, read, update, delete materials
- Support for ingredients and equipment
- Material code validation (unique)
- Search and filter materials

### Recipe Management (Admin Only)
- Create multi-step recipes
- Add/remove/reorder recipe steps
- Define setpoints and tolerances
- Assign equipment to recipes
- Soft delete with recovery option

### Batch Execution (Operator)
- Select recipe and start batch
- Step-by-step guidance
- Real-time load cell integration via Web Serial API
- QR code scanning via HID keyboard
- Tolerance validation with visual indicators
- Batch history logging
- Print batch reports

### Reporting
- Filter batches by date, recipe, operator
- Detailed batch reports with step-by-step data
- Export to Excel (xlsx)
- Export to PDF
- Analytics charts (setpoint vs actual)

### QR Code Generation
- Generate QR codes for materials
- Preview before printing
- Print-ready format

### Dashboard
- Active batch count
- Equipment status monitoring
- Real-time clock
- Quick navigation

## Hardware Integration

### Load Cell (Web Serial API)
The application integrates with load cells using the Web Serial API. This requires:
- Chrome or Edge browser (Web Serial API support)
- HTTPS or localhost
- User permission to access serial port

Usage:
```typescript
import { useLoadCell } from './hooks/useLoadCell';

const { weight, isStable, connect } = useLoadCell();

// Connect to load cell
await connect();

// Access weight data
console.log(weight, isStable);
```

### QR Scanner (HID Keyboard Wedge)
QR scanners configured as HID keyboard devices work automatically. The app listens for keyboard events and buffers characters until Enter is pressed.

Usage:
```typescript
import { useQrScanner } from './hooks/useQrScanner';

useQrScanner((scannedValue) => {
  console.log('QR Code scanned:', scannedValue);
});
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| VITE_API_URL | Backend API URL | http://localhost:5000/api |

## Styling

The application uses TailwindCSS with custom utilities. Key classes:

- `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`
- `.input`, `.input-error`
- `.card`
- `.badge`, `.badge-success`, `.badge-danger`
- `.table`
- `.modal-overlay`, `.modal-content`

## State Management

### Auth State
- `token`: JWT token
- `user`: Current user object
- `isAuthenticated`: Boolean flag

### Batch State
- `activeBatch`: Current batch being executed
- `currentRecipe`: Recipe being followed
- `currentStepIndex`: Current step in recipe
- `loadCellData`: Real-time weight data
- `localHistory`: Logged steps

### UI State
- `toasts`: Notification messages
- `modals`: Modal dialogs
- `loading`: Loading states for async operations

## API Integration

All API calls are made through the centralized HTTP client with automatic:
- Token injection in headers
- Error handling
- Unauthorized redirect
- Request/response logging

Example:
```typescript
import { get, post } from './api/http';

// GET request
const response = await get('/materials');

// POST request
const response = await post('/materials', {
  name: 'Material A',
  code: 'MAT001',
  type: 'INGREDIENT'
});
```

## Browser Support

- Chrome/Edge (recommended for Web Serial API)
- Firefox (limited - no Web Serial API)
- Safari (limited - no Web Serial API)

## Troubleshooting

### Web Serial API Not Working
- Ensure you're using Chrome or Edge
- Must be on HTTPS or localhost
- Check browser console for permissions errors

### API Connection Issues
- Verify `VITE_API_URL` in `.env`
- Check that backend server is running
- Check browser console for CORS errors

### Build Errors
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Clear Vite cache: `rm -rf node_modules/.vite`

## Development Guidelines

### Component Structure
- Use functional components with hooks
- Separate business logic into custom hooks
- Keep components small and focused
- Use TypeScript for type safety

### State Management
- Use Redux for global state
- Use local state (useState) for component-specific state
- Use Redux Toolkit for simplified Redux code

### Styling
- Use Tailwind utility classes
- Create reusable component classes in index.css
- Follow mobile-first responsive design

## Contributing

1. Follow the existing code style
2. Write TypeScript types for all data structures
3. Test with both Admin and Operator roles
4. Ensure responsive design works on tablets
5. Test hardware integration thoroughly

## License

ISC
