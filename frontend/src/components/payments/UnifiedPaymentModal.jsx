import React, { useState, useEffect } from 'react';
import { 
  Coins,
  CreditCard, 
  Wallet,
  MapPin,
  Bitcoin,
  X,
  ArrowLeft,
  Star,
  Shield,
  Check,
  AlertCircle,
  Loader,
  ExternalLink
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Importar componentes independientes
import CoinbaseCommerceBuyCoins from './CoinbaseCommerceBuyCoins';
import WompiPayment from './WompiPayment';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function UnifiedPaymentModal({ onClose }) {
  const { t } = useTranslation();
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [loading, setLoading] = useState(true);
  
  console.log('🎯 UnifiedPaymentModal renderizado:', { selectedMethod, loading });
  const [paymentMethods, setPaymentMethods] = useState({
    coinbase: { available: false, config: null },
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
    initializePaymentMethods();
  }, []);

  const initializePaymentMethods = async () => {
    try {
      setLoading(true);
      
      // Verificar disponibilidad de ambos métodos de pago de forma independiente
      const [coinbaseResult, wompiResult] = await Promise.allSettled([
        checkCoinbaseAvailability(),
        checkWompiAvailability()
      ]);

      // Procesar resultados independientemente
      const methods = { coinbase: { available: false }, wompi: { available: false } };

      if (coinbaseResult.status === 'fulfilled' && coinbaseResult.value) {
        methods.coinbase = {
          available: true,
          config: coinbaseResult.value
        };
      }

      if (wompiResult.status === 'fulfilled' && wompiResult.value) {
        methods.wompi = {
          available: true,
          config: wompiResult.value
        };
      }

      setPaymentMethods(methods);

      // Si solo hay un método disponible, seleccionarlo automáticamente
      const availableMethods = Object.keys(methods).filter(key => methods[key].available);
      if (availableMethods.length === 1) {
        setSelectedMethod(availableMethods[0]);
      }

    } catch (error) {
      console.error('Error inicializando métodos de pago:', error);
      showNotification(t('paymentMethods.errorLoadingMethods'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const checkCoinbaseAvailability = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/coinbase-commerce/config`, {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.success ? data : null;
      }
      return null;
    } catch (error) {
      console.error('Error verificando Coinbase Commerce:', error);
      return null;
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
      console.error('Error verificando Wompi:', error);
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
    const { coinbase, wompi } = paymentMethods;
    const availableCount = Object.values(paymentMethods).filter(m => m.available).length;

    if (availableCount === 0) {
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

    return (
      <div className="p-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-[#ff007a] to-[#ff4081] rounded-full flex items-center justify-center">
              <Coins size={24} className="text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              {t('paymentMethods.selectPaymentMethod')}
            </h1>
          </div>
          <p className="text-white/70">
            {t('paymentMethods.choosePreferredMethod')}
          </p>
        </div>

        {/* Métodos de pago */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          
          {/* Coinbase Commerce */}
          {coinbase.available && (
            <div
              onClick={() => handleMethodSelect('coinbase')}
              className="bg-[#2b2d31] rounded-xl p-6 border-2 border-gray-600 hover:border-blue-500/50 cursor-pointer transition-all duration-300 hover:scale-[1.02] group"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <Wallet size={32} className="text-white" />
                </div>
                
                <h3 className="text-xl font-bold text-white mb-2">Coinbase Commerce</h3>
                <p className="text-white/60 text-sm mb-4">
                  {t('paymentMethods.coinbase.description')}
                </p>

                {/* Características */}
                <div className="space-y-2 mb-6">
                  <div className="flex items-center gap-2 text-sm text-white/70">
                    <Bitcoin size={16} className="text-orange-400" />
                    <span>{t('paymentMethods.coinbase.cryptos')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-white/70">
                    <Shield size={16} className="text-green-400" />
                    <span>{t('paymentMethods.coinbase.noVolatility')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-white/70">
                    <Check size={16} className="text-blue-400" />
                    <span>{t('paymentMethods.coinbase.instantConfirmation')}</span>
                  </div>
                </div>

                {/* Ventajas */}
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mb-4">
                  <div className="text-xs text-blue-400 font-semibold mb-1">
                    {t('paymentMethods.idealFor')}:
                  </div>
                  <div className="text-xs text-white/80">
                    • {t('paymentMethods.coinbase.cryptoUsers')}<br/>
                    • {t('paymentMethods.coinbase.internationalPayments')}<br/>
                    • {t('paymentMethods.coinbase.maxPrivacy')}
                  </div>
                </div>

                {/* Badge del ambiente */}
                {coinbase.config?.sandbox && (
                  <div className="inline-block bg-yellow-500/20 border border-yellow-500/30 rounded-full px-3 py-1 mb-4">
                    <span className="text-yellow-400 text-xs font-medium">
                      {t('common.sandboxMode')}
                    </span>
                  </div>
                )}

                <button className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white py-3 px-4 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2">
                  <Wallet size={18} />
                  {t('paymentMethods.coinbase.payWithCrypto')}
                </button>
              </div>
            </div>
          )}
          {/* Wompi */}
          {wompi.available && (
            <div
              onClick={() => handleMethodSelect('wompi')}
              className="bg-[#2b2d31] rounded-xl p-6 border-2 border-gray-600 hover:border-green-500/50 cursor-pointer transition-all duration-300 hover:scale-[1.02] group"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <CreditCard size={32} className="text-white" />
                </div>
                
                <h3 className="text-xl font-bold text-white mb-2">Wompi</h3>
                <p className="text-white/60 text-sm mb-4">
                  {t('paymentMethods.wompi.description')}
                </p>

                {/* Características */}
                <div className="space-y-2 mb-6">
                  <div className="flex items-center gap-2 text-sm text-white/70">
                    <CreditCard size={16} className="text-blue-400" />
                    <span>{t('paymentMethods.wompi.cards')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-white/70">
                    <MapPin size={16} className="text-green-400" />
                    <span>{t('paymentMethods.wompi.pse')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-white/70">
                    <Check size={16} className="text-yellow-400" />
                    <span>{t('paymentMethods.wompi.otherMethods')}</span>
                  </div>
                </div>

                {/* Ventajas */}
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 mb-4">
                  <div className="text-xs text-green-400 font-semibold mb-1">
                    {t('paymentMethods.idealFor')}:
                  </div>
                  <div className="text-xs text-white/80">
                    • {t('paymentMethods.wompi.colombianUsers')}<br/>
                    • {t('paymentMethods.wompi.internationalCards')}<br/>
                    • {t('paymentMethods.wompi.bankTransfers')}
                  </div>
                </div>

                {/* Badge del ambiente */}
                {wompi.config?.sandbox && (
                  <div className="inline-block bg-yellow-500/20 border border-yellow-500/30 rounded-full px-3 py-1 mb-4">
                    <span className="text-yellow-400 text-xs font-medium">
                      {t('common.sandboxMode')}
                    </span>
                  </div>
                )}

                <button className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white py-3 px-4 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2">
                  <CreditCard size={18} />
                  {t('paymentMethods.wompi.payWithWompi')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Información adicional */}
        <div className="mt-8 text-center">
          <div className="bg-[#1a1c20] rounded-lg p-4 border border-gray-600">
            <h4 className="text-white font-semibold mb-2 flex items-center justify-center gap-2">
              <Shield className="text-blue-400" size={18} />
              {t('paymentMethods.allPaymentsSecure')}
            </h4>
            <p className="text-white/60 text-sm">
              {t('paymentMethods.securityDescription')}
            </p>
          </div>
        </div>

        {/* Comparación rápida */}
        {coinbase.available && wompi.available && (
          <div className="mt-6">
            <div className="bg-[#1a1c20] rounded-lg p-4 border border-gray-600">
              <h4 className="text-white font-semibold mb-3 text-center">
                {t('paymentMethods.quickComparison')}
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-blue-400 font-semibold mb-1">Coinbase Commerce</div>
                  <div className="text-white/60">
                    ✓ {t('paymentMethods.comparison.cryptocurrencies')}<br/>
                    ✓ {t('paymentMethods.comparison.international')}<br/>
                    ✓ {t('paymentMethods.comparison.noBanks')}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-green-400 font-semibold mb-1">Wompi</div>
                  <div className="text-white/60">
                    ✓ {t('paymentMethods.comparison.traditionalCards')}<br/>
                    ✓ {t('paymentMethods.comparison.pseColombia')}<br/>
                    ✓ {t('paymentMethods.comparison.colombianPesos')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-[500px] flex items-center justify-center">
        <div className="text-center">
          <Loader className="animate-spin text-[#ff007a] mx-auto mb-4" size={48} />
          <p className="text-white/70">{t('paymentMethods.loadingMethods')}</p>
        </div>
      </div>
    );
  }

  console.log('🎨 Renderizando UnifiedPaymentModal JSX, selectedMethod:', selectedMethod, 'loading:', loading);
  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" style={{ display: 'flex' }}>
      <div className="bg-[#1a1c20] rounded-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden border border-gray-600">
        
        {/* Header con botón de cerrar */}
        <div className="flex items-center justify-between p-4 border-b border-gray-600">
          <div className="flex items-center gap-3">
            {selectedMethod && (
              <button
                onClick={handleBackToSelection}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ArrowLeft size={20} className="text-white" />
              </button>
            )}
            <h2 className="text-xl font-bold text-white">
              {selectedMethod ? (
                selectedMethod === 'coinbase' ? 'Coinbase Commerce' : 'Wompi'
              ) : (
                t('paymentMethods.buyCoins')
              )}
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
          {!selectedMethod ? (
            <PaymentMethodSelector />
          ) : selectedMethod === 'coinbase' ? (
            <CoinbaseCommerceBuyCoins onClose={onClose} />
          ) : selectedMethod === 'wompi' ? (
            <WompiPayment onClose={onClose} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
