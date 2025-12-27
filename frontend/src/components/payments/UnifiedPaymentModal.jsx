import React, { useState, useEffect } from 'react';
import { 
  Coins,
  CreditCard, 
  MapPin,
  X,
  ArrowLeft,
  Shield,
  Check,
  AlertCircle,
  Loader,
  ExternalLink
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Importar componentes independientes
import WompiPayment from './WompiPayment';
import CountrySelector from './CountrySelector';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function UnifiedPaymentModal({ onClose }) {
  const { t } = useTranslation();
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [showCountrySelector, setShowCountrySelector] = useState(false);
  
  const [paymentMethods, setPaymentMethods] = useState({
    wompi: { available: false, config: null }
  });
  const [notification, setNotification] = useState(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  useEffect(() => {
    // Verificar si ya hay un país seleccionado
    const savedCountry = localStorage.getItem('selected_country');
    if (savedCountry) {
      try {
        const country = JSON.parse(savedCountry);
        setSelectedCountry(country);
        setLoading(false); // No mostrar loading si hay país guardado
        initializePaymentMethods();
      } catch (e) {
        setShowCountrySelector(true);
        setLoading(false); // Mostrar selector de país
      }
    } else {
      // Si no hay país seleccionado, mostrar el selector
      setShowCountrySelector(true);
      setLoading(false); // No mostrar loading, mostrar selector
    }
  }, []);

  const handleCountrySelect = (country) => {
    setSelectedCountry(country);
    setShowCountrySelector(false);
    initializePaymentMethods();
  };

  const initializePaymentMethods = async () => {
    try {
      setLoading(true);
      
      // Verificar disponibilidad de Wompi
      const wompiResult = await checkWompiAvailability();

      // Procesar resultado
      const methods = { wompi: { available: false } };

      if (wompiResult) {
        methods.wompi = {
          available: true,
          config: wompiResult
        };
      }

      setPaymentMethods(methods);

      // Auto-seleccionar Wompi si está disponible
      if (methods.wompi.available) {
        setSelectedMethod('wompi');
      }

    } catch (error) {
      showNotification(t('paymentMethods.errorLoadingMethods'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const checkWompiAvailability = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/wompi/config`, {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.success ? data : null;
      }
      return null;
    } catch (error) {
      return null;
    }
  };

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleMethodSelect = (method) => {
    if (paymentMethods[method]?.available) {
      setSelectedMethod(method);
    }
  };

  const handleBackToSelection = () => {
    setSelectedMethod(null);
  };

  // Componente de selección de método de pago
  const PaymentMethodSelector = () => {
    const { wompi } = paymentMethods;

    if (!wompi.available) {
      return (
        <div className="text-center py-12">
          <AlertCircle className="text-red-400 mx-auto mb-4" size={48} />
          <h3 className="text-xl font-bold text-white mb-2">
            {t('paymentMethods.noMethodsAvailable')}
          </h3>
          <p className="text-white/60 mb-6">
            {t('paymentMethods.noMethodsDescription')}
          </p>
          <button
            onClick={onClose}
            className="bg-gray-600 hover:bg-gray-500 text-white py-2 px-6 rounded-lg font-medium transition-colors"
          >
            {t('common.close')}
          </button>
        </div>
      );
    }

    // No debería llegar aquí ya que Wompi se auto-selecciona, pero por si acaso
    return null;
  };

  // Solo mostrar loading si no estamos mostrando el selector de país
  if (loading && !showCountrySelector) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" style={{ display: 'flex' }}>
        <div className="bg-[#1a1c20] rounded-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden border border-gray-600">
          <div className="min-h-[500px] flex items-center justify-center">
            <div className="text-center">
              <Loader className="animate-spin text-[#ff007a] mx-auto mb-4" size={48} />
              <p className="text-white/70">{t('paymentMethods.loadingMethods')}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" style={{ display: 'flex' }}>
      <div className={`bg-[#1a1c20] rounded-2xl w-full ${showCountrySelector ? 'max-w-md' : 'max-w-6xl'} max-h-[95vh] overflow-hidden border border-gray-600`}>
        
        {/* Header con botón de cerrar */}
        <div className="flex items-center justify-between p-4 border-b border-gray-600">
          <div className="flex items-center gap-3">
            {(selectedMethod || showCountrySelector) && !showCountrySelector && (
              <button
                onClick={handleBackToSelection}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ArrowLeft size={20} className="text-white" />
              </button>
            )}
            <h2 className="text-xl font-bold text-white">
              {showCountrySelector 
                ? 'Selecciona tu país' 
                : selectedMethod 
                  ? 'Wompi' 
                  : t('paymentMethods.buyCoins')}
            </h2>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={20} className="text-white" />
          </button>
        </div>

        {/* Notificación */}
        {notification && (
          <div className={`mx-4 mt-4 p-3 rounded-lg border ${
            notification.type === 'success'
              ? 'bg-green-500/10 border-green-500/30 text-green-400'
              : notification.type === 'error'
              ? 'bg-red-500/10 border-red-500/30 text-red-400'
              : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
          }`}>
            <div className="flex items-center gap-2">
              {notification.type === 'success' ? (
                <Check size={16} />
              ) : notification.type === 'error' ? (
                <AlertCircle size={16} />
              ) : (
                <ExternalLink size={16} />
              )}
              <span className="text-sm font-medium">{notification.message}</span>
            </div>
          </div>
        )}

        {/* Contenido principal */}
        <div className="overflow-auto max-h-[calc(95vh-80px)]">
          {showCountrySelector ? (
            <CountrySelector 
              onSelect={handleCountrySelect}
              onClose={onClose}
            />
          ) : !selectedMethod ? (
            <PaymentMethodSelector />
          ) : selectedMethod === 'wompi' ? (
            <WompiPayment 
              onClose={onClose} 
              selectedCountry={selectedCountry}
              onCountryChange={() => {
                setShowCountrySelector(true);
                setSelectedMethod(null);
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
