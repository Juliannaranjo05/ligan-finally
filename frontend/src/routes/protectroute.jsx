// src/routes/ProtectedRoute.jsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../hooks/useUser"; // supongamos que ahí tienes el user global
import api from "../services/api";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function ProtectedRoute({ children }) {
  const navigate = useNavigate();
  const { user, setUser } = useUser();

  useEffect(() => {
    const checkUser = async () => {
      try {
        const res = await api.get(`${API_BASE_URL}/api/profile`);
        const user = res.data.user;
        setUser(user);

        // Protección para CLIENTES
        if (user.rol === "cliente") {
          if (
            window.location.pathname.includes("/verificacion") ||
            window.location.pathname.includes("/genero") 
          ) {
            navigate("/homecliente");
          }
        }

        // Protección para MODELOS (redirigir al paso que falta)
        if (user.rol === "modelo") {
          const v = res.data.verificacion || {};

          if (!user.rol) {
            navigate("/genero");
          } else if (!user.name) {
            navigate("/genero");
          } else if (!v.selfie || !v.documento || !v.selfie_doc || !v.video) {
            navigate("/verificacion");
          } else {
            // ya verificada y puede ir a home
            if (window.location.pathname === "/") {
              navigate("/homellamadas");
            }
          }
        }
      } catch (err) {
        console.error("Error validando ruta protegida:", err);
        navigate("/login");
      }
    };

    checkUser();
  }, []);

  return children;
}
