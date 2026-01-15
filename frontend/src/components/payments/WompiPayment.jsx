import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { 
  CreditCard,
  Star, 
  Crown,
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
  const { t, i18n } = useTranslation();
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
  const [selectedPlan, setSelectedPlan] = useState(null);
  
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
      if (data.purchase.status === 'pending' || data.purchase.status === 'pending_confirmation') {
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

  const getPackageMinutes = (pkg) => {
    if (!pkg) return null;
    if (typeof pkg.minutes === 'number') return pkg.minutes;
    const totalCoins = typeof pkg.total_coins === 'number' ? pkg.total_coins : pkg.coins;
    if (typeof totalCoins !== 'number') return null;
    return Math.round(totalCoins / 10);
  };

  const locale = (i18n?.language || 'es').split('-')[0];
  const localizedCopy = {
    es: {
      gatewayNote: 'La pasarela es colombiana, por eso se mostrará en español.',
      currencyNote: 'En el checkout solo verás COP y USD.',
      minutesLabel: 'minutos',
      choosePlanLabel: 'Elegir este plan',
      plans: [
        {
          id: 'plan-15',
          label: 'PLAN 1',
          name: 'Ideal para probar',
          minutes: 15,
          priceLabel: '$6.99 USD',
          highlight: 'Ideal para probar',
          subtext: [
            'Perfecto para tu primera llamada',
            'Conversaciones rápidas con chicas'
          ]
        },
        {
          id: 'plan-30',
          label: 'PLAN 2',
          name: 'Más tiempo, más conexión',
          minutes: 30,
          priceLabel: '$12.99 USD',
          highlight: 'Más tiempo, más conexión',
          subtext: [
            'Disfruta sin prisas',
            'Mejor que pagar llamadas cortas'
          ]
        },
        {
          id: 'plan-60',
          label: 'PLAN 3',
          name: 'La mejor experiencia',
          minutes: 60,
          priceLabel: '$22.99 USD',
          highlight: 'Mejor relación valor / tiempo',
          badge: '⭐ MÁS POPULAR',
          isPopular: true,
          subtext: [
            'El favorito de los usuarios',
            'Tiempo ideal para conectar con chicas'
          ]
        },
        {
          id: 'plan-120',
          label: 'PLAN 4',
          name: 'Experiencia Premium',
          minutes: 120,
          priceLabel: '$42.99 USD',
          highlight: 'Ahorro máximo en planes pequeños',
          subtext: [
            'Pensado para usuarios frecuentes',
            'Más tiempo, mejor experiencia'
          ]
        },
        {
          id: 'plan-250',
          label: 'PLAN 5',
          name: 'Power Plan',
          minutes: 250,
          priceLabel: '$114.99 USD',
          highlight: 'Para usuarios activos',
          subtext: [
            'Mucho mejor precio por minuto',
            'Ideal para sesiones largas'
          ]
        },
        {
          id: 'plan-500',
          label: 'PLAN 6',
          name: 'Pro Plan',
          minutes: 500,
          priceLabel: '$206.99 USD',
          highlight: 'Sesiones largas sin interrupciones',
          subtext: [
            'Perfecto para quienes entran varias veces por semana'
          ]
        },
        {
          id: 'plan-1000',
          label: 'PLAN 7',
          name: 'Elite Plan',
          minutes: 1000,
          priceLabel: '$368.99 USD',
          highlight: 'El mejor valor de la plataforma',
          badge: '⭐ MEJOR VALOR',
          isBestValue: true,
          subtext: [
            'Misma cantidad de minutos que la competencia',
            'Precio claramente más bajo'
          ]
        },
        {
          id: 'plan-1500',
          label: 'PLAN 8',
          name: 'VIP Experience',
          minutes: 1500,
          priceLabel: '$460.99 USD',
          highlight: 'Experiencia VIP total',
          subtext: [
            'Máximo tiempo disponible',
            'Pensado para usuarios de alto consumo'
          ]
        }
      ]
    },
    en: {
      gatewayNote: 'The gateway is Colombian, so it will appear in Spanish.',
      currencyNote: 'At checkout you will only see COP and USD.',
      minutesLabel: 'minutes',
      choosePlanLabel: 'Choose this plan',
      plans: [
        {
          id: 'plan-15',
          label: 'PLAN 1',
          name: 'Great to try',
          minutes: 15,
          priceLabel: '$6.99 USD',
          highlight: 'Great to try',
          subtext: [
            'Perfect for your first call',
            'Quick chats with girls'
          ]
        },
        {
          id: 'plan-30',
          label: 'PLAN 2',
          name: 'More time, more connection',
          minutes: 30,
          priceLabel: '$12.99 USD',
          highlight: 'More time, more connection',
          subtext: [
            'Enjoy without rushing',
            'Better than short calls'
          ]
        },
        {
          id: 'plan-60',
          label: 'PLAN 3',
          name: 'The best experience',
          minutes: 60,
          priceLabel: '$22.99 USD',
          highlight: 'Best value for time',
          badge: '⭐ MOST POPULAR',
          isPopular: true,
          subtext: [
            'Users favorite',
            'Ideal time to connect with girls'
          ]
        },
        {
          id: 'plan-120',
          label: 'PLAN 4',
          name: 'Premium experience',
          minutes: 120,
          priceLabel: '$42.99 USD',
          highlight: 'Maximum savings vs smaller plans',
          subtext: [
            'Built for frequent users',
            'More time, better experience'
          ]
        },
        {
          id: 'plan-250',
          label: 'PLAN 5',
          name: 'Power Plan',
          minutes: 250,
          priceLabel: '$114.99 USD',
          highlight: 'For active users',
          subtext: [
            'Much better price per minute',
            'Ideal for long sessions'
          ]
        },
        {
          id: 'plan-500',
          label: 'PLAN 6',
          name: 'Pro Plan',
          minutes: 500,
          priceLabel: '$206.99 USD',
          highlight: 'Long sessions without interruptions',
          subtext: [
            'Perfect for several times a week'
          ]
        },
        {
          id: 'plan-1000',
          label: 'PLAN 7',
          name: 'Elite Plan',
          minutes: 1000,
          priceLabel: '$368.99 USD',
          highlight: 'Best value on the platform',
          badge: '⭐ BEST VALUE',
          isBestValue: true,
          subtext: [
            'Same minutes as competitors',
            'Clearly lower price'
          ]
        },
        {
          id: 'plan-1500',
          label: 'PLAN 8',
          name: 'VIP Experience',
          minutes: 1500,
          priceLabel: '$460.99 USD',
          highlight: 'Full VIP experience',
          subtext: [
            'Maximum time available',
            'Built for high-usage users'
          ]
        }
      ]
    },
    pt: {
      gatewayNote: 'A plataforma de pagamento é colombiana, por isso aparece em espanhol.',
      currencyNote: 'No checkout você verá apenas COP e USD.',
      minutesLabel: 'minutos',
      choosePlanLabel: 'Escolher este plano',
      plans: [
        {
          id: 'plan-15',
          label: 'PLANO 1',
          name: 'Ideal para testar',
          minutes: 15,
          priceLabel: '$6.99 USD',
          highlight: 'Ideal para testar',
          subtext: [
            'Perfeito para sua primeira chamada',
            'Conversas rápidas com garotas'
          ]
        },
        {
          id: 'plan-30',
          label: 'PLANO 2',
          name: 'Mais tempo, mais conexão',
          minutes: 30,
          priceLabel: '$12.99 USD',
          highlight: 'Mais tempo, mais conexão',
          subtext: [
            'Aproveite sem pressa',
            'Melhor que chamadas curtas'
          ]
        },
        {
          id: 'plan-60',
          label: 'PLANO 3',
          name: 'A melhor experiência',
          minutes: 60,
          priceLabel: '$22.99 USD',
          highlight: 'Melhor relação valor/tempo',
          badge: '⭐ MAIS POPULAR',
          isPopular: true,
          subtext: [
            'Favorito dos usuários',
            'Tempo ideal para se conectar com garotas'
          ]
        },
        {
          id: 'plan-120',
          label: 'PLANO 4',
          name: 'Experiência Premium',
          minutes: 120,
          priceLabel: '$42.99 USD',
          highlight: 'Máxima economia em planos menores',
          subtext: [
            'Feito para usuários frequentes',
            'Mais tempo, melhor experiência'
          ]
        },
        {
          id: 'plan-250',
          label: 'PLANO 5',
          name: 'Power Plan',
          minutes: 250,
          priceLabel: '$103.99 USD',
          highlight: 'Para usuários ativos',
          subtext: [
            'Preço por minuto muito melhor',
            'Ideal para sessões longas'
          ]
        },
        {
          id: 'plan-500',
          label: 'PLANO 6',
          name: 'Pro Plan',
          minutes: 500,
          priceLabel: '$187.99 USD',
          highlight: 'Sessões longas sem interrupções',
          subtext: [
            'Perfeito para quem entra várias vezes por semana'
          ]
        },
        {
          id: 'plan-1000',
          label: 'PLANO 7',
          name: 'Elite Plan',
          minutes: 1000,
          priceLabel: '$334.99 USD',
          highlight: 'Melhor valor da plataforma',
          badge: '⭐ MELHOR VALOR',
          isBestValue: true,
          subtext: [
            'Mesma quantidade de minutos da concorrência',
            'Preço claramente mais baixo'
          ]
        },
        {
          id: 'plan-1500',
          label: 'PLANO 8',
          name: 'VIP Experience',
          minutes: 1500,
          priceLabel: '$418.99 USD',
          highlight: 'Experiência VIP total',
          subtext: [
            'Tempo máximo disponível',
            'Feito para alto consumo'
          ]
        }
      ]
    },
    fr: {
      gatewayNote: 'La passerelle est colombienne, elle sera donc en espagnol.',
      currencyNote: 'Au checkout, seuls COP et USD seront affichés.',
      minutesLabel: 'minutes',
      choosePlanLabel: 'Choisir ce plan',
      plans: [
        {
          id: 'plan-15',
          label: 'PLAN 1',
          name: 'Idéal pour essayer',
          minutes: 15,
          priceLabel: '$6.99 USD',
          highlight: 'Idéal pour essayer',
          subtext: [
            'Parfait pour votre premier appel',
            'Conversations rapides avec des filles'
          ]
        },
        {
          id: 'plan-30',
          label: 'PLAN 2',
          name: 'Plus de temps, plus de connexion',
          minutes: 30,
          priceLabel: '$12.99 USD',
          highlight: 'Plus de temps, plus de connexion',
          subtext: [
            'Profitez sans vous presser',
            'Mieux que des appels courts'
          ]
        },
        {
          id: 'plan-60',
          label: 'PLAN 3',
          name: 'La meilleure expérience',
          minutes: 60,
          priceLabel: '$22.99 USD',
          highlight: 'Meilleur rapport valeur/temps',
          badge: '⭐ LE PLUS POPULAIRE',
          isPopular: true,
          subtext: [
            'Le favori des utilisateurs',
            'Temps idéal pour se connecter avec des filles'
          ]
        },
        {
          id: 'plan-120',
          label: 'PLAN 4',
          name: 'Expérience Premium',
          minutes: 120,
          priceLabel: '$42.99 USD',
          highlight: 'Économie maximale vs petits plans',
          subtext: [
            'Pensé pour les utilisateurs fréquents',
            'Plus de temps, meilleure expérience'
          ]
        },
        {
          id: 'plan-250',
          label: 'PLAN 5',
          name: 'Power Plan',
          minutes: 250,
          priceLabel: '$103.99 USD',
          highlight: 'Pour les utilisateurs actifs',
          subtext: [
            'Bien meilleur prix par minute',
            'Idéal pour les longues sessions'
          ]
        },
        {
          id: 'plan-500',
          label: 'PLAN 6',
          name: 'Pro Plan',
          minutes: 500,
          priceLabel: '$187.99 USD',
          highlight: 'Sessions longues sans interruptions',
          subtext: [
            'Parfait pour plusieurs fois par semaine'
          ]
        },
        {
          id: 'plan-1000',
          label: 'PLAN 7',
          name: 'Elite Plan',
          minutes: 1000,
          priceLabel: '$334.99 USD',
          highlight: 'Meilleure valeur de la plateforme',
          badge: '⭐ MEILLEURE VALEUR',
          isBestValue: true,
          subtext: [
            'Même minutes que la concurrence',
            'Prix clairement plus bas'
          ]
        },
        {
          id: 'plan-1500',
          label: 'PLAN 8',
          name: 'VIP Experience',
          minutes: 1500,
          priceLabel: '$418.99 USD',
          highlight: 'Expérience VIP totale',
          subtext: [
            'Temps maximal disponible',
            'Pensé pour une forte utilisation'
          ]
        }
      ]
    },
    de: {
      gatewayNote: 'Das Zahlungsportal ist kolumbianisch und erscheint auf Spanisch.',
      currencyNote: 'Im Checkout siehst du nur COP und USD.',
      minutesLabel: 'Minuten',
      choosePlanLabel: 'Diesen Plan wählen',
      plans: [
        {
          id: 'plan-15',
          label: 'PLAN 1',
          name: 'Ideal zum Testen',
          minutes: 15,
          priceLabel: '$6.99 USD',
          highlight: 'Ideal zum Testen',
          subtext: [
            'Perfekt für deinen ersten Anruf',
            'Kurze Chats mit Mädchen'
          ]
        },
        {
          id: 'plan-30',
          label: 'PLAN 2',
          name: 'Mehr Zeit, mehr Verbindung',
          minutes: 30,
          priceLabel: '$12.99 USD',
          highlight: 'Mehr Zeit, mehr Verbindung',
          subtext: [
            'Genieße ohne Eile',
            'Besser als kurze Anrufe'
          ]
        },
        {
          id: 'plan-60',
          label: 'PLAN 3',
          name: 'Das beste Erlebnis',
          minutes: 60,
          priceLabel: '$22.99 USD',
          highlight: 'Bestes Preis‑Zeit‑Verhältnis',
          badge: '⭐ AM BELIEBTESTEN',
          isPopular: true,
          subtext: [
            'Der Favorit der Nutzer',
            'Ideale Zeit, um mit Mädchen zu verbinden'
          ]
        },
        {
          id: 'plan-120',
          label: 'PLAN 4',
          name: 'Premium‑Erlebnis',
          minutes: 120,
          priceLabel: '$42.99 USD',
          highlight: 'Maximales Sparen vs. kleinere Pläne',
          subtext: [
            'Für Vielnutzer gedacht',
            'Mehr Zeit, besseres Erlebnis'
          ]
        },
        {
          id: 'plan-250',
          label: 'PLAN 5',
          name: 'Power Plan',
          minutes: 250,
          priceLabel: '$103.99 USD',
          highlight: 'Für aktive Nutzer',
          subtext: [
            'Viel besserer Preis pro Minute',
            'Ideal für lange Sessions'
          ]
        },
        {
          id: 'plan-500',
          label: 'PLAN 6',
          name: 'Pro Plan',
          minutes: 500,
          priceLabel: '$187.99 USD',
          highlight: 'Lange Sessions ohne Unterbrechungen',
          subtext: [
            'Perfekt für mehrere Besuche pro Woche'
          ]
        },
        {
          id: 'plan-1000',
          label: 'PLAN 7',
          name: 'Elite Plan',
          minutes: 1000,
          priceLabel: '$334.99 USD',
          highlight: 'Bestes Angebot der Plattform',
          badge: '⭐ BESTER WERT',
          isBestValue: true,
          subtext: [
            'Gleiche Minuten wie die Konkurrenz',
            'Klar niedrigerer Preis'
          ]
        },
        {
          id: 'plan-1500',
          label: 'PLAN 8',
          name: 'VIP Experience',
          minutes: 1500,
          priceLabel: '$418.99 USD',
          highlight: 'Volles VIP‑Erlebnis',
          subtext: [
            'Maximale verfügbare Zeit',
            'Für hohen Verbrauch gedacht'
          ]
        }
      ]
    },
    it: {
      gatewayNote: 'Il gateway è colombiano, quindi sarà in spagnolo.',
      currencyNote: 'Nel checkout vedrai solo COP e USD.',
      minutesLabel: 'minuti',
      choosePlanLabel: 'Scegli questo piano',
      plans: [
        {
          id: 'plan-15',
          label: 'PIANO 1',
          name: 'Ideale per provare',
          minutes: 15,
          priceLabel: '$6.99 USD',
          highlight: 'Ideale per provare',
          subtext: [
            'Perfetto per la prima chiamata',
            'Chat rapide con ragazze'
          ]
        },
        {
          id: 'plan-30',
          label: 'PIANO 2',
          name: 'Più tempo, più connessione',
          minutes: 30,
          priceLabel: '$12.99 USD',
          highlight: 'Più tempo, più connessione',
          subtext: [
            'Goditi senza fretta',
            'Meglio delle chiamate brevi'
          ]
        },
        {
          id: 'plan-60',
          label: 'PIANO 3',
          name: 'La migliore esperienza',
          minutes: 60,
          priceLabel: '$22.99 USD',
          highlight: 'Miglior rapporto valore/tempo',
          badge: '⭐ PIÙ POPOLARE',
          isPopular: true,
          subtext: [
            'Il preferito dagli utenti',
            'Tempo ideale per connettersi con ragazze'
          ]
        },
        {
          id: 'plan-120',
          label: 'PIANO 4',
          name: 'Esperienza Premium',
          minutes: 120,
          priceLabel: '$42.99 USD',
          highlight: 'Massimo risparmio rispetto ai piani piccoli',
          subtext: [
            'Pensato per utenti frequenti',
            'Più tempo, migliore esperienza'
          ]
        },
        {
          id: 'plan-250',
          label: 'PIANO 5',
          name: 'Power Plan',
          minutes: 250,
          priceLabel: '$103.99 USD',
          highlight: 'Per utenti attivi',
          subtext: [
            'Prezzo per minuto molto migliore',
            'Ideale per sessioni lunghe'
          ]
        },
        {
          id: 'plan-500',
          label: 'PIANO 6',
          name: 'Pro Plan',
          minutes: 500,
          priceLabel: '$187.99 USD',
          highlight: 'Sessioni lunghe senza interruzioni',
          subtext: [
            'Perfetto per chi entra più volte a settimana'
          ]
        },
        {
          id: 'plan-1000',
          label: 'PIANO 7',
          name: 'Elite Plan',
          minutes: 1000,
          priceLabel: '$334.99 USD',
          highlight: 'Miglior valore della piattaforma',
          badge: '⭐ MIGLIOR VALORE',
          isBestValue: true,
          subtext: [
            'Stessi minuti della concorrenza',
            'Prezzo chiaramente più basso'
          ]
        },
        {
          id: 'plan-1500',
          label: 'PIANO 8',
          name: 'VIP Experience',
          minutes: 1500,
          priceLabel: '$418.99 USD',
          highlight: 'Esperienza VIP totale',
          subtext: [
            'Tempo massimo disponibile',
            'Pensato per alto utilizzo'
          ]
        }
      ]
    },
    tr: {
      gatewayNote: 'Ödeme geçidi Kolombiya kaynaklıdır, bu yüzden İspanyolca görünür.',
      currencyNote: 'Ödeme ekranında sadece COP ve USD görünür.',
      minutesLabel: 'dakika',
      choosePlanLabel: 'Bu planı seç',
      plans: [
        {
          id: 'plan-15',
          label: 'PLAN 1',
          name: 'Denemek için ideal',
          minutes: 15,
          priceLabel: '$6.99 USD',
          highlight: 'Denemek için ideal',
          subtext: [
            'İlk araman için mükemmel',
            'Kızlarla hızlı sohbetler'
          ]
        },
        {
          id: 'plan-30',
          label: 'PLAN 2',
          name: 'Daha fazla zaman, daha fazla bağ',
          minutes: 30,
          priceLabel: '$12.99 USD',
          highlight: 'Daha fazla zaman, daha fazla bağ',
          subtext: [
            'Acele etmeden keyfini çıkar',
            'Kısa aramalardan daha iyi'
          ]
        },
        {
          id: 'plan-60',
          label: 'PLAN 3',
          name: 'En iyi deneyim',
          minutes: 60,
          priceLabel: '$22.99 USD',
          highlight: 'En iyi değer / zaman',
          badge: '⭐ EN POPÜLER',
          isPopular: true,
          subtext: [
            'Kullanıcıların favorisi',
            'Kızlarla bağ kurmak için ideal süre'
          ]
        },
        {
          id: 'plan-120',
          label: 'PLAN 4',
          name: 'Premium Deneyim',
          minutes: 120,
          priceLabel: '$42.99 USD',
          highlight: 'Küçük planlara göre maksimum tasarruf',
          subtext: [
            'Sık kullanıcılar için',
            'Daha fazla zaman, daha iyi deneyim'
          ]
        },
        {
          id: 'plan-250',
          label: 'PLAN 5',
          name: 'Power Plan',
          minutes: 250,
          priceLabel: '$103.99 USD',
          highlight: 'Aktif kullanıcılar için',
          subtext: [
            'Dakika başına çok daha iyi fiyat',
            'Uzun oturumlar için ideal'
          ]
        },
        {
          id: 'plan-500',
          label: 'PLAN 6',
          name: 'Pro Plan',
          minutes: 500,
          priceLabel: '$187.99 USD',
          highlight: 'Kesintisiz uzun oturumlar',
          subtext: [
            'Haftada birkaç kez girenler için ideal'
          ]
        },
        {
          id: 'plan-1000',
          label: 'PLAN 7',
          name: 'Elite Plan',
          minutes: 1000,
          priceLabel: '$334.99 USD',
          highlight: 'Platformun en iyi değeri',
          badge: '⭐ EN İYİ DEĞER',
          isBestValue: true,
          subtext: [
            'Rakiplerle aynı dakika',
            'Daha düşük fiyat'
          ]
        },
        {
          id: 'plan-1500',
          label: 'PLAN 8',
          name: 'VIP Experience',
          minutes: 1500,
          priceLabel: '$418.99 USD',
          highlight: 'Tam VIP deneyimi',
          subtext: [
            'Maksimum süre',
            'Yüksek kullanım için'
          ]
        }
      ]
    },
    ru: {
      gatewayNote: 'Платежный шлюз колумбийский, поэтому он будет на испанском.',
      currencyNote: 'В оплате будут только COP и USD.',
      minutesLabel: 'минут',
      choosePlanLabel: 'Выбрать этот план',
      plans: [
        {
          id: 'plan-15',
          label: 'ПЛАН 1',
          name: 'Отлично для пробы',
          minutes: 15,
          priceLabel: '$6.99 USD',
          highlight: 'Отлично для пробы',
          subtext: [
            'Идеально для первого звонка',
            'Быстрые чаты с девушками'
          ]
        },
        {
          id: 'plan-30',
          label: 'ПЛАН 2',
          name: 'Больше времени, больше связи',
          minutes: 30,
          priceLabel: '$12.99 USD',
          highlight: 'Больше времени, больше связи',
          subtext: [
            'Без спешки',
            'Лучше, чем короткие звонки'
          ]
        },
        {
          id: 'plan-60',
          label: 'ПЛАН 3',
          name: 'Лучший опыт',
          minutes: 60,
          priceLabel: '$22.99 USD',
          highlight: 'Лучшее соотношение цена/время',
          badge: '⭐ САМЫЙ ПОПУЛЯРНЫЙ',
          isPopular: true,
          subtext: [
            'Любимый план пользователей',
            'Идеальное время для общения с девушками'
          ]
        },
        {
          id: 'plan-120',
          label: 'ПЛАН 4',
          name: 'Премиум‑опыт',
          minutes: 120,
          priceLabel: '$42.99 USD',
          highlight: 'Максимальная экономия vs маленькие планы',
          subtext: [
            'Для частых пользователей',
            'Больше времени, лучший опыт'
          ]
        },
        {
          id: 'plan-250',
          label: 'ПЛАН 5',
          name: 'Power Plan',
          minutes: 250,
          priceLabel: '$103.99 USD',
          highlight: 'Для активных пользователей',
          subtext: [
            'Гораздо лучше цена за минуту',
            'Идеально для длинных сессий'
          ]
        },
        {
          id: 'plan-500',
          label: 'ПЛАН 6',
          name: 'Pro Plan',
          minutes: 500,
          priceLabel: '$187.99 USD',
          highlight: 'Длинные сессии без перерывов',
          subtext: [
            'Идеально для нескольких раз в неделю'
          ]
        },
        {
          id: 'plan-1000',
          label: 'ПЛАН 7',
          name: 'Elite Plan',
          minutes: 1000,
          priceLabel: '$334.99 USD',
          highlight: 'Лучшее предложение платформы',
          badge: '⭐ ЛУЧШАЯ ЦЕННОСТЬ',
          isBestValue: true,
          subtext: [
            'Столько же минут, сколько у конкурентов',
            'Цена явно ниже'
          ]
        },
        {
          id: 'plan-1500',
          label: 'ПЛАН 8',
          name: 'VIP Experience',
          minutes: 1500,
          priceLabel: '$418.99 USD',
          highlight: 'Полный VIP‑опыт',
          subtext: [
            'Максимальное время',
            'Для высокого потребления'
          ]
        }
      ]
    },
    hi: {
      gatewayNote: 'पेमेंट गेटवे कोलंबियन है, इसलिए यह स्पेनिश में दिखेगा।',
      currencyNote: 'चेकआउट में केवल COP और USD दिखेंगे।',
      minutesLabel: 'मिनट',
      choosePlanLabel: 'यह प्लान चुनें',
      plans: [
        {
          id: 'plan-15',
          label: 'PLAN 1',
          name: 'Try करने के लिए बढ़िया',
          minutes: 15,
          priceLabel: '$6.99 USD',
          highlight: 'Try करने के लिए बढ़िया',
          subtext: [
            'पहली कॉल के लिए परफेक्ट',
            'लड़कियों के साथ तेज़ चैट'
          ]
        },
        {
          id: 'plan-30',
          label: 'PLAN 2',
          name: 'ज़्यादा समय, ज़्यादा कनेक्शन',
          minutes: 30,
          priceLabel: '$12.99 USD',
          highlight: 'ज़्यादा समय, ज़्यादा कनेक्शन',
          subtext: [
            'बिना जल्दबाज़ी के',
            'शॉर्ट कॉल से बेहतर'
          ]
        },
        {
          id: 'plan-60',
          label: 'PLAN 3',
          name: 'सबसे अच्छा अनुभव',
          minutes: 60,
          priceLabel: '$22.99 USD',
          highlight: 'सबसे अच्छा वैल्यू/टाइम',
          badge: '⭐ सबसे लोकप्रिय',
          isPopular: true,
          subtext: [
            'यूज़र्स का पसंदीदा',
            'लड़कियों से जुड़ने के लिए आदर्श समय'
          ]
        },
        {
          id: 'plan-120',
          label: 'PLAN 4',
          name: 'Premium अनुभव',
          minutes: 120,
          priceLabel: '$42.99 USD',
          highlight: 'छोटे प्लान्स के मुकाबले ज्यादा बचत',
          subtext: [
            'नियमित यूज़र्स के लिए',
            'ज़्यादा समय, बेहतर अनुभव'
          ]
        },
        {
          id: 'plan-250',
          label: 'PLAN 5',
          name: 'Power Plan',
          minutes: 250,
          priceLabel: '$103.99 USD',
          highlight: 'Active यूज़र्स के लिए',
          subtext: [
            'प्रति मिनट बहुत बेहतर कीमत',
            'लंबी सेशन्स के लिए आदर्श'
          ]
        },
        {
          id: 'plan-500',
          label: 'PLAN 6',
          name: 'Pro Plan',
          minutes: 500,
          priceLabel: '$187.99 USD',
          highlight: 'बिना रुकावट लंबे सेशन्स',
          subtext: [
            'हफ्ते में कई बार आने वालों के लिए'
          ]
        },
        {
          id: 'plan-1000',
          label: 'PLAN 7',
          name: 'Elite Plan',
          minutes: 1000,
          priceLabel: '$334.99 USD',
          highlight: 'प्लैटफ़ॉर्म का बेस्ट वैल्यू',
          badge: '⭐ सबसे अच्छा वैल्यू',
          isBestValue: true,
          subtext: [
            'कंपटीटर्स जितने ही मिनट',
            'काफी कम कीमत'
          ]
        },
        {
          id: 'plan-1500',
          label: 'PLAN 8',
          name: 'VIP Experience',
          minutes: 1500,
          priceLabel: '$418.99 USD',
          highlight: 'पूरा VIP अनुभव',
          subtext: [
            'अधिकतम समय उपलब्ध',
            'उच्च उपयोग के लिए'
          ]
        }
      ]
    },
    ja: {
      gatewayNote: '決済ゲートウェイはコロンビアのため、表示はスペイン語になります。',
      currencyNote: 'チェックアウトでは COP と USD のみ表示されます。',
      minutesLabel: '分',
      choosePlanLabel: 'このプランを選ぶ',
      plans: [
        {
          id: 'plan-15',
          label: 'PLAN 1',
          name: 'お試しに最適',
          minutes: 15,
          priceLabel: '$6.99 USD',
          highlight: 'お試しに最適',
          subtext: [
            '初めての通話にぴったり',
            '女の子との短いチャット'
          ]
        },
        {
          id: 'plan-30',
          label: 'PLAN 2',
          name: '時間が増えて、つながりも増える',
          minutes: 30,
          priceLabel: '$12.99 USD',
          highlight: '時間が増えて、つながりも増える',
          subtext: [
            '急がずに楽しめる',
            '短い通話よりお得'
          ]
        },
        {
          id: 'plan-60',
          label: 'PLAN 3',
          name: '最高の体験',
          minutes: 60,
          priceLabel: '$22.99 USD',
          highlight: 'コスパ最高',
          badge: '⭐ 最も人気',
          isPopular: true,
          subtext: [
            'ユーザーに人気',
            '女の子とつながるのに理想的'
          ]
        },
        {
          id: 'plan-120',
          label: 'PLAN 4',
          name: 'プレミアム体験',
          minutes: 120,
          priceLabel: '$42.99 USD',
          highlight: '小さなプランより最大の節約',
          subtext: [
            '頻繁に使う人向け',
            '時間が増えて体験も向上'
          ]
        },
        {
          id: 'plan-250',
          label: 'PLAN 5',
          name: 'Power Plan',
          minutes: 250,
          priceLabel: '$103.99 USD',
          highlight: 'アクティブユーザー向け',
          subtext: [
            '1分あたりの価格が大幅にお得',
            '長時間セッションに最適'
          ]
        },
        {
          id: 'plan-500',
          label: 'PLAN 6',
          name: 'Pro Plan',
          minutes: 500,
          priceLabel: '$187.99 USD',
          highlight: '長時間でも途切れない',
          subtext: [
            '週に何度も使う人に最適'
          ]
        },
        {
          id: 'plan-1000',
          label: 'PLAN 7',
          name: 'Elite Plan',
          minutes: 1000,
          priceLabel: '$334.99 USD',
          highlight: 'プラットフォーム最高の価値',
          badge: '⭐ 最優良',
          isBestValue: true,
          subtext: [
            '競合と同等の分数',
            '価格は明確に安い'
          ]
        },
        {
          id: 'plan-1500',
          label: 'PLAN 8',
          name: 'VIP Experience',
          minutes: 1500,
          priceLabel: '$418.99 USD',
          highlight: 'VIPのフル体験',
          subtext: [
            '最大時間',
            '高使用者向け'
          ]
        }
      ]
    },
    zh: {
      gatewayNote: '支付通道为哥伦比亚，因此页面会显示西班牙语。',
      currencyNote: '结账页只会显示 COP 和 USD。',
      minutesLabel: '分钟',
      choosePlanLabel: '选择此方案',
      plans: [
        {
          id: 'plan-15',
          label: 'PLAN 1',
          name: '适合试用',
          minutes: 15,
          priceLabel: '$6.99 USD',
          highlight: '适合试用',
          subtext: [
            '第一次通话很合适',
            '与女生快速聊天'
          ]
        },
        {
          id: 'plan-30',
          label: 'PLAN 2',
          name: '时间更多，连接更深',
          minutes: 30,
          priceLabel: '$12.99 USD',
          highlight: '时间更多，连接更深',
          subtext: [
            '从容享受',
            '比短通话更划算'
          ]
        },
        {
          id: 'plan-60',
          label: 'PLAN 3',
          name: '最佳体验',
          minutes: 60,
          priceLabel: '$22.99 USD',
          highlight: '价值/时间最佳',
          badge: '⭐ 最受欢迎',
          isPopular: true,
          subtext: [
            '用户最爱',
            '与女生连线的理想时长'
          ]
        },
        {
          id: 'plan-120',
          label: 'PLAN 4',
          name: '高端体验',
          minutes: 120,
          priceLabel: '$42.99 USD',
          highlight: '比小套餐更省',
          subtext: [
            '适合常用用户',
            '时间更长，体验更好'
          ]
        },
        {
          id: 'plan-250',
          label: 'PLAN 5',
          name: 'Power Plan',
          minutes: 250,
          priceLabel: '$103.99 USD',
          highlight: '适合活跃用户',
          subtext: [
            '每分钟更优惠',
            '适合长时间会话'
          ]
        },
        {
          id: 'plan-500',
          label: 'PLAN 6',
          name: 'Pro Plan',
          minutes: 500,
          priceLabel: '$187.99 USD',
          highlight: '长时间不被打断',
          subtext: [
            '适合每周多次使用'
          ]
        },
        {
          id: 'plan-1000',
          label: 'PLAN 7',
          name: 'Elite Plan',
          minutes: 1000,
          priceLabel: '$334.99 USD',
          highlight: '平台最佳价值',
          badge: '⭐ 最佳价值',
          isBestValue: true,
          subtext: [
            '分钟数与竞品一致',
            '价格明显更低'
          ]
        },
        {
          id: 'plan-1500',
          label: 'PLAN 8',
          name: 'VIP Experience',
          minutes: 1500,
          priceLabel: '$418.99 USD',
          highlight: '完整 VIP 体验',
          subtext: [
            '最长时长',
            '适合高频使用'
          ]
        }
      ]
    },
    ko: {
      gatewayNote: '결제 게이트웨이는 콜롬비아 기반이라 스페인어로 표시됩니다.',
      currencyNote: '결제 화면에서는 COP와 USD만 표시됩니다.',
      minutesLabel: '분',
      choosePlanLabel: '이 플랜 선택',
      plans: [
        {
          id: 'plan-15',
          label: 'PLAN 1',
          name: '체험용으로 추천',
          minutes: 15,
          priceLabel: '$6.99 USD',
          highlight: '체험용으로 추천',
          subtext: [
            '첫 통화에 딱',
            '여자들과 빠른 대화'
          ]
        },
        {
          id: 'plan-30',
          label: 'PLAN 2',
          name: '더 많은 시간, 더 깊은 연결',
          minutes: 30,
          priceLabel: '$12.99 USD',
          highlight: '더 많은 시간, 더 깊은 연결',
          subtext: [
            '여유롭게 즐기세요',
            '짧은 통화보다 더 좋아요'
          ]
        },
        {
          id: 'plan-60',
          label: 'PLAN 3',
          name: '최고의 경험',
          minutes: 60,
          priceLabel: '$22.99 USD',
          highlight: '가성비 최고',
          badge: '⭐ 가장 인기',
          isPopular: true,
          subtext: [
            '유저 최애',
            '여자들과 연결하기 좋은 시간'
          ]
        },
        {
          id: 'plan-120',
          label: 'PLAN 4',
          name: '프리미엄 경험',
          minutes: 120,
          priceLabel: '$42.99 USD',
          highlight: '소형 플랜 대비 최대 절약',
          subtext: [
            '자주 쓰는 분들께',
            '더 많은 시간, 더 좋은 경험'
          ]
        },
        {
          id: 'plan-250',
          label: 'PLAN 5',
          name: 'Power Plan',
          minutes: 250,
          priceLabel: '$103.99 USD',
          highlight: '활동적인 사용자용',
          subtext: [
            '분당 가격이 훨씬 좋아요',
            '긴 세션에 최적'
          ]
        },
        {
          id: 'plan-500',
          label: 'PLAN 6',
          name: 'Pro Plan',
          minutes: 500,
          priceLabel: '$187.99 USD',
          highlight: '중단 없는 긴 세션',
          subtext: [
            '주중 여러 번 접속하는 분께'
          ]
        },
        {
          id: 'plan-1000',
          label: 'PLAN 7',
          name: 'Elite Plan',
          minutes: 1000,
          priceLabel: '$334.99 USD',
          highlight: '플랫폼 최고의 가치',
          badge: '⭐ 최고의 가치',
          isBestValue: true,
          subtext: [
            '경쟁사와 같은 분량',
            '가격은 더 낮음'
          ]
        },
        {
          id: 'plan-1500',
          label: 'PLAN 8',
          name: 'VIP Experience',
          minutes: 1500,
          priceLabel: '$418.99 USD',
          highlight: '완전한 VIP 경험',
          subtext: [
            '최대 사용 시간',
            '고사용자용'
          ]
        }
      ]
    }
  };

  const priceByPlanId = {
    'plan-250': '$114.99 USD',
    'plan-500': '$209.99 USD',
    'plan-1000': '$369.99 USD',
    'plan-1500': '$459.99 USD'
  };

  const basePlans = (localizedCopy[locale] || localizedCopy.es).plans;

  const minutesPlanDefinitions = basePlans.map((plan) => ({
    ...plan,
    priceLabel: priceByPlanId[plan.id] || plan.priceLabel
  }));

  const minutesPlanPackages = minutesPlanDefinitions.map((plan) => ({
    ...plan,
    pkg: packages.find((item) => {
      if (item.type !== 'minutes') return false;
      return getPackageMinutes(item) === plan.minutes;
    })
  }));

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const selectPackage = async (pkg, plan = null) => {
    setSelectedPackage(pkg);
    setSelectedPlan(plan);
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
            'currency': data.wompi_data.currency || 'COP', // Wompi solo acepta COP
            'amount-in-cents': data.wompi_data.amount_in_cents,
            'reference': data.wompi_data.reference,
            'signature:integrity': data.wompi_data.signature_integrity
          });
          paymentParams.append('default-language', 'en');

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
            'currency': data.wompi_data.currency || 'COP', // Wompi solo acepta COP
            'amount-in-cents': data.wompi_data.amount_in_cents,
            'reference': data.wompi_data.reference,
            'signature:integrity': data.wompi_data.signature_integrity
          });
          paymentParams.append('default-language', 'en');

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
    setSelectedPlan(null);
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

            {/* Texto de marketing superior */}
            {activePackageType === 'minutes' && (
              <div className="text-center mb-6">
                <p className="text-white/70 text-sm sm:text-base">
                  Pagos rápidos y seguros · Más minutos para hablar con chicas · Elige tu plan ideal
                </p>
              </div>
            )}
            <div className="text-center mb-6">
              <div className="inline-flex flex-col gap-2 bg-[#2b2d31] border border-[#ff007a]/20 rounded-xl px-4 py-3 text-xs sm:text-sm text-white/70">
                <span>
                  {(localizedCopy[locale] || localizedCopy.es).gatewayNote}
                </span>
                <span>
                  {(localizedCopy[locale] || localizedCopy.es).currencyNote}
                </span>
              </div>
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
          {activePackageType === 'minutes' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
            {minutesPlanPackages.map((plan) => {
              const canSelect = !!plan.pkg && !processing;

              return (
                <div
                  key={plan.id}
                  className={`relative bg-[#2b2d31] rounded-xl p-4 sm:p-6 border-2 transition-all duration-300 ${
                    plan.isPopular
                      ? 'border-[#ff007a] shadow-lg shadow-[#ff007a]/30'
                      : plan.isBestValue
                      ? 'border-amber-400/80 shadow-lg shadow-amber-400/20'
                      : 'border-gray-600 hover:border-[#ff007a]/60'
                  } ${canSelect ? 'hover:scale-[1.02] cursor-pointer' : 'opacity-60 cursor-not-allowed'}`}
                  onClick={() => {
                    if (canSelect) {
                      selectPackage(plan.pkg, plan);
                    }
                  }}
                >
                  {/* Badges */}
                  {plan.badge && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
                        plan.isPopular
                          ? 'bg-gradient-to-r from-[#ff007a] to-[#ff4da6] text-white'
                          : 'bg-gradient-to-r from-amber-400 to-yellow-500 text-black'
                      }`}>
                        {plan.isPopular ? <Star size={12} fill="currentColor" /> : <Crown size={12} />}
                        {plan.badge}
                      </div>
                    </div>
                  )}

                  <div className="text-center">
                    <div className="text-[11px] tracking-[0.25em] text-white/60 mb-2">
                      {plan.label}
                    </div>
                    <h3 className="text-base sm:text-lg font-bold mb-2">{plan.name}</h3>

                    <div className="mb-4">
                          <div className="text-xl sm:text-2xl font-bold text-[#ff007a] mb-1">
                            {plan.minutes} {(localizedCopy[locale] || localizedCopy.es).minutesLabel}
                          </div>
                      <div className="text-sm sm:text-base text-white/80">
                        {plan.highlight}
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="text-lg sm:text-xl font-bold mb-1 text-green-400">
                        {plan.priceLabel}
                      </div>
                      {plan.pkg?.price_eur && (
                        <div className="text-xs sm:text-sm text-white/60">
                          ≈ €{plan.pkg.price_eur.toFixed(2)} EUR
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 mb-4 text-xs sm:text-sm text-white/70">
                      {plan.subtext.map((line) => (
                        <div key={line}>{line}</div>
                      ))}
                    </div>
                    
                    <button
                      disabled={!canSelect}
                      className={`w-full py-2 sm:py-3 px-4 rounded-lg font-semibold transition-all duration-200 disabled:opacity-50 text-sm sm:text-base ${
                        plan.isPopular
                          ? 'bg-gradient-to-r from-[#ff007a] to-[#ff4da6] hover:from-[#ff1285] hover:to-[#ff57ac] text-white'
                          : plan.isBestValue
                          ? 'bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-black'
                          : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <CreditCard size={16} />
                        {(localizedCopy[locale] || localizedCopy.es).choosePlanLabel}
                      </div>
                    </button>
                  </div>
                </div>
              );
            })}
            </div>
          ) : loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader className="animate-spin text-green-500" size={48} />
            </div>
          ) : getFilteredPackages().length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="mx-auto mb-4 text-yellow-500" size={48} />
              <p className="text-white/80 text-lg mb-2">
                No hay paquetes de regalos disponibles
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
                          ⭐ MÁS POPULAR
                        </div>
                      </div>
                    )}

                    <div className="text-center">
                      <h3 className="text-base sm:text-lg font-bold mb-1">{pkg.name}</h3>
                      {pkg.description && (
                        <p className="text-xs sm:text-sm text-white/60 mb-3">{pkg.description}</p>
                      )}

                      <div className="mb-4">
                        <div className="text-xl sm:text-2xl font-bold text-[#ff007a] mb-1">
                          {formatCoins(pkg.coins)} {t('common.coins')}
                        </div>
                        
                        {pkg.bonus_coins > 0 && (
                          <div className="flex items-center justify-center gap-1 text-yellow-400 text-xs sm:text-sm mt-1">
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
                        {pkg.show_anchor_price && pkg.original_price_usd && (
                          <div className="text-sm text-white/40 line-through mb-1">
                            ${pkg.original_price_usd.toFixed(2)} USD
                          </div>
                        )}
                        
                        <div className="text-lg sm:text-xl font-bold mb-1 text-green-400">
                          ${pkg.price_usd.toFixed(2)} USD
                        </div>
                        
                        {pkg.price_eur && (
                          <div className="text-sm text-white/60 mb-2">
                            {pkg.show_anchor_price && pkg.original_price_eur && (
                              <span className="line-through text-white/30 mr-1">
                                ≈ €{pkg.original_price_eur.toFixed(2)} EUR
                              </span>
                            )}
                            <span>≈ €{pkg.price_eur.toFixed(2)} EUR</span>
                          </div>
                        )}
                        
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
                          Activar bono y pagar
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
                  {selectedPackage?.type === 'minutes' ? (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-white/70 text-sm sm:text-base">
                          {selectedPlan?.name || selectedPackage.name}
                        </span>
                        <span className="text-[#ff007a] font-bold text-sm sm:text-base">
                          {selectedPlan?.minutes || selectedPackage.minutes} {(localizedCopy[locale] || localizedCopy.es).minutesLabel}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-white font-semibold text-sm sm:text-base">{t('wompi.verification.totalToPay')}:</span>
                        <div className="text-right">
                          <div className="text-xl sm:text-2xl font-bold text-green-400">
                            {selectedPlan?.priceLabel || `$${selectedPackage.price_usd.toFixed(2)} USD`}
                          </div>
                          {selectedPackage.price_eur && (
                            <div className="text-xs text-white/50 flex items-center gap-1 justify-end mt-1">
                              ≈ €{selectedPackage.price_eur.toFixed(2)} EUR
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
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
                      
                      {selectedPackage.show_anchor_price && selectedPackage.original_price_usd && (
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-white/50 text-sm line-through">Precio regular:</span>
                          <div className="text-right">
                            <div className="text-sm text-white/40 line-through">
                              ${selectedPackage.original_price_usd.toFixed(2)} USD
                            </div>
                            {selectedPackage.original_price_eur && (
                              <div className="text-xs text-white/30 line-through">
                                ≈ €{selectedPackage.original_price_eur.toFixed(2)} EUR
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      <div className="flex justify-between items-center">
                        <span className="text-white font-semibold text-sm sm:text-base">{t('wompi.verification.totalToPay')}:</span>
                        <div className="text-right">
                          <div className="text-xl sm:text-2xl font-bold text-green-400">
                            ${selectedPackage.price_usd.toFixed(2)} USD
                          </div>
                          {selectedPackage.price_eur && (
                            <div className="text-xs text-white/50 flex items-center gap-1 justify-end mt-1">
                              ≈ €{selectedPackage.price_eur.toFixed(2)} EUR
                            </div>
                          )}
                          {selectedPackage.show_anchor_price && (
                            <div className="text-xs text-green-400 font-semibold mt-1">
                              Bono aplicado automáticamente
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
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
                        setSelectedPlan(null);
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
              {activePackageType === 'minutes' ? (
                <div className="space-y-4">
                  {minutesPlanPackages.map((plan) => {
                    const canSelect = !!plan.pkg && !processing;

                    return (
                      <div
                        key={plan.id}
                        className={`relative bg-[#2b2d31] rounded-xl p-4 sm:p-6 border-2 transition-all duration-300 ${
                          plan.isPopular
                            ? 'border-[#ff007a] shadow-lg shadow-[#ff007a]/30'
                            : plan.isBestValue
                            ? 'border-amber-400/80 shadow-lg shadow-amber-400/20'
                            : 'border-gray-600 hover:border-[#ff007a]/60'
                        } ${canSelect ? 'hover:scale-[1.02] cursor-pointer' : 'opacity-60 cursor-not-allowed'}`}
                        onClick={() => {
                          if (canSelect) {
                            selectPackage(plan.pkg, plan);
                          }
                        }}
                      >
                        {plan.badge && (
                          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                            <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
                              plan.isPopular
                                ? 'bg-gradient-to-r from-[#ff007a] to-[#ff4da6] text-white'
                                : 'bg-gradient-to-r from-amber-400 to-yellow-500 text-black'
                            }`}>
                              {plan.isPopular ? <Star size={12} fill="currentColor" /> : <Crown size={12} />}
                              {plan.badge}
                            </div>
                          </div>
                        )}

                        <div className="text-center">
                          <div className="text-[11px] tracking-[0.25em] text-white/60 mb-2">
                            {plan.label}
                          </div>
                          <h3 className="text-base sm:text-lg font-bold mb-2">{plan.name}</h3>

                          <div className="mb-4">
                            <div className="text-xl sm:text-2xl font-bold text-[#ff007a] mb-1">
                              {plan.minutes} minutos
                            </div>
                            <div className="text-sm sm:text-base text-white/80">
                              {plan.highlight}
                            </div>
                          </div>

                          <div className="mb-4">
                            <div className="text-lg sm:text-xl font-bold mb-1 text-green-400">
                              {plan.priceLabel}
                            </div>
                          </div>

                          <div className="space-y-2 mb-4 text-xs sm:text-sm text-white/70">
                            {plan.subtext.map((line) => (
                              <div key={line}>{line}</div>
                            ))}
                          </div>
                          
                          <button
                            disabled={!canSelect}
                            className={`w-full py-2 sm:py-3 px-4 rounded-lg font-semibold transition-all duration-200 disabled:opacity-50 text-sm sm:text-base ${
                              plan.isPopular
                                ? 'bg-gradient-to-r from-[#ff007a] to-[#ff4da6] hover:from-[#ff1285] hover:to-[#ff57ac] text-white'
                                : plan.isBestValue
                                ? 'bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-black'
                                : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white'
                            }`}
                          >
                            <div className="flex items-center justify-center gap-2">
                              <CreditCard size={16} />
                              {(localizedCopy[locale] || localizedCopy.es).choosePlanLabel}
                            </div>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : loading ? (
                <div className="flex justify-center items-center py-12">
                  <Loader className="animate-spin text-green-500" size={48} />
                </div>
              ) : getFilteredPackages().length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="mx-auto mb-4 text-yellow-500" size={48} />
                  <p className="text-white/80 text-lg mb-2">
                    No hay paquetes de regalos disponibles
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
                              ⭐ MÁS POPULAR
                            </div>
                          </div>
                        )}

                        <div className="text-center">
                          <h3 className="text-base sm:text-lg font-bold mb-1">{pkg.name}</h3>
                          {pkg.description && (
                            <p className="text-xs sm:text-sm text-white/60 mb-3">{pkg.description}</p>
                          )}

                          <div className="mb-4">
                            <div className="text-xl sm:text-2xl font-bold text-[#ff007a] mb-1">
                              {formatCoins(pkg.coins)} {t('common.coins')}
                            </div>
                            
                            {pkg.bonus_coins > 0 && (
                              <div className="flex items-center justify-center gap-1 text-yellow-400 text-xs sm:text-sm mt-1">
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
                            {pkg.show_anchor_price && pkg.original_price_usd && (
                              <div className="text-sm text-white/40 line-through mb-1">
                                ${pkg.original_price_usd.toFixed(2)} USD
                              </div>
                            )}
                            
                            <div className="text-lg sm:text-xl font-bold mb-1 text-green-400">
                              ${pkg.price_usd.toFixed(2)} USD
                            </div>
                            
                            {pkg.price_eur && (
                              <div className="text-sm text-white/60 mb-2">
                                {pkg.show_anchor_price && pkg.original_price_eur && (
                                  <span className="line-through text-white/30 mr-1">
                                    ≈ €{pkg.original_price_eur.toFixed(2)} EUR
                                  </span>
                                )}
                                <span>≈ €{pkg.price_eur.toFixed(2)} EUR</span>
                              </div>
                            )}
                            
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
                              Activar bono y pagar
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