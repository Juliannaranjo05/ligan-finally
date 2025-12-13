import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../../api/axios";
import { User, Heart, X } from "lucide-react";
import logoproncipal from "../../imagenes/logoprincipal.png";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
import { ProtectedPage } from '../../hooks/usePageAccess';
import { useTranslation } from 'react-i18next'; // ✅ AGREGAR

export default function SeleccionGenero() {
  const [genero, setGenero] = useState("");
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [nombre, setNombre] = useState("");
  const [nombreError, setNombreError] = useState("");
  const navigate = useNavigate();
  const { t } = useTranslation(); // ✅ AGREGAR

  const handleContinue = async (e) => {
    e.preventDefault();

    if (!genero) {
      setError(t('seleccion_genero.error_seleccionar')); // ✅ USAR TRADUCCIÓN
      return;
    }

    setError(null);
    setShowModal(true);
  };

  const validarNombreYEnviar = async () => {
    const soloLetras = /^[A-Za-z\s]+$/;

    if (!nombre.trim()) {
      setNombreError(t('seleccion_genero.error_nombre_obligatorio')); // ✅ USAR TRADUCCIÓN
      return;
    }

    if (!soloLetras.test(nombre)) {
      setNombreError(t('seleccion_genero.error_solo_letras')); // ✅ USAR TRADUCCIÓN
      return;
    }

    setNombreError("");
    setCargando(true);

    try {
      console.log("📤 Enviando nombre y rol a backend...");
      await api.post(`${API_BASE_URL}/api/asignar-rol`, {
        rol: genero,
        name: nombre.trim(),
      });

      console.log("✅ Rol asignado exitosamente. Esperando para actualizar perfil...");

      await new Promise((r) => setTimeout(r, 300));

      let user = null;
      let intentos = 0;
      let actualizado = false;

      while (intentos < 3 && !actualizado) {
        const res = await api.get(`${API_BASE_URL}/api/profile`, {
          headers: {
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
        });

        user = res.data.user;
        console.log(`🔄 Intento ${intentos + 1} - Perfil obtenido:`, user);

        if (user.rol && user.name) {
          actualizado = true;
          break;
        }

        await new Promise((r) => setTimeout(r, 300));
        intentos++;
      }

      if (!actualizado) {
        console.warn("⚠️ El perfil aún no refleja los cambios. Redirección cancelada.");
        setError(t('seleccion_genero.error_confirmar_datos')); // ✅ USAR TRADUCCIÓN
        return;
      }

      localStorage.setItem("perfil_actualizado", "1");
      api.defaults.headers.common["Authorization"] = `Bearer ${localStorage.getItem("token")}`;
      setShowModal(false);

      const destino = genero === "modelo" ? "/anteveri" : "/homellamadas";
      console.log("👉 Navegando a:", destino);
      navigate(destino);
      console.log("✅ Redirección ejecutada");

      setTimeout(() => {
        if (window.location.pathname !== destino) {
          console.warn("⚠️ Redirección no aplicada visualmente. Recargando...");
          window.location.href = destino;
        }
      }, 400);

    } catch (err) {
      console.error("❌ Error al guardar rol o al obtener perfil:", err);
      
      // Mostrar mensaje de error más específico si está disponible
      const errorMessage = err.response?.data?.message || t('seleccion_genero.error_guardar');
      setError(errorMessage);
      
      // Si el error es 403 y el mensaje indica que el rol no coincide, mostrar mensaje específico
      if (err.response?.status === 403 && errorMessage.includes('rol enviado no coincide')) {
        setError('El rol seleccionado no coincide con tu rol actual. Por favor, selecciona el rol correcto.');
      }
    } finally {
      setCargando(false);
    }
  };

  return (
    <ProtectedPage requiredConditions={{
      emailVerified: true,
      profileComplete: false
    }}>
      <div className="min-h-screen flex flex-col items-center justify-center bg-ligand-mix-dark text-white px-4 py-10">
        {/* Logo */}
        <div className="flex items-center justify-center mb-6">
          <img src={logoproncipal} alt="Logo" className="w-16 h-16 mr-[-5px]" />
          <span className="text-2xl text-fucsia font-pacifico">Ligand</span>
        </div>

        <h1 className="text-2xl font-bold mb-8 text-center">
          {t('seleccion_genero.titulo')} {/* ✅ USAR TRADUCCIÓN */}
        </h1>

        <form onSubmit={handleContinue} className="w-full max-w-2xl space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <label
              className={`rounded-2xl p-6 flex flex-col items-center justify-center border-2 cursor-pointer transition ${
                genero === "modelo"
                  ? "border-fucsia bg-[#2d2f33]"
                  : "border-gray-600 bg-[#1f2125] hover:border-fucsia"
              }`}
            >
              <Heart size={40} className="text-fucsia mb-3" />
              <span className="text-lg font-semibold">
                {t('seleccion_genero.mujer')} {/* ✅ USAR TRADUCCIÓN */}
              </span>
              <input
                type="radio"
                name="rol"
                value="modelo"
                checked={genero === "modelo"}
                onChange={(e) => setGenero(e.target.value)}
                className="hidden"
              />
            </label>

            <label
              className={`rounded-2xl p-6 flex flex-col items-center justify-center border-2 cursor-pointer transition ${
                genero === "cliente"
                  ? "border-fucsia bg-[#2d2f33]"
                  : "border-gray-600 bg-[#1f2125] hover:border-fucsia"
              }`}
            >
              <User size={40} className="text-fucsia mb-3" />
              <span className="text-lg font-semibold">
                {t('seleccion_genero.hombre')} {/* ✅ USAR TRADUCCIÓN */}
              </span>
              <input
                type="radio"
                name="rol"
                value="cliente"
                checked={genero === "cliente"}
                onChange={(e) => setGenero(e.target.value)}
                className="hidden"
              />
            </label>
          </div>

          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}

          <button
            type="submit"
            disabled={cargando}
            className="w-full bg-fucsia py-3 rounded-xl text-white font-bold hover:bg-pink-600 transition disabled:opacity-50"
          >
            {cargando ? t('seleccion_genero.guardando') : t('seleccion_genero.continuar')} {/* ✅ USAR TRADUCCIÓN */}
          </button>
        </form>

        {/* MODAL */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-[#1f2228] p-6 rounded-2xl w-full max-w-md shadow-lg relative">
              <button
                onClick={() => setShowModal(false)}
                className="absolute top-3 right-3 text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>

              <h2 className="text-xl font-bold text-fucsia mb-4 text-center">
                {genero === "cliente"
                  ? t('seleccion_genero.modal_nombre_cliente') // ✅ USAR TRADUCCIÓN
                  : t('seleccion_genero.modal_nombre_modelo')  // ✅ USAR TRADUCCIÓN
                }
              </h2>

              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder={t('seleccion_genero.placeholder_nombre')} // ✅ USAR TRADUCCIÓN
                className="w-full px-4 py-2 rounded-lg bg-[#0a0d10] border border-gray-500 text-white focus:outline-none focus:ring-2 focus:ring-fucsia"
              />

              {nombreError && (
                <p className="text-red-500 text-sm mt-2">{nombreError}</p>
              )}

              <div className="flex justify-end mt-6 space-x-4">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-gray-300 hover:underline"
                >
                  {t('seleccion_genero.cancelar')} {/* ✅ USAR TRADUCCIÓN */}
                </button>
                <button
                  onClick={validarNombreYEnviar}
                  className="bg-fucsia hover:bg-pink-600 text-white font-semibold px-4 py-2 rounded-lg text-sm"
                >
                  {t('seleccion_genero.continuar')} {/* ✅ USAR TRADUCCIÓN */}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedPage>
  );
}