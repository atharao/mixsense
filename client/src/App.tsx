import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from './store';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Materials from './pages/Materials';
import Recipes from './pages/Recipes';
import RunBatch from './pages/RunBatch';
import Reports from './pages/Reports';
import QRGenerator from './pages/QRGenerator';

// Login Page Component
const LoginPage = () => <div className="flex items-center justify-center h-screen bg-gray-100">
  <div className="card max-w-md w-full mx-4">
    <h1 className="text-4xl font-bold text-primary-600 mb-2 text-center">MixSense</h1>
    <p className="text-gray-600 text-center mb-6">Mixing Control System</p>
    <div className="bg-warning-50 border border-warning-200 rounded-lg p-4">
      <p className="text-sm text-warning-800">
        <strong>Note:</strong> The full authentication system is implemented in the backend.
        This login page UI will be completed in the next phase with form handling and validation.
      </p>
      <p className="text-sm text-warning-800 mt-2">
        For testing, you can use the backend API directly at <code className="bg-warning-100 px-2 py-1 rounded">POST /api/auth/login</code>
      </p>
    </div>
  </div>
</div>;

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Layout>{children}</Layout>;
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

  return <Layout>{children}</Layout>;
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
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/materials"
          element={
            <AdminRoute>
              <Materials />
            </AdminRoute>
          }
        />

        <Route
          path="/recipes"
          element={
            <ProtectedRoute>
              <Recipes />
            </ProtectedRoute>
          }
        />

        <Route
          path="/batch"
          element={
            <ProtectedRoute>
              <RunBatch />
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <Reports />
            </ProtectedRoute>
          }
        />

        <Route
          path="/qr-generator"
          element={
            <AdminRoute>
              <QRGenerator />
            </AdminRoute>
          }
        />

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* 404 page */}
        <Route path="*" element={<div className="flex items-center justify-center h-screen bg-gray-100">
          <div className="text-center">
            <h1 className="text-6xl font-bold text-gray-400 mb-4">404</h1>
            <p className="text-xl text-gray-600 mb-4">Page not found</p>
            <a href="/dashboard" className="btn-primary">
              Go to Dashboard
            </a>
          </div>
        </div>} />
      </Routes>
    </Router>
  );
}

export default App;
