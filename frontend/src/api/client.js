import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
});

export const SOCKET_URL = API_URL;

export default api;
