import React, { useEffect, useRef } from "react";
import Swal from "sweetalert2";
import { useNavigate } from "react-router-dom";
import { checkAuthStatus, rechazarNuevaSesion, allowNewSession } from "../../../utils/auth";

const VerificarSesionActiva = () => {
  const yaPreguntado = useRef(false);
  const intervaloRef = useRef(null);
  const popupAbierto = useRef(false);
  const navigate = useNavigate();

  // Función para mostrar popup simple
  const mostrarPopupSesionDuplicada = async (sessionInfo = null) => {
    if (popupAbierto.current || yaPreguntado.current) return;

    yaPreguntado.current = true;
    popupAbierto.current = true;

    // Limpiar intervalo
    if (intervaloRef.current) {
      clearInterval(intervaloRef.current);
      intervaloRef.current = null;
    }

    try {
      const resultado = await Swal.fire({
        title: "¡Alguien entró a tu cuenta!",
        text: "¿Qué deseas hacer?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Mantener mi sesión",
        cancelButtonText: "Permitir acceso",
        allowOutsideClick: false,
        allowEscapeKey: false,
        background: "#0a0d10",
        color: "#ffffff",
        iconColor: "#ff007a",
        confirmButtonColor: "#dc3545", // Rojo para mantener
        cancelButtonColor: "#28a745",  // Verde para permitir
      });

      if (resultado.isConfirmed) {
        // Usuario A mantiene su sesión - expulsa a Usuario B
        await expulsarUsuarioB();
        
      } else {
        // Usuario A permite acceso - se desconecta
        await permitirAcceso();
      }
    } catch (error) {
      resetearEstado();
    }
  };

  // Función para expulsar Usuario B
  const expulsarUsuarioB = async () => {
    try {
      
      const response = await rechazarNuevaSesion();
      
      if (response.access_token) {
        // Usuario A recibe nuevo token
        localStorage.setItem("token", response.access_token);
      }
      
      await Swal.fire({
        title: "¡Usuario expulsado!",
        text: "Has recuperado el control de tu cuenta",
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
        background: "#0a0d10",
        color: "#ffffff",
        iconColor: "#28a745"
      });
      
      resetearEstado();
      setTimeout(() => iniciarVerificacion(), 3000);
      
    } catch (error) {
      resetearEstado();
    }
  };

  // Función para permitir acceso
  const permitirAcceso = async () => {
    try {
      
      await allowNewSession();
      
      await Swal.fire({
        title: "Acceso permitido",
        text: "Serás redirigido al login",
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
        background: "#0a0d10",
        color: "#ffffff",
        iconColor: "#28a745"
      });
      
      // Limpiar y redirigir
      localStorage.removeItem("token");
      resetearEstado();
      
      setTimeout(() => {
        navigate("/home?auth=login", { replace: true });
      }, 2000);
      
    } catch (error) {
      resetearEstado();
    }
  };

  // Función para resetear estado
  const resetearEstado = () => {
    yaPreguntado.current = false;
    popupAbierto.current = false;
    if (intervaloRef.current) {
      clearInterval(intervaloRef.current);
      intervaloRef.current = null;
    }
  };

  // Verificación principal
  const verificar = async () => {
    if (deberíaSaltarVerificacion()) {
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      return;
    }

    try {
      const response = await checkAuthStatus();
      
      if (response.authenticated && response.code === 'SESSION_DUPLICATED') {
        
        setTimeout(() => {
          mostrarPopupSesionDuplicada(response.pending_session_info);
        }, 100);
      }
    } catch (error) {
    }
  };

  // Función para determinar si debe saltar la verificación
  const deberíaSaltarVerificacion = () => {
    const pathname = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);
    const isAuthLogin = pathname === "/home" && searchParams.get("auth") === "login";
    const popupYaMostrado = popupAbierto.current || yaPreguntado.current;

    return isAuthLogin || popupYaMostrado;
  };

  // Función para iniciar verificación
  const iniciarVerificacion = () => {
    
    setTimeout(() => {
      verificar();
    }, 500);
    
    if (!intervaloRef.current) {
      intervaloRef.current = setInterval(verificar, 10000);
    }
  };

  useEffect(() => {
    iniciarVerificacion();

    return () => {
      if (intervaloRef.current) {
        clearInterval(intervaloRef.current);
        intervaloRef.current = null;
      }
    };
  }, [navigate]);

  return null;
};

export default VerificarSesionActiva;