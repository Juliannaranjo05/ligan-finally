import React, { useState, useEffect } from "react";
import {
  CreditCard,
  Check,
  X,
  AlertCircle,
  Loader2,
  Mail,
  Shield,
  ArrowLeft,
  Building2,
  Smartphone,
  Globe,
  DollarSign
} from "lucide-react";
import { useTranslation } from "react-i18next";
import api from '../../../api/axios'; // IMPORTAR TU INSTANCIA API

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Lista de países (fuera del componente para mejor rendimiento)
const countries = [
  { code: 'CO', name: 'Colombia', flag: '🇨🇴' },
  { code: 'US', name: 'Estados Unidos', flag: '🇺🇸' },
  { code: 'MX', name: 'México', flag: '🇲🇽' },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
  { code: 'PE', name: 'Perú', flag: '🇵🇪' },
  { code: 'VE', name: 'Venezuela', flag: '🇻🇪' },
  { code: 'EC', name: 'Ecuador', flag: '🇪🇨' },
  { code: 'CL', name: 'Chile', flag: '🇨🇱' },
  { code: 'BR', name: 'Brasil', flag: '🇧🇷' },
  { code: 'ES', name: 'España', flag: '🇪🇸' },
  { code: 'OTHER', name: 'Otro país', flag: '🌍' }
];

// Métodos de pago según el país
const getPaymentMethods = (countryCode) => {
  if (countryCode === 'CO') {
    return {
      bancolombia: {
        name: "Bancolombia",
        icon: <Building2 size={20} />,
        placeholder: "Número de cuenta o cédula",
        color: "bg-yellow-500"
      },
      nequi: {
        name: "Nequi",
        icon: <Smartphone size={20} />,
        placeholder: "Número de teléfono",
        color: "bg-purple-500"
      },
      payoneer: {
        name: "Payoneer",
        icon: <Globe size={20} />,
        placeholder: "Email de Payoneer",
        color: "bg-orange-500"
      }
    };
  } else {
    // Para todos los demás países, solo TRC-20
    return {
      trc20: {
        name: "TRC-20 (USDT)",
        icon: <DollarSign size={20} />,
        placeholder: "Ej: TQqr...8xKa (Empieza con 'T' y tiene 34 caracteres)",
        color: "bg-green-500"
      }
    };
  }
};

