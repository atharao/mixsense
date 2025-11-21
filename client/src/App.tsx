import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from './store';

// Placeholder components - will be implemented later
const LoginPage = () => <div className="flex items-center justify-center h-screen">
  <div className="text-center">
    <h1 className="text-4xl font-bold text-primary-600 mb-4">MixSense</h1>
    <p className="text-gray-600">Login Page - Coming Soon</p>
  </div>
</div>;

const DashboardPage = () => <div className="p-8">
  <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
  <p>Welcome to MixSense - Mixer Batch Reporting System</p>
</div>;

const MaterialsPage = () => <div className="p-8">
  <h1 className="text-3xl font-bold mb-4">Materials Management</h1>
  <p>Materials Page - Coming Soon</p>
</div>;

const RecipesPage = () => <div className="p-8">
  <h1 className="text-3xl font-bold mb-4">Recipe Management</h1>
  <p>Recipes Page - Coming Soon</p>
</div>;

const RunBatchPage = () => <div className="p-8">
  <h1 className="text-3xl font-bold mb-4">Run Batch</h1>
  <p>Run Batch Page - Coming Soon</p>
</div>;

const ReportsPage = () => <div className="p-8">
  <h1 className="text-3xl font-bold mb-4">Reports</h1>
  <p>Reports Page - Coming Soon</p>
</div>;

const QRGeneratorPage = () => <div className="p-8">
  <h1 className="text-3xl font-bold mb-4">QR Generator</h1>
  <p>QR Generator Page - Coming Soon</p>
</div>;

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Admin Route Component
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/materials"
          element={
            <AdminRoute>
              <MaterialsPage />
            </AdminRoute>
          }
        />

        <Route
          path="/recipes"
          element={
            <AdminRoute>
              <RecipesPage />
            </AdminRoute>
          }
        />

        <Route
          path="/batch"
          element={
            <ProtectedRoute>
              <RunBatchPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <ReportsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/qr-generator"
          element={
            <ProtectedRoute>
              <QRGeneratorPage />
            </ProtectedRoute>
          }
        />

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* 404 page */}
        <Route path="*" element={<div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <h1 className="text-6xl font-bold text-gray-400 mb-4">404</h1>
            <p className="text-xl text-gray-600">Page not found</p>
          </div>
        </div>} />
      </Routes>
    </Router>
  );
}

export default App;
