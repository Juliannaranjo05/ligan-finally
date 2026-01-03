import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../../../utils/auth";
import Cookies from "js-cookie";

export default function Logout() {
  const navigate = useNavigate();

  useEffect(() => {
    const cerrarSesion = async () => {
      try {
        await logout(); // Cierra sesión en Laravel
        Cookies.remove("ligand_session", { path: "/" });
        Cookies.remove("XSRF-TOKEN", { path: "/" });
      } catch (error) {
      } finally {
        navigate("/home"); // Redirige siempre
      }
    };

    cerrarSesion();
  }, [navigate]);

  return null;
}

