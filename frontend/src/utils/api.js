import axios from "axios";

const API = axios.create({ baseURL: process.env.REACT_APP_API_URL || "http://localhost:5000/api" });

// Attach JWT automatically
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("ts_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auth
export const registerUser  = (data)   => API.post("/auth/register", data);
export const loginUser     = (data)   => API.post("/auth/login", data);
export const refreshSession = (refreshToken) => API.post("/auth/refresh", { refreshToken });
export const forgotPassword = (email) => API.post("/auth/forgot-password", { email });
export const resetPassword = (token, password) => API.post(`/auth/reset-password/${token}`, { password });
export const socialLogin = (provider) => API.post("/auth/social-login", { provider });
export const getMe         = ()       => API.get("/auth/me");
export const updateProfile = (data)   => API.put("/auth/profile", data);

// Trips
export const createTrip     = (data)  => API.post("/trips", data);
export const getTrips        = (params)=> API.get("/trips", { params });
export const getTripById     = (id)   => API.get(`/trips/${id}`);
export const updateTrip      = (id, data) => API.put(`/trips/${id}`, data);
export const deleteTrip      = (id)   => API.delete(`/trips/${id}`);
export const favoriteTrip     = (id)   => API.post(`/trips/${id}/favorite`);
export const unfavoriteTrip   = (id)   => API.delete(`/trips/${id}/favorite`);
export const getSavedTrips    = ()     => API.get("/trips/user/saved");
export const addTripComment   = (id, text) => API.post(`/trips/${id}/comments`, { text });
export const addTripReview    = (id, data) => API.post(`/trips/${id}/reviews`, data);
export const findMatches     = (data) => API.post("/trips/matches", data);
export const joinTrip        = (id)   => API.post(`/trips/${id}/join`);
export const cancelTrip      = (id, reason) => API.post(`/trips/${id}/cancel`, { reason });
export const managePassenger = (tripId, userId, action) =>
  API.put(`/trips/${tripId}/passenger/${userId}`, { action });
export const getFareSplit    = (id)   => API.get(`/trips/${id}/fare-split`);
export const getMyTrips      = ()     => API.get("/trips/user/my");

// Chat
export const getMessages    = (tripId) => API.get(`/chat/${tripId}`);
export const sendMessage    = (tripId, text) => API.post(`/chat/${tripId}`, { text });

export const getNotifications = () => API.get("/notifications");
export const markNotificationRead = (id) => API.put(`/notifications/${id}/read`);
export const markAllNotificationsRead = () => API.put("/notifications/read-all");
export const deleteNotification = (id) => API.delete(`/notifications/${id}`);
export const deleteAllNotifications = () => API.delete("/notifications");

export const getHealth = () => API.get("/health");
export const getAdminSummary = () => API.get("/admin/summary");
export const getAdminReports = () => API.get("/admin/reports");
export const updateAdminReport = (id, data) => API.put(`/admin/reports/${id}`, data);

// Smart matching extras
export const getPickupOptimization = (tripId) => API.get(`/trips/${tripId}/optimize-pickups`);
