import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import api from "../api/axios";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function RutaEmailVerificado() {
  const [cargando, setCargando] = useState(true);
  const [autenticado, setAutenticado] = useState(false);
  const [emailVerificado, setEmailVerificado] = useState(false);
  const [completoPerfil, setCompletoPerfil] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const verificar = async () => {
      try {
        const res = await api.get(`${API_BASE_URL}/api/profile`);
        const user = res.data.user;

        setAutenticado(true);
        setEmailVerificado(!!user.email_verified_at);
        setCompletoPerfil(!!user.name && !!user.rol);

        // 🔁 Si venimos de un cambio de nombre/rol, recarga una vez
        if (localStorage.getItem("perfil_actualizado") === "1") {
          localStorage.removeItem("perfil_actualizado");
          window.location.reload();
        }
      } catch {
        setAutenticado(false);
      } finally {
        setCargando(false);
      }
    };

    verificar();
  }, []);

  if (cargando) return <div className="text-white">Cargando...</div>;
  if (!autenticado) return <Navigate to="/home" replace />;
  if (!emailVerificado) return <Navigate to="/verificaremail" replace />;

  const rutaActual = location.pathname;

  if (!completoPerfil && !["/genero", "/home"].includes(rutaActual)) {
    return <Navigate to="/genero" replace />;
  }

  return <Outlet />;
}
