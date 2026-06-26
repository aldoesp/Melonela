import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import "./App.css";
import Login from "./components/Login";
import Dashboard from "./pages/Dashboard";
import { trackUserAction } from "./api/authApi";

function hasAuthToken() {
  return Boolean(localStorage.getItem("token"));
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!hasAuthToken()) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AppRoutes() {
  const navigate = useNavigate();

  const handleLoginSuccess = () => {
    navigate("/dashboard", { replace: true });
  };

  const handleLogout = async () => {
    await trackUserAction("LOGOUT", "Session utilisateur");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  };

  useEffect(() => {
    const onUnauthorized = () => {
      navigate("/login", { replace: true });
    };

    window.addEventListener("auth:unauthorized", onUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", onUnauthorized);
  }, [navigate]);

  return (
    <Routes>
      <Route
        path="/login"
        element={
          hasAuthToken() ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <Login onLoginSuccess={handleLoginSuccess} />
          )
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard onLogout={handleLogout} />
          </ProtectedRoute>
        }
      />
      <Route
        path="*"
        element={<Navigate to={hasAuthToken() ? "/dashboard" : "/login"} replace />}
      />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
