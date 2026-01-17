import { useEffect, useState } from "react";
import { useLocation, Navigate, Outlet } from "react-router-dom";
import api from "../api/axios";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function RutaProtegida() {
  const [user, setUser] = useState(null);
  const [cargando, setCargando] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const cargar = async () => {
      try {
        const res = await api.get(`${API_BASE_URL}/api/profile`);
        setUser(res.data.user);

        // 🔁 Si el perfil fue actualizado, forzar recarga una sola vez
        if (localStorage.getItem("perfil_actualizado") === "1") {
          localStorage.removeItem("perfil_actualizado");
          window.location.reload();
        }
      } catch (error) {
        const status = error.response?.status;

        if (status === 403) {
          setUser({ email_verified_at: null, rol: null, name: null });
        } else if (status === 401) {
          setUser(null);
        } else {
          console.error("❌ Error inesperado en /profile:", error);
          setUser(null);
        }
      } finally {
        setCargando(false);
      }
    };

    cargar();
  }, []);

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        Cargando...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/home" replace />;
  }

  const ruta = location.pathname;
  const tieneRolYNombre = !!user.rol && !!user.name;

  if (!tieneRolYNombre && ruta !== "/genero") {
    return <Navigate to="/genero" replace />;
  }

  if (tieneRolYNombre && ["/verificaremail", "/genero"].includes(ruta)) {
    return <Navigate to="/verificacion" replace />;
  }

  return <Outlet />;
}
