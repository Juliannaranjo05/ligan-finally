import { useEffect, useRef } from "react";
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

    console.log("🔥 Mostrando popup simple a Usuario A");

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
        console.log("✅ Usuario A eligió mantener su sesión");
        await expulsarUsuarioB();
        
      } else {
        // Usuario A permite acceso - se desconecta
        console.log("🔄 Usuario A eligió permitir acceso");
        await permitirAcceso();
      }
    } catch (error) {
      console.error("❌ Error al mostrar popup:", error);
      resetearEstado();
    }
  };

  // Función para expulsar Usuario B
  const expulsarUsuarioB = async () => {
    try {
      console.log("🔄 Expulsando Usuario B...");
      
      const response = await rechazarNuevaSesion();
      
      if (response.access_token) {
        // Usuario A recibe nuevo token
        localStorage.setItem("token", response.access_token);
        console.log("✅ Nuevo token recibido para Usuario A");
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
      console.error("❌ Error expulsando usuario:", error);
      resetearEstado();
    }
  };

  // Función para permitir acceso
  const permitirAcceso = async () => {
    try {
      console.log("🔄 Permitiendo acceso...");
      
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
      console.error("❌ Error permitiendo acceso:", error);
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
        console.log("🔥 DETECTADA SESIÓN DUPLICADA - Mostrando popup");
        
        setTimeout(() => {
          mostrarPopupSesionDuplicada(response.pending_session_info);
        }, 100);
      }
    } catch (error) {
      console.log("❌ ERROR en verificar:", error);
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
    console.log("🚀 Iniciando verificación de sesión");
    
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