// src/routes/UnifiedProtectedRoute.jsx
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import api from "../api/axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function UnifiedProtectedRoute({ children }) {
  const [loading, setLoading] = useState(true);
  const [redirectTo, setRedirectTo] = useState(null);

  useEffect(() => {
    const determineDestination = async () => {
      try {
        const res = await api.get(`${API_BASE_URL}/api/profile`);
        const user = res.data.user;

        console.log("🔍 Usuario obtenido:", user);

        // 📧 PASO 1: Verificación de email
        if (!user?.email_verified_at) {
          console.log("📧 Email no verificado, redirigiendo a /verificaremail");
          setRedirectTo("/verificaremail");
          return;
        }

        // 👤 PASO 2: Verificación de perfil básico
        if (!user.rol || !user.name) {
          console.log("👤 Perfil incompleto, redirigiendo a /genero");
          setRedirectTo("/genero");
          return;
        }

        // 🎯 PASO 3: Redirección por rol
        if (user.rol === "cliente") {
          console.log("👨‍💼 Cliente, redirigiendo a /homecliente");
          setRedirectTo("/homecliente");
          return;
        }

        if (user.rol === "modelo") {
          const estado = user.verificacion?.estado;
          console.log("👩‍🎤 Modelo, estado:", estado);

          switch (estado) {
            case null:
            case undefined:
            case "rechazada":
              setRedirectTo("/anteveri");
              break;
            case "pendiente":
              setRedirectTo("/esperando");
              break;
            case "aprobada":
              setRedirectTo("/homellamadas");
              break;
            default:
              setRedirectTo("/anteveri");
          }
          return;
        }

        // Fallback
        setRedirectTo("/home");

      } catch (error) {
        console.error("❌ Error:", error);
        setRedirectTo("/home");
      } finally {
        setLoading(false);
      }
    };

    determineDestination();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  if (redirectTo) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
}   