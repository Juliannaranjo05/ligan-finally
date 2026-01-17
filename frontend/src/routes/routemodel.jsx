import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import api from "../api/axios";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function RutaProtegidaModelo() {
  const [cargando, setCargando] = useState(true);
  const [user, setUser] = useState(null);
  const location = useLocation();

  useEffect(() => {
    const verificar = async () => {
      try {
        const res = await api.get(`${API_BASE_URL}/api/profile`);
        const usuario = res.data.user;

        if (usuario.rol === "modelo") {
          setUser(usuario);
        }
      } catch {
        setUser(null);
      } finally {
        setCargando(false);
      }
    };

    verificar();
  }, []);

  if (cargando) return <div className="text-white">Cargando...</div>;
  if (!user) return <Navigate to="/home" replace />;

  const pasoFinalCompletado =
    user.rol &&
    user.name &&
    user.verificacion?.estado === "aprobada";

  const estaEnRutasIniciales = ["/verificacion", "/anteveri"].includes(location.pathname);

  // ✅ Ya completó todo → redirigir si está en rutas iniciales
  if (pasoFinalCompletado && estaEnRutasIniciales) {
    return <Navigate to="/homellamadas" replace />;
  }

  // 🚫 No ha enviado nada de verificación
  if (!user.verificacion?.estado) {
    const rutasPermitidas = ["/anteveri", "/verificacion"];
    if (!rutasPermitidas.includes(location.pathname)) {
      return <Navigate to="/anteveri" replace />;
    }
  }

  // ⏳ Está en revisión
  if (user.verificacion?.estado === "pendiente") {
    if (location.pathname !== "/esperando") {
      return <Navigate to="/esperando" replace />;
    }
  }

  return <Outlet />;
}