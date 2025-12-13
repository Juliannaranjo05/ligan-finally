import React from "react";
import { MessageSquare, Star, Home, Phone, Clock, CheckCircle, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Header from "./headercliente";
import { ProtectedPage } from '../hooks/usePageAccess';
import { getUser } from "../../utils/auth";
import CallingSystem from '../../components/CallingOverlay';
import IncomingCallOverlay from '../../components/IncomingCallOverlay';
import { useState, useEffect } from "react";
import UnifiedPaymentModal from '../../components/payments/UnifiedPaymentModal';
import { useTranslation } from 'react-i18next';


export default function InterfazCliente() {
  const navigate = useNavigate();
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

  // Estados
  const [user, setUser] = React.useState(null);
  const [chicasActivas, setChicasActivas] = React.useState([]);
  const [loadingUsers, setLoadingUsers] = React.useState(true);
  const [initialLoad, setInitialLoad] = React.useState(true);
  const [showBuyMinutes, setShowBuyMinutes] = useState(false);
  const [userBalance, setUserBalance] = useState(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [showNoBalanceModal, setShowNoBalanceModal] = useState(false);
  const [balanceDetails, setBalanceDetails] = useState(null); // ✅ ESTADO FALTANTE
  
  const abrirModalCompraMinutos = () => {
    setShowBuyMinutes(true);
  };
  const cerrarModalCompraMinutos = () => {
    setShowBuyMinutes(false);
  };

  const consultarSaldoUsuario = async () => {
    try {
      setLoadingBalance(true);
      
      const response = await fetch(`${API_BASE_URL}/api/videochat/coins/balance`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.success) {
          setUserBalance(data.balance);
          // ✅ GUARDAMOS LOS DATOS COMPLETOS PARA EL MODAL
          setBalanceDetails(data);
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
  const [isCallActive, setIsCallActive] = React.useState(false);
  const [currentCall, setCurrentCall] = React.useState(null);
  const [isReceivingCall, setIsReceivingCall] = React.useState(false);
  const [incomingCall, setIncomingCall] = React.useState(null);
  const [callPollingInterval, setCallPollingInterval] = React.useState(null);
  const [incomingCallPollingInterval, setIncomingCallPollingInterval] = React.useState(null);
  // 🔥 ESTADOS PARA MODAL DE CONFIRMACIÓN
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  // 🔥 ESTADOS PARA AUDIO DE LLAMADAS
  const [incomingCallAudio, setIncomingCallAudio] = useState(null);
  const audioRef = React.useRef(null);

  // 🔥 ESTADO PARA USUARIOS BLOQUEADOS
  const [usuariosBloqueados, setUsuariosBloqueados] = useState([]);
  const [loadingBloqueados, setLoadingBloqueados] = useState(false);

  const historial = [
    { nombre: "SofiSweet", accion: "Llamada finalizada", hora: "Hoy, 11:12 AM" },
    { nombre: "Mia88", accion: "Te envió un mensaje", hora: "Hoy, 8:45 AM" },
    { nombre: "ValentinaXX", accion: "Agregada a favoritos", hora: "Ayer, 9:30 PM" },
  ];

  const { t } = useTranslation();

  // 🔥 FUNCIÓN PARA OBTENER HEADERS CON TOKEN
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
    
    navigate('/messageclient', {
      state: {
        openChatWith: {
          userId: chica.id,
          userName: chica.name || chica.alias,
          userRole: chica.role
        }
      }
    });
  };

  // 🔥 NUEVA FUNCIÓN: INICIAR LLAMADA A CHICA
  const iniciarLlamadaAChica = async (chica) => {
    try {
      
      // 🔥 VARIABLES CORRECTAS PARA LA VALIDACIÓN
      const otherUserId = chica.id;
      const otherUserName = chica.name || chica.alias;
      
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
      const blockCheckResponse = await fetch(`${API_BASE_URL}/api/check-if-blocked-by`, {
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

      // ✅ SIN BLOQUEOS - PROCEDER CON LA LLAMADA (resto del código original)
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
        
        // Mostrar error específico
        setConfirmAction({
          type: 'error',
          title: t('clientInterface.callError'),
          message: data.error || t('clientInterface.callFailed'),
          confirmText: t('clientInterface.understood'),
          action: () => setShowConfirmModal(false)
        });
        setShowConfirmModal(true);
      }
    } catch (error) {
            setIsCallActive(false);
      setCurrentCall(null);
      alert(t('clientInterface.errorStartingCall'));
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
  const playIncomingCallSound = async () => {
    try {
      
      if (audioRef.current) {
        return;
      }
      
      const audio = new Audio('/sounds/incoming-call.mp3');
      
      audio.loop = true;
      audio.volume = 0.8;
      audio.preload = 'auto';
      
      audioRef.current = audio;
      
      try {
        await audio.play();
      } catch (playError) {
                if (playError.name === 'NotAllowedError') {
        }
      }
    } catch (error) {
          }
  };

  const stopIncomingCallSound = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
  };

  // 🔥 NUEVA FUNCIÓN: POLLING PARA VERIFICAR ESTADO DE LLAMADA SALIENTE
  const iniciarPollingLlamada = (callId) => {
    
    const interval = setInterval(async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/calls/status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ call_id: callId })
        });
        
        const data = await response.json();
        
        if (data.success) {
          const callStatus = data.call.status;
          
          if (callStatus === 'active') {
            // ¡Llamada aceptada por la chica!
            clearInterval(interval);
            setCallPollingInterval(null);
            redirigirAVideochat(data.call);
            
          } else if (callStatus === 'rejected') {
            // Llamada rechazada por la chica
            clearInterval(interval);
            setCallPollingInterval(null);
            setIsCallActive(false);
            setCurrentCall(null);
            alert(t('clientInterface.callRejected'));
            
          } else if (callStatus === 'cancelled') {
            // Llamada cancelada por timeout
            clearInterval(interval);
            setCallPollingInterval(null);
            setIsCallActive(false);
            setCurrentCall(null);
            alert(t('clientInterface.callExpired'));
          }
        }
        
      } catch (error) {
              }
    }, 2000);
    
    setCallPollingInterval(interval);
    
    // Timeout de seguridad
    setTimeout(() => {
      if (interval) {
        clearInterval(interval);
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

  // 🔥 NUEVA FUNCIÓN: POLLING PARA LLAMADAS ENTRANTES
  const verificarLlamadasEntrantes = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/calls/check-incoming`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.has_incoming && data.incoming_call) {
          
          const isMyOutgoingCall = currentCall && 
                                  currentCall.callId === data.incoming_call.id;
          
          if (isMyOutgoingCall) {
            return;
          }
          
          if (!isReceivingCall && !isCallActive) {
            playIncomingCallSound();
            setIncomingCall(data.incoming_call);
            setIsReceivingCall(true);
          }
        } else if (isReceivingCall && !data.has_incoming) {
          stopIncomingCallSound();
          setIsReceivingCall(false);
          setIncomingCall(null);
        }
      }
    } catch (error) {
    }
  };

  // 🔥 NUEVA FUNCIÓN: RESPONDER LLAMADA ENTRANTE
  const responderLlamada = async (accion) => {
    if (!incomingCall) return;
    
    try {
      
      stopIncomingCallSound(); // 🔥 AGREGAR ESTA LÍNEA
      
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/calls/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          call_id: incomingCall.id,
          action: accion
        })
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        if (accion === 'accept') {
          setIsReceivingCall(false);
          setIncomingCall(null);
          redirigirAVideochat(data);
        } else {
          setIsReceivingCall(false);
          setIncomingCall(null);
        }
      } else {
                setIsReceivingCall(false);
        setIncomingCall(null);
      }
    } catch (error) {
            setIsReceivingCall(false);
      setIncomingCall(null);
    }
  };

  // 🔥 NUEVA FUNCIÓN: REDIRIGIR AL VIDEOCHAT CLIENTE
  const redirigirAVideochat = (callData) => {
    
    // Guardar datos de la llamada
    localStorage.setItem('roomName', callData.room_name);
    localStorage.setItem('userName', user?.name || 'Cliente');
    localStorage.setItem('currentRoom', callData.room_name);
    localStorage.setItem('inCall', 'true');
    localStorage.setItem('videochatActive', 'true');
    
    // Limpiar estados de llamada
    setIsCallActive(false);
    setCurrentCall(null);
    setIsReceivingCall(false);
    setIncomingCall(null);
    
    // Limpiar intervals
    if (callPollingInterval) {
      clearInterval(callPollingInterval);
      setCallPollingInterval(null);
    }
    
    // Redirigir al videochat cliente
    navigate('/videochatclient', {
      state: {
        roomName: callData.room_name,
        userName: user?.name || 'Cliente',
        callId: callData.call_id || callData.id,
        from: 'call',
        callData: callData
      }
    });
  };

  // 🔄 POLLING MEJORADO - SIN PARPADEO
  React.useEffect(() => {
    if (!user?.id) return;

    cargarChicasActivas(false);

    const interval = setInterval(() => {
      cargarChicasActivas(true);
    }, 30000);

    return () => clearInterval(interval);
  }, [user?.id]);

  React.useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await getUser();
        setUser(userData);
      } catch (err) {
              }
    };
    fetchUser();
  }, []);

  // 🔥 NUEVO USEEFFECT: POLLING PARA LLAMADAS ENTRANTES
  React.useEffect(() => {
    if (!user?.id) return;

    
    verificarLlamadasEntrantes();
    
    const interval = setInterval(verificarLlamadasEntrantes, 3000);
    setIncomingCallPollingInterval(interval);

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [user?.id, isReceivingCall, isCallActive]);

  // 🔥 CARGAR USUARIOS BLOQUEADOS
  React.useEffect(() => {
    if (!user?.id) return;
    cargarUsuariosBloqueados();
    consultarSaldoUsuario();
  }, [user?.id]);

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
            <span className="text-white/50">Estado:</span>
            <span className={
              (userBalance.total_coins || userBalance.total_available || 0) <= 29
                ? "text-red-400"
                : (userBalance.total_coins || userBalance.total_available || 0) <= 39
                  ? "text-yellow-400"
                  : "text-green-400"
            }>
              {(userBalance.total_coins || userBalance.total_available || 0) <= 29
                ? "❌ Insuficiente"
                : (userBalance.total_coins || userBalance.total_available || 0) <= 39
                  ? "⚠️ Mínimo"
                  : "Estable"
              }
            </span>
          </div>
        </div>
      </div>
    );
  };

  // 🔥 CONFIGURAR SISTEMA DE AUDIO
  React.useEffect(() => {
    
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
  React.useEffect(() => {
    return () => {
      stopIncomingCallSound();
      if (callPollingInterval) {
        clearInterval(callPollingInterval);
      }
      if (incomingCallPollingInterval) {
        clearInterval(incomingCallPollingInterval);  
      }
    };
  }, []);

  return (
    <ProtectedPage requiredConditions={{
      emailVerified: true,
      profileComplete: true,
      role: "cliente",
      blockIfInCall: true
    }}>
      <div className="min-h-screen bg-ligand-mix-dark from-[#1a1c20] to-[#2b2d31] text-white p-6">
        <Header />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Panel central */}
          <main className="lg:col-span-3 bg-[#1f2125] rounded-2xl p-8 shadow-xl flex flex-col items-center">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-6 mt-16">
              {t('clientInterface.greeting', { name: user?.name })}
            </h2>
            <p className="text-center text-white/70 mb-8 max-w-md">
              {t('clientInterface.mainDescription')}
            </p>

            {/* Botones verticales */}
            <div className="flex flex-col items-center gap-4 w-full max-w-xs">
              <button
                className="w-full bg-[#ff007a] hover:bg-[#e6006e] text-white px-8 py-4 rounded-full text-lg font-semibold shadow-md transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
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
                className="w-full bg-[#ffe4f1] hover:bg-[#ffd1e8] text-[#4b2e35] px-8 py-4 rounded-full text-lg font-semibold shadow-md transition-all duration-200 transform hover:scale-105"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('💰 Click en Comprar Monedas - ANTES');
                  console.log('💰 Estado actual showBuyMinutes:', showBuyMinutes);
                  setShowBuyMinutes(true);
                  console.log('💰 DESPUÉS de setShowBuyMinutes(true)');
                  setTimeout(() => {
                    console.log('💰 Estado después de timeout:', showBuyMinutes);
                  }, 100);
                }}
              >
                {t('clientInterface.buyCoins')}
              </button>

              {/* Consejo del día */}
              <div className="w-full bg-[#2b2d31] border border-[#ff007a]/30 rounded-xl p-4 text-center mt-2">
                <p className="text-white text-sm mb-1 font-semibold">{t('clientInterface.tipOfTheDay')}</p>
                <p className="text-white/70 text-sm italic">
                  {t('clientInterface.dailyTip')}
                </p>
              </div>
            </div>
          </main>

          {/* Panel lateral derecho */}
          <aside className="flex flex-col gap-2 h-[82vh] overflow-y-auto">
            <SaldoWidget />
            {/* Chicas activas */}
            <section className="bg-[#2b2d31] rounded-2xl p-5 shadow-lg h-[44vh]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-[#ff007a]">
                  {t('clientInterface.activeGirls')}
                </h3>
                {chicasActivas.length > 0 && (
                  <span className="text-xs text-white/50 bg-[#ff007a]/20 px-2 py-1 rounded-full">
                    {chicasActivas.length}
                  </span>
                )}
              </div>
              
              {loadingUsers && initialLoad ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#ff007a] border-t-transparent"></div>
                  <span className="ml-3 text-sm text-white/60">
                    {t('clientInterface.loadingGirls')}
                  </span>
                </div>
              ) : (
                <div className="space-y-3 h-[calc(100%-4rem)] overflow-y-auto pr-2">
                  <style>
                    {`
                      .space-y-3::-webkit-scrollbar {
                        width: 4px;
                      }
                      .space-y-3::-webkit-scrollbar-track {
                        background: #2b2d31;
                        border-radius: 2px;
                      }
                      .space-y-3::-webkit-scrollbar-thumb {
                        background: #ff007a;
                        border-radius: 2px;
                      }
                      .space-y-3::-webkit-scrollbar-thumb:hover {
                        background: #cc0062;
                      }
                    `}
                  </style>
                  
                  {chicasActivas.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-8">
                      <Users size={32} className="text-white/20 mb-3" />
                      <p className="text-sm text-white/60 font-medium">
                        {t('clientInterface.noActiveGirls')}
                      </p>
                      <p className="text-xs text-white/40 mt-1">
                        {t('clientInterface.girlsWillAppear')}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {chicasActivas.map((chica, index) => (
                        <div
                          key={chica.id}
                          className="flex items-center justify-between bg-[#1f2125] p-3 rounded-xl hover:bg-[#25282c] transition-all duration-200 animate-fadeIn"
                          style={{
                            animationDelay: `${index * 50}ms`
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#ff007a] flex items-center justify-center font-bold text-sm relative">
                              {getInitial(chica.name || chica.alias)}
                              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-[#2b2d31] animate-pulse"></div>
                            </div>
                            <div>
                              <div className="font-semibold text-sm">
                                {chica.name || chica.alias}
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
            </section>

            {/* Historial */}
            <section className="bg-[#2b2d31] rounded-2xl p-5 shadow-lg h-[20vh]">
              <h3 className="text-lg font-bold text-[#ff007a] mb-4 text-center">Tu Historial</h3>
            
            </section>
          </aside>
        </div>

        {/* Estilos adicionales para animaciones */}
        <style jsx>{`
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
            {console.log('✅ Renderizando UnifiedPaymentModal, showBuyMinutes:', showBuyMinutes)}
            <UnifiedPaymentModal onClose={cerrarModalCompraMinutos} />
          </div>
        )}

        {/* 🔥 OVERLAY PARA LLAMADAS SALIENTES */}
        <CallingSystem
          isVisible={isCallActive}
          callerName={currentCall?.name || currentCall?.alias}
          callerAvatar={currentCall?.avatar}
          onCancel={cancelarLlamada}
          callStatus={currentCall?.status || 'initiating'}
        />

        {/* 🔥 OVERLAY PARA LLAMADAS ENTRANTES */}
        <IncomingCallOverlay
          isVisible={isReceivingCall}
          callData={incomingCall}
          onAnswer={() => responderLlamada('accept')}
          onDecline={() => responderLlamada('reject')}
        />

      </div>
    </ProtectedPage>
  );
}
