// InterfazCliente.jsx - Versión actualizada con control de 24 horas integrado
import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, Star, Home, Phone, Clock, CheckCircle, Users, AlertTriangle, Video, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Header from "./header";
import { useTranslation } from "react-i18next";
import { ProtectedPage } from '../hooks/usePageAccess';
import { getUser } from "../../utils/auth";
import axios from "../../api/axios";
import CallingSystem from '../CallingOverlay';
import IncomingCallOverlay from '../IncomingCallOverlay';
import SecondModelInvitationOverlay from '../SecondModelInvitationOverlay';
import DualCallIncomingOverlay from '../DualCallIncomingOverlay';
import StoryModal from '../StoryModal';
import { useAppNotifications } from '../../contexts/NotificationContext';
import audioManager from '../../utils/AudioManager';
// Componentes modulares nuevos
import ActiveUsersList from './ActiveUsersList';
import ModelCallHistoryList from './ModelCallHistoryList';
import ProfessionalTip from './ProfessionalTip';

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
  const [isDualCall, setIsDualCall] = useState(false); // 🔥 Estado para detectar llamada 2vs1
  const [callPollingInterval, setCallPollingInterval] = useState(null);
  const [incomingCallPollingInterval, setIncomingCallPollingInterval] = useState(null);
  const [incomingCallAudio, setIncomingCallAudio] = useState(null);
  // 🔥 ESTADOS PARA INVITACIÓN DE SEGUNDO MODELO
  const [secondModelInvitation, setSecondModelInvitation] = useState(null);
  const [isReceivingSecondModelInvitation, setIsReceivingSecondModelInvitation] = useState(false);
  const audioRef = useRef(null);
  
  // Estados para historial de llamadas
  const [callHistory, setCallHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  
  // Estado para controlar las secciones expandidas del acordeón
  const [expandedSections, setExpandedSections] = useState({
    activeUsers: true,   // Por defecto abierto
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
          userId: usuario.id, // 🔥 ID del usuario para abrir el chat
          other_user_id: usuario.id, // También como other_user_id para compatibilidad
          userName: usuario.name || usuario.alias || usuario.display_name,
          other_user_name: usuario.name || usuario.alias || usuario.display_name,
          userRole: usuario.role || usuario.rol || 'cliente',
          role: usuario.role || usuario.rol || 'cliente',
          avatar_url: usuario.avatar_url || usuario.avatar || null
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

  // 🔥 VERIFICAR SI HAY LLAMADA ACTIVA Y RECONECTAR AUTOMÁTICAMENTE
  useEffect(() => {
    const checkAndReconnect = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

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
                
                // Redirigir de vuelta a la sala de videochat
                navigate(`/videochatclient?roomName=${encodeURIComponent(roomName)}&userName=${encodeURIComponent(userName)}`, {
                  replace: true,
                  state: {
                    userName: userName,
                    reconnect: true
                  }
                });
                return; // Salir para evitar limpiar datos
              } else {
                // No hay sesión activa, limpiar datos
                console.log('🧹 [HomeLlamadas] No hay sesión activa - Limpiando datos de llamada');
                const keysToRemove = ['roomName', 'userName', 'currentRoom', 'inCall', 'videochatActive'];
                keysToRemove.forEach(k => localStorage.removeItem(k));
                sessionStorage.removeItem('roomName');
              }
            }
          } catch (error) {
            console.warn('⚠️ [HomeLlamadas] Error verificando sesión activa:', error);
            // En caso de error, limpiar datos por seguridad
            const keysToRemove = ['roomName', 'userName', 'currentRoom', 'inCall', 'videochatActive'];
            keysToRemove.forEach(k => localStorage.removeItem(k));
            sessionStorage.removeItem('roomName');
          }
        } else {
          // No hay datos de llamada activa, limpiar claves residuales
          const keysToRemove = ['roomName', 'currentRoom', 'inCall', 'videochatActive'];
          keysToRemove.forEach(k => localStorage.removeItem(k));
          sessionStorage.removeItem('roomName');
        }
      } catch (e) {
        // Silenciar cualquier error de storage
      }
    };

    checkAndReconnect();
  }, [navigate, API_BASE_URL]);

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
        className: "w-full bg-gray-500 text-white px-6 sm:px-8 py-3 sm:py-3.5 lg:py-4 rounded-full text-sm sm:text-base lg:text-lg font-bold shadow-md opacity-50 cursor-not-allowed"
      };
    }

    if (!existingStory) {
      // No hay historia, verificar si puede subir
      if (!canUpload) {
        if (uploadRestriction?.reason === 'pending_story') {
          return {
            text: t("client.restrictions.pendingApproval"),
            icon: <Clock size={20} className="text-yellow-500 sm:w-6 sm:h-6" />,
            disabled: false,
            className: "w-full bg-yellow-500/20 border border-yellow-500/50 text-yellow-300 px-6 sm:px-8 py-3 sm:py-3.5 lg:py-4 rounded-full text-sm sm:text-base lg:text-lg font-bold shadow-md hover:bg-yellow-500/30 transition"
          };
        } else if (uploadRestriction?.reason === 'active_story') {
          return {
            text: timeRemaining ? t("client.restrictions.waitTime", { hours: timeRemaining.hours, minutes: timeRemaining.minutes }) : t("client.restrictions.activeStory"),
            icon: <AlertTriangle size={20} className="text-orange-400 sm:w-6 sm:h-6" />,
            disabled: false,
            className: "w-full bg-orange-500/20 border border-orange-500/50 text-orange-300 px-6 sm:px-8 py-3 sm:py-3.5 lg:py-4 rounded-full text-sm sm:text-base lg:text-lg font-bold shadow-md hover:bg-orange-500/30 transition"
          };
        }
      }
      
      return {
        text: t("client.uploadStory") || "Subir Historia",
        icon: null,
        disabled: false,
        className: "w-full bg-[#ffb6d2] text-[#4b2e35] px-6 sm:px-8 py-3 sm:py-3.5 lg:py-4 rounded-full text-sm sm:text-base lg:text-lg font-bold shadow-md hover:bg-[#ff9fcb] transition"
      };
    }

    const isPending = existingStory.status === 'pending';
    const isApproved = existingStory.status === 'approved';
    const isRejected = existingStory.status === 'rejected';

    if (isPending) {
      return {
        text: t("client.storyPending") || "Historia Pendiente por Aprobación",
        icon: <Clock size={20} className="text-yellow-500 sm:w-6 sm:h-6" />,
        disabled: false,
        className: "w-full bg-yellow-500/20 border border-yellow-500/50 text-yellow-300 px-6 sm:px-8 py-3 sm:py-3.5 lg:py-4 rounded-full text-sm sm:text-base lg:text-lg font-bold shadow-md hover:bg-yellow-500/30 transition"
      };
    }

    if (isApproved) {
      return {
        text: t("client.viewApprovedStory") || "Ver Mi Historia",
        icon: <CheckCircle size={20} className="text-[#ff007a] sm:w-6 sm:h-6" />,
        disabled: false,
        className: "w-full bg-[#ff007a]/20 border border-[#ff007a]/50 text-[#ff007a] px-6 sm:px-8 py-3 sm:py-3.5 lg:py-4 rounded-full text-sm sm:text-base lg:text-lg font-bold shadow-md hover:bg-[#ff007a]/30 transition"
      };
    }

    if (isRejected) {
      return {
        text: t("client.storyRejected") || "Historia Rechazada - Crear Nueva",
        icon: null,
        disabled: false,
        className: "w-full bg-red-500/20 border border-red-500/50 text-red-300 px-6 sm:px-8 py-3 sm:py-3.5 lg:py-4 rounded-full text-sm sm:text-base lg:text-lg font-bold shadow-md hover:bg-red-500/30 transition"
      };
    }

    return {
      text: t("client.uploadStory") || "Subir Historia",
      icon: null,
      disabled: false,
      className: "w-full bg-[#ffb6d2] text-[#4b2e35] px-6 sm:px-8 py-3 sm:py-3.5 lg:py-4 rounded-full text-sm sm:text-base lg:text-lg font-bold shadow-md hover:bg-[#ff9fcb] transition"
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
          
          // 🔥 DETECTAR SI ES LLAMADA 2VS1
          const callData = typeof data.incoming_call.data === 'string' 
            ? JSON.parse(data.incoming_call.data) 
            : data.incoming_call.data;
          const isDualModelCall = callData?.is_dual_model_call === true;
          
          
          // 🔥 SI ES LLAMADA 2VS1, USAR OVERLAY DE INVITACIÓN EN LUGAR DE LLAMADA NORMAL
          if (isDualModelCall) {
            const invitationData = {
              call_id: data.incoming_call.id,
              room_name: data.incoming_call.room_name || callData?.room_name,
              cliente: callData?.caller || {
                id: data.incoming_call.caller_id,
                name: data.incoming_call.caller_name,
                avatar: null
              },
              modelo1: callData?.other_model || null,
              message: 'Tienes una invitación para unirte a una llamada 2vs1'
            };
            
            console.log('🔔 [MODELO] Convirtiendo llamada 2vs1 a invitación:', invitationData);
            
            setSecondModelInvitation(invitationData);
            setIsReceivingSecondModelInvitation(true);
            
            // Reproducir sonido de invitación
            try {
              await audioManager.playRingtone();
            } catch (err) {
              console.warn('Error reproduciendo sonido de invitación:', err);
            }
          } else {
            // 🔥 GUARDAR ROOM_NAME EN EL INCOMING CALL SI ESTÁ DISPONIBLE
            const incomingCallData = {
              ...data.incoming_call,
              room_name: data.incoming_call.room_name || callData?.room_name,
              data: callData
            };
            
            setIsDualCall(false);
            playIncomingCallSound();
            setIncomingCall(incomingCallData);
            setIsReceivingCall(true);
          }
        }
      } else if (isReceivingCall && !data.has_incoming) {
                stopIncomingCallSound();
        setIsReceivingCall(false);
        setIncomingCall(null);
        setIsDualCall(false); // 🔥 Resetear estado de llamada dual
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
    
    // 🔥 VERIFICAR SI LA RESPUESTA ES OK ANTES DE PARSEAR JSON
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [MODELO] Error HTTP en respuesta:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      setIsReceivingCall(false);
      setIncomingCall(null);
      setIsDualCall(false);
      notifications.error('Error al procesar la respuesta del servidor');
      return;
    }
    
    const data = await response.json();
    
    
    if (data.success) {
      if (accion === 'accept') {
        // 🔥 OBTENER ROOM_NAME DE DIFERENTES UBICACIONES
        const roomName = data.room_name || data.call?.room_name || incomingCall.room_name || incomingCall.data?.room_name;
        
        
        if (!roomName) {
          console.error('❌ [MODELO] No se pudo obtener room_name de la respuesta');
          console.error('❌ [MODELO] Datos disponibles:', {
            data,
            incomingCall
          });
          setIsReceivingCall(false);
          setIncomingCall(null);
          setIsDualCall(false);
          notifications.error('Error: No se pudo obtener información de la sala');
          return;
        }
        
        console.log('✅ [MODELO] Redirigiendo a videochat con room_name:', roomName);
        
        setIsReceivingCall(false);
        setIncomingCall(null);
        setIsDualCall(false); // 🔥 Resetear estado de llamada dual
        
        // 🔥 PREPARAR DATOS PARA REDIRIGIR
        const callDataToPass = {
          room_name: roomName,
          call_id: incomingCall.id || data.call_id,
          is_dual_call: data.is_dual_call || isDualCall,
          modelo_id_2: data.modelo_id_2,
          modelo2: data.modelo2,
          ...data
        };
        
        console.log('🚀 [MODELO] Datos para redirigir:', callDataToPass);
        
        redirigirAVideochat(callDataToPass);
      } else {
        setIsReceivingCall(false);
        setIncomingCall(null);
        setIsDualCall(false); // 🔥 Resetear estado de llamada dual
      }
    } else {
      console.error('❌ [MODELO] Error en respuesta del backend:', data);
      setIsReceivingCall(false);
      setIncomingCall(null);
      setIsDualCall(false);
      notifications.error(data.error || data.message || 'Error al procesar la respuesta');
    }
  } catch (error) {
    console.error('❌ [MODELO] Error aceptando llamada:', error);
    console.error('❌ [MODELO] Stack trace:', error.stack);
    setIsReceivingCall(false);
    setIncomingCall(null);
    setIsDualCall(false);
    notifications.error('Error de conexión al procesar la llamada');
  }
};

