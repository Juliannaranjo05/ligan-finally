import React, { useState, useEffect } from 'react';
import { 
  Coins,
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
  Bitcoin,
  RefreshCw
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function CoinbaseCommerceBuyCoins({ onClose }) {
  const [packages, setPackages] = useState([]);
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [showPaymentWindow, setShowPaymentWindow] = useState(false);
  const [notification, setNotification] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [purchaseHistory, setPurchaseHistory] = useState([]);
  const [activePackageType, setActivePackageType] = useState('minutes');
  const [coinbaseConfig, setCoinbaseConfig] = useState(null);
  const [paymentUrl, setPaymentUrl] = useState('');
  const [purchaseId, setPurchaseId] = useState(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  useEffect(() => {
    const initializeCoinbase = async () => {
      try {
        await Promise.all([
          fetchCoinbaseConfig(),
          fetchPackages(), 
          fetchBalance(),
          fetchPurchaseHistory()
        ]);
      } catch (error) {
        console.error('Error inicializando Coinbase Commerce:', error);
        showNotification('Error de configuración. Intenta más tarde.', 'error');
      } finally {
        setLoading(false);
      }
    };

    initializeCoinbase();
  }, []);

  // Polling para verificar estado de compras pendientes
  useEffect(() => {
    if (purchaseId && showPaymentWindow) {
      const interval = setInterval(() => {
        checkPurchaseStatus(purchaseId);
      }, 10000); // Verificar cada 10 segundos

      return () => clearInterval(interval);
    }
  }, [purchaseId, showPaymentWindow]);

  const fetchCoinbaseConfig = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/coinbase-commerce/config`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (data.success) {
        setCoinbaseConfig(data);
      }
    } catch (error) {
      console.error('Error obteniendo configuración Coinbase:', error);
    }
  };

  const fetchBalance = async () => {
    try {
      const minutesResponse = await fetch(`${API_BASE_URL}/api/coins/balance`, {
        headers: getAuthHeaders()
      });
      const minutesData = await minutesResponse.json();

      const giftsResponse = await fetch(`${API_BASE_URL}/api/gifts/balance`, {
        headers: getAuthHeaders()
      });
      const giftsData = await giftsResponse.json();

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

      if (giftsData.success) {
        combinedBalance.gift_balance = giftsData.balance.gift_balance || 0;
        combinedBalance.total_received_gifts = giftsData.balance.total_received || 0;
        combinedBalance.total_sent_gifts = giftsData.balance.total_sent || 0;
      }

      setBalance(combinedBalance);
    } catch (error) {
      console.error('Error obteniendo balance:', error);
    }
  };

  const fetchPackages = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/coinbase-commerce/packages`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (data.success) {
        setPackages(data.packages);
      }
    } catch (error) {
      console.error('Error obteniendo paquetes:', error);
    }
  };

  const fetchPurchaseHistory = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/coinbase-commerce/history`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (data.success) {
        setPurchaseHistory((data.purchases.data || []).slice(0, 3));
      }
    } catch (error) {
      console.error('Error obteniendo historial:', error);
    }
  };

  const getFilteredPackages = () => {
    return packages.filter(pkg => pkg.type === activePackageType);
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const selectPackage = async (pkg) => {
    setSelectedPackage(pkg);
    setProcessing(true);
    
    try {
      // ✅ DETECTAR MODO AUTOMÁTICAMENTE
      const configResponse = await fetch(`${API_BASE_URL}/api/coinbase-commerce/config`, {
        headers: getAuthHeaders()
      });
      const config = await configResponse.json();
      
      // ✅ USAR RUTA SEGÚN EL MODO
      const endpoint = config.sandbox 
        ? '/api/coinbase-commerce/sandbox-purchase'  // 🧪 Sandbox
        : '/api/coinbase-commerce/create-payment';   // 💰 Real
      
      console.log(`Modo: ${config.sandbox ? 'SANDBOX' : 'PRODUCCIÓN'}`);
      
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          package_id: pkg.id
        })
      });

      const data = await response.json();

      if (data.success) {
        if (config.sandbox) {
          // ✅ SANDBOX: Monedas instantáneas
          showNotification(
            `¡Compra completada! Se agregaron ${data.total_coins_added} monedas (Sandbox)`,
            'success'
          );
          
          await Promise.all([
            fetchBalance(),
            fetchPurchaseHistory()
          ]);
          
          setTimeout(() => {
            if (onClose) onClose();
          }, 2000);
          
        } else {
          // ✅ PRODUCCIÓN: Redirigir a Coinbase
          setPaymentUrl(data.hosted_url);
          setPurchaseId(data.purchase_id);
          setShowPaymentWindow(true);
          
          showNotification(
            'Pago creado. Te redirigiremos a Coinbase Commerce.',
            'success'
          );

          setTimeout(() => {
            window.open(data.hosted_url, '_blank', 'width=500,height=700');
          }, 1000);
        }
        
      } else {
        showNotification(data.error || 'Error creando el pago', 'error');
      }

    } catch (error) {
      console.error('Error creando pago:', error);
      showNotification('Error de conexión. Intenta nuevamente.', 'error');
    } finally {
      setProcessing(false);
    }
  };
  const checkPurchaseStatus = async (purchaseId) => {
    if (checkingStatus) return;
    
    setCheckingStatus(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/coinbase-commerce/status/${purchaseId}`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();

      if (data.success && data.purchase.status === 'completed') {
        // Pago completado
        showNotification(
          `¡Pago completado! Se agregaron ${data.purchase.total_coins} monedas a tu cuenta`,
          'success'
        );
        
        // Actualizar balance e historial
        await Promise.all([
          fetchBalance(),
          fetchPurchaseHistory()
        ]);
        
        // Cerrar ventana de pago
        setShowPaymentWindow(false);
        setSelectedPackage(null);
        setPurchaseId(null);
        
        // Cerrar modal después de un momento
        setTimeout(() => {
          if (onClose) onClose();
        }, 2000);
      }

    } catch (error) {
      console.error('Error verificando estado:', error);
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleCancel = () => {
    setShowPaymentWindow(false);
    setSelectedPackage(null);
    setPurchaseId(null);
    setPaymentUrl('');
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

  const formatUSD = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  // Componente de ventana de pago
  const PaymentWindow = () => (
    <div className="space-y-6">
      {/* Resumen del paquete */}
      <div className="bg-[#1a1c20] rounded-lg p-4 border border-[#ff007a]/30">
        <h3 className="text-lg font-bold text-white mb-2">Esperando Confirmación de Pago</h3>
        
        <div className="flex justify-between items-center mb-2">
          <span className="text-white/70">{selectedPackage.name}</span>
          <span className="text-[#ff007a] font-bold">
            {formatCoins(selectedPackage.coins)} monedas
          </span>
        </div>
        
        {selectedPackage.bonus_coins > 0 && (
          <div className="flex justify-between items-center mb-2">
            <span className="text-green-400 text-sm flex items-center gap-1">
              <Gift size={14} />
              Monedas bonus
            </span>
            <span className="text-green-400 text-sm">
              +{formatCoins(selectedPackage.bonus_coins)}
            </span>
          </div>
        )}
        
        <div className="border-t border-gray-600 pt-2 mt-2">
          <div className="flex justify-between items-center">
            <span className="text-white font-semibold">Total:</span>
            <span className="text-2xl font-bold text-[#ff007a]">
              {formatUSD(selectedPackage.price_usd)}
            </span>
          </div>
        </div>
      </div>

      {/* Estado del pago */}
      <div className="bg-[#1a1c20] rounded-lg p-6 border border-blue-500/20 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <Wallet className="text-blue-400 mx-auto mb-2" size={48} />
            {checkingStatus && (
              <div className="absolute -top-1 -right-1">
                <RefreshCw className="animate-spin text-blue-400" size={16} />
              </div>
            )}
          </div>
          
          <div>
            <h3 className="text-xl font-bold text-white mb-2">
              Completa tu pago en Coinbase Commerce
            </h3>
            <p className="text-white/60 text-sm mb-4">
              Una nueva ventana debería haberse abierto. Si no se abrió, haz clic en el botón de abajo.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
            <button
              onClick={() => window.open(paymentUrl, '_blank')}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white py-3 px-4 rounded-lg font-semibold transition-colors"
            >
              <ExternalLink size={18} />
              Abrir Coinbase Commerce
            </button>
            
            <button
              onClick={() => checkPurchaseStatus(purchaseId)}
              disabled={checkingStatus}
              className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white py-3 px-4 rounded-lg font-semibold transition-colors disabled:opacity-50"
            >
              {checkingStatus ? (
                <Loader className="animate-spin" size={18} />
              ) : (
                <RefreshCw size={18} />
              )}
              Verificar Estado
            </button>
          </div>

          <button
            onClick={handleCancel}
            className="w-full bg-gray-600 hover:bg-gray-500 text-white py-2 px-4 rounded-lg font-medium transition-colors mt-4"
          >
            Cancelar
          </button>
        </div>
      </div>

      {/* Monedas soportadas */}
      <div className="bg-[#1a1c20] rounded-lg p-4 border border-green-500/20">
        <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
          <Bitcoin className="text-orange-400" size={18} />
          Criptomonedas Aceptadas
        </h4>
        <div className="grid grid-cols-4 gap-3 text-center">
          <div className="bg-[#2b2d31] rounded-lg p-2">
            <div className="text-orange-400 font-bold text-sm">BTC</div>
            <div className="text-white/50 text-xs">Bitcoin</div>
          </div>
          <div className="bg-[#2b2d31] rounded-lg p-2">
            <div className="text-blue-400 font-bold text-sm">ETH</div>
            <div className="text-white/50 text-xs">Ethereum</div>
          </div>
          <div className="bg-[#2b2d31] rounded-lg p-2">
            <div className="text-green-400 font-bold text-sm">USDC</div>
            <div className="text-white/50 text-xs">USD Coin</div>
          </div>
          <div className="bg-[#2b2d31] rounded-lg p-2">
            <div className="text-yellow-400 font-bold text-sm">LTC</div>
            <div className="text-white/50 text-xs">Litecoin</div>
          </div>
        </div>
        <p className="text-white/60 text-xs mt-2 text-center">
          Y muchas más criptomonedas disponibles
        </p>
      </div>

      {/* Información de seguridad */}
      <div className="bg-[#1a1c20] rounded-lg p-4 border border-green-500/20">
        <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
          <Shield className="text-green-400" size={18} />
          Pago 100% Seguro con Coinbase Commerce
        </h4>
        <ul className="text-white/70 text-sm space-y-1">
          <li>• Conversión automática a USDC (sin volatilidad)</li>
          <li>• Confirmación instantánea en blockchain</li>
          <li>• Regulado y confiable globalmente</li>
          <li>• Soporte para más de 100 criptomonedas</li>
        </ul>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <Loader className="animate-spin text-[#ff007a] mx-auto mb-4" size={48} />
          <p className="text-white/70">Cargando Coinbase Commerce...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="text-white w-[80vw] h-[90vh] mx-auto overflow-auto">
      {/* Notificación */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm ${
          notification.type === 'success'
            ? 'bg-green-500/90 border border-green-400'
            : 'bg-red-500/90 border border-red-400'
        }`}>
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <Check size={20} className="text-white" />
            ) : (
              <AlertCircle size={20} className="text-white" />
            )}
            <p className="text-white font-medium">{notification.message}</p>
          </div>
        </div>
      )}

      {!showPaymentWindow ? (
        <div className="p-4 sm:p-6">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-[#ff007a] to-[#ff4081] rounded-full flex items-center justify-center">
                <Coins size={24} className="text-white" />
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">
                {activePackageType === 'minutes' ? 'Comprar Minutos' : 'Enviar Regalos'}
              </h1>
            </div>

            {/* Badge de Coinbase Commerce */}
            <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-500/30 rounded-full px-4 py-2 mb-6">
              <Wallet size={16} className="text-blue-400" />
              <span className="text-blue-400 text-sm font-medium">
                Powered by Coinbase Commerce - Acepta 100+ Criptomonedas
              </span>
            </div>

            {/* Balance */}
            <div className="bg-[#2b2d31] rounded-xl p-6 mb-6 border border-[#ff007a]/20">
              <div className="text-center">
                <p className="text-white/70 mb-4">Tu balance actual</p>
                
                {balance && (
                  <>
                    {activePackageType === 'minutes' ? (
                      <>
                        <div className="text-3xl sm:text-4xl font-bold text-[#ff007a] mb-2">
                          {formatCoins(balance.total_coins)} monedas
                        </div>
                        <div className="text-lg text-blue-400 mb-4">
                          ≈ {formatMinutesFromCoins(balance.total_coins)} disponibles para videochat
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                          <div className="bg-[#1a1c20] rounded-lg p-3">
                            <div className="text-white/60">Compradas</div>
                            <div className="text-green-400 font-bold">{formatCoins(balance.purchased_coins)}</div>
                          </div>
                          <div className="bg-[#1a1c20] rounded-lg p-3">
                            <div className="text-white/60">Regalo (minutos)</div>
                            <div className="text-yellow-400 font-bold">{formatCoins(balance.gift_coins)}</div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-3xl sm:text-4xl font-bold text-[#ff007a] mb-2">
                          {formatCoins(balance.gift_balance)} monedas regalo
                        </div>
                        <div className="text-lg text-yellow-400 mb-4">
                          Disponibles para enviar regalos
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                          <div className="bg-[#1a1c20] rounded-lg p-3">
                            <div className="text-white/60">Recibidos</div>
                            <div className="text-green-400 font-bold">{formatCoins(balance.total_received_gifts)}</div>
                          </div>
                          <div className="bg-[#1a1c20] rounded-lg p-3">
                            <div className="text-white/60">Enviados</div>
                            <div className="text-orange-400 font-bold">{formatCoins(balance.total_sent_gifts)}</div>
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
          <div className="flex justify-center mb-8">
            <div className="bg-[#2b2d31] rounded-xl p-2 border border-gray-600">
              <div className="flex gap-2">
                <button
                  onClick={() => setActivePackageType('minutes')}
                  className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center gap-2 ${
                    activePackageType === 'minutes'
                      ? 'bg-gradient-to-r from-[#ff007a] to-[#ff4081] text-white shadow-lg'
                      : 'text-white/70 hover:text-white hover:bg-[#1a1c20]'
                  }`}
                >
                  <Coins size={18} />
                  Comprar Minutos
                </button>
                <button
                  onClick={() => setActivePackageType('gifts')}
                  className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center gap-2 ${
                    activePackageType === 'gifts'
                      ? 'bg-gradient-to-r from-[#ff007a] to-[#ff4081] text-white shadow-lg'
                      : 'text-white/70 hover:text-white hover:bg-[#1a1c20]'
                  }`}
                >
                  <Gift size={18} />
                  Enviar Regalos
                </button>
              </div>
            </div>
          </div>

          {/* Paquetes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {getFilteredPackages().map((pkg) => {
              const isGiftPackage = pkg.type === 'gifts';

              return (
                <div
                  key={pkg.id}
                  className={`relative bg-[#2b2d31] rounded-xl p-6 border-2 transition-all duration-300 hover:scale-[1.02] cursor-pointer ${
                    pkg.is_popular
                      ? 'border-[#ff007a] shadow-lg shadow-[#ff007a]/20'
                      : 'border-gray-600 hover:border-[#ff007a]/50'
                  } ${processing ? 'pointer-events-none opacity-50' : ''}`}
                  onClick={() => !processing && selectPackage(pkg)}
                >
                  {pkg.is_popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <div className="bg-gradient-to-r from-[#ff007a] to-[#ff4081] text-white px-4 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                        <Star size={14} fill="currentColor" />
                        MÁS POPULAR
                      </div>
                    </div>
                  )}

                  <div className="text-center">
                    <h3 className="text-lg sm:text-xl font-bold mb-2">{pkg.name}</h3>

                    <div className="mb-4">
                      <div className="text-2xl sm:text-3xl font-bold text-[#ff007a] mb-1">
                        {formatCoins(pkg.coins)} monedas
                      </div>
                      
                      {pkg.bonus_coins > 0 && (
                        <div className="flex items-center justify-center gap-1 text-yellow-400 text-sm">
                          <Gift size={14} />
                          +{formatCoins(pkg.bonus_coins)} gratis
                        </div>
                      )}
                      
                      {!isGiftPackage && (
                        <div className="text-blue-400 text-sm mt-1">
                          ≈ {formatMinutesFromCoins(pkg.total_coins)} de videochat
                        </div>
                      )}
                    </div>

                    <div className="mb-4">
                      <div className="text-xl sm:text-2xl font-bold mb-1">
                        {formatUSD(pkg.price_usd)}
                      </div>
                      <div className="text-xs text-white/40">
                        {formatUSD(pkg.price_usd / pkg.total_coins)} por moneda
                      </div>
                    </div>

                    <button
                      disabled={processing}
                      className={`w-full py-3 px-4 rounded-lg font-semibold transition-all duration-200 disabled:opacity-50 ${
                        pkg.is_popular
                          ? 'bg-gradient-to-r from-[#ff007a] to-[#ff4081] hover:from-[#e6006d] hover:to-[#ff3370] text-white'
                          : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <Wallet size={18} />
                        Pagar con Crypto
                      </div>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Ventajas de Coinbase Commerce */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-[#2b2d31] rounded-xl p-6 text-center border border-blue-500/20">
              <Wallet className="text-blue-400 mx-auto mb-3" size={32} />
              <h3 className="font-bold mb-2">100+ Criptomonedas</h3>
              <p className="text-white/60 text-sm">
                Bitcoin, Ethereum, USDC, Litecoin y muchas más
              </p>
            </div>
            <div className="bg-[#2b2d31] rounded-xl p-6 text-center border border-green-500/20">
              <Shield className="text-green-400 mx-auto mb-3" size={32} />
              <h3 className="font-bold mb-2">Sin Volatilidad</h3>
              <p className="text-white/60 text-sm">
                Conversión automática a USDC para precio estable
              </p>
            </div>
            <div className="bg-[#2b2d31] rounded-xl p-6 text-center border border-yellow-500/20">
              <Lock className="text-yellow-400 mx-auto mb-3" size={32} />
              <h3 className="font-bold mb-2">Confirmación Instantánea</h3>
              <p className="text-white/60 text-sm">
                Recibe tus monedas al confirmar en blockchain
              </p>
            </div>
            <div className="bg-[#2b2d31] rounded-xl p-6 text-center border border-red-500/20">
              <Heart className="text-red-400 mx-auto mb-3" size={32} />
              <h3 className="font-bold mb-2">Coinbase Confiable</h3>
              <p className="text-white/60 text-sm">
                Plataforma líder mundial en criptomonedas
              </p>
            </div>
          </div>

          {/* Historial reciente */}
          {purchaseHistory.length > 0 && (
            <div className="bg-[#2b2d31] rounded-xl p-6 border border-gray-600">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <DollarSign className="text-green-400" size={24} />
                Compras Recientes
              </h3>
              <div className="space-y-3">
                {purchaseHistory.map((purchase) => (
                  <div
                    key={purchase.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-[#1a1c20] rounded-lg"
                  >
                    <div className="mb-2 sm:mb-0">
                      <div className="font-medium">
                        {formatCoins(purchase.total_coins)} monedas
                      </div>
                      <div className="text-sm text-white/50">
                        {new Date(purchase.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-400">
                        {formatUSD(purchase.amount)}
                      </div>
                      <div className={`text-xs px-2 py-1 rounded-full ${
                        purchase.status === 'completed'
                          ? 'bg-green-500/20 text-green-400'
                          : purchase.status === 'pending'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {purchase.status === 'completed' 
                          ? 'Completado' 
                          : purchase.status === 'pending'
                          ? 'Pendiente'
                          : 'Fallido'
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
        <div className="p-4 sm:p-6">
          <div className="max-w-2xl mx-auto">
            <div className="bg-[#2b2d31] rounded-xl p-6 sm:p-8 border border-[#ff007a]/20">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Wallet className="text-[#ff007a]" size={24} />
                  Pagar con Criptomonedas
                </h2>
                <div className="flex items-center gap-2 text-blue-400">
                  <Shield size={20} />
                  <span className="text-sm">Coinbase Commerce</span>
                </div>
              </div>

              <PaymentWindow />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}