// InterfazCliente.jsx - Versión actualizada con control de 24 horas integrado
import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, Star, Home, Phone, Clock, CheckCircle, Users, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Header from "./header";
import { useTranslation } from "react-i18next";
import { ProtectedPage } from '../hooks/usePageAccess';
import { getUser } from "../../utils/auth";
import axios from "../../api/axios";
import CallingSystem from '../CallingOverlay';
import IncomingCallOverlay from '../IncomingCallOverlay';
import StoryModal from '../StoryModal';
import { useAppNotifications } from '../../contexts/NotificationContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function InterfazCliente() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const notifications = useAppNotifications();

  // Estados existentes
  const [user, setUser] = useState(null);
  const [existingStory, setExistingStory] = useState(null);
  const [loadingStory, setLoadingStory] = useState(true);
  const [usuariosActivos, setUsuariosActivos] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [usuariosBloqueados, setUsuariosBloqueados] = useState([]);
  const [loadingBloqueados, setLoadingBloqueados] = useState(false);
  
  // 🆕 Estados para control de 24 horas
  const [canUpload, setCanUpload] = useState(true);
  const [uploadRestriction, setUploadRestriction] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);
  
  // Estados de modales y llamadas
  const [showStoryModal, setShowStoryModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [currentCall, setCurrentCall] = useState(null);
  const [isReceivingCall, setIsReceivingCall] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [callPollingInterval, setCallPollingInterval] = useState(null);
  const [incomingCallPollingInterval, setIncomingCallPollingInterval] = useState(null);
  const [incomingCallAudio, setIncomingCallAudio] = useState(null);
  const audioRef = useRef(null);
  
  // Estados para historial de llamadas
  const [callHistory, setCallHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  
  // Estado para controlar las secciones expandidas del acordeón
  const [expandedSections, setExpandedSections] = useState({
    activeUsers: false,  // Por defecto colapsado
    history: false       // Por defecto colapsado
  });

  // 🔥 FUNCIÓN PARA OBTENER HEADERS CON TOKEN
  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    
    if (!token || token === 'null' || token === 'undefined') {
            return {};
    }
    
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'Authorization': `Bearer ${token}`
    };
  };

  // 🆕 VERIFICAR SI PUEDE SUBIR HISTORIA
  const checkCanUpload = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token || token === 'null' || token === 'undefined') {
        return;
      }
      
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        withCredentials: false,
      };
      
      const response = await axios.get("/api/stories/can-upload", config);
      
      if (response.data.can_upload) {
        setCanUpload(true);
        setUploadRestriction(null);
        setTimeRemaining(null);
      } else {
        setCanUpload(false);
        setUploadRestriction(response.data);
        
        // Si hay tiempo de expiración, calcular tiempo restante
        if (response.data.expires_at) {
          calculateTimeRemaining(response.data.expires_at);
        }
      }
    } catch (error) {
          }
  };

  // 🆕 CALCULAR TIEMPO RESTANTE
  const calculateTimeRemaining = (expiresAt) => {
    const updateTime = () => {
      const now = new Date();
      const expires = new Date(expiresAt);
      const diff = expires.getTime() - now.getTime();
      
      if (diff <= 0) {
        setCanUpload(true);
        setUploadRestriction(null);
        setTimeRemaining(null);
        // Recargar estado cuando expire
        checkCanUpload();
        checkExistingStory();
        return;
      }
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setTimeRemaining({
        hours,
        minutes,
        seconds,
        total: diff
      });
    };
    
    updateTime();
    const interval = setInterval(updateTime, 1000);
    
    // Limpiar intervalo después de 24 horas
    setTimeout(() => {
      clearInterval(interval);
    }, 24 * 60 * 60 * 1000);
    
    return () => clearInterval(interval);
  };

  // 🔥 FUNCIÓN PARA OBTENER INICIAL DEL NOMBRE
  const getInitial = (name) => {
    return name ? name.charAt(0).toUpperCase() : '?';
  };

  // 👈 FUNCIÓN ACTUALIZADA: MANEJAR CLIC EN BOTÓN DE HISTORIA
  const handleStoryButtonClick = () => {
    if (loadingStory) return;

    if (!existingStory) {
      // No hay historia, verificar si puede subir
      if (!canUpload) {
        if (uploadRestriction?.reason === 'pending_story') {
          notifications.storyPending();
        } else if (uploadRestriction?.reason === 'active_story') {
          notifications.warning(uploadRestriction.message);
        }
        return;
      }
      // Puede subir, ir a la página
      navigate("/historysu");
    } else if (existingStory.status === 'approved') {
      // Historia aprobada, mostrar modal
      setShowStoryModal(true);
    } else {
      // Historia pendiente o rechazada, ir a gestionar
      navigate("/historysu");
    }
  };

  // 👈 FUNCIÓN ACTUALIZADA: ELIMINAR HISTORIA DESDE EL MODAL
  const handleDeleteStory = async () => {
    try {
      await axios.delete(`/api/stories/${existingStory.id}`, {
        withCredentials: false,
      });
      
      notifications.storyDeleted();
      setExistingStory(null);
      setShowStoryModal(false);
      
      // Recargar estados
      await checkExistingStory();
      await checkCanUpload();
    } catch (error) {
            notifications.deleteError();
    }
  };

  // ... (mantener todas las funciones existentes de usuarios y llamadas)
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
      }
    } catch (error) {
          } finally {
      setLoadingBloqueados(false);
    }
  };

  const cargarUsuariosActivos = async (isBackgroundUpdate = false) => {
    try {
      if (!isBackgroundUpdate) {
        setLoadingUsers(true);
      }
      
      const headers = getAuthHeaders();
      
      if (!headers.Authorization) {
        if (initialLoad) {
          await handleFallbackData();
        }
        return;
      }
      
      const response = await fetch(`${API_BASE_URL}/api/chat/users/my-contacts`, {
        method: 'GET',
        headers: headers,
        mode: 'cors',
        credentials: 'omit'
      });
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        if (response.status === 401) {
          localStorage.removeItem('token');
          sessionStorage.removeItem('user');
        }
        
        if (initialLoad) {
          await handleFallbackData();
        }
        return;
      }
      
      if (response.ok) {
        try {
          const data = await response.json();
          const usuariosOnline = (data.contacts || []);
          
          setUsuariosActivos(prevUsers => {
            const newUserIds = usuariosOnline.map(u => u.id).sort();
            const prevUserIds = prevUsers.map(u => u.id).sort();
            
            if (JSON.stringify(newUserIds) !== JSON.stringify(prevUserIds)) {
              return usuariosOnline;
            }
            
            return prevUsers.map(prevUser => {
              const updatedUser = usuariosOnline.find(u => u.id === prevUser.id);
              return updatedUser || prevUser;
            });
          });
          
        } catch (jsonError) {
          if (initialLoad) {
            await handleFallbackData();
          }
        }
      } else {
        if (response.status === 401) {
          localStorage.removeItem('token');
          sessionStorage.removeItem('user');
        }
        
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

  const handleFallbackData = async () => {
    try {
      const conversationsResponse = await fetch(`${API_BASE_URL}/api/chat/conversations`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      
      if (conversationsResponse.ok) {
        const conversationsData = await conversationsResponse.json();
        
        const uniqueUsers = (conversationsData.conversations || []).map(conv => ({
          id: conv.other_user_id,
          name: conv.other_user_name,
          alias: conv.other_user_name,
          role: conv.other_user_role,
          is_online: Math.random() > 0.3,
          avatar: `https://i.pravatar.cc/40?u=${conv.other_user_id}`,
          last_seen: new Date().toISOString()
        })).filter(u => u.is_online);
        
        setUsuariosActivos(uniqueUsers);
      }
    } catch (fallbackError) {
      const exampleUsers = [
        {
          id: 101,
          name: "Carlos_VIP",
          alias: "Carlos_VIP",
          role: "cliente",
          is_online: true,
          avatar: "https://i.pravatar.cc/40?u=101",
          last_seen: new Date().toISOString()
        }
      ];
      
      setUsuariosActivos(exampleUsers);
    }
  };

  // ... (mantener todas las funciones de llamadas existentes)
  const abrirChatConUsuario = (usuario) => {
    navigate('/mensajes', {
      state: {
        openChatWith: {
          userId: usuario.id,
          userName: usuario.name || usuario.alias,
          userRole: usuario.role
        }
      }
    });
  };

  // ... (mantener funciones de llamadas - iniciarLlamadaReal, cancelarLlamada, etc.)

  // 🔥 USEEFFECTS ACTUALIZADOS
  useEffect(() => {
    if (!user?.id) return;

    cargarUsuariosActivos(false);
    cargarUsuariosBloqueados();

    const interval = setInterval(() => {
      cargarUsuariosActivos(true);
    }, 30000);

    return () => clearInterval(interval);
  }, [user?.id]);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await getUser();
        setUser(userData);
      } catch (err) {
              }
    };
    fetchUser();
  }, []);

  // 🧹 CLEANUP: Evitar redirección no deseada desde RouteGuard
  // Limpiar claves residuales de videochat que pueden forzar redirección
  useEffect(() => {
    try {
      const keysToRemove = ['roomName', 'currentRoom', 'inCall', 'videochatActive'];
      keysToRemove.forEach(k => localStorage.removeItem(k));
      sessionStorage.removeItem('roomName');
    } catch (e) {
      // Silenciar cualquier error de storage
    }
  }, []);

  // 🆕 USEEFFECT ACTUALIZADO PARA CARGAR DATOS DE HISTORIA
  useEffect(() => {
    const loadStoryData = async () => {
      await checkExistingStory();
      await checkCanUpload();
    };
    
    loadStoryData();
  }, []);

  const checkExistingStory = async () => {
    try {
      setLoadingStory(true);
      
      const token = localStorage.getItem('token');
      
      if (!token || token === 'null' || token === 'undefined') {
        return;
      }
      
      const config = {
        skipInterceptor: true,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        withCredentials: false,
      };
      
      const response = await axios.get(`${API_BASE_URL}/api/stories/my-story`, config);
      
      if (response.data) {
        setExistingStory(response.data);
        
        // Si tiene tiempo restante, calcular countdown
        if (response.data.time_remaining?.expires_at) {
          calculateTimeRemaining(response.data.time_remaining.expires_at);
        }
      }
    } catch (error) {
            if (error.response?.status === 401) {
        notifications.unauthorized();
      }
    } finally {
      setLoadingStory(false);
    }
  };

  // 👈 FUNCIÓN ACTUALIZADA PARA DETERMINAR EL TEXTO Y ESTADO DEL BOTÓN DE HISTORIA
  const getStoryButtonInfo = () => {
    if (loadingStory) {
      return {
        text: t("client.loading") || "Cargando...",
        icon: null,
        disabled: true,
        className: "w-full bg-gray-500 text-white px-8 py-4 rounded-full text-lg font-semibold shadow-md opacity-50 cursor-not-allowed"
      };
    }

    if (!existingStory) {
      // No hay historia, verificar si puede subir
      if (!canUpload) {
        if (uploadRestriction?.reason === 'pending_story') {
          return {
            text: t("client.restrictions.pendingApproval"),
            icon: <Clock size={20} className="text-yellow-500" />,
            disabled: false,
            className: "w-full bg-yellow-500/20 border border-yellow-500/50 text-yellow-300 px-8 py-4 rounded-full text-lg font-semibold shadow-md hover:bg-yellow-500/30 transition"
          };
        } else if (uploadRestriction?.reason === 'active_story') {
          return {
            text: timeRemaining ? t("client.restrictions.waitTime", { hours: timeRemaining.hours, minutes: timeRemaining.minutes }) : t("client.restrictions.activeStory"),
            icon: <AlertTriangle size={20} className="text-orange-400" />,
            disabled: false,
            className: "w-full bg-orange-500/20 border border-orange-500/50 text-orange-300 px-8 py-4 rounded-full text-lg font-semibold shadow-md hover:bg-orange-500/30 transition"
          };
        }
      }
      
      return {
        text: t("client.uploadStory") || "Subir Historia",
        icon: null,
        disabled: false,
        className: "w-full bg-[#ffb6d2] text-[#4b2e35] px-8 py-4 rounded-full text-lg font-semibold shadow-md hover:bg-[#ff9fcb] transition"
      };
    }

    const isPending = existingStory.status === 'pending';
    const isApproved = existingStory.status === 'approved';
    const isRejected = existingStory.status === 'rejected';

    if (isPending) {
      return {
        text: t("client.storyPending") || "Historia Pendiente por Aprobación",
        icon: <Clock size={20} className="text-yellow-500" />,
        disabled: false,
        className: "w-full bg-yellow-500/20 border border-yellow-500/50 text-yellow-300 px-8 py-4 rounded-full text-lg font-semibold shadow-md hover:bg-yellow-500/30 transition"
      };
    }

    if (isApproved) {
      return {
        text: t("client.viewApprovedStory") || "Ver Mi Historia",
        icon: <CheckCircle size={20} className="text-[#ff007a]" />,
        disabled: false,
        className: "w-full bg-[#ff007a]/20 border border-[#ff007a]/50 text-[#ff007a] px-8 py-4 rounded-full text-lg font-semibold shadow-md hover:bg-[#ff007a]/30 transition"
      };
    }

    if (isRejected) {
      return {
        text: t("client.storyRejected") || "Historia Rechazada - Crear Nueva",
        icon: null,
        disabled: false,
        className: "w-full bg-red-500/20 border border-red-500/50 text-red-300 px-8 py-4 rounded-full text-lg font-semibold shadow-md hover:bg-red-500/30 transition"
      };
    }

    return {
      text: t("client.uploadStory") || "Subir Historia",
      icon: null,
      disabled: false,
      className: "w-full bg-[#ffb6d2] text-[#4b2e35] px-8 py-4 rounded-full text-lg font-semibold shadow-md hover:bg-[#ff9fcb] transition"
    };
  };

  const storyButtonInfo = getStoryButtonInfo();

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
          setCallHistory([]); // 🔥 Establecer array vacío si hay error parseando
        }
      } else {
        // 🔥 Si la respuesta no es OK, establecer array vacío
        setCallHistory([]);
      }
    } catch (error) {
      setCallHistory([]); // 🔥 Establecer array vacío en caso de error
    } finally {
      // 🔥 SIEMPRE establecer loadingHistory en false, incluso si hay errores
      setLoadingHistory(false);
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

// 🔥 FUNCIÓN PARA INICIAR LLAMADA A CLIENTE
const iniciarLlamadaReal = async (usuario) => {
  try {
        
    // 🔥 VARIABLES CORRECTAS PARA LA VALIDACIÓN
    const otherUserId = usuario.id;
    const otherUserName = usuario.name || usuario.alias;
    
    // 🚫 VERIFICAR SI YO LO BLOQUEÉ
    const yoLoBloquee = usuariosBloqueados.some((user) => user.id === otherUserId);
    if (yoLoBloquee) {
      setConfirmAction({
        type: 'blocked',
        title: t("client.errors.notAvailable"),
        message: t("client.errors.userBlocked", { name: otherUserName }),
        confirmText: t("client.errors.understood"),
        action: () => setShowConfirmModal(false)
      });
      setShowConfirmModal(true);
      return;
    }

    // 🚫 VERIFICAR SI ÉL ME BLOQUEÓ
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
          title: t("client.errors.notAvailable"),
          message: t("client.errors.blockedByUser", { name: otherUserName }),
          confirmText: t("client.errors.understood"),
          action: () => setShowConfirmModal(false)
        });
        setShowConfirmModal(true);
        return;
      }
    }

    // 💰 VERIFICAR SALDO DEL CLIENTE ANTES DE INICIAR LLAMADA
    try {
      const clientBalanceResponse = await fetch(`${API_BASE_URL}/api/videochat/coins/check-client-balance`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          client_id: otherUserId
        })
      });
      
      if (clientBalanceResponse.ok) {
        const clientBalanceData = await clientBalanceResponse.json();
        
        // 🔥 VERIFICAR SI EL CLIENTE PUEDE INICIAR LLAMADA
        // Si success es false o can_start_call es false, NO permitir la llamada
        const canStartCall = clientBalanceData.success !== false && 
                            (clientBalanceData.success?.can_start_call ?? clientBalanceData.can_start_call ?? false);
        
        if (!canStartCall) {
          // ❌ EL CLIENTE NO TIENE SALDO SUFICIENTE
          setIsCallActive(false);
          setCurrentCall(null);
          
          const clientMinutes = clientBalanceData.balance?.minutes_available ?? clientBalanceData.success?.balance?.minutes_available ?? 0;
          setConfirmAction({
            type: 'error',
            title: t("client.errors.clientNoBalance") || 'Este cliente tiene saldo insuficiente',
            message: t("client.errors.clientNoBalanceMessage", { name: otherUserName }) || `${otherUserName} no tiene saldo suficiente para realizar videollamadas. Necesita más de 2 minutos de saldo.`,
            confirmText: t("client.errors.understood") || 'Entendido',
            action: () => setShowConfirmModal(false)
          });
          setShowConfirmModal(true);
          return;
        }
      } else {
        // ❌ NO SE PUDO VERIFICAR EL SALDO - NO PERMITIR LA LLAMADA POR SEGURIDAD
        setIsCallActive(false);
        setCurrentCall(null);
        
        setConfirmAction({
          type: 'error',
          title: t("client.errors.clientNoBalance") || 'Error al verificar saldo',
          message: 'No se pudo verificar el saldo del cliente. Por favor intenta nuevamente.',
          confirmText: t("client.errors.understood") || 'Entendido',
          action: () => setShowConfirmModal(false)
        });
        setShowConfirmModal(true);
        return;
      }
    } catch (error) {
      // ❌ ERROR AL VERIFICAR SALDO - NO PERMITIR LA LLAMADA POR SEGURIDAD
      console.error('Error verificando saldo del cliente:', error);
      setIsCallActive(false);
      setCurrentCall(null);
      
      setConfirmAction({
        type: 'error',
        title: t("client.errors.clientNoBalance") || 'Error al verificar saldo',
        message: 'Error al verificar el saldo del cliente. Por favor intenta nuevamente.',
        confirmText: t("client.errors.understood") || 'Entendido',
        action: () => setShowConfirmModal(false)
      });
      setShowConfirmModal(true);
      return;
    }

    // ✅ SIN BLOQUEOS Y CLIENTE CON SALDO - PROCEDER CON LA LLAMADA
    setCurrentCall({
      ...usuario,
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
        receiver_id: usuario.id,
        call_type: 'video'
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
            setCurrentCall({
        ...usuario,
        callId: data.call_id,
        roomName: data.room_name,
        status: 'calling'
      });
      iniciarPollingLlamada(data.call_id);
    } else {
            setIsCallActive(false);
      setCurrentCall(null);
      
      // 🔥 DETECTAR ERROR DE SALDO INSUFICIENTE DEL CLIENTE
      const errorMessage = data.error || data.message || '';
      const isBalanceError = errorMessage.toLowerCase().includes('saldo') || 
                             errorMessage.toLowerCase().includes('balance') ||
                             errorMessage.toLowerCase().includes('insufficient') ||
                             response.status === 402; // Payment Required
      
      if (isBalanceError) {
        // Mostrar modal de error con mensaje específico
        setConfirmAction({
          type: 'error',
          title: t("client.errors.clientNoBalance") || 'Este cliente tiene saldo insuficiente',
          message: t("client.errors.clientNoBalanceMessage", { name: otherUserName }) || `${otherUserName} no tiene saldo suficiente para realizar videollamadas. Necesita más de 2 minutos de saldo.`,
          confirmText: t("client.errors.understood") || 'Entendido',
          action: () => setShowConfirmModal(false)
        });
        setShowConfirmModal(true);
      } else {
        // Otros errores - usar sistema de notificaciones
        notifications.error(data.error || 'No se pudo completar la llamada');
      }
    }
  } catch (error) {
        setIsCallActive(false);
    setCurrentCall(null);
    notifications.warning(t("client.errors.callRejected"));
  }
};

