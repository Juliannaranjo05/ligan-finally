import { useEffect, useState } from "react";
import axios from "axios";
import { FaCheckCircle, FaTimesCircle } from "react-icons/fa";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function AdminVerification() {
  const [verificaciones, setVerificaciones] = useState([]);

  useEffect(() => {
    axios
      .get(`${API_BASE_URL}/api/admin-test/verificaciones`) // <-- 🔥 Ruta corregida
      .then((res) => {
        setVerificaciones(res.data);
      })
      .catch((err) => {
        console.error("❌ Error cargando verificaciones", err);
      });
  }, []);

  // 🔄 Acción para aceptar o rechazar
  const handleAccion = async (id, accion) => {
    try {
      await axios.post(`${API_BASE_URL}/api/admin-test/verificaciones/${id}/${accion}`); // <-- 🔥 Ruta corregida
      // ✅ Elimina la verificación del estado
      setVerificaciones((prev) => prev.filter((v) => v.id !== id));
    } catch (error) {
      console.error(`❌ Error al ${accion} verificación`, error);
      alert(`Error al ${accion} verificación.`);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white px-6 py-8">
      <h1 className="text-3xl font-bold text-fuchsia-500 mb-6">Panel de Verificaciones</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {verificaciones.map((v) => (
          <div key={v.id} className="bg-[#131418] rounded-xl p-4 shadow-lg">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-fuchsia-400">
                {v.user?.name ?? "Sin nombre"} ({v.user?.email ?? "sin email"})
              </h2>
              <p className="text-sm text-gray-400">ID: {v.user?.id ?? "N/A"}</p>
            </div>

            <div className="space-y-2 text-sm text-gray-300">
              <p><span className="text-fuchsia-500">Selfie:</span> {v.selfie ? "📷 Enviada" : "❌ No"}</p>
              <p><span className="text-fuchsia-500">Documento:</span> {v.documento ? "📄 Enviado" : "❌ No"}</p>
              <p><span className="text-fuchsia-500">Selfie con Documento:</span> {v.selfie_doc ? "📸 Enviada" : "❌ No"}</p>
              <p><span className="text-fuchsia-500">Video:</span> {v.video ? "🎥 Enviado" : "❌ No"}</p>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button
                className="bg-green-600 hover:bg-green-700 text-white py-1 px-3 rounded-lg flex items-center gap-1"
                onClick={() => handleAccion(v.id, "aceptar")}
              >
                <FaCheckCircle /> Aceptar
              </button>
              <button
                className="bg-red-600 hover:bg-red-700 text-white py-1 px-3 rounded-lg flex items-center gap-1"
                onClick={() => handleAccion(v.id, "rechazar")}
              >
                <FaTimesCircle /> Rechazar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
