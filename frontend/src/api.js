import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8000",
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    if (status === 401) {
      // App.js yönetecek, burada sadece flag atanır
      return Promise.reject({ ...error, _unauthorized: true });
    }
    return Promise.reject(error);
  }
);

export default api;
