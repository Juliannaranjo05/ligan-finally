import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, Star, Home, Phone, Clock, CheckCircle, Users } from "lucide-react";
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
        console.warn('🚫 [HomeCliente] Sesión cerrada por otro dispositivo detectada en:', url);
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

  // 🔥 HEARTBEAT DE RESPALDO: Asegura detección constante de sesión cerrada
  // El heartbeat global en ProtectedPage ya está activo, esto es redundancia adicional
  useBrowsingHeartbeat(25000); // 25 segundos

  // 🔥 VALIDACIÓN ADICIONAL DE SEGURIDAD: Verificar token y rol al montar
  useEffect(() => {
    const validateAccess = () => {
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
  }, [navigate]);

  // Estados
  const [user, setUser] = useState(null);
  const [chicasActivas, setChicasActivas] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [showBuyMinutes, setShowBuyMinutes] = useState(false);
  const [userBalance, setUserBalance] = useState(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [showNoBalanceModal, setShowNoBalanceModal] = useState(false);
  const [balanceDetails, setBalanceDetails] = useState(null); // ✅ ESTADO FALTANTE
  const [notification, setNotification] = useState(null); // Notificación temporal

  // Verificar pago de Wompi cuando el usuario regresa
  useEffect(() => {
    const payment = searchParams.get('payment');
    const reference = searchParams.get('reference');
    const purchaseId = searchParams.get('purchase_id');

    if (payment === 'wompi' && purchaseId) {
      // Verificar el estado del pago
      const checkPaymentStatus = async () => {
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
              // Actualizar balance
              consultarSaldoUsuario();
            } else if (data.purchase.status === 'pending') {
              showNotification('Tu pago está siendo procesado. Las monedas se agregarán cuando se confirme.', 'info');
            } else {
              showNotification('El pago no se completó. Por favor intenta nuevamente.', 'error');
            }
          }

          // Limpiar parámetros de la URL
          searchParams.delete('payment');
          searchParams.delete('reference');
          searchParams.delete('purchase_id');
          setSearchParams(searchParams, { replace: true });
        } catch (error) {
          console.error('Error verificando estado del pago:', error);
        }
      };

      checkPaymentStatus();
    } else if (payment === 'cancelled') {
      showNotification('El pago fue cancelado.', 'info');
      searchParams.delete('payment');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, API_BASE_URL]);

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
                  gift_balance: giftsData.balance.gift_balance || 0
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

  // Función para mostrar notificación
  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000); // Ocultar después de 4 segundos
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
  
  // 🔥 USAR CONTEXTO GLOBAL PARA LLAMADAS ENTRANTES
  const { isReceivingCall } = useGlobalCall();
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
    activeGirls: false,  // Se abrirá automáticamente si hay chicas activas
    history: false       // Por defecto cerrado
  });

  const { t } = useTranslation();

  // 🔥 FUNCIÓN PARA OBTENER HEADERS CON TOKEN
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

  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'Authorization': token ? `Bearer ${token}` : ''
    };
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
        
        // Filtrar solo modelos (chicas) que están online
        const chicasOnline = (data.contacts || []).filter(contact => 
          contact.role === 'modelo' && contact.is_online
        );
        
        setChicasActivas(prevChicas => {
          const newChicaIds = chicasOnline.map(u => u.id).sort();
          const prevChicaIds = prevChicas.map(u => u.id).sort();
          
          if (JSON.stringify(newChicaIds) !== JSON.stringify(prevChicaIds)) {
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
    
    navigate({
      pathname: '/message',
      search: `?user=${encodeURIComponent(otherUserName)}`,
      state: {
        openChatWith: chatData
      }
    });
  };

  // 🔥 NUEVA FUNCIÓN: INICIAR LLAMADA A CHICA
  const iniciarLlamadaAChica = async (chica) => {
    try {
      
      // 🔥 VARIABLES CORRECTAS PARA LA VALIDACIÓN
      const otherUserId = chica.id;
      const otherUserName = chica.name || chica.alias;
      
      // 💰 VERIFICAR SALDO ANTES DE INICIAR LLAMADA
      const balanceResponse = await fetch(`${API_BASE_URL}/api/videochat/coins/balance`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      
      if (balanceResponse.ok) {
        const balanceData = await balanceResponse.json();
        logger.debug('Respuesta de balance', balanceData);
        
        // 🔥 VERIFICAR SI PUEDE INICIAR LLAMADA (puede venir como success.can_start_call o directamente can_start_call)
        const canStartCall = balanceData.success?.can_start_call ?? balanceData.can_start_call ?? true;
        
        logger.debug('can_start_call', { canStartCall });
        
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
      
      // 🚫 VERIFICAR SI YO LA BLOQUEÉ
      const yoLaBloquee = usuariosBloqueados.some((user) => user.id === otherUserId);
      if (yoLaBloquee) {
        setConfirmAction({
          type: 'blocked',
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
              type: 'blocked',
              title: t('clientInterface.notAvailable'),
              message: t('clientInterface.userBlockedYou', { name: 'nombre' }),
              confirmText: t('clientInterface.understood'),
              action: () => setShowConfirmModal(false)
            });
            setShowConfirmModal(true);
            return;
          }
        }
        // Si el endpoint no está disponible (404) o hay error, continuar normalmente
      } catch (error) {
        // Silenciar errores de red o del endpoint (endpoint puede no estar disponible)
      }

      // ✅ SIN BLOQUEOS Y CON SALDO - PROCEDER CON LA LLAMADA
      setCurrentCall({
        ...chica,
        status: 'initiating'
      });
      setIsCallActive(true);
      
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/calls/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          receiver_id: chica.id,
          call_type: 'video'
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setCurrentCall({
          ...chica,
          callId: data.call_id,
          roomName: data.room_name,
          status: 'calling'
        });
        iniciarPollingLlamada(data.call_id);
      } else {
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
              type: 'error',
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
            type: 'error',
            title: t('clientInterface.callError'),
            message: errorMessage || t('clientInterface.callFailed'),
            confirmText: t('clientInterface.understood'),
            action: () => setShowConfirmModal(false)
          });
          setShowConfirmModal(true);
        }
      }
    } catch (error) {
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
            console.log('📢 [CALL][CLIENTE] Verificando notificaciones:', {
              has_notifications: data.has_notifications,
              notification_type: data.notification?.type,
              notification_full: data.notification,
              callId,
              isCallActive,
              currentCall: currentCall?.callId
            });
          }
          
          if (data.success && data.has_notifications) {
            const notification = data.notification;
            
            console.log('🔔 [CALL][CLIENTE] Notificación recibida:', {
              type: notification.type,
              data: notification.data,
              full_notification: notification
            });
            
            // 🔥 DETECTAR NOTIFICACIÓN DE LLAMADA ACEPTADA
            if (notification.type === 'call_accepted') {
              console.log('✅ [CALL][CLIENTE] ¡Notificación de llamada aceptada recibida!', notification);
              
              isPolling = false;
              if (interval) clearInterval(interval);
              if (notificationInterval) clearInterval(notificationInterval);
              setCallPollingInterval(null);
              
              // Obtener datos de la notificación
              const notificationData = typeof notification.data === 'string' 
                ? JSON.parse(notification.data) 
                : notification.data;
              
              console.log('📦 [CALL][CLIENTE] Datos de notificación procesados:', notificationData);
              
              const roomName = notificationData.room_name || currentCall?.roomName;
              const receiverName = notificationData.receiver?.name || notificationData.receiver_name || 'Modelo';
              
              console.log('🚀 [CALL][CLIENTE] Preparando redirección:', {
                roomName,
                receiverName,
                hasRoomName: !!roomName
              });
              
              if (roomName) {
                // Redirigir inmediatamente
                redirigirAVideochat({
                  room_name: roomName,
                  receiver: notificationData.receiver,
                  call_id: notificationData.call_id || callId
                });
              } else {
                console.error('❌ [CALL][CLIENTE] No se pudo obtener roomName de la notificación');
              }
              return;
            }
          }
        }
      } catch (error) {
        console.error('❌ [CALL][CLIENTE] Error verificando notificaciones:', error);
      }
    };
    
    // 🔥 FUNCIÓN PARA VERIFICAR ESTADO (FALLBACK)
    const checkCallStatus = async () => {
      if (!isPolling) return;
      
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          console.warn('⚠️ [CALL][CLIENTE] No hay token disponible');
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
            
            console.log('📞 [CALL][CLIENTE] Estado de llamada:', callStatus);
            
            if (callStatus === 'active') {
              // ¡Llamada aceptada por la chica!
              isPolling = false;
              if (interval) clearInterval(interval);
              if (notificationInterval) clearInterval(notificationInterval);
              setCallPollingInterval(null);
              redirigirAVideochat(data.call);
              
            } else if (callStatus === 'rejected') {
              // Llamada rechazada por la chica
              isPolling = false;
              if (interval) clearInterval(interval);
              if (notificationInterval) clearInterval(notificationInterval);
              setCallPollingInterval(null);
              setIsCallActive(false);
              setCurrentCall(null);
              alert(t('clientInterface.callRejected'));
              
            } else if (callStatus === 'cancelled') {
              // Llamada cancelada por timeout
              isPolling = false;
              if (interval) clearInterval(interval);
              if (notificationInterval) clearInterval(notificationInterval);
              setCallPollingInterval(null);
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
            console.warn('⚠️ [CALL][CLIENTE] Error 403 en status:', {
              error: errorData.error || errorData.message,
              callId,
              hasToken: !!token,
              consecutiveErrors: consecutive403Errors
            });
          } catch (e) {
            console.warn('⚠️ [CALL][CLIENTE] Error 403 en status (sin detalles):', {
              callId,
              hasToken: !!token,
              consecutiveErrors: consecutive403Errors
            });
          }
          // Continuar con notificaciones - no detener el polling
        } else if (response.status === 401) {
          // Token inválido o expirado
          console.error('❌ [CALL][CLIENTE] Error 401 - Token inválido o expirado');
          // No detener el polling, el sistema de notificaciones puede seguir funcionando
        } else if (response.ok) {
          // Si la respuesta es exitosa, resetear el contador de errores
          consecutive403Errors = 0;
        }
        
      } catch (error) {
        // Solo loggear errores críticos, no detener el polling
        if (error.name !== 'AbortError') {
          console.error('❌ [CALL][CLIENTE] Error en checkCallStatus:', error.message);
        }
      }
    };
    
    // 🔥 EJECUTAR AMBOS INMEDIATAMENTE
    console.log('🔄 [CALL][CLIENTE] Iniciando polling dual para callId:', callId);
    checkCallStatus();
    checkCallAcceptedNotification();
    
    // 🔥 POLLING DE ESTADO CADA 500ms (más frecuente)
    interval = setInterval(checkCallStatus, 500);
    
    // 🔥 POLLING DE NOTIFICACIONES CADA 500ms (más confiable y rápido)
    notificationInterval = setInterval(checkCallAcceptedNotification, 500);
    
    setCallPollingInterval(interval);
    
    console.log('✅ [CALL][CLIENTE] Polling dual iniciado:', {
      statusInterval: '500ms',
      notificationInterval: '500ms',
      callId
    });
    
    // Timeout de seguridad
    setTimeout(() => {
      if (interval && isPolling) {
        isPolling = false;
        clearInterval(interval);
        if (notificationInterval) clearInterval(notificationInterval);
        setCallPollingInterval(null);
        if (isCallActive) {
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
      
    } catch (error) {
          }
    
    setIsCallActive(false);
    setCurrentCall(null);
  };

  // 🔥 REMOVIDO: verificarLlamadasEntrantes y responderLlamada ahora se manejan en GlobalCallContext

  // 🔥 NUEVA FUNCIÓN: REDIRIGIR AL VIDEOCHAT CLIENTE
  const redirigirAVideochat = (callData) => {
    // 🔥 Obtener room_name de diferentes posibles ubicaciones
    const roomName = callData.room_name || callData.incoming_call?.room_name || callData.call?.room_name;
    
    if (!roomName) {
      console.error('❌ [CALL][CLIENTE] No se pudo obtener room_name');
      return;
    }
    
    // 🔥 Obtener el nombre del receptor/modelo
    const receiverName = callData.receiver?.name || callData.receiver_name || callData.modelo?.name || 'Modelo';
    
    console.log('🚀 [CALL][CLIENTE] Redirigiendo a videochat:', {
      roomName,
      receiverName,
      callData
    });
    
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
          roomName: roomName,
          userName: receiverName,
          callId: callData.call_id || callData.id || callData.incoming_call?.id,
          from: 'call',
          callData: callData
        },
        replace: true
      });
      console.log('✅ [CALL][CLIENTE] Navegación ejecutada a:', videochatUrl);
    } catch (navError) {
      console.error('❌ [CALL][CLIENTE] Error en navigate, usando window.location:', navError);
      // Fallback: usar window.location
      window.location.href = videochatUrl;
    }
  };

  // 🔄 POLLING MEJORADO - SIN PARPADEO
  useEffect(() => {
    if (!user?.id) return;

    cargarChicasActivas(false);

    const interval = setInterval(() => {
      cargarChicasActivas(true);
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
              {t('clientInterface.insufficientBalanceTitle')}
            </h3>
            
            {/* Mensaje */}
            <div className="text-white/70 mb-6 leading-relaxed">
              <p className="mb-3">
                {t('clientInterface.insufficientBalanceMessage')}
              </p>
              
              {/* ✅ MOSTRAR DETALLES DEL SALDO SI ESTÁN DISPONIBLES */}
              {balanceDetails && balanceDetails.balance && (
                <div className="bg-[#1f2125] rounded-lg p-3 text-sm">
                  <p className="text-white/50 mb-2">{t('clientInterface.currentStatus')}</p>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>{t('clientInterface.totalCoins')}</span>
                      <span className="text-[#ff007a]">
                        {balanceDetails.balance.total_coins || 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t('clientInterface.minutes')}</span>
                      <span className="text-[#ff007a]">
                        {balanceDetails.balance.minutes_available || 0}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-white/10 pt-2 mt-2">
                      <span>{t('clientInterface.minimumRequired')}</span>
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
                {t('clientInterface.rechargeNow')}
              </button>
              
              <button
                onClick={onClose}
                className="w-full bg-transparent border border-white/20 hover:border-white/40 text-white/70 hover:text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                {t('clientInterface.cancel')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const SaldoWidget = () => {
    if (!userBalance) return null;
    
    return (
      <div className="bg-[#2b2d31] rounded-xl p-4 border border-[#ff007a]/20 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-white/60">{t('clientInterface.yourBalance')}</span>
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
            <span className="text-white/70">{t('clientInterface.total')}</span>
            <span className="text-[#ff007a] font-semibold">
              {userBalance.total_coins || userBalance.total_available || 0}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-white/50">{t('clientInterface.minutes')}</span>
            <span className="text-white/70">{userBalance.minutes_available || 0}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-white/50">{t('clientInterface.status')}</span>
            <span className={
              (userBalance.total_coins || userBalance.total_available || 0) <= 29
                ? "text-red-400"
                : (userBalance.total_coins || userBalance.total_available || 0) <= 39
                  ? "text-yellow-400"
                  : "text-green-400"
            }>
              {(userBalance.total_coins || userBalance.total_available || 0) <= 29
                ? t('clientInterface.insufficientBalance')
                : (userBalance.total_coins || userBalance.total_available || 0) <= 39
                  ? t('clientInterface.minimumBalance')
                  : t('clientInterface.stableBalance')
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
      <div className="min-h-screen bg-ligand-mix-dark from-[#1a1c20] to-[#2b2d31] text-white flex flex-col p-3 sm:p-4 lg:p-6">
        {/* Notificación Toast */}
        {notification && (
          <div className={`fixed top-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-auto z-[9999] px-4 py-3 rounded-lg shadow-2xl border flex items-center gap-2 animate-slide-in-right max-w-sm sm:max-w-md backdrop-blur-sm ${
            notification.type === 'success' 
              ? 'bg-green-500/20 border-green-500/30 text-green-400'
              : notification.type === 'error'
              ? 'bg-red-500/20 border-red-500/30 text-red-400'
              : notification.type === 'warning'
              ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400'
              : 'bg-blue-500/20 border-blue-500/30 text-blue-400'
          }`}>
            {notification.type === 'success' && <span className="text-base">✓</span>}
            {notification.type === 'error' && <span className="text-base">✗</span>}
            {notification.type === 'warning' && <span className="text-base">⚠</span>}
            {notification.type === 'info' && <span className="text-base">ℹ</span>}
            <span className="text-xs sm:text-sm font-medium flex-1">{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              className="ml-2 text-white/60 hover:text-white text-lg font-bold"
            >
              ×
            </button>
          </div>
        )}
        <div className="flex-shrink-0 mb-3 sm:mb-4">
          <Header />
        </div>

        <div className="flex-1 flex flex-col lg:flex-row gap-3 sm:gap-4 lg:gap-6">
          {/* Panel central */}
          <main className="flex-1 lg:w-3/4 bg-[#1f2125] rounded-2xl p-4 sm:p-5 lg:p-6 shadow-xl flex flex-col items-center justify-center">
            <div className="w-full flex-shrink-0 flex flex-col items-center">
              <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-center mb-3 sm:mb-4 lg:mb-5 mt-2 sm:mt-3 lg:mt-4 px-2">
                {t('clientInterface.greeting', { name: user?.name })}
              </h2>
              <p className="text-center text-white/70 mb-4 sm:mb-5 lg:mb-6 max-w-md text-xs sm:text-sm lg:text-base px-4">
                {t('clientInterface.mainDescription')}
              </p>

              {/* Botones verticales */}
              <div className="flex flex-col items-center gap-3 sm:gap-4 lg:gap-5 w-full max-w-xs px-2 pb-2 sm:pb-3">
              <button
                className="w-full bg-[#ff007a] hover:bg-[#e6006e] text-white px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3 lg:py-4 rounded-full text-sm sm:text-base lg:text-lg font-semibold shadow-md transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                onClick={validarSaldoYRedireccionarConLoading} // ✅ Usar la función con loading
                disabled={loadingBalance}
              >
                {loadingBalance ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span>{t('clientInterface.checkingBalance')}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    {t('clientInterface.startCall')}
                  </div>
                )}
              </button>

              <button
                className="w-full bg-[#ffe4f1] hover:bg-[#ffd1e8] text-[#4b2e35] px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3 lg:py-4 rounded-full text-sm sm:text-base lg:text-lg font-semibold shadow-md transition-all duration-200 transform hover:scale-105"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  logger.debug('Click en Comprar Monedas');
                  setShowBuyMinutes(true);
                }}
              >
                {t('clientInterface.buyCoins')}
              </button>

              {/* Consejo del día */}
              <div className="w-full bg-[#2b2d31] border border-[#ff007a]/30 rounded-xl p-3 sm:p-4 text-center mt-1 sm:mt-2">
                <p className="text-white text-xs sm:text-sm mb-1 font-semibold">{t('clientInterface.tipOfTheDay')}</p>
                <p className="text-white/70 text-xs sm:text-sm italic">
                  {t('clientInterface.dailyTip')}
                </p>
              </div>
            </div>
            </div>
          </main>

          {/* Panel lateral derecho - Acordeón */}
          <aside className="w-full lg:w-1/4 flex flex-col min-h-0 max-h-full">
            <div className="bg-[#2b2d31] rounded-2xl border border-[#ff007a]/20 overflow-hidden flex flex-col h-full max-h-full overflow-y-auto custom-scrollbar">
              {/* Sección 1: Saldo (siempre visible, colapsable) */}
              {userBalance && (
                <div className="border-b border-[#ff007a]/10 flex-shrink-0">
                  <button
                    onClick={() => setExpandedSections(prev => ({
                      balance: !prev.balance,
                      activeGirls: false,
                      history: false
                    }))}
                    className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-[#1f2125] transition-colors"
                  >
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                      <span className="text-xs sm:text-sm font-semibold text-white whitespace-nowrap">{t('clientInterface.yourBalance')}</span>
                      <span className="text-[#ff007a] font-bold text-base sm:text-lg">
                        {userBalance.minutes_available || 0}
                      </span>
                      <span className="text-xs text-white/60 whitespace-nowrap">{t('clientInterface.minutes')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          consultarSaldoUsuario();
                        }}
                        className="text-[#ff007a] hover:text-[#e6006e] transition-colors p-1.5 rounded-lg hover:bg-[#ff007a]/10"
                        disabled={loadingBalance}
                        title="Actualizar saldo"
                      >
                        {loadingBalance ? (
                          <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        )}
                      </button>
                      <svg
                        className={`w-5 h-5 text-white/60 transition-transform ${expandedSections.balance ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>
                  
                  {expandedSections.balance && (
                    <div className="px-3 sm:px-4 pb-3 sm:pb-4 border-t border-[#ff007a]/10">
                      <div className="pt-2 sm:pt-3 space-y-2 sm:space-y-3">
                        <div className="flex justify-between text-xs sm:text-sm">
                          <span className="text-white/70">{t('clientInterface.total')}</span>
                          <span className="text-[#ff007a] font-semibold">
                            {userBalance.total_coins || userBalance.total_available || 0}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs sm:text-sm">
                          <span className="text-white/70">Saldo de minutos</span>
                          <span className="text-white font-semibold">
                            {userBalance.purchased_coins || userBalance.purchased_balance || 0}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs sm:text-sm">
                          <span className="text-white/70">Saldo de regalo</span>
                          <span className="text-white font-semibold">
                            {userBalance.gift_coins || userBalance.gift_balance || 0}
                          </span>
                        </div>

                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Sección 2: Chicas Activas */}
              <div className={`border-b border-[#ff007a]/10 flex flex-col ${expandedSections.activeGirls ? 'flex-1 min-h-0' : 'flex-shrink-0'}`}>
                <button
                  onClick={() => setExpandedSections(prev => ({
                    balance: false,
                    activeGirls: !prev.activeGirls,
                    history: false
                  }))}
                  className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-[#1f2125] transition-colors flex-shrink-0"
                >
                  <div className="flex items-center gap-2 sm:gap-3">
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
                    className={`w-5 h-5 text-white/60 transition-transform ${expandedSections.activeGirls ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                  {expandedSections.activeGirls && (
                  <div className="px-3 sm:px-4 pb-3 sm:pb-4 border-t border-[#ff007a]/10 flex-1 min-h-0 overflow-y-auto custom-scrollbar max-h-[40vh] sm:max-h-[50vh]">
                    
                    {loadingUsers && initialLoad ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#ff007a] border-t-transparent"></div>
                        <span className="ml-3 text-sm text-white/60">
                          {t('clientInterface.loadingGirls')}
                        </span>
                      </div>
                    ) : chicasActivas.length === 0 ? (
                      <div className="flex flex-col items-center justify-center text-center py-8">
                        <Users size={32} className="text-white/20 mb-3" />
                        <p className="text-sm text-white/60 font-medium">
                          {t('clientInterface.noActiveGirls')}
                        </p>
                        <p className="text-xs text-white/40 mt-1">
                          {t('clientInterface.girlsWillAppear')}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3 pt-3">
                        {chicasActivas.map((chica, index) => (
                          <div
                            key={chica.id}
                            className="flex items-center justify-between bg-[#1f2125] p-3 rounded-xl hover:bg-[#25282c] transition-all duration-200 animate-fadeIn"
                            style={{
                              animationDelay: `${index * 50}ms`
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                {chica.avatar_url ? (
                                  <img 
                                    src={chica.avatar_url} 
                                    alt={chica.display_name || chica.name || chica.alias} 
                                    className="w-10 h-10 rounded-full object-cover border-2 border-[#ff007a]"
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                      e.target.nextElementSibling.style.display = 'flex';
                                    }}
                                  />
                                ) : null}
                                <div 
                                  className={`w-10 h-10 rounded-full bg-[#ff007a] flex items-center justify-center font-bold text-sm ${chica.avatar_url ? 'hidden' : ''}`}
                                >
                                  {getInitial(chica.display_name || chica.name || chica.alias)}
                                </div>
                                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-[#2b2d31] animate-pulse"></div>
                              </div>
                              <div>
                                <div className="font-semibold text-sm">
                                  {chica.display_name || chica.name || chica.alias}
                                </div>
                                <div className="text-xs text-green-400">
                                  {t('clientInterface.online')}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => iniciarLlamadaAChica(chica)}
                                disabled={isCallActive || isReceivingCall}
                                className={`p-2 rounded-full transition-colors duration-200 ${
                                  isCallActive || isReceivingCall 
                                    ? 'bg-gray-500/20 cursor-not-allowed' 
                                    : 'hover:bg-[#ff007a]/20'
                                }`}
                                title={
                                  isCallActive || isReceivingCall 
                                    ? t('clientInterface.callInProgress')
                                    : t('clientInterface.callThisGirl')
                                }
                              >
                                <Phone 
                                  size={16} 
                                  className={`${
                                    isCallActive || isReceivingCall 
                                      ? 'text-gray-500' 
                                      : 'text-[#ff007a] hover:text-white'
                                  } transition-colors`} 
                                />
                              </button>
                              <button
                                onClick={() => abrirChatConChica(chica)}
                                className="p-2 rounded-full hover:bg-gray-500/20 transition-colors duration-200"
                                title={t('clientInterface.messageThisGirl')}
                              >
                                <MessageSquare size={16} className="text-gray-400 hover:text-white transition-colors" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Sección 3: Historial */}
              <div className={`flex flex-col ${expandedSections.history ? 'flex-1 min-h-0' : 'flex-shrink-0'}`}>
                <button
                  onClick={() => setExpandedSections(prev => {
                    const newHistoryState = !prev.history;
                    return {
                      balance: false,      // Cerrar Tu Saldo cuando se abre Historial
                      activeGirls: false,  // Cerrar Chicas Activas cuando se abre Historial
                      history: newHistoryState
                    };
                  })}
                  className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-[#1f2125] transition-colors flex-shrink-0"
                >
                  <h3 className="text-sm sm:text-base lg:text-lg font-bold text-[#ff007a]">
                    {t('clientInterface.yourHistory')}
                  </h3>
                  <svg
                    className={`w-5 h-5 text-white/60 transition-transform ${expandedSections.history ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {expandedSections.history && (
                  <div className="px-3 sm:px-4 pb-3 sm:pb-4 border-t border-[#ff007a]/10 flex-1 min-h-0 overflow-y-auto custom-scrollbar max-h-[40vh] sm:max-h-[50vh]">
                    <div className="space-y-2 sm:space-y-3 pt-2 sm:pt-3">
                      {(() => {
                        return loadingHistory ? (
                          <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#ff007a] border-t-transparent"></div>
                          </div>
                        ) : callHistory.length === 0 ? (
                          <div className="text-center py-8">
                            <p className="text-white/60 text-sm">
                              {t("client.history.noHistory")}
                            </p>
                          </div>
                        ) : (
                        callHistory.map((item) => (
                          <div 
                            key={item.id} 
                            className="flex justify-between items-start bg-[#1f2125] p-3 rounded-xl hover:bg-[#25282c] transition-colors duration-200"
                          >
                            <div className="flex gap-3 items-center flex-1 min-w-0">
                              <div className={`w-9 h-9 flex-shrink-0 ${item.type === 'favorite' ? 'bg-yellow-500' : 'bg-pink-400'} text-[#1a1c20] font-bold rounded-full flex items-center justify-center text-sm`}>
                                {item.type === 'favorite' ? <Star size={16} className="text-[#1a1c20]" /> : getInitial(item.user_name)}
                              </div>
                              <div className="text-sm min-w-0 flex-1">
                                <p className="font-medium text-white truncate">{item.user_name}</p>
                                <p className="text-white/60 text-xs">
                                  {item.type === 'favorite' 
                                    ? `${item.user_name} ${t("client.history.addedToFavorites")}`
                                    : item.status === 'ended' 
                                    ? t("client.history.callEnded")
                                    : item.status === 'rejected'
                                    ? t("client.history.callRejected")
                                    : t("client.history.callCancelled")
                                  }
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <div className="text-right text-white/40 text-xs">
                                {item.formatted_date || new Date(item.timestamp).toLocaleDateString()}
                              </div>
                              {item.user_id && (
                                <>
                                  {item.type === 'favorite' ? (
                                    <button
                                      onClick={() => abrirChatConChica({ id: item.user_id, name: item.user_name, role: 'modelo' })}
                                      className="p-1.5 hover:bg-[#ff007a]/20 rounded-lg transition-colors"
                                      title={t("client.history.sendMessage")}
                                    >
                                      <MessageSquare size={14} className="text-[#ff007a]" />
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => iniciarLlamadaAChica({ id: item.user_id, name: item.user_name, role: 'modelo' })}
                                      className="p-1.5 hover:bg-[#ff007a]/20 rounded-lg transition-colors"
                                      title={t("client.history.callAgain")}
                                    >
                                      <Phone size={14} className="text-[#ff007a]" />
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        ))
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>

        {/* Estilos adicionales para animaciones y scrollbar */}
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
          
          .animate-fadeIn {
            animation: fadeIn 0.3s ease-out forwards;
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
          }
          
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: linear-gradient(180deg, #ff3399 0%, #e6006e 100%);
            box-shadow: 0 2px 6px rgba(255, 0, 122, 0.5);
          }
          
          .custom-scrollbar::-webkit-scrollbar-thumb:active {
            background: linear-gradient(180deg, #cc0062 0%, #99004d 100%);
          }
          
          /* Para Firefox */
          .custom-scrollbar {
            scrollbar-width: thin;
            scrollbar-color: #ff007a rgba(43, 45, 49, 0.5);
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
