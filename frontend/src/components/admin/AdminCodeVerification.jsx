import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from "react-router-dom";

export const AdminCodeVerification = ({ onSuccess }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [emergencyCode, setEmergencyCode] = useState(null);
  const navigate = useNavigate();

  // Verificar si hay código de emergencia guardado
  useEffect(() => {
    const savedCode = localStorage.getItem("ligand_emergency_code");
    if (savedCode) {
      setEmergencyCode(savedCode);
      setCode(savedCode); // Pre-llenar el código
      localStorage.removeItem("ligand_emergency_code"); // Limpiar después de usar
    }
  }, []);

  const handleVerify = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    const adminId = localStorage.getItem("ligand_admin_id");

    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || 'https://ligandome.com'}/api/admin/verify-code`,
        { code },
        {
          headers: {
            "ligand-admin-id": adminId,
          },
        }
      );

      if (res.data.success) {
        // Guardar admin_id en localStorage si viene en la respuesta
        if (res.data.admin_id) {
          localStorage.setItem("ligand_admin_id", res.data.admin_id);
        }
        // Asegurar que el admin_id esté guardado (por si viene del header)
        const adminId = localStorage.getItem("ligand_admin_id");
        if (!adminId && res.data.admin_id) {
          localStorage.setItem("ligand_admin_id", res.data.admin_id);
        }
        navigate("/admin/dashboard"); // o donde desees ir
      } else {
        setError(res.data.message || 'Código incorrecto');
      }
    } catch (err) {
      setError('Ocurrió un error al verificar');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80">
      <div className="bg-gradient-to-b from-[#0a0d10] to-[#131418] rounded-xl p-8 w-full max-w-sm border border-fucsia shadow-lg">
        <h2 className="text-xl text-fucsia font-semibold text-center mb-6">
          Verifica tu código
        </h2>

        <form onSubmit={handleVerify} className="space-y-5">
          <div>
            <label className="block text-white text-sm mb-1">Código</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              className="w-full px-4 py-2 rounded-lg bg-[#1f2228] text-white placeholder-gray-400 border border-fucsia focus:outline-none focus:ring-2 focus:ring-fucsia text-center tracking-widest"
              placeholder="123456"
            />
          </div>

          {emergencyCode && (
            <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-3 mb-4">
              <p className="text-yellow-400 text-xs font-semibold mb-1">⚠️ Código de emergencia</p>
              <p className="text-yellow-300 text-xs">
                El correo no pudo enviarse. Usa este código para acceder: <span className="font-mono font-bold">{emergencyCode}</span>
              </p>
            </div>
          )}

          {error && (
            <div className="text-red-500 text-sm text-center">{error}</div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2 bg-fucsia hover:bg-pink-700 text-white rounded-lg transition text-sm"
          >
            {submitting ? 'Verificando...' : 'Verificar código'}
          </button>
        </form>
      </div>
    </div>
  );
};