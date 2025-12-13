import axios from "axios";

const instance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: false,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

// 👉 Interceptor para añadir token
instance.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 👉 Variable para evitar bucles infinitos
let isRefreshing = false;
let hasLoggedOut = false;

// 👉 Interceptor mejorado para capturar errores globales
instance.interceptors.response.use(
  (response) => response,
  (error) => {
    const config = error.config || {};

    // Saltar si está marcado para omitir
    if (config.skipInterceptor) {
      return Promise.reject(error);
    }

    const status = error.response?.status;
    const mensaje = error.response?.data?.message || "";
    const codigo = error.response?.data?.code || "";
    const url = error.config?.url || "";

    // 🆕 NO INTERCEPTAR errores 409 de sesión duplicada en LOGIN
    if (status === 409 && codigo === 'SESSION_DUPLICATED' && url.includes('/login')) {
            return Promise.reject(error);
    }

    // 🆕 NO LIMPIAR TOKEN SI ES SESIÓN DUPLICADA en otras rutas
    if (status === 401 && codigo === 'SESSION_DUPLICATED') {
            return Promise.reject(error); // Dejar que VerificarSesionActiva maneje esto
    }

    const mensajesEspeciales = [
      "Correo no verificado.",
      "Ya tienes un rol asignado."
    ];

    // Si es un mensaje especial, no eliminar token
    if (mensajesEspeciales.includes(mensaje)) {
      return Promise.reject(error);
    }

    // Manejar errores 401/403 de forma más inteligente (SOLO si NO es sesión duplicada)
    if ((status === 401 || status === 403) && !isRefreshing && !hasLoggedOut && codigo !== 'SESSION_DUPLICATED') {
      isRefreshing = true;
      hasLoggedOut = true;
      
            
      // Limpiar token
      localStorage.removeItem("token");
      localStorage.removeItem("reclamando_sesion");
      
      // Opcional: Notificar al usuario
      console.warn("🚫 Sesión expirada. Por favor, inicia sesión nuevamente.");
      
      // Opcional: Redirigir al login después de un breve delay
      setTimeout(() => {
                isRefreshing = false;
      }, 1000);
    }

    const customEvent = new CustomEvent("axiosError", {
      detail: {
        status,
        mensaje,
        codigo,
        url: error.config?.url,
        method: error.config?.method,
      },
    });
    window.dispatchEvent(customEvent);

    return Promise.reject(error);
  }
);

export default instance;