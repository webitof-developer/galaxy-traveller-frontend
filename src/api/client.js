import axios from "axios";

const client = axios.create({
  baseURL:
    `${process.env.NEXT_PUBLIC_BASE_API}/api` || "http://localhost:8080/api",
  timeout: 10000,
});

/**
 * ✅ AUTO ATTACH TOKEN IF PRESENT
 */
client.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default client;

export const Base_Url =
  `${process.env.NEXT_PUBLIC_BASE_API}` || "http://localhost:8080";

/**
 * Optional manual setters (still useful)
 */
export const setToken = (token) => {
  localStorage.setItem("token", token);
  client.defaults.headers.common["Authorization"] = `Bearer ${token}`;
};

export const removeToken = () => {
  localStorage.removeItem("token");
  delete client.defaults.headers.common["Authorization"];
};

export const get = (path, config = {}) => client.get(path, config);
export const patch = (path, data) => client.patch(path, data);
export const post = (path, data) => client.post(path, data);
export const put = (path, data) => client.put(path, data);
export const del = (path) => client.delete(path);

export const upload = (path, data) =>
  client.post(path, data, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const download = (path) => client.get(path, { responseType: "blob" });

export const downloadFile = (path) =>
  client.get(path, { responseType: "blob" });

export const downloadImage = (path) =>
  client.get(path, { responseType: "blob" });