// 🔥 FUNCIÓN: REDIRIGIR AL VIDEOCHAT MODELO
const redirigirAVideochat = (callData) => {
  console.log('🚀 [MODELO] redirigirAVideochat llamado con:', callData);
  
  // 🔥 Obtener room_name de diferentes posibles ubicaciones en la respuesta
  const roomName = callData.room_name || callData.incoming_call?.room_name || callData.call?.room_name;
  
  
  if (!roomName) {
    console.error('❌ [MODELO] No se encontró room_name en callData');
    console.error('❌ [MODELO] callData completo:', JSON.stringify(callData, null, 2));
    return;
  }
  
  console.log('✅ [MODELO] room_name encontrado:', roomName);
  
  
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
  
  // 🔥 DETECTAR SI ES LLAMADA 2VS1 Y GUARDAR INFORMACIÓN
  const isDualCall = callData?.is_dual_call || callData?.is_dual_model_call || callData?.modelo_id_2 || (callData?.call && callData.call.modelo_id_2);
  if (isDualCall) {
    sessionStorage.setItem('isDualCall', 'true');
    if (callData?.modelo_id_2) {
      sessionStorage.setItem('modeloId2', callData.modelo_id_2);
    }
  }
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
    // 🔥 PREPARAR DATOS PARA VIDEOCHAT 2VS1
    const videoChatState = {
      userName: user?.name || 'Modelo',
      callId: callData.call_id || callData.id || callData.incoming_call?.id,
      from: 'call',
      callData: callData,
      isDualCall: isDualCall,
      modeloId2: callData?.modelo_id_2,
      modelo2: callData?.modelo2
    };
    
    console.log('🚀 [MODELO] Redirigiendo a videochat con estado:', videoChatState);
    console.log('🚀 [MODELO] isDualCall:', isDualCall);
    
    // Redirigir al videochat modelo (no cliente)
    try {
      console.log('🚀 [MODELO] Intentando navegar a /videochat...');
      navigate('/videochat', {
        state: videoChatState,
        replace: true // Usar replace para evitar problemas de navegación
      });
      console.log('✅ [MODELO] Navegación iniciada correctamente');
    } catch (navError) {
      console.error('❌ [MODELO] Error en navigate:', navError);
      // Fallback: usar window.location
      console.log('🔄 [MODELO] Usando fallback con window.location');
      window.location.href = `/videochat?roomName=${encodeURIComponent(roomName)}&userName=${encodeURIComponent(user?.name || 'Modelo')}`;
    }
  }, 500); // Delay de 500ms para asegurar desconexión
};

