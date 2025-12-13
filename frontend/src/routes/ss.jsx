import { useEffect, useState } from "react";
import { useLocation, Navigate, Outlet } from "react-router-dom";
import api from "../api/axios";

export default function RutaProtegida() {
  const [estadoVerificacion, setEstadoVerificacion] = useState(null);
  const [autenticado, setAutenticado] = useState(true);
  const [emailVerificado, setEmailVerificado] = useState(false);
  const [cargando, setCargando] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const verificar = async () => {
      try {
        const userRes = await api.get("/api/profile");
        setEmailVerificado(!!userRes.data.user.email_verified_at);

        const estadoRes = await api.get("/api/verificacion/estado");
        setEstadoVerificacion(estadoRes.data.estado);
      } catch (error) {
        if (error.response?.status === 401) {
          setAutenticado(false);
        } else {
          console.error("❌ Error al verificar estado:", error);
        }
      } finally {
        setCargando(false);
      }
    };

    verificar();
  }, []);

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="text-center">
          <div className="loader mb-4" />
          <p>Cargando...</p>
        </div>
      </div>
    );
  }

  if (!autenticado) return <Navigate to="/home" replace />;

  const rutaActual = location.pathname;

  // 🛑 Si no ha verificado el correo, solo permitir /verificaremail y /home
  if (!emailVerificado && rutaActual !== "/verificaremail" && rutaActual !== "/home") {
    return <Navigate to="/verificaremail" replace />;
  }

  // 🔁 Si ya verificó el correo y está en /verificaremail, redirigir a /verificacion
  if (emailVerificado && rutaActual === "/verificaremail") {
    return <Navigate to="/verificacion" replace />;
  }

  // ⏳ Si verificación está en pendiente, redirigir a /esperando
  if (estadoVerificacion === "pendiente" && rutaActual !== "/esperando") {
    return <Navigate to="/esperando" replace />;
  }

  // ✅ Si está aprobado pero intenta volver atrás
  if (
    estadoVerificacion === "aprobado" &&
    ["/verificacion", "/anteveri", "/esperando"].includes(rutaActual)
  ) {
    return <Navigate to="/homellamadas" replace />;
  }

  // ⛔ Si está sin verificar o rechazada, redirigir a verificación
  if (
    (estadoVerificacion === null || estadoVerificacion === "rechazada") &&
    !["/", "/home", "/verificacion"].includes(rutaActual)
  ) {
    return <Navigate to="/verificacion" replace />;
  }

  return <Outlet />;
}