// 🔥 FUNCIÓN: POLLING PARA VERIFICAR ESTADO DE LLAMADA SALIENTE
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
          // ¡Llamada aceptada!
                    clearInterval(interval);
          setCallPollingInterval(null);
          redirigirAVideochat(data.call);
          
        } else if (callStatus === 'rejected') {
          // Llamada rechazada
                    clearInterval(interval);
          setCallPollingInterval(null);
          setIsCallActive(false);
          setCurrentCall(null);
          notifications.warning(t("client.errors.callRejected"));
          
        } else if (callStatus === 'cancelled') {
          // Llamada cancelada por timeout
                    clearInterval(interval);
          setCallPollingInterval(null);
          setIsCallActive(false);
          setCurrentCall(null);
          notifications.warning(t("client.errors.callExpired"));
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
        notifications.warning(t("client.errors.timeoutExpired"));      }
    }
  }, 35000);
};

// 🔥 FUNCIÓN: CANCELAR LLAMADA SALIENTE
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

// 🔥 FUNCIÓN: POLLING PARA LLAMADAS ENTRANTES
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
        
        // 🔥 PERMITIR RECIBIR LLAMADAS ENTRANTES INCLUSO SI HAY UNA LLAMADA ACTIVA
        // El backend cancelará automáticamente la llamada activa previa cuando se acepte la nueva
        if (!isReceivingCall) {
          
          // Si hay una llamada activa, mostrar advertencia pero permitir recibir la nueva
          if (isCallActive) {
          }
          
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

// 🔥 FUNCIÓN: RESPONDER LLAMADA ENTRANTE
const responderLlamada = async (accion) => {
  if (!incomingCall) return;
  
  try {
        
    stopIncomingCallSound();
    
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

// 🔥 FUNCIÓN: REDIRIGIR AL VIDEOCHAT MODELO
const redirigirAVideochat = (callData) => {
  // 🔥 Obtener room_name de diferentes posibles ubicaciones en la respuesta
  const roomName = callData.room_name || callData.incoming_call?.room_name || callData.call?.room_name;
  
  if (!roomName) {
    return;
  }
  
  
  // 🔥 DESCONECTAR CONEXIÓN LIVEKIT ANTERIOR SI EXISTE
  const disconnectPreviousConnection = async () => {
    try {
      if (window.livekitRoom && window.livekitRoom.state !== 'disconnected') {
        await window.livekitRoom.disconnect();
        window.livekitRoom = null;
      }
    } catch (error) {
    }
  };
  
  disconnectPreviousConnection();
  
  // 🔥 LIMPIAR DATOS DE LLAMADAS PREVIAS
  // Limpiar sessionStorage y localStorage de llamadas anteriores
  const oldRoomName = sessionStorage.getItem('roomName') || localStorage.getItem('roomName');
  if (oldRoomName && oldRoomName !== roomName) {
    sessionStorage.removeItem('currentRoom');
    sessionStorage.removeItem('inCall');
    sessionStorage.removeItem('videochatActive');
    sessionStorage.removeItem('roomName');
    sessionStorage.removeItem('userName');
    localStorage.removeItem('roomName');
    localStorage.removeItem('userName');
  }
  
  // Guardar datos de la nueva llamada
  sessionStorage.setItem('roomName', roomName);
  sessionStorage.setItem('userName', user?.name || 'Modelo');
  sessionStorage.setItem('currentRoom', roomName);
  sessionStorage.setItem('inCall', 'true');
  sessionStorage.setItem('videochatActive', 'true');
  
  // También guardar en localStorage para compatibilidad
  localStorage.setItem('roomName', roomName);
  localStorage.setItem('userName', user?.name || 'Modelo');
  
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
  
  // Pequeño delay para asegurar que la desconexión anterior se complete
  setTimeout(() => {
    // Redirigir al videochat modelo (no cliente)
    navigate('/videochat', {
      state: {
        roomName: roomName,
        userName: user?.name || 'Modelo',
        callId: callData.call_id || callData.id || callData.incoming_call?.id,
        from: 'call',
        callData: callData
      },
      replace: true // Usar replace para evitar problemas de navegación
    });
  }, 500); // Delay de 500ms para asegurar desconexión
};

// 🔥 USEEFFECTS NECESARIOS:

// 1. POLLING PARA LLAMADAS ENTRANTES
useEffect(() => {
  if (!user?.id) return;

  // 🔥 LIMPIAR INTERVALO ANTERIOR SI EXISTE
  if (incomingCallPollingInterval) {
    clearInterval(incomingCallPollingInterval);
    setIncomingCallPollingInterval(null);
  }
    
  verificarLlamadasEntrantes();
  
  // 🔥 INTERVALO DE 5 SEGUNDOS (aumentado de 3s para reducir carga)
  const interval = setInterval(verificarLlamadasEntrantes, 5000);
  setIncomingCallPollingInterval(interval);

  return () => {
    if (interval) {
      clearInterval(interval);
    }
    if (incomingCallPollingInterval) {
      clearInterval(incomingCallPollingInterval);
    }
  };
}, [user?.id]); // 🔥 Solo dependencia crítica - removido isReceivingCall e isCallActive

// 2. CONFIGURAR SISTEMA DE AUDIO
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

// 4. CARGAR HISTORIAL DE LLAMADAS
useEffect(() => {
  if (user?.id) {
    cargarHistorialLlamadas();
  }
}, [user?.id]);

// 3. CLEANUP AL DESMONTAR COMPONENTE
useEffect(() => {
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
      role: "modelo",
      verificationStatus: "aprobada",
      blockIfInCall: true
    }}>
      <div className="h-screen bg-ligand-mix-dark from-[#1a1c20] to-[#2b2d31] text-white p-6 overflow-hidden flex flex-col">
        <Header />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 flex-1 overflow-hidden">
          {/* Panel central */}
          <main className="lg:col-span-3 bg-[#1f2125] rounded-2xl p-6 shadow-xl flex flex-col items-center justify-center overflow-hidden">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">
              {t("client.greeting", { name: user?.display_name || user?.nickname || user?.name || t("client.defaultUser") || "Usuario" })}
            </h2>
            <p className="text-center text-white/70 mb-6 max-w-md">
              {t("client.instructions")}
            </p>

            <div className="flex flex-col items-center gap-3 w-full max-w-xs">
              <button
                className="w-full bg-[#ff007a] hover:bg-[#e6006e] text-white px-8 py-3 rounded-full text-lg font-semibold shadow-md transition-all duration-200 transform hover:scale-105"
                onClick={() => navigate("/esperandocall")}
              >
                {t("client.startCall")}
              </button>

              {/* 👈 BOTÓN ACTUALIZADO CON NUEVA LÓGICA */}
              <button
                className={storyButtonInfo.className}
                onClick={handleStoryButtonClick}
                disabled={storyButtonInfo.disabled}
              >
                <div className="flex items-center justify-center gap-2">
                  {storyButtonInfo.icon}
                  <span>{storyButtonInfo.text}</span>
                </div>
              </button>

              {/* 🆕 MOSTRAR INFORMACIÓN ADICIONAL SI HAY RESTRICCIÓN */}
              {!canUpload && uploadRestriction && (
                <div className="w-full bg-[#2b2d31] border border-orange-400/30 rounded-xl p-3 text-center">
                  <p className="text-orange-300 text-xs font-semibold mb-1">
                    ⏰ {t("client.restrictions.activeRestriction")}
                  </p>
                  <p className="text-white/60 text-xs">
                    {uploadRestriction.reason === 'active_story' 
                      ? t("client.restrictions.timeRemaining", { 
                          hours: timeRemaining?.hours || 0, 
                          minutes: timeRemaining?.minutes || 0 
                        })
                      : t("client.restrictions.pendingApprovalDesc")
                    }
                  </p>
                </div>
              )}

              <div className="w-full bg-[#2b2d31] border border-[#ff007a]/30 rounded-xl p-3 text-center">
                <p className="text-white text-xs mb-1 font-semibold">
                  🌟 {t("client.restrictions.professionalTip")}
                </p>
                <p className="text-white/70 text-xs italic">
                  {t("client.restrictions.professionalTipText")}
                </p>
              </div>
            </div>
          </main>

          {/* Panel lateral - Acordeón */}
          <aside className="h-full overflow-y-auto custom-scrollbar">
            <div className="bg-[#2b2d31] rounded-2xl border border-[#ff007a]/20 overflow-hidden">
              {/* Sección 1: Usuarios Activos */}
              <div className="border-b border-[#ff007a]/10">
                <button
                  onClick={() => setExpandedSections(prev => ({
                    activeUsers: !prev.activeUsers,
                    history: false
                  }))}
                  className="w-full flex items-center justify-between p-4 hover:bg-[#1f2125] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-bold text-[#ff007a]">
                      {t("client.activeUsers")}
                    </h3>
                    {usuariosActivos.length > 0 && (
                      <span className="text-xs text-white/50 bg-[#ff007a]/20 px-2 py-1 rounded-full">
                        {usuariosActivos.length}
                      </span>
                    )}
                  </div>
                  <svg
                    className={`w-5 h-5 text-white/60 transition-transform ${expandedSections.activeUsers ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {expandedSections.activeUsers && (
                  <div className="px-4 pb-4 border-t border-[#ff007a]/10 max-h-[50vh] overflow-y-auto custom-scrollbar">
                    {loadingUsers && initialLoad ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#ff007a] border-t-transparent"></div>
                        <span className="ml-3 text-sm text-white/60">
                          {t("client.loadingUsers")}
                        </span>
                      </div>
                    ) : usuariosActivos.length === 0 ? (
                      <div className="flex flex-col items-center justify-center text-center py-8">
                        <Users size={32} className="text-white/20 mb-3" />
                        <p className="text-sm text-white/60 font-medium">
                          {t("client.noActiveUsers")}
                        </p>
                        <p className="text-xs text-white/40 mt-1">
                          {t("client.contactsWillAppear")}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3 pt-3">
                        {usuariosActivos.map((usuario, index) => (
                          <div
                            key={usuario.id}
                            className="flex items-center justify-between bg-[#1f2125] p-3 rounded-xl hover:bg-[#25282c] transition-all duration-200 animate-fadeIn"
                            style={{
                              animationDelay: `${index * 50}ms`
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                {usuario.avatar_url ? (
                                  <img
                                    src={usuario.avatar_url}
                                    alt={usuario.display_name || usuario.name || usuario.alias}
                                    className="w-10 h-10 rounded-full object-cover border-2 border-[#ff007a]"
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                      e.target.nextElementSibling.style.display = 'flex';
                                    }}
                                  />
                                ) : null}
                                <div className={`w-10 h-10 rounded-full bg-[#ff007a] flex items-center justify-center font-bold text-sm ${usuario.avatar_url ? 'hidden' : ''}`}>
                                  {getInitial(usuario.display_name || usuario.name || usuario.alias)}
                                </div>
                                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-[#2b2d31] animate-pulse"></div>
                              </div>
                              <div>
                                <div className="font-semibold text-sm">
                                  {usuario.display_name || usuario.name || usuario.alias}
                                </div>
                                <div className="text-xs text-green-400">
                                  {t("client.status.home.online")}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => iniciarLlamadaReal(usuario)}
                                disabled={isCallActive || isReceivingCall}
                                className={`p-2 rounded-full transition-colors duration-200 ${
                                  isCallActive || isReceivingCall 
                                    ? 'bg-gray-500/20 cursor-not-allowed' 
                                    : 'hover:bg-[#ff007a]/20'
                                }`}
                                title={
                                  isCallActive || isReceivingCall 
                                    ? t("client.errors.callError")
                                    : t("client.call")
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
                                onClick={() => abrirChatConUsuario(usuario)}
                                className="p-2 rounded-full hover:bg-gray-500/20 transition-colors duration-200"
                                title={t("client.message")}
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

              {/* Sección 2: Historial */}
              <div>
                <button
                  onClick={() => setExpandedSections(prev => ({
                    activeUsers: false,
                    history: !prev.history
                  }))}
                  className="w-full flex items-center justify-between p-4 hover:bg-[#1f2125] transition-colors"
                >
                  <h3 className="text-lg font-bold text-[#ff007a]">
                    {t("client.yourHistory")}
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
                  <div className="px-4 pb-4 border-t border-[#ff007a]/10 max-h-[50vh] overflow-y-auto custom-scrollbar">
                    <div className="space-y-3 pt-3">
                      {loadingHistory ? (
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
                            <div className="flex gap-3 items-center">
                              <div className={`w-9 h-9 ${item.type === 'favorite' ? 'bg-yellow-500' : 'bg-pink-400'} text-[#1a1c20] font-bold rounded-full flex items-center justify-center text-sm`}>
                                {item.type === 'favorite' ? <Star size={16} className="text-[#1a1c20]" /> : getInitial(item.user_name)}
                              </div>
                              <div className="text-sm">
                                <p className="font-medium">{item.user_name}</p>
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
                            <div className="flex items-center gap-2">
                              <div className="text-right text-white/40 text-xs">
                                {item.formatted_date || item.timestamp}
                              </div>
                              {item.user_id && (
                                <>
                                  {item.type === 'favorite' ? (
                                    <button
                                      onClick={() => abrirChatConUsuario({ 
                                        id: item.user_id, 
                                        name: item.user_name,
                                        alias: item.user_name
                                      })}
                                      className="p-2 rounded-full bg-[#ff007a] hover:bg-[#e6006e] text-white transition-colors duration-200"
                                      title={t("client.message")}
                                    >
                                      <MessageSquare size={14} />
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => iniciarLlamadaReal({ 
                                        id: item.user_id, 
                                        name: item.user_name,
                                        alias: item.user_name
                                      })}
                                      disabled={isCallActive || isReceivingCall}
                                      className="p-2 rounded-full bg-[#ff007a] hover:bg-[#e6006e] text-white transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                      title={t("client.startCall")}
                                    >
                                      <Phone size={14} />
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>

        {/* Estilos adicionales para animaciones y scrollbar */}
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
      </div>

      {/* Modal de confirmación existente */}
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

      {/* 👈 MODAL DE HISTORIA */}
      <StoryModal
        isOpen={showStoryModal}
        onClose={() => setShowStoryModal(false)}
        story={existingStory}
        onDelete={handleDeleteStory}
      />

      <CallingSystem
        isVisible={isCallActive}
        callerName={currentCall?.display_name || currentCall?.name || currentCall?.alias}
        callerAvatar={currentCall?.avatar_url || null}
        onCancel={cancelarLlamada}
        callStatus={currentCall?.status || 'initiating'}
      />

      <IncomingCallOverlay
        isVisible={isReceivingCall}
        callData={incomingCall}
        onAnswer={() => responderLlamada('accept')}
        onDecline={() => responderLlamada('reject')}
      />
    </ProtectedPage>
  );
}