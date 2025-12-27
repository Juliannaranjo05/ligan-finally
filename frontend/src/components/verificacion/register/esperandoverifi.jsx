import React, { useEffect, useState, useRef } from "react";
import { Lock, CheckCircle, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Header from "../../modelo/header";
import api from "../../../api/axios";
import { ProtectedPage } from '../../hooks/usePageAccess';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function EsperandoVerificacion() {
  const [estadoVerificacion, setEstadoVerificacion] = useState("pendiente");
  const [mensaje, setMensaje] = useState("");
  const [redirigiendo, setRedirigiendo] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  
  const navigate = useNavigate();
  const intervalRef = useRef(null);
  const isCheckingRef = useRef(false);
  
  const { t } = useTranslation();

  const verificarEstado = async () => {
    if (isCheckingRef.current || redirigiendo || rateLimited) return;
    
    isCheckingRef.current = true;

    try {
      const response = await api.get(`${API_BASE_URL}/api/verificacion/estado`);
      const { estado, mensaje: mensajeApi } = response.data;
      
      
      setEstadoVerificacion(estado);
      setMensaje(mensajeApi || "");
      setRateLimited(false);

      if (estado === "aprobada") {
        setRedirigiendo(true);
        
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        
        setTimeout(() => {
          navigate("/dashboard");
        }, 2000);
        
      } else if (estado === "rechazada") {
        setRedirigiendo(true);
        
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        
        setTimeout(() => {
          navigate("/verificacion-identidad");
        }, 3000);
      }
      
    } catch (error) {
      
      if (error.response?.status === 429) {
        setRateLimited(true);
        
        setTimeout(() => {
          setRateLimited(false);
        }, 120000);
      } else {
        setMensaje(t('anteveri.common.error_message'));
      }
    } finally {
      isCheckingRef.current = false;
    }
  };

  useEffect(() => {
    let mounted = true;

    const inicializar = async () => {
      if (!mounted) return;
      
      
      setTimeout(() => {
        if (mounted && !redirigiendo) {
          verificarEstado();
        }
      }, 1000);

      intervalRef.current = setInterval(() => {
        if (mounted && !redirigiendo && !rateLimited) {
          verificarEstado();
        }
      }, 10000);
    };

    inicializar();

    return () => {
      mounted = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (redirigiendo && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [redirigiendo]);

  const getIconoEstado = () => {
    const iconSize = window.innerWidth < 768 ? 40 : 48;
    switch (estadoVerificacion) {
      case "aprobada":
        return <CheckCircle size={iconSize} color="#10b981" strokeWidth={2.2} />;
      case "rechazada":
        return <XCircle size={iconSize} color="#ef4444" strokeWidth={2.2} />;
      default:
        return <Lock size={iconSize} color="#ffffff" strokeWidth={2.2} />;
    }
  };

  const getTituloEstado = () => {
    switch (estadoVerificacion) {
      case "aprobada":
        return t('anteveri.approved.title');
      case "rechazada":
        return t('anteveri.rejected.title');
      default:
        return t('anteveri.waiting.title');
    }
  };

  const getMensajeEstado = () => {
    switch (estadoVerificacion) {
      case "aprobada":
        return mensaje || t('anteveri.approved.default_message');
      case "rechazada":
        return mensaje || t('anteveri.rejected.default_message');
      default:
        return t('anteveri.waiting.message');
    }
  };

  const getColorTitulo = () => {
    switch (estadoVerificacion) {
      case "aprobada":
        return "text-green-400";
      case "rechazada":
        return "text-red-400";
      default:
        return "text-white";
    }
  };

  const getColorBoton = () => {
    switch (estadoVerificacion) {
      case "aprobada":
        return "bg-green-600";
      case "rechazada":
        return "bg-red-600";
      default:
        return "bg-[#ff007a]";
    }
  };

  const getTextoBoton = () => {
    switch (estadoVerificacion) {
      case "aprobada":
        return redirigiendo ? t('anteveri.approved.button_redirecting') : t('anteveri.approved.button');
      case "rechazada":
        return redirigiendo ? t('anteveri.rejected.button_redirecting') : t('anteveri.rejected.button');
      default:
        return t('anteveri.waiting.button');
    }
  };

  const handleBotonClick = () => {
    if (estadoVerificacion === "rechazada" && !redirigiendo) {
      setRedirigiendo(true);
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      navigate("/verificacion-identidad");
    }
  };

  window.debugVerificacion = () => {
    return {
      estadoVerificacion,
      redirigiendo,
      rateLimited,
      intervalActive: !!intervalRef.current,
      isChecking: isCheckingRef.current
    };
  };

  return (
    <>
      {/* Estilos CSS responsive */}
      <style jsx>{`
        .titulo-responsive {
          font-size: clamp(3.5rem, 10vw, 6rem);
          line-height: 1.1;
        }
        
        .subtitulo-responsive {
          font-size: clamp(2rem, 6vw, 3rem);
          line-height: 1.2;
        }
        
        .mensaje-responsive {
          font-size: clamp(1rem, 3.5vw, 1.125rem);
          line-height: 1.5;
        }
        
        .boton-responsive {
          font-size: clamp(1rem, 3.5vw, 1.125rem);
          padding: clamp(0.75rem, 2.5vw, 1rem) clamp(1.5rem, 5vw, 2rem);
        }
        
        @media (max-width: 640px) {
          .contenedor-principal {
            padding: 1rem 0.75rem;
            transform: translateY(-10%); /* FUERZA ADICIONAL */
          }
        }
        
        @media (min-width: 641px) {
          .contenedor-principal {
            transform: translateY(-8%); /* FUERZA ADICIONAL DESKTOP */
          }
        }
        
        .icono-container {
          padding: clamp(0.5rem, 2vw, 1rem);
        }
      `}</style>

      <ProtectedPage requiredConditions={{
        emailVerified: true,
        profileComplete: true,
        role: "modelo",
        verificationStatus: "pendiente",
        blockIfInCall: true
      }}>
        <div className="min-h-screen bg-ligand-mix-dark flex flex-col">
          
          {/* Header fijo arriba */}
        <div className="relative z-[9999]">
          <Header />
        </div>

          {/* Contenido centrado - FORZADO A SUBIR */}
          <div className="flex flex-col items-center justify-center flex-1 contenedor-principal text-center mt-[2%]">
            
            {/* Título Ligand - un poco más pequeño */}
            <div className="mb-4 sm:mb-6">
              <h1 className="font-pacifico text-fucsia titulo-responsive bg-backgroundDark rounded-lg px-3 py-2">
                {t('anteveri.title')}
              </h1>
            </div>

            {/* Subtítulo dinámico */}
            <h2 className={`subtitulo-responsive font-semibold mb-4 sm:mb-5 ${getColorTitulo()}`}>
              {getTituloEstado()}
            </h2>

            {/* Icono dinámico */}
            <div className="icono-container rounded-full mb-5 sm:mb-7">
              {getIconoEstado()}
            </div>

            {/* Mensaje dinámico */}
            <div className="max-w-md sm:max-w-lg md:max-w-xl mb-5 sm:mb-7">
              <p className="text-white/70 mensaje-responsive leading-relaxed whitespace-pre-line px-3">
                {getMensajeEstado()}
              </p>
            </div>

            {/* Indicador de estado en tiempo real */}
            {!redirigiendo && (
              <div className="mb-4 sm:mb-5">
                <div className="flex items-center justify-center gap-2 text-white/50 text-sm">
                  <div className={`w-2 h-2 rounded-full ${rateLimited ? 'bg-yellow-500' : 'bg-[#ff007a] animate-pulse'}`}></div>
                  <span className="text-center">
                    {rateLimited ? t('anteveri.waiting.waiting_to_check') : t('anteveri.waiting.checking')}
                  </span>
                </div>
              </div>
            )}

            {/* Botón dinámico - responsive */}
            <button
              onClick={handleBotonClick}
              disabled={estadoVerificacion === "pendiente" || estadoVerificacion === "aprobada" || redirigiendo}
              className={`${getColorBoton()} text-white font-semibold boton-responsive rounded-full ${
                estadoVerificacion === "pendiente" || estadoVerificacion === "aprobada" || redirigiendo
                  ? "opacity-95 cursor-not-allowed" 
                  : "hover:opacity-90 cursor-pointer transform hover:scale-105"
              } transition-all duration-300 mb-2 sm:mb-3`}
            >
              {getTextoBoton()}
            </button>

            {/* Mensajes adicionales - más compactos */}
            {estadoVerificacion === "rechazada" && !redirigiendo && (
              <p className="text-red-400 text-xs sm:text-sm max-w-xs sm:max-w-sm text-center px-2">
                {t('anteveri.rejected.redirect_message')}
              </p>
            )}

            {estadoVerificacion === "aprobada" && !redirigiendo && (
              <p className="text-green-400 text-xs sm:text-sm max-w-xs sm:max-w-sm text-center px-2">
                {t('anteveri.approved.redirect_message')}
              </p>
            )}

            {/* Indicador de redirección - compacto */}
            {redirigiendo && (
              <p className="text-blue-400 text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2">
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-400 rounded-full animate-pulse"></div>
                {t('anteveri.common.redirecting')}
              </p>
            )}
          </div>
        </div>
      </ProtectedPage>
    </>
  );
}