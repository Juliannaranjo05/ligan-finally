import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import axios from "../api/axios"; // asegúrate de que apunta a tu instancia personalizada

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const RutaSoloVisitantes = () => {
  const [redirect, setRedirect] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verificarUsuario = async () => {
      try {
        const { data } = await axios.get(`${API_BASE_URL}/api/profile`); // ✔️ uso correcto de template string
        const rol = data?.user?.rol;

        if (rol === "cliente") {
          setRedirect("/homecliente");
        } else if (rol === "modelo" && data?.user?.verificacion.estado === "pendiente") {
          setRedirect("/esperando");
        }else if (rol === "modelo" && data?.user?.verificacion.estado === "aprobada") {
          setRedirect("/homellamadas");
        } else if (rol === "modelo" && data?.user?.verificacion.estado === "null") {
            setRedirect("/anteveri");
        }else {
          setRedirect("/"); // por si el rol no es válido
        }
      } catch (error) {
        // Si no está autenticado, se queda como visitante
        setRedirect(null);
      } finally {
        setLoading(false);
      }
    };

    verificarUsuario();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: "white" }}>
        Cargando...
      </div>
    );
  }

  return redirect ? <Navigate to={redirect} replace /> : <Outlet />;
};

export default RutaSoloVisitantes;