export default function PaymentManager({ onClose }) { // ELIMINAR userId
  const [step, setStep] = useState("select"); // select, verify, success
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [currentPaymentInfo, setCurrentPaymentInfo] = useState(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [codeExpiry, setCodeExpiry] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  
  const [formData, setFormData] = useState({
    payment_method: "",
    account_details: "",
    account_holder_name: ""
  });

  const { t } = useTranslation();

  const paymentMethods = {
    bancolombia: {
      name: "Bancolombia",
      icon: <Building2 size={20} />,
      placeholder: "Número de cuenta o cédula",
      color: "bg-yellow-500"
    },
    nequi: {
      name: "Nequi",
      icon: <Smartphone size={20} />,
      placeholder: "Número de teléfono",
      color: "bg-purple-500"
    },
    payoneer: {
      name: "Payoneer",
      icon: <Globe size={20} />,
      placeholder: "Email de Payoneer",
      color: "bg-orange-500"
    },
    other: {
      name: "Otro",
      icon: <DollarSign size={20} />,
      placeholder: "Detalles de la cuenta",
      color: "bg-gray-500"
    }
  };

  // Cargar información de pago actual
  useEffect(() => {
    fetchCurrentPaymentInfo();
  }, []); // ELIMINAR userId de dependencias

  // Timer para código de verificación
  useEffect(() => {
    let interval;
    if (codeExpiry && timeLeft > 0) {
      interval = setInterval(() => {
        const now = new Date().getTime();
        const expiry = new Date(codeExpiry).getTime();
        const difference = expiry - now;
        
        if (difference > 0) {
          setTimeLeft(Math.floor(difference / 1000));
        } else {
          setTimeLeft(0);
          setError(t("settings.payoutAccountModal.errors.codeExpiredMessage"));
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [codeExpiry, timeLeft]);

  const fetchCurrentPaymentInfo = async () => {
    try {
      const response = await api.get(`${API_BASE_URL}/api/payment-methods`);
      
      setCurrentPaymentInfo(response.data);
      if (response.data.current_method || response.data.country_code) {
        setFormData({
          country_code: response.data.country_code || "",
          country_name: response.data.country_name || "",
          payment_method: response.data.current_method || "",
          account_details: response.data.account_details || "",
          account_holder_name: response.data.account_holder_name || ""
        });
      }
    } catch (err) {
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError("");
  };

  const handleUpdatePaymentMethod = async () => {
    // Validar que se haya seleccionado país
    if (!formData.country_code || !formData.country_name) {
      setError(t("settings.payoutAccountModal.errors.selectCountry"));
      return;
    }

    if (!formData.payment_method || !formData.account_details) {
      setError(t("settings.payoutAccountModal.errors.enterAccountDetails"));
      return;
    }

    // Para métodos que no sean TRC-20, requerir nombre del titular
    if (formData.payment_method !== 'trc20' && !formData.account_holder_name) {
      setError(t("settings.payoutAccountModal.errors.enterAccountHolderName"));
      return;
    }

    setLoading(true);
    setError("");

    try {
      
      // Para TRC-20, enviar nombre vacío o por defecto
      const dataToSend = {
        ...formData,
        account_holder_name: formData.payment_method === 'trc20' ? 'Crypto User' : formData.account_holder_name
      };
      
      const response = await api.post(`${API_BASE_URL}/api/payment-method`, dataToSend);
      
      
      setSuccess(t("settings.payoutAccountModal.success.codeSent"));
      setStep("verify");
      setCodeExpiry(new Date(Date.now() + 15 * 60 * 1000).toISOString());
      setTimeLeft(15 * 60);
      
    } catch (err) {
      const errorMessage = err.response?.data?.error || t("settings.payoutAccountModal.errors.connectionError");
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const sendVerificationCode = async () => {
    setLoading(true);
    try {
      
      // USAR API INSTANCE EN LUGAR DE FETCH - SIN userId
      const response = await api.post(`${API_BASE_URL}/api/send-verification`);
      
      setCodeExpiry(response.data.expires_at);
      setTimeLeft(15 * 60); // 15 minutos en segundos
      setStep("verify");
      setSuccess(t("settings.payoutAccountModal.success.codeSent"));
      
    } catch (err) {
      const errorMessage = err.response?.data?.error || t("settings.payoutAccountModal.errors.connectionError");
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (verificationCode.length !== 6) {
      setError(t("settings.payoutAccountModal.errors.enterVerificationCode"));
      return;
    }

    if (timeLeft === 0) {
      setError(t("settings.payoutAccountModal.errors.codeExpiredMessage"));
      return;
    }

    setLoading(true);
    setError("");

    try {
      
      // USAR API INSTANCE EN LUGAR DE FETCH - SIN userId
      const response = await api.post(`${API_BASE_URL}/api/verify-code`, {
        verification_code: verificationCode
      });
      
      setStep("success");
      setSuccess(t("settings.payoutAccountModal.success.verified"));
      
      // 🔄 RECARGAR INFORMACIÓN DE PAGO DESPUÉS DE VERIFICAR
      await fetchCurrentPaymentInfo();
      
    } catch (err) {
      const errorMessage = err.response?.data?.error || t("settings.payoutAccountModal.errors.invalidCode");
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const renderSelectStep = () => (
    <div className="space-y-6">
      {/* Información actual */}
      {(currentPaymentInfo?.current_method || currentPaymentInfo?.country_code) && (
        <div className="bg-[#0a0d10] p-4 rounded-lg border border-[#ff007a]/20">
          <h4 className="text-sm font-medium text-[#ff007a] mb-2">{t("settings.payoutAccountModal.currentConfiguration")}</h4>
          
          {/* País actual */}
          {currentPaymentInfo.country_code && (
            <div className="mb-3 pb-3 border-b border-white/10">
              <p className="text-white/60 text-xs mb-1">{t("settings.payoutAccountModal.country")}</p>
              <div className="flex items-center gap-2">
                <span className="text-lg">
                  {countries.find(c => c.code === currentPaymentInfo.country_code)?.flag || '🌍'}
                </span>
                <span className="text-white font-medium">
                  {currentPaymentInfo.country_name}
                </span>
              </div>
            </div>
          )}

          {/* Método de pago actual */}
          {currentPaymentInfo.current_method && (
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${getPaymentMethods(currentPaymentInfo.country_code)[currentPaymentInfo.current_method]?.color}`}>
                {getPaymentMethods(currentPaymentInfo.country_code)[currentPaymentInfo.current_method]?.icon}
              </div>
              <div className="flex-1">
                <p className="text-white font-medium">
                  {getPaymentMethods(currentPaymentInfo.country_code)[currentPaymentInfo.current_method]?.name}
                </p>
                <p className="text-white/60 text-sm">
                  {currentPaymentInfo.account_holder_name}
                </p>
                {currentPaymentInfo.account_details && (
                  <p className="text-white/50 text-xs font-mono">
                    {currentPaymentInfo.account_details}
                  </p>
                )}
                {currentPaymentInfo.is_verified ? (
                  <span className="inline-flex items-center gap-1 text-green-400 text-xs">
                    <Check size={12} /> {t("settings.payoutAccountModal.verified")}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-yellow-400 text-xs">
                    <AlertCircle size={12} /> {t("settings.payoutAccountModal.pendingVerification")}
                  </span>
                )}
              </div>
            </div>
          )}
          
          <button
            onClick={() => {
              setFormData({
                country_code: "",
                country_name: "",
                payment_method: "",
                account_details: "",
                account_holder_name: currentPaymentInfo.account_holder_name || ""
              });
            }}
            className="w-full mt-3 text-[#ff007a] hover:text-[#ff007a]/80 text-sm font-medium"
          >
            {t("settings.payoutAccountModal.changeConfiguration")}
          </button>
        </div>
      )}

      <div className="space-y-4">
        {/* Selección de país */}
        <div>
          <label className="block text-sm font-medium text-white/80 mb-3">
            <Globe size={16} className="inline mr-2" />
            {t("settings.payoutAccountModal.selectCountry")}
          </label>
          <select
            value={formData.country_code}
            onChange={(e) => {
              const selectedCountry = countries.find(c => c.code === e.target.value);
              setFormData(prev => ({
                ...prev,
                country_code: e.target.value,
                country_name: selectedCountry?.name || "",
                payment_method: "", // Reset método al cambiar país
                account_details: ""
              }));
              setError("");
            }}
            className="w-full px-3 py-2 bg-[#0a0d10] border border-white/10 rounded-lg text-white focus:border-[#ff007a] focus:outline-none"
          >
            <option value="">{t("settings.payoutAccountModal.selectCountry")}</option>
            {countries.map(country => (
              <option key={country.code} value={country.code}>
                {country.flag} {country.name}
              </option>
            ))}
          </select>
        </div>

        {/* Métodos de pago (solo si se seleccionó país) */}
        {formData.country_code && (
          <div>
            <label className="block text-sm font-medium text-white/80 mb-3">
              <CreditCard size={16} className="inline mr-2" />
              {t("settings.payoutAccountModal.selectPaymentMethod")}
              {formData.country_code === 'CO' && (
                <span className="text-xs text-green-400 ml-2">({t("settings.payoutAccountModal.localMethodsAvailable")})</span>
              )}
              {formData.country_code !== 'CO' && formData.country_code && (
                <span className="text-xs text-blue-400 ml-2">({t("settings.payoutAccountModal.cryptoOnly")})</span>
              )}
            </label>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(paymentMethods).map(([key, method]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, payment_method: key }))}
                  className={`p-3 rounded-lg border transition-all ${
                    formData.payment_method === key
                      ? "border-[#ff007a] bg-[#ff007a]/10"
                      : "border-white/10 bg-[#0a0d10] hover:border-[#ff007a]/50"
                  }`}
                >
                  <div className={`p-2 rounded-lg ${method.color} mb-2 mx-auto w-fit`}>
                    {method.icon}
                  </div>
                  <p className="text-sm font-medium text-white">{method.name}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Campos de detalles (solo si se seleccionó método) */}
        {formData.payment_method && (
          <>
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                {formData.payment_method === 'trc20' ? t("settings.payoutAccountModal.walletAddress") : t("settings.payoutAccountModal.accountDetails")}
              </label>
              <input
                type="text"
                name="account_details"
                value={formData.account_details}
                onChange={handleInputChange}
                placeholder={paymentMethods[formData.payment_method]?.placeholder}
                className="w-full px-3 py-2 bg-[#0a0d10] border border-white/10 rounded-lg text-white placeholder-white/40 focus:border-[#ff007a] focus:outline-none"
              />
              {formData.payment_method === 'trc20' && (
                <p className="text-xs text-white/60 mt-1">
                  {t("settings.payoutAccountModal.verifyWalletWarning")}
                </p>
              )}
            </div>

            {/* Solo mostrar nombre del titular si NO es TRC-20 */}
            {formData.payment_method !== 'trc20' && (
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  {t("settings.payoutAccountModal.accountHolderName")}
                </label>
                <input
                  type="text"
                  name="account_holder_name"
                  value={formData.account_holder_name}
                  onChange={handleInputChange}
                  placeholder={t("settings.payoutAccountModal.accountHolderPlaceholder")}
                  className="w-full px-3 py-2 bg-[#0a0d10] border border-white/10 rounded-lg text-white placeholder-white/40 focus:border-[#ff007a] focus:outline-none"
                />
              </div>
            )}
          </>
        )}

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 p-3 rounded-lg">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 text-green-400 text-sm bg-green-400/10 p-3 rounded-lg">
            <Check size={16} />
            {success}
          </div>
        )}

        <button
          onClick={handleUpdatePaymentMethod}
          disabled={
            loading || 
            !formData.country_code || 
            !formData.payment_method || 
            !formData.account_details || 
            (formData.payment_method !== 'trc20' && !formData.account_holder_name)
          }
          className="w-full bg-[#ff007a] hover:bg-[#ff007a]/80 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              {t("settings.payoutAccountModal.sendingCode")}
            </>
          ) : (
            <>
              <CreditCard size={16} />
              {t("settings.payoutAccountModal.sendVerificationCode")}
            </>
          )}
        </button>
      </div>
    </div>
  );

  const renderVerifyStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="bg-[#ff007a]/10 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
          <Mail className="text-[#ff007a]" size={24} />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">
          {t("settings.payoutAccountModal.confirmPaymentMethod")}
        </h3>
        <p className="text-white/60 text-sm">
          {t("settings.payoutAccountModal.enterVerificationCode")}
        </p>
        {timeLeft > 0 && (
          <p className="text-[#ff007a] text-sm mt-2">
            {t("settings.payoutAccountModal.codeValidFor")} {formatTime(timeLeft)}
          </p>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-white/80 mb-2">
            {t("settings.payoutAccountModal.verificationCode")}
          </label>
          <input
            type="text"
            value={verificationCode}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '').slice(0, 6);
              setVerificationCode(value);
              setError("");
            }}
            placeholder="000000"
            className="w-full px-3 py-2 bg-[#0a0d10] border border-white/10 rounded-lg text-white text-center text-lg tracking-widest placeholder-white/40 focus:border-[#ff007a] focus:outline-none"
            maxLength={6}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 p-3 rounded-lg">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => setStep("select")}
            className="flex-1 bg-white/10 hover:bg-white/20 text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <ArrowLeft size={16} />
            {t("settings.payoutAccountModal.back")}
          </button>
          <button
            onClick={handleVerifyCode}
            disabled={loading || verificationCode.length !== 6 || timeLeft === 0}
            className="flex-1 bg-[#ff007a] hover:bg-[#ff007a]/80 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {t("settings.payoutAccountModal.verifying")}
              </>
            ) : (
              <>
                <Shield size={16} />
                {t("settings.payoutAccountModal.verifyCode")}
              </>
            )}
          </button>
        </div>

        <button
          onClick={sendVerificationCode}
          disabled={loading || timeLeft > 0}
          className="w-full text-[#ff007a] hover:text-[#ff007a]/80 disabled:opacity-50 disabled:cursor-not-allowed text-sm underline"
        >
          {t("settings.payoutAccountModal.resendCode")}
        </button>
      </div>
    </div>
  );

  const renderSuccessStep = () => (
    <div className="text-center space-y-6">
      <div className="bg-green-400/10 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
        <Check className="text-green-400" size={24} />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">
          {t("settings.payoutAccountModal.paymentMethodUpdated")}
        </h3>
        <p className="text-white/60 text-sm">
          {t("settings.payoutAccountModal.paymentMethodUpdatedDescription")}
        </p>
      </div>
      <button
        onClick={onClose}
        className="w-full bg-[#ff007a] hover:bg-[#ff007a]/80 text-white py-2 px-4 rounded-lg font-medium transition-colors"
      >
        {t("settings.payoutAccountModal.continue")}
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="bg-[#1f2125] rounded-xl p-6 w-full max-w-md border border-[#ff007a] relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-white/50 hover:text-white transition-colors"
          title={t("settings.payoutAccountModal.close")}
        >
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold text-[#ff007a] mb-2">
          {t("settings.payoutAccountTitle") || "Configurar cuenta para consignaciones"}
        </h2>
        <p className="text-sm text-white/60 mb-6">
          {t("settings.payoutAccountDescription") || "Configura la cuenta donde recibirás tus pagos laborales. Esta información se utilizará para realizar las consignaciones de tus ganancias."}
        </p>

        {step === "select" && renderSelectStep()}
        {step === "verify" && renderVerifyStep()}
        {step === "success" && renderSuccessStep()}
      </div>
    </div>
  );
}