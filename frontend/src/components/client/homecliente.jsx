import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { MessageSquare, Star, Home, Phone, Clock, CheckCircle, Users, Video } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Header from "./headercliente";
import { ProtectedPage } from '../hooks/usePageAccess';
import { getUser } from "../../utils/auth";
import CallingSystem from '../../components/CallingOverlay';
// 🔥 REMOVIDO: IncomingCallOverlay ahora se maneja globalmente en GlobalCallContext
import UnifiedPaymentModal from '../../components/payments/UnifiedPaymentModal';
import { useTranslation } from 'react-i18next';
import { createLogger } from '../../utils/logger';
import { useBrowsingHeartbeat } from '../../utils/heartbeat';
import { useGlobalCall } from '../../contexts/GlobalCallContext';
import { playOutgoingCallSound as playOutgoingCallSoundHelper, stopOutgoingCallSound as stopOutgoingCallSoundHelper } from '../../utils/callAudioHelpers';
import CallModeSelector from './CallModeSelector';
import DualCallConfigModal from './DualCallConfigModal';
// Componentes modulares nuevos
import BalanceCard from './BalanceCard';
import ActiveGirlsList from './ActiveGirlsList';
import CallHistoryList from './CallHistoryList';
// import TipOfTheDay from './TipOfTheDay'; // 🔥 TEMPORALMENTE DESHABILITADO
import SkeletonLoader from './SkeletonLoader';

const logger = createLogger('HomeCliente');

// 🔥 FUNCIÓN HELPER PARA DETECTAR Y MANEJAR ERRORES DE SESIÓN CERRADA
const handleSessionClosedError = async (response, url, method = 'GET') => {
  if ((response.status === 401 || response.status === 403)) {
    try {
      // Clonar response para poder leer el body sin consumirlo
      const clonedResponse = response.clone();
      const errorData = await clonedResponse.json().catch(() => ({}));
      const codigo = errorData.code || errorData.codigo || '';
      
      if (codigo === 'SESSION_CLOSED_BY_OTHER_DEVICE') {
        // Guardar flag en localStorage para persistencia
        try {
          localStorage.setItem('session_closed_by_other_device', 'true');
        } catch (error) {
          logger.warn('Error al guardar flag en localStorage:', error);
        }
        // Disparar evento para que SessionClosedAlert lo maneje
        const customEvent = new CustomEvent("axiosError", {
          detail: {
            status: response.status,
            mensaje: errorData.message || 'Se abrió tu cuenta en otro dispositivo',
            codigo: codigo,
            code: codigo,
            url: url,
            method: method,
          },
        });
        window.dispatchEvent(customEvent);
        return true; // Indica que se manejó el error
      }
    } catch (error) {
      logger.warn('Error al procesar respuesta de sesión cerrada:', error);
    }
  }
  return false;
};

