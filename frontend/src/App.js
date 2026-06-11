import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./utils/AuthContext";
import { SocketProvider } from "./utils/SocketContext";
import { ToastProvider } from "./utils/ToastContext";
import "./styles/global.css";

import Navbar from "./components/Navbar";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import BrowseTrips from "./pages/BrowseTrips";
import PostTrip from "./pages/PostTrip";
import TripDetail from "./pages/TripDetail";
import MyTrips from "./pages/MyTrips";
import Profile from "./pages/Profile";
import Landing from "./pages/Landing";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ color: "var(--text2)", fontFamily: "var(--font-display)", fontSize: 18 }}>
          Loading TravelShare...
        </div>
      </div>
    );
  }
  return user ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/dashboard" replace /> : children;
}

function AppLayout({ children }) {
  return (
    <>
      <Navbar />
      <main style={{ minHeight: "calc(100vh - 60px)" }}>{children}</main>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
              <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
              <Route path="/dashboard" element={<PrivateRoute><AppLayout><Dashboard /></AppLayout></PrivateRoute>} />
              <Route path="/trips" element={<PrivateRoute><AppLayout><BrowseTrips /></AppLayout></PrivateRoute>} />
              <Route path="/trips/:id" element={<PrivateRoute><AppLayout><TripDetail /></AppLayout></PrivateRoute>} />
              <Route path="/post-trip" element={<PrivateRoute><AppLayout><PostTrip /></AppLayout></PrivateRoute>} />
              <Route path="/my-trips" element={<PrivateRoute><AppLayout><MyTrips /></AppLayout></PrivateRoute>} />
              <Route path="/profile" element={<PrivateRoute><AppLayout><Profile /></AppLayout></PrivateRoute>} />
              <Route path="/admin" element={<PrivateRoute><AppLayout><Admin /></AppLayout></PrivateRoute>} />
              <Route path="/fare-predictor" element={<Navigate to="/post-trip?type=scheduled" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </SocketProvider>
    </AuthProvider>
  );
}