// 🔥 USEEFFECTS NECESARIOS:

// 🔥 POLLING PARA NOTIFICACIONES DE INVITACIÓN DE SEGUNDO MODELO
useEffect(() => {
  if (!user?.id || user?.rol !== 'modelo') return;

  const checkSecondModelInvitations = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/status/updates`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.success && data.has_notifications) {
          const notification = data.notification;
          
          if (notification.type === 'second_model_invitation') {
            const invitationData = typeof notification.data === 'string'
              ? JSON.parse(notification.data)
              : notification.data;
            
            console.log('🔔 [MODELO] Invitación de segundo modelo recibida:', invitationData);
            
            setSecondModelInvitation(invitationData);
            setIsReceivingSecondModelInvitation(true);
            
            // Reproducir sonido de invitación
            try {
              await audioManager.playRingtone();
            } catch (err) {
              console.warn('Error reproduciendo sonido de invitación:', err);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error verificando invitaciones de segundo modelo:', error);
    }
  };

  // Verificar cada 3 segundos
  const interval = setInterval(checkSecondModelInvitations, 3000);
  checkSecondModelInvitations(); // Verificar inmediatamente

  return () => clearInterval(interval);
}, [user?.id, user?.rol]);

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
      <div className="min-h-screen max-h-screen bg-gradient-to-br from-[#1a1c20] via-[#1f2125] to-[#2b2d31] text-white p-4 sm:p-6 overflow-hidden flex flex-col">
        <div className="flex-shrink-0 mb-2 sm:mb-3 lg:mb-4">
          <Header />
        </div>

        <div className="flex flex-col lg:grid lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 flex-1 min-h-0 overflow-hidden">
          {/* Panel central - Mejorado con gradientes y sombras */}
          <main 
            className="flex-1 w-full lg:col-span-3 bg-gradient-to-br from-[#1f2125] via-[#25282c] to-[#1f2125] rounded-2xl p-3 sm:p-4 lg:p-4 shadow-2xl border border-[#ff007a]/10 flex flex-col items-center justify-center overflow-hidden relative min-h-[50vh] max-h-[60vh] lg:min-h-0 lg:max-h-none lg:h-full"
            role="main"
            aria-label="Panel principal de inicio"
          >
            {/* Efecto de brillo sutil en el fondo */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#ff007a]/5 via-transparent to-transparent pointer-events-none"></div>
            <div className="relative z-10 w-full flex flex-col items-center justify-center min-h-0 py-4 sm:py-6 lg:py-4 px-4 sm:px-6">
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-center mb-3 sm:mb-4 lg:mb-3 bg-gradient-to-r from-white via-white/95 to-white/90 bg-clip-text text-transparent">
                {t("client.greeting", { name: user?.display_name || user?.nickname || user?.name || t("client.defaultUser") || "Usuario" })}
              </h2>
              <p className="text-center text-white/80 mb-4 sm:mb-5 lg:mb-5 max-w-lg leading-relaxed text-sm sm:text-base lg:text-base px-2" role="note">
                {t("client.instructions")}
              </p>

              <div className="flex flex-col items-center gap-3 sm:gap-3.5 lg:gap-4 w-full max-w-md">
                <button
                  className="w-full bg-gradient-to-r from-[#ff007a] to-[#e6006e] hover:from-[#ff3399] hover:to-[#ff007a] text-white px-6 sm:px-8 py-3 sm:py-3.5 lg:py-4 rounded-full text-sm sm:text-base lg:text-lg font-bold shadow-lg shadow-[#ff007a]/30 transition-all duration-300 transform hover:scale-105 hover:shadow-xl hover:shadow-[#ff007a]/50 relative overflow-hidden group flex-shrink-0"
                  onClick={() => navigate("/esperandocall")}
                  aria-label={t("client.startCall")}
                >
                  {/* Efecto de brillo en hover */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                  <div className="flex items-center justify-center gap-2.5 sm:gap-3 relative z-10">
                    <Video className="w-5 h-5 sm:w-6 sm:h-6 transition-transform duration-300 group-hover:scale-110" />
                    {t("client.startCall")}
                  </div>
                </button>

                {/* 👈 BOTÓN ACTUALIZADO CON NUEVA LÓGICA - Mejorado */}
                <button
                  className={`w-full ${storyButtonInfo.className} relative overflow-hidden group transition-all duration-300 transform hover:scale-105 active:scale-95 flex-shrink-0`}
                  onClick={handleStoryButtonClick}
                  disabled={storyButtonInfo.disabled}
                  aria-label={storyButtonInfo.text}
                >
                  {/* Efecto ripple */}
                  <div className="absolute inset-0 bg-white/20 scale-0 group-active:scale-100 rounded-full transition-transform duration-300"></div>
                  <div className="flex items-center justify-center gap-2.5 sm:gap-3 relative z-10">
                    {storyButtonInfo.icon}
                    <span>{storyButtonInfo.text}</span>
                  </div>
                </button>

                {/* 🆕 MOSTRAR INFORMACIÓN ADICIONAL SI HAY RESTRICCIÓN - Mejorado */}
                {!canUpload && uploadRestriction && (
                  <div className="w-full bg-gradient-to-r from-orange-500/20 to-yellow-500/20 border border-orange-400/30 rounded-xl p-3 text-center backdrop-blur-sm animate-fadeIn">
                    <p className="text-orange-300 text-xs font-semibold mb-1">
                      ⏰ {t("client.restrictions.activeRestriction")}
                    </p>
                    <p className="text-white/70 text-xs">
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

                {/* Consejo profesional - Usando componente nuevo */}
                <ProfessionalTip />
              </div>
            </div>
          </main>

          {/* Panel lateral - Acordeón Mejorado */}
          <aside className="w-full lg:w-auto flex flex-col min-h-[50vh] max-h-[60vh] lg:min-h-0 lg:max-h-none lg:h-full flex-shrink-0" role="complementary" aria-label="Panel de información">
            <div className="bg-gradient-to-b from-[#2b2d31] to-[#1f2125] rounded-2xl border border-[#ff007a]/20 shadow-xl flex flex-col h-full flex-1 min-h-0">
              {/* Sección 1: Usuarios Activos - Usando componente ActiveUsersList */}
              <div className={`border-b border-[#ff007a]/10 flex flex-col transition-all duration-300 ${expandedSections.activeUsers ? '' : 'flex-shrink-0'}`}>
                <button
                  onClick={() => setExpandedSections(prev => ({
                    activeUsers: !prev.activeUsers,
                    history: false
                  }))}
                  className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-[#1f2125] transition-colors group flex-shrink-0"
                  aria-expanded={expandedSections.activeUsers}
                  aria-label={t("client.activeUsers")}
                >
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Users className="w-4 h-4 sm:w-5 sm:h-5 text-[#ff007a]" />
                    <h3 className="text-sm sm:text-base lg:text-lg font-bold text-[#ff007a]">
                      {t("client.activeUsers")}
                    </h3>
                    {usuariosActivos.length > 0 && (
                      <span className="text-xs text-white/50 bg-[#ff007a]/20 px-2 py-1 rounded-full">
                        {usuariosActivos.length}
                      </span>
                    )}
                  </div>
                  <svg
                    className={`w-5 h-5 text-white/60 transition-transform duration-300 ${expandedSections.activeUsers ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {expandedSections.activeUsers && (
                  <ActiveUsersList
                    usuariosActivos={usuariosActivos}
                    loadingUsers={loadingUsers && initialLoad}
                    onCall={(usuario) => iniciarLlamadaReal(usuario)}
                    onMessage={(usuario) => abrirChatConUsuario(usuario)}
                    isCallActive={isCallActive}
                    isReceivingCall={isReceivingCall}
                  />
                )}
              </div>

              {/* Sección 2: Historial - Usando componente ModelCallHistoryList */}
              <div className={`flex flex-col transition-all duration-300 ${expandedSections.history ? 'flex-1 min-h-0' : 'flex-shrink-0'}`}>
                <button
                  onClick={() => setExpandedSections(prev => ({
                    activeUsers: false,
                    history: !prev.history
                  }))}
                  className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-[#1f2125] transition-colors group flex-shrink-0"
                  aria-expanded={expandedSections.history}
                  aria-label={t("client.yourHistory")}
                >
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-[#ff007a]" />
                    <h3 className="text-sm sm:text-base lg:text-lg font-bold text-[#ff007a]">
                      {t("client.yourHistory")}
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
                  <ModelCallHistoryList
                    callHistory={callHistory}
                    loadingHistory={loadingHistory}
                    onCall={(item) => iniciarLlamadaReal(item)}
                    onMessage={(item) => abrirChatConUsuario(item)}
                    isCallActive={isCallActive}
                    isReceivingCall={isReceivingCall}
                  />
                )}
              </div>
            </div>
          </aside>
        </div>

        {/* Estilos adicionales para animaciones y scrollbar mejorados */}
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

      {/* 🔥 OVERLAY PARA LLAMADA NORMAL (NO 2VS1) */}
      {!isDualCall && (
        <IncomingCallOverlay
          isVisible={isReceivingCall}
          callData={incomingCall}
          onAnswer={() => responderLlamada('accept')}
          onDecline={() => responderLlamada('reject')}
        />
      )}

      {/* 🔥 OVERLAY PARA INVITACIÓN DE SEGUNDO MODELO */}
      <SecondModelInvitationOverlay
        isVisible={isReceivingSecondModelInvitation}
        invitationData={secondModelInvitation}
        onAccept={async () => {
          if (!secondModelInvitation?.call_id) {
            console.error('❌ [MODELO] No hay call_id en la invitación');
            return;
          }
          
          
          try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/calls/answer`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                call_id: secondModelInvitation.call_id,
                action: 'accept'
              })
            });
            
            
            if (!response.ok) {
              const errorText = await response.text();
              console.error('❌ [MODELO] Error HTTP:', {
                status: response.status,
                error: errorText
              });
              return;
            }
            
            const data = await response.json();
            console.log('📞 [MODELO] Datos de respuesta:', data);
            
            if (data.success) {
              setIsReceivingSecondModelInvitation(false);
              setSecondModelInvitation(null);
              audioManager.stopRingtone();
              
              // 🔥 PREPARAR DATOS PARA REDIRIGIR
              const roomName = data.room_name || secondModelInvitation.room_name;
              
              if (!roomName) {
                console.error('❌ [MODELO] No se encontró room_name en la respuesta');
                return;
              }
              
              const callDataToPass = {
                room_name: roomName,
                call_id: secondModelInvitation.call_id,
                is_dual_call: true,
                modelo_id_2: data.modelo_id_2 || secondModelInvitation.call_id,
                modelo2: data.modelo2,
                ...data
              };
              
              console.log('🚀 [MODELO] Redirigiendo segundo modelo a videochat:', callDataToPass);
              
              // Redirigir al videochat
              redirigirAVideochat(callDataToPass);
            } else {
              console.error('❌ [MODELO] Error en respuesta:', data);
            }
          } catch (error) {
            console.error('❌ [MODELO] Error aceptando invitación:', error);
            console.error('❌ [MODELO] Stack:', error.stack);
          }
        }}
        onReject={async () => {
          if (!secondModelInvitation?.call_id) return;
          try {
            const token = localStorage.getItem('token');
            await fetch(`${API_BASE_URL}/api/calls/${secondModelInvitation.call_id}/reject-second-model`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              }
            });
            
            setIsReceivingSecondModelInvitation(false);
            setSecondModelInvitation(null);
            audioManager.stopRingtone();
          } catch (error) {
            console.error('Error rechazando invitación:', error);
          }
        }}
      />
    </ProtectedPage>
  );
}