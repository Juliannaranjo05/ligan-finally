import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { 
  CreditCard,
  Star, 
  Check, 
  AlertCircle, 
  Loader,
  Gift,
  Shield,
  DollarSign,
  X,
  Lock,
  Wallet,
  Heart,
  ExternalLink,
  RefreshCw,
  MapPin,
  Building2,
  ArrowLeft,
  Clock
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function WompiPayment({ onClose, selectedCountry, onCountryChange }) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [packages, setPackages] = useState([]);
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [showPaymentWindow, setShowPaymentWindow] = useState(false);
  const [notification, setNotification] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [purchaseHistory, setPurchaseHistory] = useState([]);
  const [activePackageType, setActivePackageType] = useState('minutes');
  const [wompiConfig, setWompiConfig] = useState(null);
  const [purchaseId, setPurchaseId] = useState(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [wompiData, setWompiData] = useState(null);
  const [redirectCountdown, setRedirectCountdown] = useState(3);
  const [paymentUrl, setPaymentUrl] = useState(null);
  const [showBuyMinutesSidebar, setShowBuyMinutesSidebar] = useState(false);
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  
  // Obtener país desde localStorage si no viene como prop
  const country = selectedCountry || (() => {
    const saved = localStorage.getItem('selected_country');
    return saved ? JSON.parse(saved) : null;
  })();

  // Debug: Log cuando cambia el estado del sidebar
  useEffect(() => {
  }, [showBuyMinutesSidebar, packages, activePackageType]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  useEffect(() => {
    const initializeWompi = async () => {
      try {
        await Promise.all([
          fetchWompiConfig(),
          fetchPackages(), 
          fetchBalance(),
          fetchPurchaseHistory()
        ]);
      } catch (error) {
        showNotification(t('wompi.errors.configurationError'), 'error');
      } finally {
        setLoading(false);
      }
    };

    // Solo inicializar si hay un país seleccionado
    if (country) {
      initializeWompi();
    } else {
      setLoading(false);
    }
  }, [country]);

  // 🔥 FUNCIÓN PARA VERIFICAR ESTADO DEL PAGO
  const checkPurchaseStatus = async (purchaseIdToCheck) => {
    if (checkingStatus && !purchaseIdToCheck) return false;
    
    setCheckingStatus(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/wompi/status/${purchaseIdToCheck}`, {
        headers: getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();

      if (!data.success) {
        console.error('Error en respuesta del servidor:', data.error);
        return false;
      }

      // 🔥 VERIFICAR SI SE PROCESÓ EN ESTA VERIFICACIÓN
      if (data.processed) {
        console.log('✅ Pago procesado en esta verificación');
      }

      if (data.purchase.status === 'completed') {
        // Pago completado
        showNotification(
          t('wompi.notifications.paymentCompleted', { coins: data.purchase.total_coins }) || 
          `¡Pago completado! Se agregaron ${data.purchase.total_coins} monedas`,
          'success'
        );
        
        // Actualizar balance e historial
        await Promise.all([
          fetchBalance(),
          fetchPurchaseHistory()
        ]);
        
        // Marcar como completado para mostrar botón de finalizar
        setPaymentCompleted(true);
        
        // Limpiar purchaseId para detener el polling
        setPurchaseId(null);
        
        // Limpiar parámetros de URL si existen
        const newParams = new URLSearchParams(searchParams);
        if (newParams.get('payment') === 'wompi') {
          newParams.delete('payment');
          newParams.delete('purchase_id');
          setSearchParams(newParams, { replace: true });
        }
        
        return true; // Indica que el pago se completó
      }
      
      // Si sigue pendiente, mostrar mensaje informativo
      if (data.purchase.status === 'pending') {
        console.log('⏳ Pago aún pendiente, continuando verificación...');
      }
      
      return false; // Pago aún pendiente

    } catch (error) {
      console.error('❌ Error verificando estado del pago:', error);
      showNotification('Error al verificar el estado del pago. Intenta nuevamente.', 'error');
      return false;
    } finally {
      setCheckingStatus(false);
    }
  };

  // 🔥 VERIFICAR PAGO CUANDO EL USUARIO REGRESA DE WOMPI
  useEffect(() => {
    const urlPurchaseId = searchParams.get('purchase_id');
    const payment = searchParams.get('payment');
    
    if (payment === 'wompi' && urlPurchaseId) {
      // Usuario regresó de Wompi - verificar estado inmediatamente
      console.log('🔄 Usuario regresó de Wompi, verificando pago...', { purchase_id: urlPurchaseId });
      
      // Establecer purchaseId para activar el polling
      setPurchaseId(urlPurchaseId);
      
      // Verificar estado inmediatamente
      checkPurchaseStatus(urlPurchaseId).then((completed) => {
        if (!completed) {
          // Si sigue pendiente, iniciar polling agresivo
          console.log('⏳ Pago aún pendiente, iniciando polling...');
        } else {
          // Limpiar parámetros de URL
          searchParams.delete('payment');
          searchParams.delete('purchase_id');
          setSearchParams(searchParams, { replace: true });
        }
      });
    }
  }, [searchParams, setSearchParams]);

  // Polling para verificar estado de compras pendientes - MÁS AGRESIVO
  useEffect(() => {
    if (purchaseId) {
      // Verificar inmediatamente
      checkPurchaseStatus(purchaseId);
      
      // Luego verificar cada 3 segundos
      const interval = setInterval(() => {
        checkPurchaseStatus(purchaseId);
      }, 3000); // ⚡ Verificar cada 3 segundos para respuesta más rápida

      return () => clearInterval(interval);
    }
  }, [purchaseId]);

  // Countdown para redirección automática
  useEffect(() => {
    if (showPaymentWindow && paymentUrl && redirectCountdown > 0) {
      const timer = setTimeout(() => {
        setRedirectCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (showPaymentWindow && paymentUrl && redirectCountdown === 0) {
      // Redirigir automáticamente
      window.open(paymentUrl, '_blank');
    }
  }, [showPaymentWindow, paymentUrl, redirectCountdown]);

  const fetchWompiConfig = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/wompi/config`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (data.success) {
        setWompiConfig(data);
      }
    } catch (error) {
    }
  };

  const fetchBalance = async () => {
    try {
      const minutesResponse = await fetch(`${API_BASE_URL}/api/coins/balance`, {
        headers: getAuthHeaders()
      });
      const minutesData = await minutesResponse.json();

      let combinedBalance = {
        purchased_coins: 0,
        gift_coins: 0,
        total_coins: 0,
        minutes_available: 0,
        gift_balance: 0,
        total_received_gifts: 0,
        total_sent_gifts: 0
      };

      if (minutesData.success) {
        combinedBalance.purchased_coins = minutesData.balance.purchased_coins || 0;
        combinedBalance.gift_coins = minutesData.balance.gift_coins || 0;
        combinedBalance.total_coins = minutesData.balance.total_coins || 0;
        combinedBalance.minutes_available = minutesData.balance.minutes_available || 0;
      }

      // Intentar obtener balance de gifts, pero no fallar si no está disponible
      try {
        const giftsResponse = await fetch(`${API_BASE_URL}/api/gifts/balance`, {
          headers: getAuthHeaders()
        });
        const giftsData = await giftsResponse.json();

        if (giftsData.success) {
          combinedBalance.gift_balance = giftsData.balance.gift_balance || 0;
          combinedBalance.total_received_gifts = giftsData.balance.total_received || 0;
          combinedBalance.total_sent_gifts = giftsData.balance.total_sent || 0;
        }
      } catch (giftsError) {
        // API de gifts no disponible, continuar sin ella
      }

      setBalance(combinedBalance);
    } catch (error) {
    }
  };

  const fetchPackages = async () => {
    try {
      // Enviar país seleccionado en los parámetros
      const params = new URLSearchParams();
      if (country) {
        params.append('country_code', country.code);
        params.append('currency', country.currency);
        params.append('price_per_hour', country.pricePerHour.toString());
      }
      
      const response = await fetch(`${API_BASE_URL}/api/wompi/packages?${params.toString()}`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (data.success && data.packages) {
        setPackages(data.packages);
      } else {
        showNotification('Error al cargar paquetes. Intenta recargar la página.', 'error');
      }
    } catch (error) {
      showNotification('Error de conexión al cargar paquetes.', 'error');
    }
  };

  const fetchPurchaseHistory = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/wompi/history`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (data.success) {
        setPurchaseHistory((data.purchases.data || []).slice(0, 3));
      }
    } catch (error) {
    }
  };

  const getFilteredPackages = () => {
    const filtered = packages.filter(pkg => pkg.type === activePackageType);
    // debug summary removed
    return filtered;
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const selectPackage = async (pkg) => {
    setSelectedPackage(pkg);
    setProcessing(true);
    
    try {
      // Detectar modo automáticamente
      const configResponse = await fetch(`${API_BASE_URL}/api/wompi/config`, {
        headers: getAuthHeaders()
      });
      const config = await configResponse.json();
      
      // Usar ruta según el modo
      const endpoint = config.sandbox 
        ? '/api/wompi/sandbox-purchase'
        : '/api/wompi/create-payment';
      
      
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          package_id: pkg.id,
          currency: country?.currency || 'COP',
          price_per_hour: country?.pricePerHour || 30
        })
      });

      const data = await response.json();

      if (data.success) {
        if (config.sandbox) {
          // SANDBOX: Redirigir a Wompi sandbox (mismo flujo que producción)
          setWompiData(data.wompi_data);
          setPurchaseId(data.purchase_id);
          
          // Crear URL de pago de Wompi sandbox
          const paymentParams = new URLSearchParams({
            'public-key': data.wompi_data.public_key,
            'currency': data.wompi_data.currency || 'COP',
            'amount-in-cents': data.wompi_data.amount_in_cents,
            'reference': data.wompi_data.reference,
            'signature:integrity': data.wompi_data.signature_integrity
          });

          // Agregar datos opcionales
          if (data.wompi_data.customer_email) {
            paymentParams.append('customer-data:email', data.wompi_data.customer_email);
          }
          if (data.wompi_data.customer_full_name) {
            paymentParams.append('customer-data:full-name', data.wompi_data.customer_full_name);
          }

          // Añadir URLs de redirección si están disponibles (muestra botón "Volver al comercio" / "Finalizar")
          if (data.wompi_data.redirect_url) {
            paymentParams.append('redirect-url', data.wompi_data.redirect_url);
            paymentParams.append('redirect_url', data.wompi_data.redirect_url);
          }
          if (data.wompi_data.cancel_url) {
            paymentParams.append('cancel-url', data.wompi_data.cancel_url);
            paymentParams.append('cancel_url', data.wompi_data.cancel_url);
          }

          // Añadir teléfono del cliente si existe
          if (data.wompi_data.customer_phone) {
            paymentParams.append('customer-data:phone', data.wompi_data.customer_phone);
          }
          
          const fullPaymentUrl = `https://checkout.wompi.co/p/?${paymentParams.toString()}`;
          setPaymentUrl(fullPaymentUrl);
          setShowPaymentWindow(true);
          setRedirectCountdown(3);
          
          showNotification(
            t('wompi.notifications.paymentCreated') + ' (Sandbox)',
            'success'
          );
          
        } else {
          // PRODUCCIÓN: Mostrar página de verificación y redirigir
          setWompiData(data.wompi_data);
          setPurchaseId(data.purchase_id);
          
          // Crear URL de pago de Wompi
          const paymentParams = new URLSearchParams({
            'public-key': data.wompi_data.public_key,
            'currency': data.wompi_data.currency || 'COP',
            'amount-in-cents': data.wompi_data.amount_in_cents,
            'reference': data.wompi_data.reference,
            'signature:integrity': data.wompi_data.signature_integrity
          });

          // Agregar datos opcionales
          if (data.wompi_data.customer_email) {
            paymentParams.append('customer-data:email', data.wompi_data.customer_email);
          }
          if (data.wompi_data.customer_full_name) {
            paymentParams.append('customer-data:full-name', data.wompi_data.customer_full_name);
          }

          // Añadir URLs de redirección si están disponibles (muestra botón "Volver al comercio" / "Finalizar")
          if (data.wompi_data.redirect_url) {
            paymentParams.append('redirect-url', data.wompi_data.redirect_url);
            paymentParams.append('redirect_url', data.wompi_data.redirect_url);
          }
          if (data.wompi_data.cancel_url) {
            paymentParams.append('cancel-url', data.wompi_data.cancel_url);
            paymentParams.append('cancel_url', data.wompi_data.cancel_url);
          }

          // Añadir teléfono del cliente si existe
          if (data.wompi_data.customer_phone) {
            paymentParams.append('customer-data:phone', data.wompi_data.customer_phone);
          }
          
          const fullPaymentUrl = `https://checkout.wompi.co/p/?${paymentParams.toString()}`;
          setPaymentUrl(fullPaymentUrl);
          setShowPaymentWindow(true);
          setRedirectCountdown(3); // Reiniciar countdown
          
          showNotification(
            t('wompi.notifications.paymentCreated'),
            'success'
          );
        }
        
      } else {
        showNotification(data.error || t('wompi.errors.createPayment'), 'error');
      }

    } catch (error) {
      showNotification(t('wompi.errors.connectionError'), 'error');
    } finally {
      setProcessing(false);
    }
  };


  const handleCancel = () => {
    setShowPaymentWindow(false);
    setSelectedPackage(null);
    setPurchaseId(null);
    setWompiData(null);
    setPaymentUrl(null);
    setRedirectCountdown(3);
    setPaymentCompleted(false);
  };

  const handleManualRedirect = () => {
    if (paymentUrl) {
      window.open(paymentUrl, '_blank');
    }
  };

  const formatCoins = (coins) => {
    return coins ? `${coins.toLocaleString()}` : '0';
  };

  const formatMinutesFromCoins = (coins, costPerMinute = 10) => {
    const minutes = Math.floor(coins / costPerMinute);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${mins}m`;
  };

  const formatCOP = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <Loader className="animate-spin text-[#ff007a] mx-auto mb-4" size={48} />
          <p className="text-white/70">{t('wompi.loading')}</p>
        </div>
      </div>
    );
  }

  // debug: removed UI summary

  return (
    <div className="text-white w-full max-w-7xl mx-auto overflow-auto px-2 sm:px-4 lg:px-6">
      {/* Notificación */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 p-3 sm:p-4 rounded-lg shadow-lg max-w-xs sm:max-w-sm ${
          notification.type === 'success'
            ? 'bg-green-500/90 border border-green-400'
            : 'bg-red-500/90 border border-red-400'
        }`}>
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <Check size={18} className="text-white flex-shrink-0" />
            ) : (
              <AlertCircle size={18} className="text-white flex-shrink-0" />
            )}
            <p className="text-white font-medium text-sm">{notification.message}</p>
          </div>
        </div>
      )}

      {!showPaymentWindow ? (
        <div className="py-4 sm:py-6">
          {/* Header */}
          <div className="text-center mb-6 sm:mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center">
                <CreditCard size={20} sm:size={24} className="text-white" />
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-white">
                {activePackageType === 'minutes' ? t('wompi.title.buyMinutes') : t('wompi.title.sendGifts')}
              </h1>
            </div>

            {/* Badge de Wompi y País */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mb-4 sm:mb-6">
              <div className="inline-flex items-center gap-2 bg-green-500/20 border border-green-500/30 rounded-full px-3 py-2">
                <MapPin size={14} className="text-green-400" />
                <span className="text-green-400 text-xs sm:text-sm font-medium">
                  {t('wompi.poweredBy')}
                </span>
              </div>
              {country && (
                <div className="inline-flex items-center gap-2 bg-[#2b2d31] border border-[#ff007a]/30 rounded-full px-3 py-2">
                  <span className="text-lg">{country.flag}</span>
                  <span className="text-white text-xs sm:text-sm font-medium">
                    {country.name}
                  </span>
                  <span className="text-white/60 text-xs">
                    ${country.pricePerHour}/hora
                  </span>
                  {onCountryChange && (
                    <button
                      onClick={() => {
                        if (onCountryChange) {
                          onCountryChange();
                        }
                      }}
                      className="ml-2 p-1 hover:bg-[#3a3d44] rounded transition-colors"
                      title="Cambiar país"
                    >
                      <X size={12} className="text-white/60 hover:text-white" />
                    </button>
                  )}
                </div>
              )}
            </div>
            {/* Balance */}
            <div className="bg-[#2b2d31] rounded-xl p-4 sm:p-6 mb-4 sm:mb-6 border border-[#ff007a]/20">
              <div className="text-center">
                <p className="text-white/70 mb-3 text-sm sm:text-base">{t('balances.currentBalance')}</p>
                
                {balance && (
                  <>
                    {activePackageType === 'minutes' ? (
                      <>
                        <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#ff007a] mb-2">
                          {formatCoins(balance.total_coins)} {t('common.coins')}
                        </div>
                        <div className="text-base sm:text-lg text-blue-400 mb-3">
                          ≈ {formatMinutesFromCoins(balance.total_coins)} {t('wompi.balances.availableForVideochat')}
                        </div>
                        <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-4 text-sm">
                          <div className="bg-[#1a1c20] rounded-lg p-2 sm:p-3">
                            <div className="text-white/60 text-xs sm:text-sm">{t('balance.purchased')}</div>
                            <div className="text-green-400 font-bold text-sm sm:text-base">{formatCoins(balance.purchased_coins)}</div>
                          </div>
                          <div className="bg-[#1a1c20] rounded-lg p-2 sm:p-3">
                            <div className="text-white/60 text-xs sm:text-sm">{t('balance.giftMinutes')}</div>
                            <div className="text-yellow-400 font-bold text-sm sm:text-base">{formatCoins(balance.gift_coins)}</div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#ff007a] mb-2">
                          {formatCoins(balance.gift_balance)} {t('balance.giftCoins')}
                        </div>
                        <div className="text-base sm:text-lg text-yellow-400 mb-3">
                          {t('wompi.balances.availableForGifts')}
                        </div>
                        <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-4 text-sm">
                          <div className="bg-[#1a1c20] rounded-lg p-2 sm:p-3">
                            <div className="text-white/60 text-xs sm:text-sm">{t('balance.received')}</div>
                            <div className="text-green-400 font-bold text-sm sm:text-base">{formatCoins(balance.total_received_gifts)}</div>
                          </div>
                          <div className="bg-[#1a1c20] rounded-lg p-2 sm:p-3">
                            <div className="text-white/60 text-xs sm:text-sm">{t('balance.sent')}</div>
                            <div className="text-orange-400 font-bold text-sm sm:text-base">{formatCoins(balance.total_sent_gifts)}</div>
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Selector de tipo de paquete */}
          <div className="flex justify-center mb-6 sm:mb-8">
            <div className="bg-[#2b2d31] rounded-xl p-1 sm:p-2 border border-gray-600 w-full max-w-md">
              <div className="grid grid-cols-2 gap-1 sm:gap-2">
                <button
                  onClick={() => setActivePackageType('minutes')}
                  className={`px-3 py-2 sm:px-6 sm:py-3 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 text-sm sm:text-base ${
                    activePackageType === 'minutes'
                      ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg'
                      : 'text-white/70 hover:text-white hover:bg-[#1a1c20]'
                  }`}
                >
                  <CreditCard size={16} />
                  <span className="hidden sm:inline">{t('buttons.buy')}</span> {t('common.minutes')}
                </button>
                <button
                  onClick={() => setActivePackageType('gifts')}
                  className={`px-3 py-2 sm:px-6 sm:py-3 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 text-sm sm:text-base ${
                    activePackageType === 'gifts'
                      ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg'
                      : 'text-white/70 hover:text-white hover:bg-[#1a1c20]'
                  }`}
                >
                  <Gift size={16} />
                  <span className="hidden sm:inline">{t('buttons.send')}</span> {t('common.gifts')}
                </button>
              </div>
            </div>
          </div>

          {/* Paquetes */}
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader className="animate-spin text-green-500" size={48} />
            </div>
          ) : getFilteredPackages().length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="mx-auto mb-4 text-yellow-500" size={48} />
              <p className="text-white/80 text-lg mb-2">
                {activePackageType === 'minutes' 
                  ? 'No hay paquetes de minutos disponibles' 
                  : 'No hay paquetes de regalos disponibles'}
              </p>
              <p className="text-white/60 text-sm">
                Por favor, intenta recargar la página o contacta al soporte.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
            {getFilteredPackages().map((pkg) => {
              const isGiftPackage = pkg.type === 'gifts';

              return (
                <div
                  key={pkg.id}
                  className={`relative bg-[#2b2d31] rounded-xl p-4 sm:p-6 border-2 transition-all duration-300 hover:scale-[1.02] cursor-pointer ${
                    pkg.is_popular
                      ? 'border-green-500 shadow-lg shadow-green-500/20'
                      : 'border-gray-600 hover:border-green-500/50'
                  } ${processing ? 'pointer-events-none opacity-50' : ''}`}
                  onClick={() => !processing && selectPackage(pkg)}
                >
                  {pkg.is_popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <div className="bg-gradient-to-r from-green-500 to-green-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                        <Star size={12} fill="currentColor" />
                        {t('packages.mostPopular')}
                      </div>
                    </div>
                  )}

                  <div className="text-center">
                    <h3 className="text-base sm:text-lg font-bold mb-3">{pkg.name}</h3>

                    <div className="mb-4">
                      <div className="text-xl sm:text-2xl font-bold text-[#ff007a] mb-1">
                        {formatCoins(pkg.coins)} {t('common.coins')}
                      </div>
                      
                      {pkg.bonus_coins > 0 && (
                        <div className="flex items-center justify-center gap-1 text-yellow-400 text-xs sm:text-sm">
                          <Gift size={12} />
                          +{formatCoins(pkg.bonus_coins)} {t('packages.free')}
                        </div>
                      )}
                      
                      {!isGiftPackage && (
                        <div className="text-blue-400 text-xs sm:text-sm mt-1">
                          ≈ {formatMinutesFromCoins(pkg.total_coins)} {t('packages.videochatTime')}
                        </div>
                      )}
                    </div>

                    <div className="mb-4">
                      {/* Precio principal en USD */}
                      <div className="text-lg sm:text-xl font-bold mb-1 text-green-400">
                        ${pkg.price_usd} USD
                      </div>
                      
                      {/* Precio en EUR si está disponible */}
                      {pkg.price_eur && (
                        <div className="text-sm text-white/60 mb-2">
                          ≈ €{pkg.price_eur} EUR
                        </div>
                      )}
                      
                      {/* Precio por moneda */}
                      <div className="text-xs text-white/40">
                        ${(pkg.price_usd / pkg.total_coins).toFixed(3)} {t('packages.perCoin')}
                      </div>
                    </div>
                    
                    <button
                      disabled={processing}
                      className={`w-full py-2 sm:py-3 px-4 rounded-lg font-semibold transition-all duration-200 disabled:opacity-50 text-sm sm:text-base ${
                        pkg.is_popular
                          ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white'
                          : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <CreditCard size={16} />
                        {t('wompi.payWithWompi')}
                      </div>
                    </button>
                  </div>
                </div>
              );
            })}
            </div>
          )}

          {/* Ventajas de Wompi */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
            <div className="bg-[#2b2d31] rounded-xl p-3 sm:p-6 text-center border border-green-500/20">
              <CreditCard className="text-green-400 mx-auto mb-2 sm:mb-3" size={24} />
              <h3 className="font-bold mb-1 sm:mb-2 text-sm sm:text-base">{t('wompi.features.cardsAndPSE')}</h3>
              <p className="text-white/60 text-xs sm:text-sm">
                {t('wompi.features.cardsDescription')}
              </p>
            </div>
            <div className="bg-[#2b2d31] rounded-xl p-3 sm:p-6 text-center border border-blue-500/20">
              <MapPin className="text-blue-400 mx-auto mb-2 sm:mb-3" size={24} />
              <h3 className="font-bold mb-1 sm:mb-2 text-sm sm:text-base">{t('wompi.features.colombian')}</h3>
              <p className="text-white/60 text-xs sm:text-sm">
                {t('wompi.features.colombianDescription')}
              </p>
            </div>
            <div className="bg-[#2b2d31] rounded-xl p-3 sm:p-6 text-center border border-yellow-500/20">
              <Shield className="text-yellow-400 mx-auto mb-2 sm:mb-3" size={24} />
              <h3 className="font-bold mb-1 sm:mb-2 text-sm sm:text-base">{t('wompi.features.securePayment')}</h3>
              <p className="text-white/60 text-xs sm:text-sm">
                {t('wompi.features.secureDescription')}
              </p>
            </div>
            <div className="bg-[#2b2d31] rounded-xl p-3 sm:p-6 text-center border border-red-500/20">
              <Check className="text-red-400 mx-auto mb-2 sm:mb-3" size={24} />
              <h3 className="font-bold mb-1 sm:mb-2 text-sm sm:text-base">{t('wompi.features.quickConfirmation')}</h3>
              <p className="text-white/60 text-xs sm:text-sm">
                {t('wompi.features.quickDescription')}
              </p>
            </div>
          </div>

          {/* Historial reciente */}
          {purchaseHistory.length > 0 && (
            <div className="bg-[#2b2d31] rounded-xl p-4 sm:p-6 border border-gray-600">
              <h3 className="text-lg sm:text-xl font-bold mb-4 flex items-center gap-2">
                <DollarSign className="text-green-400" size={20} />
                {t('wompi.history.recentPurchases')}
              </h3>
              <div className="space-y-3">
                {purchaseHistory.map((purchase) => (
                  <div
                    key={purchase.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-[#1a1c20] rounded-lg gap-2"
                  >
                    <div>
                      <div className="font-medium text-sm sm:text-base">
                        {formatCoins(purchase.total_coins)} {t('common.coins')}
                      </div>
                      <div className="text-xs sm:text-sm text-white/50">
                        {new Date(purchase.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-left sm:text-right">
                      <div className="font-bold text-green-400 text-sm sm:text-base">
                        ${purchase.amount} USD
                      </div>
                      <div className={`text-xs px-2 py-1 rounded-full inline-block ${
                        purchase.status === 'completed'
                          ? 'bg-green-500/20 text-green-400'
                          : purchase.status === 'pending'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {purchase.status === 'completed' 
                          ? t('wompi.status.completed')
                          : purchase.status === 'pending'
                          ? t('wompi.status.pending')
                          : t('wompi.status.failed')
                        }
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        // Pantalla de verificación y redirección
        <div className="py-4 sm:py-6">
          <div className="max-w-2xl mx-auto">
            <div className="bg-[#2b2d31] rounded-xl p-4 sm:p-6 lg:p-8 border border-green-500/20">
              
              {/* Header con botón de regreso */}
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
                >
                  <ArrowLeft size={20} />
                  <span className="text-sm sm:text-base">{t('buttons.back')}</span>
                </button>
                <div className="flex items-center gap-2 text-green-400">
                  <MapPin size={18} />
                  <span className="text-sm">{t('wompi.country.colombia')}</span>
                </div>
              </div>

              {/* Resumen del paquete */}
              <div className="bg-[#1a1c20] rounded-lg p-4 sm:p-6 border border-[#ff007a]/30 mb-6">
                <h3 className="text-lg sm:text-xl font-bold text-white mb-4 text-center">
                  {t('wompi.verification.title')}
                </h3>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-white/70 text-sm sm:text-base">{selectedPackage.name}</span>
                    <span className="text-[#ff007a] font-bold text-sm sm:text-base">
                      {formatCoins(selectedPackage.coins)} {t('common.coins')}
                    </span>
                  </div>
                  
                  {selectedPackage.bonus_coins > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-green-400 text-sm flex items-center gap-1">
                        <Gift size={14} />
                        {t('packages.bonusCoins')}
                      </span>
                      <span className="text-green-400 text-sm">
                        +{formatCoins(selectedPackage.bonus_coins)}
                      </span>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center">
                    <span className="text-white font-semibold text-sm sm:text-base">{t('wompi.verification.totalToPay')}:</span>
                    <div className="text-right">
                      <div className="text-xl sm:text-2xl font-bold text-[#ff007a]">
                        ${selectedPackage.price_usd} USD
                      </div>
                      {selectedPackage.price_eur && (
                        <div className="text-xs text-white/50 flex items-center gap-1">
                          ≈ €{selectedPackage.price_eur} EUR
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Estado de redirección */}
              <div className="text-center mb-6">
                {redirectCountdown > 0 ? (
                  <div className="bg-gradient-to-r from-blue-500/20 to-green-500/20 border border-blue-500/30 rounded-lg p-4 sm:p-6">
                    <div className="flex items-center justify-center gap-3 mb-4">
                      <Clock className="text-blue-400 animate-pulse" size={24} />
                      <h3 className="text-lg sm:text-xl font-bold text-white">
                        {t('wompi.redirect.preparingPayment')}
                      </h3>
                    </div>
                    
                    <div className="mb-4">
                      <div className="text-3xl sm:text-4xl font-bold text-blue-400 mb-2">
                        {redirectCountdown}
                      </div>
                      <p className="text-white/70 text-sm sm:text-base">
                        {t('wompi.redirect.autoRedirect')}
                      </p>
                    </div>
                    
                    <div className="w-full bg-gray-700 rounded-full h-2 mb-4">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-1000"
                        style={{ width: `${((3 - redirectCountdown) / 3) * 100}%` }}
                      />
                    </div>
                    
                    <button
                      onClick={handleManualRedirect}
                      className="bg-green-500 hover:bg-green-600 text-white py-2 px-4 sm:py-3 sm:px-6 rounded-lg font-semibold transition-colors text-sm sm:text-base"
                    >
                      {t('wompi.redirect.payNow')}
                    </button>
                  </div>
                ) : (
                  <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4 sm:p-6">
                    <div className="flex items-center justify-center gap-3 mb-4">
                      <ExternalLink className="text-green-400" size={24} />
                      <h3 className="text-lg sm:text-xl font-bold text-white">
                        {t('wompi.redirect.redirectedToWompi')}
                      </h3>
                    </div>
                    
                    <p className="text-white/70 mb-4 text-sm sm:text-base">
                      {t('wompi.redirect.newWindowOpened')}
                    </p>
                    
                    <button
                      onClick={handleManualRedirect}
                      className="bg-green-500 hover:bg-green-600 text-white py-2 px-4 sm:py-3 sm:px-6 rounded-lg font-semibold transition-colors text-sm sm:text-base flex items-center gap-2 mx-auto"
                    >
                      <ExternalLink size={16} />
                      {t('wompi.redirect.openWompiAgain')}
                    </button>
                  </div>
                )}
              </div>{/* Información del proceso */}
              <div className="bg-[#1a1c20] rounded-lg p-4 sm:p-6 border border-blue-500/20 mb-6">
                <h4 className="text-white font-semibold mb-3 flex items-center gap-2 text-sm sm:text-base">
                  <Shield className="text-blue-400" size={18} />
                  {t('wompi.process.whatHappensNow')}
                </h4>
                <div className="space-y-2 text-white/70 text-sm sm:text-base">
                  <div className="flex items-start gap-2">
                    <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold mt-0.5">1</div>
                    <span>{t('wompi.process.step1')}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold mt-0.5">2</div>
                    <span>{t('wompi.process.step2')}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold mt-0.5">3</div>
                    <span>{t('wompi.process.step3')}</span>
                  </div>
                </div>
              </div>

              {/* Verificación manual */}
              <div className="bg-[#1a1c20] rounded-lg p-4 sm:p-6 border border-yellow-500/20 mb-6">
                <h4 className="text-white font-semibold mb-3 flex items-center gap-2 text-sm sm:text-base">
                  <AlertCircle className="text-yellow-400" size={18} />
                  {t('wompi.verification.alreadyCompleted')}
                </h4>
                
                {/* Indicador de verificación automática */}
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mb-4">
                  <div className="flex items-center gap-2 text-blue-400 text-xs sm:text-sm">
                    <RefreshCw className="animate-spin" size={14} />
                    <span>{t('wompi.verification.autoChecking')}</span>
                  </div>
                </div>
                
                <p className="text-white/70 mb-4 text-xs sm:text-sm">
                  {t('wompi.verification.coinsWillAppear')}
                </p>
                
                {paymentCompleted ? (
                  <div className="space-y-3">
                    <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4 text-center">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <Check className="text-green-400" size={24} />
                        <h4 className="text-green-400 font-bold text-lg">
                          {t('wompi.verification.paymentCompleted') || '¡Pago completado!'}
                        </h4>
                      </div>
                      <p className="text-white/70 text-sm">
                        {t('wompi.verification.coinsAdded') || 'Tus monedas han sido agregadas exitosamente'}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setShowPaymentWindow(false);
                        setSelectedPackage(null);
                        setPurchaseId(null);
                        setWompiData(null);
                        setPaymentUrl(null);
                        setPaymentCompleted(false);
                        if (onClose) onClose();
                      }}
                      className="w-full bg-green-500 hover:bg-green-600 text-white py-3 px-4 rounded-lg font-semibold transition-colors text-base flex items-center justify-center gap-2"
                    >
                      <Check size={20} />
                      {t('wompi.verification.finish') || 'Finalizar'}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => checkPurchaseStatus(purchaseId)}
                    disabled={checkingStatus}
                    className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white py-2 sm:py-3 px-4 rounded-lg font-semibold transition-colors text-sm sm:text-base flex items-center justify-center gap-2"
                  >
                    {checkingStatus ? (
                      <>
                        <Loader className="animate-spin" size={16} />
                        {t('wompi.verification.checking')}
                      </>
                    ) : (
                      <>
                        <RefreshCw size={16} />
                        {t('wompi.verification.checkNow')}
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Métodos de pago aceptados */}
              <div className="bg-[#1a1c20] rounded-lg p-4 sm:p-6 border border-green-500/20">
                <h4 className="text-white font-semibold mb-3 flex items-center gap-2 text-sm sm:text-base">
                  <Building2 className="text-green-400" size={18} />
                  {t('wompi.paymentMethods.title')}
                </h4>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="bg-[#2b2d31] rounded-lg p-3 text-center">
                    <div className="text-blue-400 font-bold text-xs sm:text-sm">{t('wompi.paymentMethods.cards.title')}</div>
                    <div className="text-white/50 text-xs">{t('wompi.paymentMethods.cards.description')}</div>
                  </div>
                  <div className="bg-[#2b2d31] rounded-lg p-3 text-center">
                    <div className="text-green-400 font-bold text-xs sm:text-sm">{t('wompi.paymentMethods.pse.title')}</div>
                    <div className="text-white/50 text-xs">{t('wompi.paymentMethods.pse.description')}</div>
                  </div>
                  <div className="bg-[#2b2d31] rounded-lg p-3 text-center">
                    <div className="text-yellow-400 font-bold text-xs sm:text-sm">{t('wompi.paymentMethods.nequi.title')}</div>
                    <div className="text-white/50 text-xs">{t('wompi.paymentMethods.nequi.description')}</div>
                  </div>
                  <div className="bg-[#2b2d31] rounded-lg p-3 text-center">
                    <div className="text-red-400 font-bold text-xs sm:text-sm">{t('wompi.paymentMethods.bancolombia.title')}</div>
                    <div className="text-white/50 text-xs">{t('wompi.paymentMethods.bancolombia.description')}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar de Comprar Minutos - Renderizado con Portal */}
      {showBuyMinutesSidebar && typeof document !== 'undefined' && createPortal(
        <>
          {}
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] transition-opacity duration-300"
            onClick={() => {
              setShowBuyMinutesSidebar(false);
            }}
          />
          
          {/* Sidebar */}
          <div 
            className="fixed right-0 top-0 h-full w-full sm:w-[500px] lg:w-[600px] bg-[#1a1c20] z-[110] shadow-2xl transform transition-transform duration-300 ease-in-out overflow-y-auto border-l border-gray-700"
            style={{ transform: 'translateX(0)' }}
          >
            {/* Header del Sidebar */}
            <div className="sticky top-0 bg-[#1a1c20] border-b border-gray-700 p-4 sm:p-6 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center">
                  {activePackageType === 'minutes' ? (
                    <Wallet size={20} className="text-white" />
                  ) : (
                    <Gift size={20} className="text-white" />
                  )}
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  {activePackageType === 'minutes' ? t('wompi.title.buyMinutes') : t('wompi.title.sendGifts')}
                </h2>
              </div>
              <button
                onClick={() => setShowBuyMinutesSidebar(false)}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X size={24} className="text-white" />
              </button>
            </div>

            {/* Contenido del Sidebar */}
            <div className="p-4 sm:p-6">
              {/* Selector de tipo de paquete */}
              <div className="mb-6">
                <div className="bg-[#2b2d31] rounded-xl p-1 sm:p-2 border border-gray-600">
                  <div className="grid grid-cols-2 gap-1 sm:gap-2">
                    <button
                      onClick={() => setActivePackageType('minutes')}
                      className={`px-3 py-2 sm:px-6 sm:py-3 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 text-sm sm:text-base ${
                        activePackageType === 'minutes'
                          ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg'
                          : 'text-white/70 hover:text-white hover:bg-[#1a1c20]'
                      }`}
                    >
                      <CreditCard size={16} />
                      <span className="hidden sm:inline">{t('buttons.buy')}</span> {t('common.minutes')}
                    </button>
                    <button
                      onClick={() => setActivePackageType('gifts')}
                      className={`px-3 py-2 sm:px-6 sm:py-3 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 text-sm sm:text-base ${
                        activePackageType === 'gifts'
                          ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg'
                          : 'text-white/70 hover:text-white hover:bg-[#1a1c20]'
                      }`}
                    >
                      <Gift size={16} />
                      <span className="hidden sm:inline">{t('buttons.send')}</span> {t('common.gifts')}
                    </button>
                  </div>
                </div>
              </div>

              {/* Paquetes */}
              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <Loader className="animate-spin text-green-500" size={48} />
                </div>
              ) : getFilteredPackages().length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="mx-auto mb-4 text-yellow-500" size={48} />
                  <p className="text-white/80 text-lg mb-2">
                    {activePackageType === 'minutes' 
                      ? 'No hay paquetes de minutos disponibles' 
                      : 'No hay paquetes de regalos disponibles'}
                  </p>
                  <p className="text-white/60 text-sm">
                    Por favor, intenta recargar la página o contacta al soporte.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {getFilteredPackages().map((pkg) => {
                    const isGiftPackage = pkg.type === 'gifts';

                    return (
                      <div
                        key={pkg.id}
                        className={`relative bg-[#2b2d31] rounded-xl p-4 sm:p-6 border-2 transition-all duration-300 hover:scale-[1.02] cursor-pointer ${
                          pkg.is_popular
                            ? 'border-green-500 shadow-lg shadow-green-500/20'
                            : 'border-gray-600 hover:border-green-500/50'
                        } ${processing ? 'pointer-events-none opacity-50' : ''}`}
                        onClick={() => !processing && selectPackage(pkg)}
                      >
                        {pkg.is_popular && (
                          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                            <div className="bg-gradient-to-r from-green-500 to-green-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                              <Star size={12} fill="currentColor" />
                              {t('packages.mostPopular')}
                            </div>
                          </div>
                        )}

                        <div className="text-center">
                          <h3 className="text-base sm:text-lg font-bold mb-3">{pkg.name}</h3>

                          <div className="mb-4">
                            <div className="text-xl sm:text-2xl font-bold text-[#ff007a] mb-1">
                              {formatCoins(pkg.coins)} {t('common.coins')}
                            </div>
                            
                            {pkg.bonus_coins > 0 && (
                              <div className="flex items-center justify-center gap-1 text-yellow-400 text-xs sm:text-sm">
                                <Gift size={12} />
                                +{formatCoins(pkg.bonus_coins)} {t('packages.free')}
                              </div>
                            )}
                            
                            {!isGiftPackage && (
                              <div className="text-blue-400 text-xs sm:text-sm mt-1">
                                ≈ {formatMinutesFromCoins(pkg.total_coins)} {t('packages.videochatTime')}
                              </div>
                            )}
                          </div>

                          <div className="mb-4">
                            {/* Precio principal en USD */}
                            <div className="text-lg sm:text-xl font-bold mb-1 text-green-400">
                              ${pkg.price_usd} USD
                            </div>
                            
                            {/* Precio en EUR si está disponible */}
                            {pkg.price_eur && (
                              <div className="text-sm text-white/60 mb-2">
                                ≈ €{pkg.price_eur} EUR
                              </div>
                            )}
                            
                            {/* Precio por moneda */}
                            <div className="text-xs text-white/40">
                              ${(pkg.price_usd / pkg.total_coins).toFixed(3)} {t('packages.perCoin')}
                            </div>
                          </div>
                          
                          <button
                            disabled={processing}
                            className={`w-full py-2 sm:py-3 px-4 rounded-lg font-semibold transition-all duration-200 disabled:opacity-50 text-sm sm:text-base ${
                              pkg.is_popular
                                ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white'
                                : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white'
                            }`}
                          >
                            <div className="flex items-center justify-center gap-2">
                              <CreditCard size={16} />
                              {t('wompi.payWithWompi')}
                            </div>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}