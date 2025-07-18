// api.js
import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8000",
  withCredentials: true,
});

// interceptor kısmı 401 handle koydum uraya da
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/session-expired";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
