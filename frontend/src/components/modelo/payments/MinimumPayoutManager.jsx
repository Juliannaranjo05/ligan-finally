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
      description: t("settings.minimumPayoutModal.payoutOptions.basic"),
      color: "bg-blue-500",
      recommended: false
    },
    {
      amount: 80,
      label: "$80 USD", 
      description: t("settings.minimumPayoutModal.payoutOptions.recommended"),
      color: "bg-green-500",
      recommended: true
    },
    {
      amount: 120,
      label: "$120 USD",
      description: t("settings.minimumPayoutModal.payoutOptions.medium"),
      color: "bg-purple-500",
      recommended: false
    },
    {
      amount: 180,
      label: "$180 USD",
      description: t("settings.minimumPayoutModal.payoutOptions.high"),
      color: "bg-orange-500",
      recommended: false
    },
    {
      amount: 240,
      label: "$240 USD",
      description: t("settings.minimumPayoutModal.payoutOptions.maximum"),
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
      
      const response = await api.get(`${API_BASE_URL}/api/minimum-payout`);
      
      const minimum = response.data.minimum_payout;
      setCurrentMinimum(minimum);
      setSelectedMinimum(minimum);
      
    } catch (err) {
      setError(t("settings.minimumPayoutModal.errors.loadingError"));
    } finally {
      setLoadingData(false);
    }
  };

  const handleUpdateMinimum = async () => {
    if (selectedMinimum === currentMinimum) {
      setError(t("settings.minimumPayoutModal.errors.selectDifferentAmount"));
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      
      const response = await api.post(`${API_BASE_URL}/api/minimum-payout`, {
        minimum_payout: selectedMinimum
      });
      
      
      setCurrentMinimum(selectedMinimum);
      setSuccess(`${t("settings.minimumPayoutModal.success.updated")} $${selectedMinimum} USD`);
      
      // Cerrar modal después de 2 segundos
      setTimeout(() => {
        onClose();
      }, 2000);
      
    } catch (err) {
      const errorMessage = err.response?.data?.error || t("settings.minimumPayoutModal.errors.updateError");
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
            <p className="text-white/80">{t("settings.minimumPayoutModal.loadingConfiguration")}</p>
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
          title={t("settings.payoutAccountModal.close")}
        >
          <X size={20} />
        </button>

        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-[#ff007a]/10 p-2 rounded-lg">
              <DollarSign className="text-[#ff007a]" size={24} />
            </div>
            <h2 className="text-xl font-bold text-[#ff007a]">
              {t("settings.minimumPayoutModal.title")}
            </h2>
          </div>
          <p className="text-white/60 text-sm">
            {t("settings.minimumPayoutModal.description")}
          </p>
        </div>

        {/* Configuración actual */}
        <div className="bg-[#0a0d10] p-4 rounded-lg border border-[#ff007a]/20 mb-6">
          <h4 className="text-sm font-medium text-[#ff007a] mb-2">{t("settings.minimumPayoutModal.currentConfiguration")}</h4>
          <div className="flex items-center gap-3">
            <div className="bg-[#ff007a]/10 p-2 rounded-lg">
              <Target size={20} className="text-[#ff007a]" />
            </div>
            <div>
              <p className="text-white font-medium">${currentMinimum} USD</p>
              <p className="text-white/60 text-sm">
                {payoutOptions.find(opt => opt.amount === currentMinimum)?.description || t("settings.minimumPayoutModal.customPayout")}
              </p>
            </div>
          </div>
        </div>

        {/* Opciones de pago mínimo */}
        <div className="space-y-4 mb-6">
          <h4 className="text-white font-medium">{t("settings.minimumPayoutModal.selectNewMinimum")}</h4>
          
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
                    {t("settings.minimumPayoutModal.recommended")}
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
                      {t("settings.minimumPayoutModal.payoutInfo")}
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
              <span className="text-blue-400 font-medium text-sm">{t("settings.minimumPayoutModal.newAmountSelected")}</span>
            </div>
            <p className="text-white text-sm">
              {t("settings.minimumPayoutModal.newAmountDescription")} <strong>${selectedMinimum} USD</strong> {t("settings.minimumPayoutModal.asMinimum")}
              {selectedMinimum > currentMinimum ? 
                ` ${t("settings.minimumPayoutModal.moreEarningsNeeded")}` : 
                ` ${t("settings.minimumPayoutModal.moreFrequentPayments")}`
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
            {t("settings.minimumPayoutModal.cancel")}
          </button>
          
          <button
            onClick={handleUpdateMinimum}
            disabled={loading || selectedMinimum === currentMinimum}
            className="flex-1 bg-[#ff007a] hover:bg-[#ff007a]/80 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {t("settings.minimumPayoutModal.updating")}
              </>
            ) : (
              <>
                <Check size={16} />
                {t("settings.minimumPayoutModal.updateMinimum")}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}