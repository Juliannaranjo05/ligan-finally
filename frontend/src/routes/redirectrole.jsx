import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function RedirectSegunRol() {
  const navigate = useNavigate();

  useEffect(() => {
    const check = async () => {
      try {
        const res = await api.get(`${API_BASE_URL}/api/profile`);
        const user = res.data.user;
        const verificada = res.data.autorizado;

        if (user.rol === "model") {
          if (!verificada) {
            navigate("/verificacion");
          } else {
            navigate("/esperando"); // o el dashboard de la modelo
          }
        } else if (user.rol === "cliente") {
          navigate("/homecliente");
        } else {
          navigate("/home");
        }
      } catch (err) {
        navigate("/home");
      }
    };

    check();
  }, [navigate]);

  return null;
}
