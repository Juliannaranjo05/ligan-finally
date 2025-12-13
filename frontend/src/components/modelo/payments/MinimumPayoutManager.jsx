import React, { useState, useEffect } from "react";
import {
  DollarSign,
  Check,
  X,
  AlertCircle,
  Loader2,
  TrendingUp,
  Clock,
  Target
} from "lucide-react";
import { useTranslation } from "react-i18next";
import api from '../../../api/axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function MinimumPayoutManager({ onClose }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [currentMinimum, setCurrentMinimum] = useState(40);
  const [selectedMinimum, setSelectedMinimum] = useState(40);
  const [loadingData, setLoadingData] = useState(true);

  const { t } = useTranslation();

  // Opciones de pago mínimo 
  const payoutOptions = [
    {
      amount: 40,
      label: "$40 USD",
      description: "Pago mínimo básico",
      color: "bg-blue-500",
      recommended: false
    },
    {
      amount: 80,
      label: "$80 USD", 
      description: "Pago mínimo recomendado",
      color: "bg-green-500",
      recommended: true
    },
    {
      amount: 120,
      label: "$120 USD",
      description: "Pago mínimo medio",
      color: "bg-purple-500",
      recommended: false
    },
    {
      amount: 180,
      label: "$180 USD",
      description: "Pago mínimo alto",
      color: "bg-orange-500",
      recommended: false
    },
    {
      amount: 240,
      label: "$240 USD",
      description: "Pago mínimo máximo",
      color: "bg-red-500",
      recommended: false
    }
  ];

  // Cargar configuración actual
  useEffect(() => {
    fetchCurrentMinimum();
  }, []);

  const fetchCurrentMinimum = async () => {
    try {
      setLoadingData(true);
      console.log('🔍 Fetching current minimum payout...');
      
      const response = await api.get(`${API_BASE_URL}/api/minimum-payout`);
      console.log('✅ Current minimum fetched:', response.data);
      
      const minimum = response.data.minimum_payout;
      setCurrentMinimum(minimum);
      setSelectedMinimum(minimum);
      
    } catch (err) {
      console.error("❌ Error fetching minimum payout:", err);
      setError("Error cargando configuración actual");
    } finally {
      setLoadingData(false);
    }
  };

  const handleUpdateMinimum = async () => {
    if (selectedMinimum === currentMinimum) {
      setError("Selecciona un monto diferente al actual");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      console.log('🔍 Updating minimum payout...', { minimum_payout: selectedMinimum });
      
      const response = await api.post(`${API_BASE_URL}/api/minimum-payout`, {
        minimum_payout: selectedMinimum
      });
      
      console.log('✅ Minimum payout updated:', response.data);
      
      setCurrentMinimum(selectedMinimum);
      setSuccess(`Pago mínimo actualizado a $${selectedMinimum} USD`);
      
      // Cerrar modal después de 2 segundos
      setTimeout(() => {
        onClose();
      }, 2000);
      
    } catch (err) {
      console.error("❌ Error updating minimum payout:", err);
      const errorMessage = err.response?.data?.error || "Error al actualizar el pago mínimo";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getSelectedOption = () => {
    return payoutOptions.find(option => option.amount === selectedMinimum);
  };

  if (loadingData) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
        <div className="bg-[#1f2125] rounded-xl p-6 w-full max-w-md border border-[#ff007a]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#ff007a] mx-auto mb-4"></div>
            <p className="text-white/80">Cargando configuración...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="bg-[#1f2125] rounded-xl p-6 w-full max-w-lg border border-[#ff007a] relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-white/50 hover:text-white transition-colors"
          title="Cerrar"
        >
          <X size={20} />
        </button>

        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-[#ff007a]/10 p-2 rounded-lg">
              <DollarSign className="text-[#ff007a]" size={24} />
            </div>
            <h2 className="text-xl font-bold text-[#ff007a]">
              Configurar Pago Mínimo
            </h2>
          </div>
          <p className="text-white/60 text-sm">
            Define el monto mínimo para recibir tus pagos. Las ganancias se acumularán hasta alcanzar este monto.
          </p>
        </div>

        {/* Configuración actual */}
        <div className="bg-[#0a0d10] p-4 rounded-lg border border-[#ff007a]/20 mb-6">
          <h4 className="text-sm font-medium text-[#ff007a] mb-2">Configuración actual</h4>
          <div className="flex items-center gap-3">
            <div className="bg-[#ff007a]/10 p-2 rounded-lg">
              <Target size={20} className="text-[#ff007a]" />
            </div>
            <div>
              <p className="text-white font-medium">${currentMinimum} USD</p>
              <p className="text-white/60 text-sm">
                {payoutOptions.find(opt => opt.amount === currentMinimum)?.description || "Pago personalizado"}
              </p>
            </div>
          </div>
        </div>

        {/* Opciones de pago mínimo */}
        <div className="space-y-4 mb-6">
          <h4 className="text-white font-medium">Selecciona nuevo monto mínimo:</h4>
          
          <div className="grid gap-3">
            {payoutOptions.map((option) => (
              <button
                key={option.amount}
                type="button"
                onClick={() => {
                  setSelectedMinimum(option.amount);
                  setError("");
                }}
                className={`p-4 rounded-lg border transition-all text-left relative ${
                  selectedMinimum === option.amount
                    ? "border-[#ff007a] bg-[#ff007a]/10"
                    : "border-white/10 bg-[#0a0d10] hover:border-[#ff007a]/50"
                }`}
              >
                {/* Badge recomendado */}
                {option.recommended && (
                  <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                    Recomendado
                  </div>
                )}
                
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${option.color}`}>
                    <DollarSign size={20} className="text-white" />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-white font-bold text-lg">{option.label}</p>
                      {selectedMinimum === option.amount && (
                        <Check size={16} className="text-[#ff007a]" />
                      )}
                    </div>
                    <p className="text-white/60 text-sm">{option.description}</p>
                    <p className="text-white/40 text-xs mt-1">
                      Solo recibirás pagos cuando alcances este monto
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Información del monto seleccionado */}
        {selectedMinimum !== currentMinimum && (
          <div className="bg-blue-500/10 p-4 rounded-lg border border-blue-500/20 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={16} className="text-blue-400" />
              <span className="text-blue-400 font-medium text-sm">Nuevo monto seleccionado</span>
            </div>
            <p className="text-white text-sm">
              Con <strong>${selectedMinimum} USD</strong> como mínimo, solo recibirás pagos cuando tus ganancias acumuladas alcancen este monto.
              {selectedMinimum > currentMinimum ? 
                " Esto significa que necesitarás más ganancias antes de recibir un pago." : 
                " Esto significa que recibirás pagos más frecuentemente."
              }
            </p>
          </div>
        )}

        {/* Mensajes de error y éxito */}
        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 p-3 rounded-lg mb-4">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 text-green-400 text-sm bg-green-400/10 p-3 rounded-lg mb-4">
            <Check size={16} />
            {success}
          </div>
        )}

        {/* Botones de acción */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-white/10 hover:bg-white/20 text-white py-3 px-4 rounded-lg font-medium transition-colors"
          >
            Cancelar
          </button>
          
          <button
            onClick={handleUpdateMinimum}
            disabled={loading || selectedMinimum === currentMinimum}
            className="flex-1 bg-[#ff007a] hover:bg-[#ff007a]/80 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Actualizando...
              </>
            ) : (
              <>
                <Check size={16} />
                Actualizar Mínimo
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}