export default function InterfazCliente() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
  const { t } = useTranslation(); // 🔥 MOVER AQUÍ PARA QUE ESTÉ DISPONIBLE EN TODO EL COMPONENTE
  
  // 🔥 REFS PARA AUDIO (definir ANTES de cualquier función que los use)
  const outgoingAudioRef = useRef(null);
  const outgoingPlayPromiseRef = useRef(null);
  const [outgoingCallAudio, setOutgoingCallAudio] = useState(null);
  
  // 🔥 WRAPPERS COMO FUNCTION DECLARATIONS para evitar TDZ (se elevan antes de ser usadas)
  // Estas funciones se definen INMEDIATAMENTE después de los refs para evitar problemas
  function playOutgoingCallSound() {
    return playOutgoingCallSoundHelper(outgoingAudioRef, outgoingPlayPromiseRef, setOutgoingCallAudio);
  }
  
  function stopOutgoingCallSound() {
    return stopOutgoingCallSoundHelper(outgoingPlayPromiseRef, outgoingAudioRef, setOutgoingCallAudio);
  }
  
  // 🔥 MOVER useGlobalCall DESPUÉS de las funciones de audio para evitar TDZ
  const { isReceivingCall } = useGlobalCall();

  // 🔍 Función para enviar logs al backend
  const sendLogToBackend = async (level, message, data = null) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return; // No enviar si no hay token
      
      const logData = {
        level: level, // 'info', 'warn', 'error', 'debug'
        message: message,
        data: data,
        context: 'HomeCliente',
        url: window.location.href,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent
      };

      // Fire and forget - no esperar respuesta
      fetch(`${API_BASE_URL}/api/logs/frontend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(logData),
        keepalive: true
      }).catch(() => {
        // Silenciar errores de logging para evitar bucles
      });
    } catch (e) {
      // Silenciar errores de logging
    }
  };

  // 🔍 LOG INICIAL DEL COMPONENTE

  // 🔍 LOG INICIAL DEL COMPONENTE - FORZAR VISIBILIDAD
  useEffect(() => {
    // También usar métodos directos para evitar filtros
    if (window.console) {
    }
  }, []);

  // 🔥 HEARTBEAT DE RESPALDO: Asegura detección constante de sesión cerrada
  // El heartbeat global en ProtectedPage ya está activo, esto es redundancia adicional
  useBrowsingHeartbeat(25000); // 25 segundos

  // 🔥 VALIDACIÓN ADICIONAL DE SEGURIDAD: Verificar token y rol al montar
  useEffect(() => {
    const validateAccess = async () => {
      // Verificar flag de sesión cerrada primero
      const sessionClosedFlag = localStorage.getItem('session_closed_by_other_device');
      if (sessionClosedFlag === 'true') {
        // Si hay flag de sesión cerrada, no hacer nada aquí
        // SessionClosedAlert se encargará de mostrar el alert y redirigir
        return;
      }

      // Verificar que existe token
      const token = localStorage.getItem('token');
      if (!token || token.trim() === '') {
        // No hay token, limpiar todo y redirigir a /home
        try {
          localStorage.removeItem('user');
          localStorage.removeItem('session_closed_by_other_device');
        } catch (e) {
          // Ignorar errores
        }
        window.location.href = '/home';
        return;
      }

      // 🔥 VERIFICAR SI HAY UNA LLAMADA ACTIVA Y RECONECTAR AUTOMÁTICAMENTE
      // Solo si NO se finalizó manualmente
      const callEndedManually = localStorage.getItem('call_ended_manually');
      if (callEndedManually === 'true') {
        // Si el usuario finalizó manualmente, limpiar todo y no reconectar
        localStorage.removeItem('call_ended_manually');
        localStorage.removeItem('roomName');
        localStorage.removeItem('userName');
        localStorage.removeItem('currentRoom');
        localStorage.removeItem('inCall');
        localStorage.removeItem('videochatActive');
        return; // Salir sin reconectar
      }
      
      const roomName = localStorage.getItem('roomName');
      const userName = localStorage.getItem('userName');
      const videochatActive = localStorage.getItem('videochatActive');
      const inCall = localStorage.getItem('inCall');
      
      // Si hay datos de llamada activa, verificar con el backend
      if ((videochatActive === 'true' || inCall === 'true') && roomName && userName) {
        try {
          const statusResponse = await fetch(`${API_BASE_URL}/api/heartbeat/check-user-status`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            
            // Verificar si hay una sesión activa con este roomName
            const activeSession = statusData.sessions?.find(
              session => session.room_name === roomName && 
                        (session.status === 'active' || session.status === 'waiting')
            );
            
            if (activeSession) {
                console.log('Sesión activa encontrada:', {
                  userName,
                  sessionStatus: activeSession.status
                });
              
              // Redirigir de vuelta a la sala de videochat
              navigate(`/videochatclient?roomName=${encodeURIComponent(roomName)}&userName=${encodeURIComponent(userName)}`, {
                replace: true,
                state: {
                  userName: userName,
                  reconnect: true
                }
              });
              return; // Salir para evitar otras validaciones
            } else {
              // No hay sesión activa, limpiar datos
              localStorage.removeItem('roomName');
              localStorage.removeItem('userName');
              localStorage.removeItem('currentRoom');
              localStorage.removeItem('inCall');
              localStorage.removeItem('videochatActive');
            }
          }
        } catch (error) {
          // En caso de error, limpiar datos por seguridad
          localStorage.removeItem('roomName');
          localStorage.removeItem('userName');
          localStorage.removeItem('currentRoom');
          localStorage.removeItem('inCall');
          localStorage.removeItem('videochatActive');
        }
      }

      // Verificar rol del usuario desde localStorage (caché)
      // Solo como validación adicional, pero no confiar solo en esto
      try {
        const userString = localStorage.getItem('user');
        if (userString) {
          const cachedUser = JSON.parse(userString);
          const userRole = cachedUser?.rol || cachedUser?.role;
          
          // Si el rol no es 'cliente', redirigir a home correspondiente
          if (userRole && userRole !== 'cliente') {
            if (userRole === 'modelo') {
              navigate('/homellamadas', { replace: true });
            } else if (userRole === 'admin') {
              navigate('/admin/dashboard', { replace: true });
            } else {
              // Si no hay rol válido, limpiar y redirigir a /home
              try {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
              } catch (e) {
                // Ignorar errores
              }
              window.location.href = '/home';
            }
            return;
          }
        }
      } catch (e) {
        // Si hay error al parsear, limpiar y redirigir a /home
        try {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        } catch (e2) {
          // Ignorar errores
        }
        window.location.href = '/home';
        return;
      }
    };

    validateAccess();
  }, [navigate, API_BASE_URL]);

  // Estados
  const [user, setUser] = useState(null);
  const [chicasActivas, setChicasActivas] = useState([]);
  const [stories, setStories] = useState([]);
  const [loadingStories, setLoadingStories] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [showBuyMinutes, setShowBuyMinutes] = useState(false);
  const [userBalance, setUserBalance] = useState(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [showNoBalanceModal, setShowNoBalanceModal] = useState(false);
  const [balanceDetails, setBalanceDetails] = useState(null); // ✅ ESTADO FALTANTE
  const [notification, setNotification] = useState(null); // Notificación temporal

  // 🔥 FUNCIÓN PARA MOSTRAR NOTIFICACIÓN - MOVER ANTES DE SU USO Y USAR useCallback
  const showNotification = useCallback((message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000); // Ocultar después de 4 segundos
  }, []);

  // Estado para rastrear pagos pendientes y polling
  const [pendingPurchaseId, setPendingPurchaseId] = useState(null);
  const paymentPollingRef = useRef(null);
  const paymentPollingStartTimeRef = useRef(null);

  const stopPaymentPolling = useCallback(() => {
    if (paymentPollingRef.current) {
      clearInterval(paymentPollingRef.current);
      paymentPollingRef.current = null;
    }
    setPendingPurchaseId(null);
    paymentPollingStartTimeRef.current = null;
  }, []);

  const startPaymentPolling = useCallback((purchaseId) => {
    if (!purchaseId) return;

    stopPaymentPolling();
    setPendingPurchaseId(purchaseId);
    paymentPollingStartTimeRef.current = Date.now();

    const pollOnce = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/wompi/status/${purchaseId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        const data = await response.json();

        if (data.success && data.purchase) {
          if (data.purchase.status === 'completed') {
            showNotification(`¡Pago completado! Se agregaron ${data.purchase.total_coins} monedas`, 'success');
            try {
              const balanceResponse = await fetch(`${API_BASE_URL}/api/videochat/coins/balance`, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              });
              if (balanceResponse.ok) {
                const balanceData = await balanceResponse.json();
                if (balanceData.success) {
                  setUserBalance(balanceData.balance);
                  setBalanceDetails(balanceData);
                }
              }
            } catch (error) {
            }
            stopPaymentPolling();
            return;
          }

          if (data.purchase.status !== 'pending' && data.purchase.status !== 'pending_confirmation') {
            showNotification('El pago no se completó. Por favor intenta nuevamente.', 'error');
            stopPaymentPolling();
            return;
          }
        }
      } catch (error) {
      }
    };

    pollOnce();
    paymentPollingRef.current = setInterval(() => {
      const elapsed = Date.now() - (paymentPollingStartTimeRef.current || Date.now());
      const maxPollingTime = 10 * 60 * 1000; // 10 minutos
      if (elapsed > maxPollingTime) {
        stopPaymentPolling();
        return;
      }
      pollOnce();
    }, 15000); // cada 15 segundos
  }, [API_BASE_URL, showNotification, stopPaymentPolling]);

  // Verificar pago de Wompi cuando el usuario regresa
  useEffect(() => {
    const payment = searchParams.get('payment');
    const reference = searchParams.get('reference');
    const purchaseId = searchParams.get('purchase_id');
    const txId = searchParams.get('id');
    const env = searchParams.get('env');

    // Caso: Wompi puede redirigir con ?id=<transaction_id>&env=test (especialmente sandbox)
    // Intentar resolver la transacción directamente por transaction id si existe
    if (txId) {
      const resolveByTx = async () => {
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`${API_BASE_URL}/api/wompi/resolve/${txId}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          const data = await response.json();

          if (data.success && data.purchase) {
            if (data.purchase.status === 'completed') {
              showNotification(`¡Pago completado! Se agregaron ${data.purchase.total_coins} monedas`, 'success');
              // Actualizar balance después de un pequeño delay
              setTimeout(() => {
                window.location.reload(); // Recargar para actualizar balance
              }, 1000);
            } else if (data.purchase.status === 'pending') {
              showNotification('Tu pago está siendo procesado. Las monedas se agregarán cuando se confirme.', 'info');
              // Iniciar polling automático
              startPaymentPolling(data.purchase.id);
            }
          } else {
            // Si no se resuelve la compra localmente, avisar que está procesándose
            showNotification('Tu pago está siendo procesado. Si el redireccionamiento vino de Wompi, intentaremos resolverlo automáticamente.', 'info');
          }
        } catch (error) {
        } finally {
          // Limpiar parámetros id/env de la URL
          searchParams.delete('id');
          searchParams.delete('env');
          setSearchParams(searchParams, { replace: true });
        }
      };

      resolveByTx();
      return; // Evitar ejecutar la lógica de purchase_id simultáneamente
    }

    if (payment === 'wompi' && purchaseId) {
      // Verificar el estado del pago inmediatamente
      const initialCheck = async () => {
          // Iniciar polling automático
          showNotification('Tu pago está siendo procesado. Verificando automáticamente...', 'info');
          startPaymentPolling(purchaseId);

          // Limpiar parámetros de la URL
          searchParams.delete('payment');
          searchParams.delete('reference');
          searchParams.delete('purchase_id');
          setSearchParams(searchParams, { replace: true });
      };

      initialCheck();
    } else if (payment === 'cancelled') {
      showNotification('El pago fue cancelado.', 'info');
      searchParams.delete('payment');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, API_BASE_URL, showNotification, startPaymentPolling]);

  const abrirModalCompraMinutos = () => {
    setShowBuyMinutes(true);
  };
  const cerrarModalCompraMinutos = () => {
    setShowBuyMinutes(false);
    // Forzar actualización del último pago y balance cuando se cierra el modal
    setTimeout(() => {
      consultarSaldoUsuario();
    }, 500); // Pequeño delay para asegurar que el pago se haya procesado
  };

  // 🔥 FUNCIÓN PARA OBTENER HEADERS CON TOKEN (useCallback para evitar problemas de inicialización)
  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem("token");
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'Authorization': token ? `Bearer ${token}` : ''
    };
  }, []);

  const consultarSaldoUsuario = async () => {
    try {
      setLoadingBalance(true);
      
      const response = await fetch(`${API_BASE_URL}/api/videochat/coins/balance`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      
      // 🔥 DETECTAR SESIÓN CERRADA POR OTRO DISPOSITIVO
      const isSessionClosed = await handleSessionClosedError(response, `${API_BASE_URL}/api/videochat/coins/balance`);
      if (isSessionClosed) {
        setLoadingBalance(false);
        return null;
      }
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.success) {
          setUserBalance(data.balance);
          // ✅ GUARDAMOS LOS DATOS COMPLETOS PARA EL MODAL
          setBalanceDetails(data);
          
          // 🔥 CARGAR SALDO DE REGALOS DESDE EL ENDPOINT CORRECTO (user_gift_coins)
          try {
            const giftsResponse = await fetch(`${API_BASE_URL}/api/gifts/balance`, {
              method: 'GET',
              headers: getAuthHeaders()
            });
            
            if (giftsResponse.ok) {
              const giftsData = await giftsResponse.json();
              if (giftsData.success && giftsData.balance) {
                // 🔥 ACTUALIZAR EL SALDO DE REGALOS CON EL VALOR CORRECTO
                setUserBalance(prev => ({
                  ...prev,
                  gift_coins: giftsData.balance.gift_balance || 0,
                }));
              }
            }
          } catch (giftError) {
            // Silenciar errores al cargar gift balance
          }
          
          return data;
        } else {
                    return null;
        }
      } else {
                return null;
      }
    } catch (error) {
            return null;
    } finally {
      setLoadingBalance(false);
    }
  };

  const validarSaldoYRedireccionar = async () => {
    try {
      
      const response = await fetch(`${API_BASE_URL}/api/videochat/coins/balance`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.success && data.can_start_call) {
          // ✅ TIENE SALDO - REDIRIGIR DIRECTAMENTE SIN MODAL
          navigate("/esperandocallcliente");
          
        } else {
          // ❌ No puede iniciar - mostrar modal de recarga
          setBalanceDetails(data);
          setShowNoBalanceModal(true);
        }
      } else {
                setShowNoBalanceModal(true);
      }
      
    } catch (error) {
            setShowNoBalanceModal(true);
    }
  };

   const validarSaldoYRedireccionarConLoading = async () => {
    try {
      setLoadingBalance(true); // ✅ Mostrar loading en el botón
      
      const response = await fetch(`${API_BASE_URL}/api/videochat/coins/balance`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.success && data.can_start_call) {
          // ✅ TIENE SALDO - REDIRIGIR DIRECTAMENTE
          navigate("/esperandocallcliente");
          
        } else {
          // ❌ No puede iniciar - mostrar modal de recarga
          setBalanceDetails(data);
          setShowNoBalanceModal(true);
        }
      } else {
                setShowNoBalanceModal(true);
      }
      
    } catch (error) {
            setShowNoBalanceModal(true);
    } finally {
      setLoadingBalance(false); // ✅ Quitar loading del botón
    }
  };

  // 🔥 ESTADOS DE LLAMADAS
  const [isCallActive, setIsCallActive] = useState(false);
  const [currentCall, setCurrentCall] = useState(null);
  const [callPollingInterval, setCallPollingInterval] = useState(null);
  // 🔥 ESTADOS PARA MODO DE LLAMADA 2VS1
  const [callMode, setCallMode] = useState('normal'); // 'normal' | 'dual'
  const [selectedModelos, setSelectedModelos] = useState([]); // Array de IDs de chicas seleccionadas
  const [availableModelos, setAvailableModelos] = useState([]); // Lista de chicas disponibles
  const [showDualCallModal, setShowDualCallModal] = useState(false); // Modal para configurar 2vs1

  // 🔥 ACTUALIZAR MODELOS DISPONIBLES CUANDO CAMBIEN LAS CHICAS ACTIVAS
  useEffect(() => {
    if (chicasActivas && chicasActivas.length > 0) {
      const modelosDisponibles = chicasActivas.map(chica => ({
        id: chica.id,
        name: chica.name || chica.display_name || chica.alias || chica.user_name || `Modelo ${chica.id}`,
        avatar: chica.avatar_url || chica.avatar
      }));
      
      setAvailableModelos(modelosDisponibles);
    } else {
      setAvailableModelos([]);
    }
  }, [chicasActivas]);
  
  // 🔥 ESTADOS PARA MODAL DE CONFIRMACIÓN
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  // 🔥 REMOVIDO: Audio de llamadas entrantes ahora se maneja en GlobalCallContext

  // 🔥 ESTADO PARA USUARIOS BLOQUEADOS
  const [usuariosBloqueados, setUsuariosBloqueados] = useState([]);
  const [loadingBloqueados, setLoadingBloqueados] = useState(false);

  // 🔥 ESTADOS PARA HISTORIAL DE LLAMADAS
  const [callHistory, setCallHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  
  // Estado para controlar las secciones expandidas del acordeón
  const [expandedSections, setExpandedSections] = useState({
    balance: true,       // Siempre abierto
    activeGirls: true,   // Por defecto desplegado
    history: false       // Por defecto cerrado
  });

  // 🔥 FUNCIÓN PARA CARGAR HISTORIAL DE LLAMADAS
  const cargarHistorialLlamadas = async () => {
    try {
      setLoadingHistory(true);
      const token = localStorage.getItem('token');
      
      if (!token || token === 'null' || token === 'undefined') {
        setLoadingHistory(false);
        setCallHistory([]); // 🔥 Establecer array vacío si no hay token
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/calls/history`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      
      // 🔥 DETECTAR SESIÓN CERRADA POR OTRO DISPOSITIVO
      const isSessionClosed = await handleSessionClosedError(response, `${API_BASE_URL}/api/calls/history`);
      if (isSessionClosed) {
        setLoadingHistory(false);
        return;
      }
      
      if (response.ok) {
        try {
          const data = await response.json();
          if (data.success && data.history) {
            setCallHistory(data.history);
          } else {
            // 🔥 Si no hay éxito o no hay historial, establecer array vacío
            setCallHistory([]);
          }
        } catch (jsonError) {
          logger.error('Error parseando JSON del historial:', jsonError);
          setCallHistory([]); // 🔥 Establecer array vacío si hay error parseando
        }
      } else {
        // 🔥 Si la respuesta no es OK, establecer array vacío
        logger.warn('Respuesta no OK al cargar historial:', response.status);
        setCallHistory([]);
      }
    } catch (error) {
      logger.error('Error cargando historial de llamadas', error);
      setCallHistory([]); // 🔥 Establecer array vacío en caso de error
    } finally {
      // 🔥 SIEMPRE establecer loadingHistory en false, incluso si hay errores
      setLoadingHistory(false);
    }
  };

  // 🔥 FUNCIÓN PARA OBTENER INICIAL DEL NOMBRE
  const getInitial = (name) => {
    return name ? name.charAt(0).toUpperCase() : '?';
  };

  // 🔥 CARGAR CHICAS ACTIVAS/ONLINE
  const cargarChicasActivas = async (isBackgroundUpdate = false) => {
    try {
      if (!isBackgroundUpdate) {
        setLoadingUsers(true);
      }
      
      const response = await fetch(`${API_BASE_URL}/api/chat/users/my-contacts`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      
      // 🔥 DETECTAR SESIÓN CERRADA POR OTRO DISPOSITIVO
      const isSessionClosed = await handleSessionClosedError(response, `${API_BASE_URL}/api/chat/users/my-contacts`);
      if (isSessionClosed) {
        return; // No continuar si la sesión fue cerrada
      }
      
      if (response.ok) {
          const data = await response.json();
        
        // 🔥 FILTRAR SOLO MODELOS (CHICAS) QUE ESTÁN ONLINE
        // Si is_online no está disponible, asumir que está online si está en la lista
        const chicasOnline = (data.contacts || []).filter(contact => {
          if (contact.role !== 'modelo') {
            return false;
          }
          // Si tiene is_online explícito, usarlo
          if (contact.is_online !== undefined) {
            const isOnline = contact.is_online === true;
            return isOnline;
          }
          // Si no tiene is_online pero está en la lista, asumir que está online
          return true;
        });
        
        setChicasActivas(prevChicas => {
          const newChicaIds = chicasOnline.map(u => u.id).sort();
          const prevChicaIds = prevChicas.map(u => u.id).sort();
          
          if (JSON.stringify(newChicaIds) !== JSON.stringify(prevChicaIds)) {
            // 🔥 ACTUALIZAR MODELOS DISPONIBLES PARA EL SELECTOR
            setAvailableModelos(chicasOnline.map(chica => ({
              id: chica.id,
              name: chica.name || chica.display_name || chica.alias || chica.user_name || `Modelo ${chica.id}`,
              avatar: chica.avatar_url || chica.avatar
            })));
            return chicasOnline;
          }
          
          return prevChicas.map(prevChica => {
            const updatedChica = chicasOnline.find(u => u.id === prevChica.id);
            return updatedChica || prevChica;
          });
        });
        
      } else {
        if (initialLoad) {
          await handleFallbackData();
        }
      }
    } catch (error) {
      if (initialLoad) {
        await handleFallbackData();
      }
    } finally {
      if (!isBackgroundUpdate) {
        setLoadingUsers(false);
      }
      if (initialLoad) {
        setInitialLoad(false);
      }
    }
  };

  // Función para manejar datos de fallback
  const handleFallbackData = async () => {
    try {
      const conversationsResponse = await fetch(`${API_BASE_URL}/api/chat/conversations`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      
      // 🔥 DETECTAR SESIÓN CERRADA POR OTRO DISPOSITIVO
      const isSessionClosed = await handleSessionClosedError(conversationsResponse, `${API_BASE_URL}/api/chat/conversations`);
      if (isSessionClosed) {
        return; // No continuar si la sesión fue cerrada
      }
      
      if (conversationsResponse.ok) {
        const conversationsData = await conversationsResponse.json();
        
        // Solo modelos (chicas) de las conversaciones
        const uniqueChicas = (conversationsData.conversations || [])
          .filter(conv => conv.other_user_role === 'modelo')
          .map(conv => ({
            id: conv.other_user_id,
            name: conv.other_user_name,
            alias: conv.other_user_name,
            role: conv.other_user_role,
            is_online: Math.random() > 0.3,
            avatar: `https://i.pravatar.cc/40?u=${conv.other_user_id}`,
            last_seen: new Date().toISOString()
          })).filter(u => u.is_online);
        
        setChicasActivas(uniqueChicas);
        // 🔥 ACTUALIZAR MODELOS DISPONIBLES PARA EL SELECTOR
        setAvailableModelos(uniqueChicas.map(chica => ({
          id: chica.id,
          name: chica.name || chica.display_name || chica.alias || chica.user_name || `Modelo ${chica.id}`,
          avatar: chica.avatar_url || chica.avatar
        })));
      } else {
        throw new Error('No se pudieron cargar conversaciones');
      }
    } catch (fallbackError) {
      const exampleChicas = [
        {
          id: 201,
          name: "SofiSweet",
          alias: "SofiSweet",
          role: "modelo",
          is_online: true,
          avatar: "https://i.pravatar.cc/40?u=201",
          last_seen: new Date().toISOString()
        },
        {
          id: 202,
          name: "Mia88",
          alias: "Mia88", 
          role: "modelo",
          is_online: true,
          avatar: "https://i.pravatar.cc/40?u=202",
          last_seen: new Date().toISOString()
        },
        {
          id: 203,
          name: "ValentinaXX",
          alias: "ValentinaXX", 
          role: "modelo",
          is_online: true,
          avatar: "https://i.pravatar.cc/40?u=203",
          last_seen: new Date().toISOString()
        }
      ];
      
      setChicasActivas(exampleChicas);
    }
  };

  // 📱 Cargar historias de modelos
  const cargarHistorias = async () => {
    try {
      // 🔍 LOG INICIAL - Forzar mostrar en consola con múltiples métodos
      const logMessage = '🔍 [HOME] Iniciando carga de historias...';
      sendLogToBackend('info', logMessage);
      setLoadingStories(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        const warnMessage = '⚠️ [HOME] No hay token disponible para cargar historias';
        sendLogToBackend('warn', warnMessage);
        setStories([]);
        setLoadingStories(false);
        return;
      }

      const url = `${API_BASE_URL}/api/stories/active`;
      const requestLog = `📡 [HOME] Haciendo petición a: ${url}`;
      sendLogToBackend('info', requestLog, { url });
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      const responseData = {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      };
      sendLogToBackend('info', '📥 [HOME] Respuesta recibida', responseData);

      if (response.ok) {
        const data = await response.json();
        const storiesData = {
          total: Array.isArray(data) ? data.length : 0,
          stories: Array.isArray(data) ? data.map(s => ({
            id: s.id,
            user_id: s.user_id,
            user_name: s.user?.name || 'N/A',
            is_online: s.user?.is_online || false,
            expires_at: s.expires_at,
            status: s.status
          })) : []
        };
        sendLogToBackend('info', '✅ [HOME] Historias cargadas exitosamente', storiesData);
        
        const storiesArray = Array.isArray(data) ? data : [];
        setStories(storiesArray);
        
        // Log detallado de estados online/offline
        const onlineCount = storiesArray.filter(s => s.user?.is_online).length;
        const offlineCount = storiesArray.filter(s => !s.user?.is_online).length;
        const summaryData = {
          total: storiesArray.length,
          activas: onlineCount,
          inactivas: offlineCount
        };
        sendLogToBackend('info', '📊 [HOME] Resumen de estados', summaryData);
      } else {
        const errorText = await response.text();
        const errorData = {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        };
        sendLogToBackend('error', '❌ [HOME] Error al cargar historias', errorData);
        setStories([]);
      }
    } catch (error) {
      const errorData = {
        message: error.message,
        stack: error.stack,
        error: String(error)
      };
      sendLogToBackend('error', '💥 [HOME] Excepción al cargar historias', errorData);
      setStories([]);
    } finally {
      setLoadingStories(false);
      const finalMessage = '🏁 [HOME] Carga de historias finalizada';
      sendLogToBackend('info', finalMessage);
    }
  };

  // 🔥 FUNCIÓN PARA NAVEGAR A CHAT CON CHICA ESPECÍFICA
  const abrirChatConChica = (chica) => {
    logger.debug('Abriendo chat con chica:', chica);
    
    const otherUserId = chica.id || chica.user_id;
    const otherUserName = chica.display_name || chica.name || chica.alias || 'Usuario';
    const userRole = chica.role || 'modelo';
    
    // Generar room_name (mismo formato que usa el backend)
    const currentUserFromState = user?.id;
    const currentUserFromStorage = getUser()?.id;
    const currentUserId = currentUserFromState || currentUserFromStorage;
    
    if (!currentUserId || !otherUserId) {
      logger.error('No se pudo obtener IDs de usuario para crear el chat');
      showNotification('Error al abrir el chat. Por favor, intenta de nuevo.', 'error');
      return;
    }
    
    // Crear room_name ordenando los IDs para que sea consistente
    const roomName = [currentUserId, otherUserId].sort().join('_');
    
    
    const chatData = {
      other_user_id: otherUserId,
      other_user_name: otherUserName,
      other_user_role: userRole,
      room_name: roomName,
      createdLocally: true,
      needsSync: true
    };
    
    logger.debug('Datos del chat:', chatData);
    
    // 🔥 DETECTAR SI ES MÓVIL Y USAR LA RUTA CORRECTA
    const windowWidth = window.innerWidth;
    const isMobile = windowWidth < 768;
    // 🔥 Usar ruta diferente según dispositivo
    const chatPath = isMobile ? '/mensajesmobileclient' : '/message';
    
    const navigationState = {
      pathname: chatPath,
      search: `?user=${encodeURIComponent(otherUserName)}`,
      state: {
        openChatWith: chatData
      }
    };
    
    
    navigate(navigationState);
  };

  // 🔥 NUEVA FUNCIÓN: INICIAR LLAMADA A CHICA (SOPORTA 1VS1 Y 2VS1)
  const iniciarLlamadaAChica = async (chica, modeloIds = null) => {
    try {
      // 🔥 DETERMINAR SI ES LLAMADA CON 2 MODELOS
      const isDualCall = Array.isArray(modeloIds) && modeloIds.length === 2;
      const modeloIdsToUse = modeloIds || (chica?.id ? [chica.id] : null);
      
      // 🔥 VARIABLES CORRECTAS PARA LA VALIDACIÓN
      const otherUserId = chica?.id;
      const otherUserName = chica?.name || chica?.alias;
      
      // 💰 VERIFICAR SALDO ANTES DE INICIAR LLAMADA (doble si es 2vs1)
      const minimumBalance = isDualCall ? 60 : 30; // 60 para 2vs1, 30 para 1vs1
        const balanceResponse = await fetch(`${API_BASE_URL}/api/videochat/coins/balance`, {
          method: 'GET',
          headers: getAuthHeaders()
        });
        
        if (balanceResponse.ok) {
        const balanceData = await balanceResponse.json();
        logger.debug('Respuesta de balance', balanceData);
        
        const purchasedBalance = balanceData.balance?.purchased_coins || balanceData.balance?.purchased_balance || 0;
        const canStartCall = purchasedBalance >= minimumBalance;
        
        logger.debug('can_start_call', { canStartCall, purchasedBalance, minimumBalance });
        
        if (!canStartCall) {
          // ❌ NO TIENE SALDO SUFICIENTE - MOSTRAR MODAL DE COMPRA
          logger.info('Saldo insuficiente detectado, mostrando modal', balanceData);
          setBalanceDetails(balanceData);
          setShowNoBalanceModal(true);
          return;
        }
      } else {
        // Si no se puede verificar el saldo, intentar igual pero manejar el error después
        logger.warn('No se pudo verificar el saldo, continuando con la llamada');
      }
      
      // 🚫 VERIFICAR BLOQUEOS (solo si es llamada 1vs1)
      if (!isDualCall && otherUserId) {
        const yoLaBloquee = usuariosBloqueados.some((user) => user.id === otherUserId);
        if (yoLaBloquee) {
          setConfirmAction({
            title: t('clientInterface.notAvailable'),
            message: t('clientInterface.youBlockedUser', { name: 'nombre' }),
            confirmText: t('clientInterface.understood'),
            action: () => setShowConfirmModal(false)
          });
          setShowConfirmModal(true);
          return;
        }

        // 🚫 VERIFICAR SI ELLA ME BLOQUEÓ
        try {
          const blockCheckResponse = await fetch(`${API_BASE_URL}/api/blocks/check-if-blocked-by`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
              user_id: otherUserId
            })
          });

          if (blockCheckResponse.ok) {
            const blockData = await blockCheckResponse.json();
            if (blockData.success && blockData.is_blocked_by_them) {
              setConfirmAction({
                title: t('clientInterface.notAvailable'),
                message: t('clientInterface.userBlockedYou', { name: 'nombre' }),
                confirmText: t('clientInterface.understood'),
                action: () => setShowConfirmModal(false)
              });
              setShowConfirmModal(true);
              return;
            }
          }
        } catch (error) {
          // Silenciar errores de red o del endpoint
        }
      }

      // ✅ SIN BLOQUEOS Y CON SALDO - PROCEDER CON LA LLAMADA
      if (isDualCall) {
        setCurrentCall({
          modeloIds: modeloIdsToUse,
          status: 'initiating'
        });
      } else {
        setCurrentCall({
          ...chica,
          status: 'initiating'
        });
      }
      setIsCallActive(true);
      
      // 🔥 REPRODUCIR SONIDO DE LLAMADA SALIENTE
      try {
        await playOutgoingCallSound();
      } catch (error) {
      }
      
      const token = localStorage.getItem('token');
      
      // 🔥 PREPARAR BODY SEGÚN TIPO DE LLAMADA
      const requestBody = isDualCall
        ? { modelo_ids: modeloIdsToUse, call_type: 'video' }
        : { receiver_id: chica.id, call_type: 'video' };
      
      const response = await fetch(`${API_BASE_URL}/api/calls/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });
      
      const data = await response.json();
      
      if (data.success) {
        if (isDualCall && data.modelos) {
          setCurrentCall({
            modeloIds: modeloIdsToUse,
            modelos: data.modelos,
            callId: data.call_id,
            status: 'calling'
          });
        } else {
          setCurrentCall({
            ...chica,
            callId: data.call_id,
            status: 'calling'
          });
        }
        iniciarPollingLlamada(data.call_id);
      } else {
        stopOutgoingCallSound();
        setIsCallActive(false);
        setCurrentCall(null);
        
        // 🔥 DETECTAR ERRORES ESPECÍFICOS DE SALDO
        const errorMessage = data.error || data.message || '';
        const isBalanceError = errorMessage.toLowerCase().includes('saldo') || 
                               errorMessage.toLowerCase().includes('balance') ||
                               errorMessage.toLowerCase().includes('insufficient') ||
                               errorMessage.toLowerCase().includes('coins') ||
                               response.status === 402; // Payment Required
        
        if (isBalanceError) {
          // Mostrar modal de compra en lugar de error genérico
          const balanceCheck = await fetch(`${API_BASE_URL}/api/videochat/coins/balance`, {
            method: 'GET',
            headers: getAuthHeaders()
          });
          if (balanceCheck.ok) {
            const balanceInfo = await balanceCheck.json();
            setBalanceDetails(balanceInfo);
            setShowNoBalanceModal(true);
          } else {
            setConfirmAction({
              title: t('clientInterface.insufficientBalanceTitle') || 'Saldo Insuficiente',
              message: t('clientInterface.insufficientBalanceMessage') || 'No tienes saldo suficiente para realizar esta llamada. Por favor, recarga tu cuenta.',
              confirmText: t('clientInterface.understood'),
              action: () => {
                setShowConfirmModal(false);
                setShowBuyMinutes(true);
              }
            });
            setShowConfirmModal(true);
          }
        } else {
          // Otros errores - mostrar mensaje genérico
          setConfirmAction({
            title: t('clientInterface.callError'),
            message: errorMessage || t('clientInterface.callFailed'),
            confirmText: t('clientInterface.understood'),
            action: () => setShowConfirmModal(false)
          });
          setShowConfirmModal(true);
        }
      }
    } catch (error) {
      stopOutgoingCallSound();
      setIsCallActive(false);
      setCurrentCall(null);
      
      // 🔥 DETECTAR ERRORES DE SALDO EN LA EXCEPCIÓN
      const errorMessage = error.message || '';
      const isBalanceError = errorMessage.toLowerCase().includes('saldo') || 
                             errorMessage.toLowerCase().includes('balance') ||
                             errorMessage.toLowerCase().includes('insufficient') ||
                             errorMessage.toLowerCase().includes('coins') ||
                             (error.response && error.response.status === 402);
      
      if (isBalanceError) {
        // Mostrar modal de compra
        const balanceCheck = await fetch(`${API_BASE_URL}/api/videochat/coins/balance`, {
          method: 'GET',
          headers: getAuthHeaders()
        });
        if (balanceCheck.ok) {
          const balanceInfo = await balanceCheck.json();
          setBalanceDetails(balanceInfo);
          setShowNoBalanceModal(true);
        } else {
          setShowBuyMinutes(true);
        }
      } else {
        alert(t('clientInterface.errorStartingCall') || 'Error al iniciar la llamada');
      }
    }
  };

  // 🔥 CARGAR USUARIOS BLOQUEADOS
  const cargarUsuariosBloqueados = async () => {
    try {
      setLoadingBloqueados(true);

      const response = await fetch(`${API_BASE_URL}/api/blocks/list`, {
        method: 'GET',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setUsuariosBloqueados(data.blocked_users || []);
        }
      } else {
              }
    } catch (error) {
          } finally {
      setLoadingBloqueados(false);
    }
  };

  // 🔥 FUNCIONES DE AUDIO
  // 🔥 REMOVIDO: playIncomingCallSound y stopIncomingCallSound ahora se manejan en GlobalCallContext

  // 🔥 NUEVA FUNCIÓN: POLLING PARA VERIFICAR ESTADO DE LLAMADA SALIENTE
  const iniciarPollingLlamada = (callId) => {
    let isPolling = true;
    let interval = null;
    let notificationInterval = null;
    let consecutive403Errors = 0; // Contador de errores 403 consecutivos
    
    // 🔥 FUNCIÓN PARA VERIFICAR NOTIFICACIONES (MÁS CONFIABLE)
    const checkCallAcceptedNotification = async () => {
      if (!isPolling || !isCallActive) {
        return;
      }
      
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        
        const response = await fetch(`${API_BASE_URL}/api/status/updates`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          
          // 🔥 LOG DETALLADO SOLO CUANDO HAY NOTIFICACIONES O CADA 5 INTENTOS
          if (data.has_notifications || Math.random() < 0.2) {
            // Log detallado cuando hay notificaciones
          }
          
          if (data.success && data.has_notifications) {
            const notification = data.notification;
            
            // 🔥 DETECTAR NOTIFICACIÓN DE LLAMADA ACEPTADA
            if (notification.type === 'call_accepted') {
              
              isPolling = false;
              if (interval) clearInterval(interval);
              if (notificationInterval) clearInterval(notificationInterval);
              setCallPollingInterval(null);
              
              // Obtener datos de la notificación
              const notificationData = typeof notification.data === 'string' 
                ? JSON.parse(notification.data) 
                : notification.data;
              
              
              const roomName = notificationData.room_name || currentCall?.roomName;
              const receiverName = notificationData.receiver?.name || notificationData.receiver_name || 'Modelo';
              
              if (roomName) {
                // Redirigir inmediatamente
                redirigirAVideochat({
                  room_name: roomName,
                  receiver: notificationData.receiver
                });
              } else {
              }
              return;
            }
          }
        }
      } catch (error) {
      }
    };
    
    // 🔥 FUNCIÓN PARA VERIFICAR ESTADO (FALLBACK)
    const checkCallStatus = async () => {
      if (!isPolling) return;
      
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          return;
        }
        
        const response = await fetch(`${API_BASE_URL}/api/calls/status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          },
          body: JSON.stringify({ call_id: callId })
        });
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.success) {
            const callStatus = data.call.status;
            
            
            if (callStatus === 'active') {
              // ¡Llamada aceptada por la chica!
              isPolling = false;
              if (interval) clearInterval(interval);
              if (notificationInterval) clearInterval(notificationInterval);
              setCallPollingInterval(null);
              
              // 🔥 DETENER SONIDO DE LLAMADA SALIENTE ANTES DE REDIRIGIR
              stopOutgoingCallSound();
              
              redirigirAVideochat(data.call);
              
            } else if (callStatus === 'rejected') {
              // Llamada rechazada por la chica
              isPolling = false;
              if (interval) clearInterval(interval);
              if (notificationInterval) clearInterval(notificationInterval);
              setCallPollingInterval(null);
              stopOutgoingCallSound();
              setIsCallActive(false);
              setCurrentCall(null);
              alert(t('clientInterface.callRejected'));
              
            } else if (callStatus === 'cancelled') {
              // Llamada cancelada por timeout
              isPolling = false;
              if (interval) clearInterval(interval);
              if (notificationInterval) clearInterval(notificationInterval);
              setCallPollingInterval(null);
              stopOutgoingCallSound();
              setIsCallActive(false);
              setCurrentCall(null);
              alert(t('clientInterface.callExpired'));
            }
          }
        } else if (response.status === 403) {
          // Si hay error 403, incrementar contador y reducir frecuencia
          consecutive403Errors++;
          
          // Si hay muchos errores 403 consecutivos, reducir frecuencia del polling de status
          if (consecutive403Errors >= 3) {
            // Reducir frecuencia a cada 2 segundos en lugar de 500ms
            if (interval) {
              clearInterval(interval);
              interval = setInterval(checkCallStatus, 2000);
            }
          }
          
          // Intentar obtener más información del error
          try {
            const errorData = await response.json();
            // Error 403 en status
          } catch (e) {
            // Error 403 en status (sin detalles)
          }
          // Continuar con notificaciones - no detener el polling
        } else if (response.status === 401) {
          // Token inválido o expirado
          // No detener el polling, el sistema de notificaciones puede seguir funcionando
        } else if (response.ok) {
          // Si la respuesta es exitosa, resetear el contador de errores
          consecutive403Errors = 0;
        }
        
      } catch (error) {
        // Solo loggear errores críticos, no detener el polling
        if (error.name !== 'AbortError') {
        }
      }
    };
    
    // 🔥 EJECUTAR AMBOS INMEDIATAMENTE
    checkCallStatus();
    checkCallAcceptedNotification();
    
    // 🔥 POLLING DE ESTADO CADA 500ms (más frecuente)
    interval = setInterval(checkCallStatus, 500);
    
    // 🔥 POLLING DE NOTIFICACIONES CADA 500ms (más confiable y rápido)
    notificationInterval = setInterval(checkCallAcceptedNotification, 500);
    
    setCallPollingInterval(interval);
    
    // Timeout de seguridad
    setTimeout(() => {
      if (interval && isPolling) {
        isPolling = false;
        clearInterval(interval);
        if (notificationInterval) clearInterval(notificationInterval);
        setCallPollingInterval(null);
        if (isCallActive) {
          stopOutgoingCallSound();
          setIsCallActive(false);
          setCurrentCall(null);
          alert(t('clientInterface.timeoutExpired'));
        }
      }
    }, 35000);
  };

  // 🔥 NUEVA FUNCIÓN: CANCELAR LLAMADA SALIENTE
  const cancelarLlamada = async () => {
    try {
      
      if (currentCall?.callId) {
        const token = localStorage.getItem('token');
        await fetch(`${API_BASE_URL}/api/calls/cancel`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            call_id: currentCall.callId
          })
        });
      }
      
      // Limpiar polling
      if (callPollingInterval) {
        clearInterval(callPollingInterval);
        setCallPollingInterval(null);
      }
      
      // 🔥 DETENER SONIDO DE LLAMADA SALIENTE
      stopOutgoingCallSound();
      
    } catch (error) {
          }
    
    setIsCallActive(false);
    setCurrentCall(null);
  };

  // 🔥 REMOVIDO: verificarLlamadasEntrantes y responderLlamada ahora se manejan en GlobalCallContext

  // 🔥 NUEVA FUNCIÓN: REDIRIGIR AL VIDEOCHAT CLIENTE
  const redirigirAVideochat = (callData) => {
    // 🔥 DETENER SONIDO DE LLAMADA SALIENTE ANTES DE REDIRIGIR
    stopOutgoingCallSound();
    
    // 🔥 Obtener room_name de diferentes posibles ubicaciones
    const roomName = callData.room_name || callData.incoming_call?.room_name || callData.call?.room_name;
    
    if (!roomName) {
      return;
    }
    
    // 🔥 Obtener el nombre del receptor/modelo
    const receiverName = callData.receiver?.name || callData.receiver_name || callData.modelo?.name || 'Modelo';
    
    // Guardar datos de la llamada
    localStorage.setItem('roomName', roomName);
    localStorage.setItem('userName', receiverName);
    localStorage.setItem('currentRoom', roomName);
    localStorage.setItem('inCall', 'true');
    localStorage.setItem('videochatActive', 'true');
    
    // Limpiar estados de llamada
    setIsCallActive(false);
    setCurrentCall(null);
    
    // Limpiar intervals
    if (callPollingInterval) {
      clearInterval(callPollingInterval);
      setCallPollingInterval(null);
    }
    
    // 🔥 REDIRIGIR CON URL COMPLETA Y PARÁMETROS
    const videochatUrl = `/videochatclient?roomName=${encodeURIComponent(roomName)}&userName=${encodeURIComponent(receiverName)}`;
    
    try {
      navigate(videochatUrl, {
        state: {
          userName: receiverName,
          callId: callData.call_id || callData.id || callData.incoming_call?.id,
          from: 'call',
          callData: callData
        },
        replace: true
      });
    } catch (navError) {
      // Fallback: usar window.location
      window.location.href = videochatUrl;
    }
  };

  // 🔄 POLLING MEJORADO - SIN PARPADEO
  useEffect(() => {
    if (!user?.id) {
      return;
    }

    cargarChicasActivas(false);
    cargarHistorias(); // Cargar historias al montar

    const interval = setInterval(() => {
      cargarChicasActivas(true);
      cargarHistorias(); // Actualizar historias periódicamente
    }, 30000);

    return () => clearInterval(interval);
  }, [user?.id]);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await getUser();
        // Verificar que se obtuvo un usuario válido
        if (!userData || (!userData.user && !userData.id)) {
          // No hay usuario válido, limpiar y redirigir
          try {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('session_closed_by_other_device');
          } catch (e) {
            // Ignorar errores
          }
          window.location.href = '/home';
          return;
        }
        
        const user = userData.user || userData;
        // Verificar que el usuario tiene rol cliente
        if (user.rol !== 'cliente') {
          // Rol incorrecto, redirigir según rol
          try {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
          } catch (e) {
            // Ignorar errores
          }
          if (user.rol === 'modelo') {
            window.location.href = '/homellamadas';
          } else if (user.rol === 'admin') {
            window.location.href = '/admin/dashboard';
          } else {
            window.location.href = '/home';
          }
          return;
        }
        
        setUser(user);
      } catch (err) {
        // getUser usa axios, que ya dispara el evento axiosError automáticamente
        // Si hay error de sesión cerrada, el evento ya fue disparado
        logger.warn('Error al obtener usuario:', err);
        
        // Si hay error, verificar si es por sesión cerrada
        const sessionClosedFlag = localStorage.getItem('session_closed_by_other_device');
        if (sessionClosedFlag !== 'true') {
          // No es sesión cerrada por otro dispositivo, limpiar y redirigir
          try {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
          } catch (e) {
            // Ignorar errores
          }
          window.location.href = '/home';
        }
      }
    };
    fetchUser();
  }, []);

  // 🔥 REMOVIDO: Polling de llamadas entrantes ahora se maneja en GlobalCallContext

  // 🔥 CARGAR USUARIOS BLOQUEADOS
  useEffect(() => {
    if (!user?.id) return;
    cargarUsuariosBloqueados();
    consultarSaldoUsuario();
  }, [user?.id]);

  // 🔥 CARGAR HISTORIAL DE LLAMADAS
  useEffect(() => {
    if (user?.id) {
      cargarHistorialLlamadas();
    } else {
    }
  }, [user?.id]);

  // 🔥 ABRIR AUTOMÁTICAMENTE "CHICAS ACTIVAS" SI HAY CHICAS ACTIVAS
  useEffect(() => {
    if (chicasActivas.length > 0) {
      setExpandedSections(prev => ({
        ...prev,
        activeGirls: true
      }));
    }
  }, [chicasActivas.length]);


  const ModalSinSaldo = ({ isVisible, onClose, onGoToRecharge }) => {
    const { t: tModal } = useTranslation(); // 🔥 USAR useTranslation DENTRO DEL COMPONENTE
    if (!isVisible) return null;
    
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
        <div className="bg-[#2b2d31] rounded-xl p-6 max-w-md mx-4 shadow-xl border border-[#ff007a]/20">
          <div className="text-center">
            {/* Icono animado */}
            <div className="w-16 h-16 bg-[#ff007a]/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
              <svg className="w-8 h-8 text-[#ff007a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            
            {/* Título */}
            <h3 className="text-xl font-bold text-white mb-3">
              {tModal('clientInterface.insufficientBalanceTitle')}
            </h3>
            
            {/* Mensaje */}
            <div className="text-white/70 mb-6 leading-relaxed">
              <p className="mb-3">
                {tModal('clientInterface.insufficientBalanceMessage')}
              </p>
              
              {/* ✅ MOSTRAR DETALLES DEL SALDO SI ESTÁN DISPONIBLES */}
              {balanceDetails && balanceDetails.balance && (
                <div className="bg-[#1f2125] rounded-lg p-3 text-sm">
                  <p className="text-white/50 mb-2">{tModal('clientInterface.currentStatus')}</p>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>{tModal('clientInterface.totalCoins')}</span>
                      <span className="text-[#ff007a]">
                        {balanceDetails.balance.total_coins || 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>{tModal('clientInterface.minutes')}</span>
                      <span className="text-[#ff007a]">
                        {balanceDetails.balance.minutes_available || 0}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-white/10 pt-2 mt-2">
                      <span>{tModal('clientInterface.minimumRequired')}</span>
                      <span className="text-yellow-400">
                        {balanceDetails.balance.minimum_required || 30}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Botones */}
            <div className="flex flex-col gap-3">
              <button
                onClick={onGoToRecharge}
                className="w-full bg-[#ff007a] hover:bg-[#e6006e] text-white px-6 py-3 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                {tModal('clientInterface.rechargeNow')}
              </button>
              
              <button
                onClick={onClose}
                className="w-full bg-transparent border border-white/20 hover:border-white/40 text-white/70 hover:text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                {tModal('clientInterface.cancel')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Estado para verificación de pagos
  const [checkingPayments, setCheckingPayments] = useState(false);

  // Función para verificar todos los pagos pendientes
  const checkAllPendingPayments = async () => {
    setCheckingPayments(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/wompi/check-all-pending`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        if (data.processed > 0) {
          showNotification(
            `¡Excelente! Se procesaron ${data.processed} pago(s) pendiente(s). Se agregaron las monedas a tu cuenta.`,
            'success'
          );
          // Actualizar balance después de un pequeño delay
          setTimeout(() => {
            consultarSaldoUsuario();
          }, 1000);
        } else if (data.still_pending > 0) {
          showNotification(
            `Hay ${data.still_pending} pago(s) aún pendiente(s). Se verificarán automáticamente.`,
            'info'
          );
        } else {
          showNotification('No hay pagos pendientes por verificar.', 'info');
        }
      } else {
        showNotification(data.error || 'Error al verificar los pagos pendientes.', 'error');
      }
    } catch (error) {
      showNotification('Error de conexión al verificar pagos.', 'error');
    } finally {
      setCheckingPayments(false);
    }
  };

  const SaldoWidget = () => {
    const { t: tWidget } = useTranslation(); // 🔥 USAR useTranslation DENTRO DEL COMPONENTE
    if (!userBalance) return null;
    
    return (
      <div className="bg-[#2b2d31] rounded-xl p-4 border border-[#ff007a]/20 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-white/60">{tWidget('clientInterface.yourBalance')}</span>
          <button 
            onClick={consultarSaldoUsuario}
            className="text-[#ff007a] hover:text-[#e6006e] text-xs"
            disabled={loadingBalance}
          >
            {loadingBalance ? '⟳' : '🔄'}
          </button>
        </div>
        
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-white/70">{tWidget('clientInterface.total')}</span>
            <span className="text-[#ff007a] font-semibold">
              {userBalance.total_coins || userBalance.total_available || 0}
            </span>
          </div>
          <div className="flex justify-between text-xs items-center">
            <div className="flex items-center gap-2">
            <span className="text-white/50">{tWidget('clientInterface.minutes')}</span>
              <button
                onClick={checkAllPendingPayments}
                disabled={checkingPayments}
                className="text-[10px] px-2 py-0.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded border border-blue-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={tWidget('clientInterface.verifyPaymentsTitle')}
              >
                {checkingPayments ? tWidget('clientInterface.verifyingPayments') : tWidget('clientInterface.verifyPayments')}
              </button>
            </div>
            <span className="text-white/70">{userBalance.minutes_available || 0}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-white/50">{tWidget('clientInterface.status')}</span>
            <span className={
              (userBalance.total_coins || userBalance.total_available || 0) <= 29
                ? "text-red-400"
                : (userBalance.total_coins || userBalance.total_available || 0) <= 39
                  ? "text-yellow-400"
                  : "text-green-400"
            }>
              {(userBalance.total_coins || userBalance.total_available || 0) <= 29
                ? tWidget('clientInterface.insufficientBalance')
                : (userBalance.total_coins || userBalance.total_available || 0) <= 39
                  ? tWidget('clientInterface.minimumBalance')
                  : tWidget('clientInterface.stableBalance')
              }
            </span>
          </div>
        </div>
      </div>
    );
  };

  // 🔥 CONFIGURAR SISTEMA DE AUDIO
  useEffect(() => {
    
    const enableAudioContext = async () => {
      try {
        const silentAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAAABAABABkAAgAAACAJAAEAAABkYXRhBAAAAAEA');
        silentAudio.volume = 0.01;
        await silentAudio.play();
      } catch (e) {
      }
      
      document.removeEventListener('click', enableAudioContext);
      document.removeEventListener('touchstart', enableAudioContext);
    };
    
    document.addEventListener('click', enableAudioContext, { once: true });
    document.addEventListener('touchstart', enableAudioContext, { once: true });
    
    return () => {
      document.removeEventListener('click', enableAudioContext);
      document.removeEventListener('touchstart', enableAudioContext);
    };
  }, []);

  // 🔥 CLEANUP MEJORADO
  useEffect(() => {
    return () => {
      // 🔥 REMOVIDO: stopIncomingCallSound ahora se maneja en GlobalCallContext
      if (callPollingInterval) {
        clearInterval(callPollingInterval);
      }
      // 🔥 REMOVIDO: incomingCallPollingInterval ahora se maneja en GlobalCallContext
    };
  }, []);

  return (
    <ProtectedPage requiredConditions={{
      emailVerified: true,
      profileComplete: true,
      role: "cliente",
      blockIfInCall: true
    }}>
      <div className="h-screen bg-gradient-to-br from-[#1a1c20] via-[#1f2125] to-[#2b2d31] text-white flex flex-col overflow-hidden">
        {/* Notificación Toast - Mejorada con accesibilidad */}
        {notification && (
          <div 
            role="alert"
            aria-live="polite"
            aria-atomic="true"
            className={`fixed top-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-auto z-[9999] px-4 py-3 rounded-lg shadow-2xl border flex items-center gap-2 animate-slide-in-right max-w-sm sm:max-w-md backdrop-blur-sm ${
              notification.type === 'success' 
                ? 'bg-green-500/20 border-green-500/30 text-green-400'
                : notification.type === 'error'
                ? 'bg-red-500/20 border-red-500/30 text-red-400'
                : notification.type === 'warning'
                ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400'
                : 'bg-blue-500/20 border-blue-500/30 text-blue-400'
            }`}
          >
            {notification.type === 'success' && <span className="text-base" aria-hidden="true">✓</span>}
            {notification.type === 'error' && <span className="text-base" aria-hidden="true">✗</span>}
            {notification.type === 'warning' && <span className="text-base" aria-hidden="true">⚠</span>}
            {notification.type === 'info' && <span className="text-base" aria-hidden="true">ℹ</span>}
            <span className="text-xs sm:text-sm font-medium flex-1">{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              className="ml-2 text-white/60 hover:text-white text-lg font-bold transition-colors"
              aria-label="Cerrar notificación"
            >
              ×
            </button>
          </div>
        )}
        <div className="flex-shrink-0 pt-4 sm:pt-5 lg:pt-6 mb-2 sm:mb-3 lg:mb-4 px-4 sm:px-6">
          <Header />
        </div>

        <div className="flex-1 flex flex-col lg:flex-row gap-3 sm:gap-4 lg:gap-6 p-3 sm:p-4 lg:p-6 min-h-0 overflow-y-auto lg:overflow-hidden">
          {/* Panel central - Mejorado con gradientes y sombras */}
          <main 
            className="flex-1 w-full lg:w-3/4 bg-gradient-to-br from-[#1f2125] via-[#25282c] to-[#1f2125] rounded-2xl p-6 sm:p-8 lg:p-8 shadow-2xl border border-[#ff007a]/10 flex flex-col items-center justify-center relative overflow-hidden min-h-[100vh] max-h-[130vh] lg:min-h-0 lg:max-h-none lg:h-full flex-shrink-0"
            role="main"
            aria-label="Panel principal de inicio"
          >
            {/* Efecto de brillo sutil en el fondo */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#ff007a]/5 via-transparent to-transparent pointer-events-none"></div>
            <div className="w-full max-w-2xl flex flex-col items-center justify-center relative z-10 py-6 sm:py-8 lg:py-6">
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-2xl font-bold text-center mb-4 sm:mb-5 lg:mb-3 px-4 bg-gradient-to-r from-white to-white/90 bg-clip-text text-transparent">
                {t('clientInterface.greeting', { name: user?.name })}
              </h2>
              <p className="text-center text-white/80 mb-6 sm:mb-7 lg:mb-4 text-base sm:text-lg lg:text-sm px-4 leading-relaxed" role="note">
                {t('clientInterface.mainDescription')}
              </p>

              {/* 🔥 SELECTOR DE MODO DE LLAMADA */}
              <div className="w-full max-w-sm px-4 mb-4 sm:mb-5 lg:mb-2 lg:sm:mb-3">
                <CallModeSelector
                  onModeChange={(mode, selectedIds) => {
                    setCallMode(mode);
                    if (mode === 'dual') {
                      // Abrir modal para configurar 2vs1
                      setShowDualCallModal(true);
                    } else {
                      // Modo normal, limpiar selección
                      setSelectedModelos([]);
                    }
                  }}
                  disabled={loadingBalance}
                  initialMode={callMode}
                  availableModelos={availableModelos}
                />
              </div>

              {/* 🔥 MODAL PARA CONFIGURAR LLAMADA 2VS1 */}
              <DualCallConfigModal
                isOpen={showDualCallModal}
                onClose={() => {
                  setShowDualCallModal(false);
                  // Si se cancela, volver a modo normal
                  setCallMode('normal');
                  setSelectedModelos([]);
                }}
                availableModelos={availableModelos}
                onConfirm={async (modeloIds) => {
                  setSelectedModelos(modeloIds);
                  setCallMode('dual');
                  setShowDualCallModal(false);
                  
                  // 🔥 INICIAR LLAMADA 2VS1 INMEDIATAMENTE
                  try {
                    await iniciarLlamadaAChica(null, modeloIds);
                  } catch (error) {
                    // Resetear estado en caso de error
                    setSelectedModelos([]);
                    setCallMode('normal');
                  }
                }}
                userBalance={userBalance?.purchased_coins || userBalance?.purchased_balance || 0}
              />

              {/* Botones verticales - Mejorados */}
              <div className="flex flex-col items-center gap-4 sm:gap-5 lg:gap-3 w-full max-w-sm px-4 mb-4 sm:mb-5 lg:mb-3">
              <button
                className="w-full bg-gradient-to-r from-[#ff007a] to-[#e6006e] hover:from-[#ff3399] hover:to-[#ff007a] text-white px-8 sm:px-10 lg:px-5 py-4 sm:py-5 lg:py-2.5 rounded-full text-base sm:text-lg lg:text-sm font-semibold shadow-lg shadow-[#ff007a]/30 transition-all duration-300 transform hover:scale-105 hover:shadow-xl hover:shadow-[#ff007a]/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:hover:shadow-lg relative overflow-hidden group"
                onClick={() => {
                  // 🔥 BLOQUEAR 2VS1 EN PRODUCCIÓN
                  const isProd = API_BASE_URL?.includes('ligandome.com') || API_BASE_URL?.includes('https://');
                  if (callMode === 'dual' && isProd) {
                    alert('La función 2vs1 no está disponible temporalmente. Por favor, usa el modo 1vs1.');
                    setCallMode('normal');
                    setSelectedModelos([]);
                    return;
                  }

                  if (callMode === 'dual') {
                    // Si está en modo dual pero no hay modelos seleccionados, abrir modal
                    if (selectedModelos.length !== 2) {
                      setShowDualCallModal(true);
                    } else {
                      // Ya hay modelos seleccionados, iniciar llamada
                      iniciarLlamadaAChica(null, selectedModelos);
                    }
                  } else {
                    // Modo normal, usar flujo original
                    validarSaldoYRedireccionarConLoading();
                  }
                }}
                disabled={loadingBalance}
                aria-label={callMode === 'dual' 
                  ? (selectedModelos.length === 2 ? 'Iniciar Llamada 2vs1' : 'Configurar Llamada 2vs1')
                  : t('clientInterface.startCall')}
              >
                {/* Efecto de brillo en hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                {loadingBalance ? (
                  <div className="flex items-center justify-center gap-2 relative z-10">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span>{t('clientInterface.checkingBalance')}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 relative z-10">
                    <Video className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
                    {callMode === 'dual' 
                      ? (selectedModelos.length === 2 ? 'Iniciar Llamada 2vs1' : 'Configurar Llamada 2vs1')
                      : t('clientInterface.startCall')
                    }
                  </div>
                )}
              </button>

              <button
                className="w-full bg-gradient-to-r from-[#ffe4f1] to-[#ffd1e8] hover:from-[#ffd1e8] hover:to-[#ffb8d9] text-[#4b2e35] px-8 sm:px-10 lg:px-5 py-4 sm:py-5 lg:py-2.5 rounded-full text-base sm:text-lg lg:text-sm font-semibold shadow-md transition-all duration-300 transform hover:scale-105 hover:shadow-lg active:scale-95 relative overflow-hidden group"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  logger.debug('Click en Comprar Monedas');
                  setShowBuyMinutes(true);
                }}
                aria-label={t('clientInterface.buyCoins')}
              >
                {/* Efecto ripple */}
                <div className="absolute inset-0 bg-white/20 scale-0 group-active:scale-100 rounded-full transition-transform duration-300"></div>
                <span className="relative z-10">{t('clientInterface.buyCoins')}</span>
              </button>

              {/* Consejo del día - Usando componente nuevo - TEMPORALMENTE DESHABILITADO PARA EVITAR ERRORES */}
              {/* <TipOfTheDay className="mt-6 sm:mt-8 lg:mt-3 w-full max-w-sm px-4" /> */}
            </div>
            </div>
          </main>

           {/* Panel lateral derecho - Acordeón Mejorado con responsive */}
           <aside className="w-full lg:w-1/4 flex flex-col min-h-0 lg:h-full flex-shrink-0" role="complementary" aria-label="Panel de información">
             <div className="bg-gradient-to-b from-[#2b2d31] to-[#1f2125] rounded-2xl border border-[#ff007a]/20 flex flex-col shadow-xl lg:h-full lg:flex-1 lg:min-h-0">
              {/* Sección 1: Saldo - Usando componente BalanceCard */}
              {userBalance && (
                <BalanceCard
                  userBalance={userBalance}
                  loadingBalance={loadingBalance}
                  checkingPayments={checkingPayments}
                  onRefresh={consultarSaldoUsuario}
                  onVerifyPayments={checkAllPendingPayments}
                  isExpanded={expandedSections.balance}
                  onToggleExpand={() => setExpandedSections(prev => ({
                    balance: !prev.balance,
                    activeGirls: false,
                    history: false
                  }))}
                />
              )}

               {/* Sección 2: Chicas Activas - Usando componente ActiveGirlsList */}
               <div className={`border-b border-[#ff007a]/10 flex flex-col ${expandedSections.activeGirls ? 'lg:flex-1 lg:min-h-0' : 'flex-shrink-0'} transition-all duration-300`}>
                <button
                  onClick={() => setExpandedSections(prev => ({
                    balance: false,
                    activeGirls: !prev.activeGirls,
                    history: false
                  }))}
                  className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-[#1f2125] transition-colors flex-shrink-0 group"
                  aria-expanded={expandedSections.activeGirls}
                  aria-label={t('clientInterface.activeGirls')}
                >
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Users className="w-4 h-4 text-[#ff007a]" />
                    <h3 className="text-sm sm:text-base lg:text-lg font-bold text-[#ff007a]">
                      {t('clientInterface.activeGirls')}
                    </h3>
                    {chicasActivas.length > 0 && (
                      <span className="text-xs text-white/50 bg-[#ff007a]/20 px-2 py-1 rounded-full">
                        {chicasActivas.length}
                      </span>
                    )}
                  </div>
                  <svg
                    className={`w-5 h-5 text-white/60 transition-transform duration-300 ${expandedSections.activeGirls ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {expandedSections.activeGirls && (
                  <ActiveGirlsList
                    chicasActivas={chicasActivas}
                    loadingUsers={loadingUsers}
                    onCall={(chica) => {
                      const chicaData = {
                        id: chica.id,
                        name: chica.display_name || chica.name || chica.alias,
                        display_name: chica.display_name || chica.name || chica.alias,
                        alias: chica.display_name || chica.name || chica.alias,
                        role: 'modelo',
                        is_online: chica.is_online,
                        avatar_url: chica.avatar_url || chica.avatar
                      };
                      iniciarLlamadaAChica(chicaData);
                    }}
                    onMessage={(chica) => {
                      const chicaData = {
                        id: chica.id,
                        name: chica.display_name || chica.name || chica.alias,
                        display_name: chica.display_name || chica.name || chica.alias,
                        alias: chica.display_name || chica.name || chica.alias,
                        role: 'modelo',
                        is_online: chica.is_online,
                        avatar_url: chica.avatar_url || chica.avatar
                      };
                      abrirChatConChica(chicaData);
                    }}
                    isCallActive={isCallActive}
                    isReceivingCall={isReceivingCall}
                  />
                )}
              </div>

              {/* Sección 3: Historial - Usando componente CallHistoryList */}
              <div className={`flex flex-col ${expandedSections.history ? 'lg:flex-1 lg:min-h-0 lg:overflow-hidden' : 'flex-shrink-0'} transition-all duration-300`}>
                <button
                  onClick={() => setExpandedSections(prev => {
                    const newHistoryState = !prev.history;
                    return {
                      balance: false,      // Cerrar Tu Saldo cuando se abre Historial
                      activeGirls: false,  // Cerrar Chicas Activas cuando se abre Historial
                      history: newHistoryState
                    };
                  })}
                  className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-[#1f2125] transition-colors flex-shrink-0 group"
                  aria-expanded={expandedSections.history}
                  aria-label={t('clientInterface.yourHistory')}
                >
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#ff007a]" />
                    <h3 className="text-sm sm:text-base lg:text-lg font-bold text-[#ff007a]">
                      {t('clientInterface.yourHistory')}
                    </h3>
                  </div>
                  <svg
                    className={`w-5 h-5 text-white/60 transition-transform duration-300 ${expandedSections.history ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {expandedSections.history && (
                  <CallHistoryList
                    callHistory={callHistory}
                    loadingHistory={loadingHistory}
                    onCall={(item) => iniciarLlamadaAChica(item)}
                    onMessage={(item) => abrirChatConChica(item)}
                  />
                )}
              </div>
            </div>
          </aside>
        </div>

        {/* Estilos adicionales para animaciones y scrollbar mejorados */}
        <style>{`
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          @keyframes shimmer {
            0% {
              background-position: -200% 0;
            }
            100% {
              background-position: 200% 0;
            }
          }
          
          @keyframes slideInRight {
            from {
              opacity: 0;
              transform: translateX(20px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
          
          .animate-fadeIn {
            animation: fadeIn 0.3s ease-out forwards;
          }
          
          .animate-shimmer {
            animation: shimmer 2s infinite;
          }
          
          .animate-slide-in-right {
            animation: slideInRight 0.3s ease-out;
          }
          
          /* Scrollbar personalizado mejorado */
          .custom-scrollbar::-webkit-scrollbar {
            width: 8px;
          }
          
          .custom-scrollbar::-webkit-scrollbar-track {
            background: rgba(43, 45, 49, 0.5);
            border-radius: 10px;
            margin: 4px 0;
          }
          
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: linear-gradient(180deg, #ff007a 0%, #cc0062 100%);
            border-radius: 10px;
            border: 2px solid rgba(43, 45, 49, 0.3);
            box-shadow: 0 2px 4px rgba(255, 0, 122, 0.3);
            transition: all 0.2s ease;
          }
          
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: linear-gradient(180deg, #ff3399 0%, #e6006e 100%);
            box-shadow: 0 2px 6px rgba(255, 0, 122, 0.5);
            transform: scaleY(1.1);
          }
          
          .custom-scrollbar::-webkit-scrollbar-thumb:active {
            background: linear-gradient(180deg, #cc0062 0%, #99004d 100%);
          }
          
          /* Para Firefox */
          .custom-scrollbar {
            scrollbar-width: thin;
            scrollbar-color: #ff007a rgba(43, 45, 49, 0.5);
          }
          
          /* Mejoras de accesibilidad - Focus visible mejorado */
          button:focus-visible,
          input:focus-visible,
          a:focus-visible {
            outline: 2px solid #ff007a;
            outline-offset: 2px;
            border-radius: 4px;
          }
          
          /* Transiciones suaves para todos los elementos interactivos */
          button, a, input {
            transition: all 0.2s ease;
          }
        `}</style>

        {/* 🔥 MODAL DE CONFIRMACIÓN */}
        {showConfirmModal && confirmAction && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-[#2b2d31] rounded-xl p-6 max-w-sm mx-4 shadow-xl border border-[#ff007a]/20">
              <h3 className="text-lg font-bold text-white mb-3">
                {confirmAction.title}
              </h3>
              <p className="text-white/70 mb-6">
                {confirmAction.message}
              </p>
              <button
                onClick={confirmAction.action}
                className="w-full bg-[#ff007a] hover:bg-[#e6006e] text-white px-4 py-2 rounded-lg font-semibold transition-colors"
              >
                {confirmAction.confirmText}
              </button>
            </div>
          </div>
        )}

        {/* 🔄 CAMBIO: Reemplazar StripeBuyMinutes con UnifiedPaymentModal */}
        {showBuyMinutes && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)' }}>
            <UnifiedPaymentModal onClose={cerrarModalCompraMinutos} />
          </div>
        )}

        {/* 🔥 OVERLAY PARA LLAMADAS SALIENTES */}
        <CallingSystem
          isVisible={isCallActive}
          callerName={currentCall?.display_name || currentCall?.name || currentCall?.alias}
          callerAvatar={currentCall?.avatar_url || null}
          onCancel={cancelarLlamada}
          callStatus={currentCall?.status || 'initiating'}
        />

        {/* 🔥 REMOVIDO: IncomingCallOverlay ahora se maneja globalmente en GlobalCallContext */}

        {/* 🔥 MODAL DE SALDO INSUFICIENTE */}
        <ModalSinSaldo
          isVisible={showNoBalanceModal}
          onClose={() => setShowNoBalanceModal(false)}
          onGoToRecharge={() => {
            setShowNoBalanceModal(false);
            setShowBuyMinutes(true);
          }}
        />

      </div>
    </ProtectedPage>
  );
}
