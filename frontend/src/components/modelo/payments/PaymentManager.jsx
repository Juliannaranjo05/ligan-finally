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
          setError("El código de verificación ha expirado");
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [codeExpiry, timeLeft]);

  const fetchCurrentPaymentInfo = async () => {
    try {
      console.log('🔍 Fetching current payment info...');
      const response = await api.get(`${API_BASE_URL}/api/payment-methods`);
      console.log('✅ Payment info fetched:', response.data);
      
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
      console.error("❌ Error fetching payment info:", err);
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
      setError("Por favor selecciona tu país");
      return;
    }

    if (!formData.payment_method || !formData.account_details) {
      setError("Por favor completa todos los campos");
      return;
    }

    // Para métodos que no sean TRC-20, requerir nombre del titular
    if (formData.payment_method !== 'trc20' && !formData.account_holder_name) {
      setError("Por favor ingresa el nombre del titular");
      return;
    }

    setLoading(true);
    setError("");

    try {
      console.log('🔍 Updating payment method...', formData);
      
      // Para TRC-20, enviar nombre vacío o por defecto
      const dataToSend = {
        ...formData,
        account_holder_name: formData.payment_method === 'trc20' ? 'Crypto User' : formData.account_holder_name
      };
      
      const response = await api.post(`${API_BASE_URL}/api/payment-method`, dataToSend);
      
      console.log('✅ Payment method request sent:', response.data);
      
      setSuccess("Código de verificación enviado a tu correo");
      setStep("verify");
      setCodeExpiry(new Date(Date.now() + 15 * 60 * 1000).toISOString());
      setTimeLeft(15 * 60);
      
    } catch (err) {
      console.error("❌ Error updating payment method:", err);
      const errorMessage = err.response?.data?.error || "Error al procesar la solicitud";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const sendVerificationCode = async () => {
    setLoading(true);
    try {
      console.log('🔍 Sending verification code...');
      
      // USAR API INSTANCE EN LUGAR DE FETCH - SIN userId
      const response = await api.post(`${API_BASE_URL}/api/send-verification`);
      
      console.log('✅ Verification code sent:', response.data);
      setCodeExpiry(response.data.expires_at);
      setTimeLeft(15 * 60); // 15 minutos en segundos
      setStep("verify");
      setSuccess("Código de verificación enviado a tu correo");
      
    } catch (err) {
      console.error("❌ Error sending verification code:", err);
      const errorMessage = err.response?.data?.error || "Error al enviar el código";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (verificationCode.length !== 6) {
      setError("Por favor ingresa un código de 6 dígitos");
      return;
    }

    if (timeLeft === 0) {
      setError("El código ha expirado");
      return;
    }

    setLoading(true);
    setError("");

    try {
      console.log('🔍 Verifying code...', verificationCode);
      
      // USAR API INSTANCE EN LUGAR DE FETCH - SIN userId
      const response = await api.post(`${API_BASE_URL}/api/verify-code`, {
        verification_code: verificationCode
      });
      
      console.log('✅ Code verified:', response.data);
      setStep("success");
      setSuccess("¡Método de pago verificado con éxito!");
      
      // 🔄 RECARGAR INFORMACIÓN DE PAGO DESPUÉS DE VERIFICAR
      await fetchCurrentPaymentInfo();
      
    } catch (err) {
      console.error("❌ Error verifying code:", err);
      const errorMessage = err.response?.data?.error || "Código de verificación incorrecto";
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
          <h4 className="text-sm font-medium text-[#ff007a] mb-2">Configuración actual</h4>
          
          {/* País actual */}
          {currentPaymentInfo.country_code && (
            <div className="mb-3 pb-3 border-b border-white/10">
              <p className="text-white/60 text-xs mb-1">País</p>
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
                    <Check size={12} /> Verificado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-yellow-400 text-xs">
                    <AlertCircle size={12} /> Pendiente de verificación
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
            Cambiar configuración
          </button>
        </div>
      )}

      <div className="space-y-4">
        {/* Selección de país */}
        <div>
          <label className="block text-sm font-medium text-white/80 mb-3">
            <Globe size={16} className="inline mr-2" />
            Selecciona tu país
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
            <option value="">Selecciona tu país</option>
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
              Selecciona método de pago
              {formData.country_code === 'CO' && (
                <span className="text-xs text-green-400 ml-2">(Métodos locales disponibles)</span>
              )}
              {formData.country_code !== 'CO' && formData.country_code && (
                <span className="text-xs text-blue-400 ml-2">(Solo criptomonedas)</span>
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
                {formData.payment_method === 'trc20' ? 'Dirección de wallet TRC-20' : 'Detalles de la cuenta'}
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
                  ⚠️ Verifica que la dirección sea correcta. Las transacciones son irreversibles.
                </p>
              )}
            </div>

            {/* Solo mostrar nombre del titular si NO es TRC-20 */}
            {formData.payment_method !== 'trc20' && (
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Nombre del titular
                </label>
                <input
                  type="text"
                  name="account_holder_name"
                  value={formData.account_holder_name}
                  onChange={handleInputChange}
                  placeholder="Nombre completo del titular de la cuenta"
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
              Enviando código...
            </>
          ) : (
            <>
              <CreditCard size={16} />
              Enviar código de verificación
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
          Confirma tu método de pago
        </h3>
        <p className="text-white/60 text-sm">
          Ingresa el código de 6 dígitos enviado a tu correo para confirmar el cambio de método de pago
        </p>
        {timeLeft > 0 && (
          <p className="text-[#ff007a] text-sm mt-2">
            Código válido por: {formatTime(timeLeft)}
          </p>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-white/80 mb-2">
            Código de verificación
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
            Volver
          </button>
          <button
            onClick={handleVerifyCode}
            disabled={loading || verificationCode.length !== 6 || timeLeft === 0}
            className="flex-1 bg-[#ff007a] hover:bg-[#ff007a]/80 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Verificando...
              </>
            ) : (
              <>
                <Shield size={16} />
                Verificar código
              </>
            )}
          </button>
        </div>

        <button
          onClick={sendVerificationCode}
          disabled={loading || timeLeft > 0}
          className="w-full text-[#ff007a] hover:text-[#ff007a]/80 disabled:opacity-50 disabled:cursor-not-allowed text-sm underline"
        >
          Reenviar código
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
          ¡Método de pago actualizado!
        </h3>
        <p className="text-white/60 text-sm">
          Tu método de pago ha sido verificado y actualizado correctamente. Ya puedes recibir pagos.
        </p>
      </div>
      <button
        onClick={onClose}
        className="w-full bg-[#ff007a] hover:bg-[#ff007a]/80 text-white py-2 px-4 rounded-lg font-medium transition-colors"
      >
        Continuar
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="bg-[#1f2125] rounded-xl p-6 w-full max-w-md border border-[#ff007a] relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-white/50 hover:text-white transition-colors"
          title="Cerrar"
        >
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold text-[#ff007a] mb-6">
          Gestionar método de pago
        </h2>

        {step === "select" && renderSelectStep()}
        {step === "verify" && renderVerifyStep()}
        {step === "success" && renderSuccessStep()}
      </div>
    </div>
  );
}