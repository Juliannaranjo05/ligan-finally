import React, { useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import api from "../../../api/axios";
import logoproncipal from "../../imagenes/logoprincipal.png";
import { verificarCodigo, reenviarCodigo } from "../../../utils/auth";
import { RegistrationProtectedPage } from '../../hooks/useRegistrationAccess'; // 🔄 Cambio de hook

const RECAPTCHA_SITE_KEY = "6LfNonwrAAAAAIgJSmx1LpsprNhNct1VVWMWp2rz";

export default function EmailVerification() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email;

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [message, setMessage] = useState("");
  const [resending, setResending] = useState(false);
  const [verifying, setVerifying] = useState(false); // 🆕 Estado para verificación
  const inputsRef = useRef([]);

  // ✅ Asegurar que el token esté configurado cuando el componente se monta
  React.useEffect(() => {
    const token = localStorage.getItem("token");
    const justRegistered = localStorage.getItem("just_registered");
    
    if (token) {
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      console.log('✅ Token encontrado y configurado en verificarcodigo');
    } else {
      console.warn('⚠️ No se encontró token en localStorage en verificarcodigo');
      // No mostrar error - permitir verificar el código sin token
      // El código se puede verificar sin autenticación según la API
    }
  }, [navigate]);

  const handleSalir = async () => {
    try {
      // 🔴 Llama al backend para borrar el usuario si no está verificado
      await axios.delete("/api/eliminar-no-verificado", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      // 🔐 Limpia el token y redirige
      localStorage.removeItem("token");
      navigate("/home");
    } catch (error) {
      setMessage("No se pudo cerrar sesión correctamente.");
    }
  };

  const handleChange = (value, index) => {
    if (/^[0-9]?$/.test(value)) {
      const newCode = [...code];
      newCode[index] = value;
      setCode(newCode);
      if (value && index < 5) {
        inputsRef.current[index + 1].focus();
      }
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === "Backspace") {
      if (code[index]) {
        const newCode = [...code];
        newCode[index] = "";
        setCode(newCode);
      } else if (index > 0) {
        inputsRef.current[index - 1].focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputsRef.current[index - 1].focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      inputsRef.current[index + 1].focus();
    }
  };

  const handleVerify = async () => {
    const fullCode = code.join("");
    if (fullCode.length !== 6) {
      setMessage("Por favor ingresa los 6 dígitos.");
      return;
    }

    if (!email) {
      setMessage("No se encontró el correo registrado.");
      return;
    }

    try {
      setVerifying(true); // 🔄 Activar estado de verificación
      setMessage("Verificando...");
      
      // 📧 Verificar el código (no requiere token según la API)
      await verificarCodigo(email, fullCode);
      
      // ✅ Después de verificar, verificar si tenemos token
      let token = localStorage.getItem('token');
      
      // ✅ Si no hay token pero acabamos de verificar el email, guardar email para que puedan hacer login
      if (!token) {
        // Guardar el email verificado para que puedan hacer login después
        localStorage.setItem('email_verified_waiting_login', email);
        setMessage("✅ ¡Tu cuenta ha sido verificada exitosamente! Ya puedes iniciar sesión con tu correo y contraseña. Redirigiendo...");
        
        setTimeout(() => {
          localStorage.removeItem("just_registered");
          localStorage.setItem('email_just_verified', 'true');
          // Redirigir a login con el email prellenado
          navigate(`/home?auth=login&email=${encodeURIComponent(email)}`, { replace: true });
        }, 3000); // Aumentar tiempo para que el usuario lea el mensaje
        return;
      }
      
      // ✅ Asegurar que axios tenga el token configurado
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      
      // 🏃‍♂️ BANDERA TEMPORAL para evitar que el hook intercepte
      localStorage.setItem('email_just_verified', 'true');
      
      // ✅ Usar navigate en lugar de window.location.href para preservar la sesión
      navigate('/genero', { replace: true });
      
    } catch (error) {
      setVerifying(false);
      if (error.response?.status === 422) {
        setMessage("❌ Código incorrecto o expirado.");
      } else {
        setMessage("❌ Error al verificar el código.");
      }
    }
  };

  const handleResend = async () => {
    try {
      setResending(true);
      setMessage("Reenviando código...");
      await reenviarCodigo(email);
      setMessage("📧 Código reenviado al correo.");
    } catch (error) {
      setTimeout(() => {
        navigate("/home");
      }, 3000);
      setMessage("❌ Vuelve a intentarlo dentro de 10 minutos.");
    } finally {
      setResending(false);
    }
  };

  return (
    <RegistrationProtectedPage>
      <div className="min-h-screen bg-gradient-to-b from-[#0a0d10] to-[#131418] text-white flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-[#1f2228] p-6 sm:p-8 rounded-2xl shadow-xl">
          {/* Logo + Nombre */}
          <div className="flex items-center justify-center mb-6">
            <img src={logoproncipal} alt="Logo" className="w-14 h-14 mr-[-5px]" />
            <span className="text-2xl text-fucsia font-pacifico">Ligand</span>
          </div>

          <h1 className="text-2xl font-bold text-fucsia mb-4 text-center">
            Verificación de correo
          </h1>
          <p className="text-gray-300 mb-6 text-center text-sm">
            Ingresa el código que te enviamos a tu correo electrónico.
          </p>

          <div className="flex justify-center gap-2 mb-6">
            {code.map((digit, index) => (
              <input
                key={index}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(e.target.value, index)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                ref={(el) => (inputsRef.current[index] = el)}
                disabled={verifying} // 🔒 Deshabilitar durante verificación
                className="w-10 h-12 text-center text-xl bg-[#0a0d10] border border-gray-500 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-fucsia disabled:opacity-50"
              />
            ))}
          </div>

          {/* reCAPTCHA */}
          {/*<div className="mb-4 flex justify-center">
            <ReCAPTCHA
              sitekey={RECAPTCHA_SITE_KEY}
              onChange={(token) => setCaptchaToken(token)}
            />
          </div>*/}

          <button
            onClick={handleVerify}
            disabled={verifying}
            className="bg-fucsia hover:bg-pink-600 transition-colors text-white font-semibold px-6 py-2 rounded-2xl mb-4 w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {verifying ? (
              <>
                <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                Verificando...
              </>
            ) : (
              "Verificar código"
            )}
          </button>

          <button
            onClick={handleResend}
            disabled={resending || verifying}
            className="text-sm text-fucsia hover:underline disabled:opacity-50 w-full text-center"
          >
            {resending ? "Reenviando..." : "¿No recibiste el código? Reenviar"}
          </button>

          <button
            onClick={handleSalir}
            disabled={verifying}
            className="mt-6 text-sm text-red-400 hover:underline w-full text-center disabled:opacity-50"
          >
            Salir sin verificar
          </button>

          {message && (
            <p className={`mt-4 text-sm text-center ${
              message.includes('✅') ? 'text-green-400' : 
              message.includes('❌') ? 'text-red-400' : 
              'text-gray-300'
            }`}>
              {message}
            </p>
          )}
        </div>
      </div>
    </RegistrationProtectedPage>
  );
}