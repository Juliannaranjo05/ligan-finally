import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "./headercliente";
import { useTranslation } from 'react-i18next';

// 🔥 IMPORTAR COMPONENTES DE LLAMADA (como en mensajes)
import CallingSystem from '../CallingOverlay';
import IncomingCallOverlay from '../IncomingCallOverlay';

import {
  Home,
  MessageSquare,
  Star,
  MoreVertical,
  PhoneCall,
  Ban,
  Trash2,
  RefreshCw,
  Heart,
  Users,
  Clock,
  Video,
  X,
  Shield
} from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function Favoritos() {
  const [favoritas, setFavoritos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [opcionesAbiertas, setOpcionesAbiertas] = useState(null);
  const [processingAction, setProcessingAction] = useState(null);
  const { t } = useTranslation();
  
  // 🔥 ESTADOS PARA SISTEMA ONLINE/OFFLINE (como en mensajes)
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [ultimaConexion, setUltimaConexion] = useState({});
  
  // 🔥 ESTADOS PARA SISTEMA DE LLAMADAS (como en mensajes)
  const [isCallActive, setIsCallActive] = useState(false);
  const [currentCall, setCurrentCall] = useState(null);
  const [isReceivingCall, setIsReceivingCall] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [callPollingInterval, setCallPollingInterval] = useState(null);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [selectedUserToBlock, setSelectedUserToBlock] = useState(null);
  const [loadingBlock, setLoadingBlock] = useState(false);

  
  // 🔥 ESTADOS PARA MODAL DE USUARIOS BLOQUEADOS
  const [showBloqueadosModal, setShowBloqueadosModal] = useState(false);
  const [usuariosBloqueados, setUsuariosBloqueados] = useState([]);
  const [loadingBloqueados, setLoadingBloqueados] = useState(false);
  
  // 🔥 ESTADOS PARA MODAL DE CONFIRMACIÓN
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  
  const navigate = useNavigate();

  // 🔥 FUNCIÓN PARA OBTENER HEADERS CON TOKEN (como en mensajes)
  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  };

  // 🔥 CARGAR FAVORITOS Y USUARIOS ONLINE AL MONTAR
  useEffect(() => {
    loadFavorites();
    cargarUsuariosOnline();
    
    // Actualizar chicas online cada 15 segundos (como en mensajes)
    const interval = setInterval(cargarUsuariosOnline, 15000);
    return () => clearInterval(interval);
  }, []);

  // 🔥 FUNCIÓN PARA CARGAR USUARIOS BLOQUEADOS
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

  // 🔥 FUNCIÓN PARA DESBLOQUEAR USUARIO DESDE EL MODAL
  const desbloquearUsuarioModal = async (blockedUserId, nombre) => {
    try {
      setProcessingAction(blockedUserId);
            
      const response = await fetch(`${API_BASE_URL}/api/blocks/unblock-user`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          blocked_user_id: blockedUserId
        })
      });

      const data = await response.json();

      if (data.success) {
        // Remover de la lista local
        setUsuariosBloqueados(prev => prev.filter(user => user.id !== blockedUserId));
        
        // 🔥 RECARGAR FAVORITOS POR SI ERA UN FAVORITO BLOQUEADO
        loadFavorites();
      } else {
              }
    } catch (error) {
          } finally {
      setProcessingAction(null);
    }
  };

  // 🔥 FUNCIÓN PARA CARGAR USUARIOS ONLINE Y ÚLTIMA CONEXIÓN
  const cargarUsuariosOnline = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/online-status`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const onlineIds = new Set(data.online_users?.map(user => user.id) || []);
          setOnlineUsers(onlineIds);
          
          // Guardar información de última conexión
          const ultimaConexionMap = {};
          data.users_status?.forEach(user => {
            if (user.last_seen) {
              ultimaConexionMap[user.id] = user.last_seen;
            }
          });
          setUltimaConexion(ultimaConexionMap);
          
        }
      }
    } catch (error) {
          }
  };

  // 🔥 FUNCIÓN PARA OBTENER ESTADO DE CONEXIÓN DETALLADO
  const obtenerEstadoConexion = (usuarioId) => {
    if (onlineUsers.has(usuarioId)) {
      return { estado: 'online', texto: t('favorites.status.online'), color: 'text-green-400' };
    }
    
    const ultimaVez = ultimaConexion[usuarioId];
    if (ultimaVez) {
      const fecha = new Date(ultimaVez);
      const ahora = new Date();
      const diffTime = Math.abs(ahora - fecha);
      const diffMinutes = Math.ceil(diffTime / (1000 * 60));
      const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffMinutes < 5) {
        return { estado: 'recent', texto: t('favorites.status.recentlyOnline'), color: 'text-yellow-400' };
      } else if (diffMinutes < 60) {
        return { estado: 'minutes', texto: t('favorites.status.minutesAgo', { minutes: 'número' }), color: 'text-orange-400' };
      } else if (diffHours < 24) {
        return { estado: 'hours', texto: t('favorites.status.hoursAgo', { hours: 'número' }), color: 'text-orange-500' };
      } else if (diffDays < 7) {
        return { estado: 'days', texto: t('favorites.status.daysAgo', { days: 'número' }), color: 'text-red-400' };
      } else {
        return { estado: 'offline', texto: t('favorites.status.offline'), color: 'text-gray-500' };
      }
    }
    
    return { estado: 'unknown', texto: t('favorites.status.unknown'), color: 'text-gray-500' };
  };

  // 🔥 FUNCIÓN PARA INICIAR LLAMADA REAL CON VERIFICACIÓN DE BLOQUEO
  const iniciarLlamadaReal = async (otherUserId, otherUserName) => {
    try {
      // 🔒 Verificar si YO lo he bloqueado
      const yoLoBloquee = usuariosBloqueados.some((user) => user.id === otherUserId);
      if (yoLoBloquee) {
        setConfirmAction({
          type: 'blocked',
          title: t('favorites.calls.notAvailable'),
          message: t('favorites.calls.blockedByUser', { name: 'nombre' }),
          confirmText: 'Entendido',
          action: () => setShowConfirmModal(false)
        });
        setShowConfirmModal(true);
        return;
      }

      
      // 🔥 VERIFICAR BLOQUEO ANTES DE INICIAR LLAMADA
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
          // Mostrar modal de bloqueo en lugar de console
          setConfirmAction({
            type: 'blocked',
            title: t('favorites.calls.notAvailable'),
            message: t('favorites.calls.userBlocked', { name: 'nombre' }),
            confirmText: 'Entendido',
            action: () => setShowConfirmModal(false)
          });
          setShowConfirmModal(true);
          return;
        }
      }

      // Si no está bloqueado, continuar con la llamada
      
      setCurrentCall({
        id: otherUserId,
        name: otherUserName,
        status: 'initiating'
      });
      setIsCallActive(true);
      
      const response = await fetch(`${API_BASE_URL}/api/calls/start`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          receiver_id: otherUserId,
          call_type: 'video'
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setCurrentCall({
          id: otherUserId,
          name: otherUserName,
          callId: data.call_id,
          roomName: data.room_name,
          status: 'calling'
        });
        iniciarPollingLlamada(data.call_id);
      } else {
        // Verificar si el error es por bloqueo
        if (data.error && (data.error.includes('bloqueado') || data.error.includes('blocked'))) {
          setConfirmAction({
            type: 'blocked',
            title: t('favorites.calls.notAvailable'),
            message: `No puedes llamar a ${otherUserName}. Este chica te ha bloqueado.`,
            confirmText: t('favorites.calls.understood'),
            action: () => setShowConfirmModal(false)
          });
          setShowConfirmModal(true);
        } else {
          setConfirmAction({
            type: 'error',
            title: 'Error en llamada',
            message: data.error || 'No se pudo iniciar la llamada',
            confirmText: t('favorites.calls.understood'),
            action: () => setShowConfirmModal(false)
          });
          setShowConfirmModal(true);
        }
        
        setIsCallActive(false);
        setCurrentCall(null);
      }
    } catch (error) {
            setIsCallActive(false);
      setCurrentCall(null);
      
      setConfirmAction({
        type: 'error',
        title: 'Error de conexión',
        message: t('favorites.calls.cannotCall'),
        confirmText: 'Entendido',
        action: () => setShowConfirmModal(false)
      });
      setShowConfirmModal(true);
    }
  };

  // 🔥 POLLING PARA VERIFICAR ESTADO DE LLAMADA (igual que en mensajes)
  const iniciarPollingLlamada = (callId) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/calls/status`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ call_id: callId })
        });
        
        const data = await response.json();
        
        if (data.success) {
          const callStatus = data.call.status;
          
          if (callStatus === 'active') {
            clearInterval(interval);
            setCallPollingInterval(null);
            redirigirAVideochat(data.call);
          } else if (callStatus === 'rejected') {
            clearInterval(interval);
            setCallPollingInterval(null);
            setIsCallActive(false);
            setCurrentCall(null);
            alert(t('favorites.calls.rejected'));
          } else if (callStatus === 'cancelled') {
            clearInterval(interval);
            setCallPollingInterval(null);
            setIsCallActive(false);
            setCurrentCall(null);
            alert(t('favorites.calls.expired'));
          }
        }
      } catch (error) {
              }
    }, 2000);
    
    setCallPollingInterval(interval);
  };

  // 🔥 CANCELAR LLAMADA (igual que en mensajes)
  const cancelarLlamada = async () => {
    try {
      if (currentCall?.callId) {
        await fetch(`${API_BASE_URL}/api/calls/cancel`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ call_id: currentCall.callId })
        });
      }
      
      if (callPollingInterval) {
        clearInterval(callPollingInterval);
        setCallPollingInterval(null);
      }
    } catch (error) {
          }
    
    setIsCallActive(false);
    setCurrentCall(null);
  };

  // 🔥 REDIRIGIR AL VIDEOCHAT (igual que en mensajes)
  const redirigirAVideochat = (callData) => {
    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    
    localStorage.setItem('roomName', callData.room_name);
    localStorage.setItem('userName', userData.name || userData.alias || 'Chica');
    localStorage.setItem('currentRoom', callData.room_name);
    localStorage.setItem('inCall', 'true');
    
    setIsCallActive(false);
    setCurrentCall(null);
    
    if (callPollingInterval) {
      clearInterval(callPollingInterval);
      setCallPollingInterval(null);
    }
    
    // Solo para modelos (no hay clientes aquí)
    navigate('/videochat', {
      state: {
        roomName: callData.room_name,
        userName: userData.name || userData.alias || 'Chica',
        callId: callData.call_id || callData.id,
        from: 'call'
      }
    });
  };

  // 🔥 FUNCIÓN PARA CARGAR FAVORITOS
  const loadFavorites = async () => {
    try {
      setLoading(true);
      setError(null);

      const authToken = localStorage.getItem('token');
      if (!authToken) {
        setError(t('favorites.noSession'));
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/favorites/list`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        setFavoritos(data.favorites || []);
      } else {
        throw new Error(data.error || t('favorites.errorLoading'));
      }

    } catch (err) {
            setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 🔥 FUNCIÓN PARA ELIMINAR FAVORITO
  const eliminarFavorito = async (favoriteId, nombre) => {
    try {
      setProcessingAction(favoriteId);
            
      const authToken = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/favorites/remove`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          favorite_user_id: favoriteId
        })
      });

      const data = await response.json();

      if (data.success) {
        // Remover de la lista local
        setFavoritos(prev => prev.filter(fav => fav.id !== favoriteId));
        setOpcionesAbiertas(null);
      } else {
              }
    } catch (error) {
          } finally {
      setProcessingAction(null);
    }
  };

  // 🔥 FUNCIÓN PARA BLOQUEAR USUARIO
  const bloquearUsuario = async (favoriteId, nombre, reason = "Bloqueado desde favoritas") => {
  try {
    setProcessingAction(favoriteId);
          
    const authToken = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/api/blocks/block-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        blocked_user_id: favoriteId,
        reason: reason
      })
    });

    const data = await response.json();

    if (data.success) {
      setFavoritos(prev => prev.filter(fav => fav.id !== favoriteId));
      setOpcionesAbiertas(null);
      
      if (showBloqueadosModal) {
        cargarUsuariosBloqueados();
      }
    } else {
          }
  } catch (error) {
      } finally {
    setProcessingAction(null);
    setShowBlockModal(false); // Cierra el modal si estaba abierto
  }
  };

  const BlockConfirmModal = ({ isOpen, onClose, userData, onConfirm, loading }) => {
    const [blockReason, setBlockReason] = useState("Comportamiento inapropiado");
  
    if (!isOpen || !userData) return null;
  
    const reasons = [
      t('favorites.blocking.reasons.inappropriate'),
      t('favorites.blocking.reasons.offensive'),
      t('favorites.blocking.reasons.spam'),
      t('favorites.blocking.reasons.requests'),
      t('favorites.blocking.reasons.terms'),
      t('favorites.blocking.reasons.other')
    ];
  
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
        <div className="bg-gradient-to-b from-[#0a0d10] to-[#131418] border border-[#ff007a]/30 rounded-2xl shadow-2xl w-full max-w-md transform animate-fadeIn">
          
          {/* Header */}
          <div className="p-6 border-b border-[#ff007a]/20">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-[#ff007a]/20 rounded-full flex items-center justify-center">
                <Ban size={24} className="text-[#ff007a]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{t('favorites.blocking.title')}</h3>
                <p className="text-[#ff007a] text-sm">{userData.name}</p>
              </div>
            </div>
            <p className="text-white/70 text-sm">
              {t('favorites.blocking.confirmMessage')}
            </p>
          </div>
  
          {/* Contenido */}
          <div className="p-6">
            <div className="mb-4">
              <label className="block text-white text-sm font-medium mb-3">
                {t('favorites.blocking.selectReason')}
              </label>
              <div className="space-y-2">
                {reasons.map((reason) => (
                  <label key={reason} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-white/5 rounded-lg transition-colors">
                    <input
                      type="radio"
                      name="blockReason"
                      value={reason}
                      checked={blockReason === reason}
                      onChange={(e) => setBlockReason(e.target.value)}
                      className="w-4 h-4 text-[#ff007a] focus:ring-[#ff007a] focus:ring-2"
                    />
                    <span className="text-white/80 text-sm">{reason}</span>
                  </label>
                ))}
              </div>
            </div>
  
            {/* Consecuencias */}
            <div className="bg-[#ff007a]/10 border border-[#ff007a]/30 rounded-lg p-3 mb-4">
              <h4 className="text-[#ff007a] font-medium text-sm mb-2">{t('favorites.blocking.consequences')}</h4>
              <ul className="text-[#ff007a]/90 text-xs space-y-1">
                <li>• {t('favorites.blocking.consequencesList.noMessages')}</li>
                <li>• {t('favorites.blocking.consequencesList.noCalls')}</li>
                <li>• {t('favorites.blocking.consequencesList.removedFromFavorites')}</li>
                <li>• {t('favorites.blocking.consequencesList.noOnlineStatus')}</li>
              </ul>
            </div>
          </div>
  
          {/* Botones */}
          <div className="p-6 border-t border-[#ff007a]/20 flex gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 bg-[#1e1e25] hover:bg-[#2c2c33] text-white px-4 py-3 rounded-xl transition-colors disabled:opacity-50 font-medium"
            >
              {t('favorites.actions.cancel')}
            </button>
            <button
              onClick={() => onConfirm(blockReason)}
              disabled={loading}
              className="flex-1 bg-[#ff007a] hover:bg-[#e6006f] text-white px-4 py-3 rounded-xl transition-colors disabled:opacity-50 font-medium flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  {t('favorites.blocking.blocking')}
                </>
              ) : (
                <>
                  <Ban size={16} />
                   {t('favorites.blocking.title')}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 🔥 FUNCIÓN PARA INICIAR CHAT CON FAVORITO - SOLO VA A /mensajes
  const iniciarChatConFavorito = async (favoriteId, nombre) => {
    try {
      setProcessingAction(favoriteId);
      
      // 🔥 IR A /mensajes CON EL PARÁMETRO
      navigate('/mensajes', {
        state: {
          openChatWith: {
            userId: favoriteId,
            userName: nombre,
            userRole: 'modelo' // Los favoritas de las modelos son clientes
          }
        }
      });
      
    } catch (error) {
            alert(t('favorites.calls.connectionError'));
    } finally {
      setProcessingAction(null);
    }
  };

  // 🔥 FUNCIÓN PARA FORMATEAR FECHA
  const formatearFecha = (fechaString) => {
    if (!fechaString) return 'Fecha desconocida';
        
    const fecha = new Date(fechaString);
    const ahora = new Date();
    const diffTime = Math.abs(ahora - fecha);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
    if (diffDays === 1) return t('favorites.dates.addedDays', { days: 1 });
    if (diffDays < 7) return t('favorites.dates.addedDaysPlural', { days: 'número' });
    if (diffDays < 30) return t('favorites.dates.addedWeeks', { weeks: 'número' });
    return t('favorites.dates.addedOn', { date: 'fecha' });
  };

  // 🔥 CERRAR OPCIONES AL HACER CLIC FUERA
  useEffect(() => {
    const handleClickOutside = () => {
      setOpcionesAbiertas(null);
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  // 🔥 CLEANUP AL DESMONTAR (como en mensajes)
  useEffect(() => {
    return () => {
      if (callPollingInterval) {
        clearInterval(callPollingInterval);
      }
    };
  }, []);

  // 🔥 RENDER LOADING
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0d10] to-[#131418] text-white p-6">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff007a] mx-auto mb-4"></div>
            <p className="text-gray-400">{t('favorites.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  // 🔥 RENDER ERROR
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0d10] to-[#131418] text-white p-6">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h3 className="text-xl font-bold mb-2">{t('favorites.errorLoading')}</h3>
            <p className="text-gray-400 mb-4">{error}</p>
            <button
              onClick={loadFavorites}
              className="bg-[#ff007a] hover:bg-[#e6006e] px-6 py-2 rounded-lg flex items-center gap-2 mx-auto"
            >
              <RefreshCw size={16} />
              {t('favorites.retry')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0d10] to-[#131418] text-white p-6">
      {/* Header */}
      <Header />
            
      {/* Título y estadísticas */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-[#ff007a] flex items-center gap-2">
            <Heart size={24} />
            {t('favorites.title')}
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            {favoritas.length} {favoritas.length === 1 ? t('favorites.count') : t('favorites.countPlural')}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* 🔥 BOTÓN PARA VER USUARIOS BLOQUEADOS */}
          <button
            onClick={() => {
              setShowBloqueadosModal(true);
              cargarUsuariosBloqueados();
            }}
            className="bg-[#2b2d31] hover:bg-[#373a40] text-red-400 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Ban size={16} />
            {t('favorites.blockedUsers.title')}
          </button>
          
          <button
            onClick={loadFavorites}
            disabled={loading}
            className="bg-[#2b2d31] hover:bg-[#373a40] px-4 py-2 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
             {t('favorites.refresh')}
          </button>
        </div>
      </div>

      {/* Lista de favoritas */}
      {favoritas.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">💝</div>
          <h3 className="text-xl font-bold mb-2">{t('favorites.noFavorites')}</h3>
          <p className="text-gray-400 mb-6">{t('favorites.noFavoritesDesc')}</p>
          <button
            onClick={() => navigate('/esperandocall')}
            className="bg-[#ff007a] hover:bg-[#e6006e] px-6 py-3 rounded-lg flex items-center gap-2 mx-auto"
          >
            <Users size={16} />
            {t('favorites.searchUsers')}
          </button>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {favoritas.map((fav) => {
            const estadoConexion = obtenerEstadoConexion(fav.id);
            
            return (
              <div
                key={fav.id}
                className="bg-[#1f2125] rounded-xl p-5 shadow-lg border border-[#ff007a]/10 relative hover:border-[#ff007a]/30 transition-colors"
              >
                {/* Parte superior */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-12 h-12 bg-[#ff007a] rounded-full flex items-center justify-center font-bold text-black text-lg">
                        {fav.name.charAt(0).toUpperCase()}
                      </div>
                      {/* 🔥 INDICADOR DE ESTADO ONLINE MEJORADO */}
                      <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#1f2125] ${
                        estadoConexion.estado === 'online' ? 'bg-green-500 animate-pulse' :
                        estadoConexion.estado === 'recent' ? 'bg-yellow-400' :
                        estadoConexion.estado === 'minutes' ? 'bg-orange-400' :
                        estadoConexion.estado === 'hours' ? 'bg-orange-500' :
                        'bg-gray-500'
                      }`} />
                    </div>
                    <div>
                      <p className="font-semibold text-base">{fav.name}</p>
                      <p className={`text-sm flex items-center gap-1 ${estadoConexion.color}`}>
                        {estadoConexion.estado === 'online' && <span className="animate-pulse">●</span>}
                        {estadoConexion.texto}
                      </p>
                    </div>
                  </div>

                  {/* Botón de opciones */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpcionesAbiertas(opcionesAbiertas === fav.id ? null : fav.id);
                      }}
                      className="text-white/50 hover:text-white p-1 hover:bg-[#3a3d44] rounded-lg transition-colors"
                      disabled={processingAction === fav.id}
                    >
                      {processingAction === fav.id ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      ) : (
                        <MoreVertical size={20} />
                      )}
                    </button>

                    {opcionesAbiertas === fav.id && (
                      <div className="absolute right-0 mt-2 bg-[#2b2d31] border border-[#ff007a]/30 rounded-xl shadow-xl w-48 z-50">
                        <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedUserToBlock({ id: fav.id, name: fav.name });
                          setShowBlockModal(true); // Abre el modal
                        }}
                        className="flex items-center w-full px-4 py-2 gap-2 hover:bg-[#373a40] text-sm text-red-400 rounded-t-xl"
                      >
                        <Ban size={16} />
                        {t('favorites.actions.block')}
                      </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            eliminarFavorito(fav.id, fav.name);
                          }}
                          className="flex items-center w-full px-4 py-2 gap-2 hover:bg-[#373a40] text-sm rounded-b-xl"
                        >
                          <Trash2 size={16} />
                          {t('favorites.actions.removeFromFavorites')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Nota del favorito */}
                {fav.note && (
                  <p className="text-white/70 text-sm italic mb-3 bg-[#2b2d31] p-2 rounded">
                    "{fav.note}"
                  </p>
                )}

                {/* Fecha agregado */}
                <p className="text-gray-500 text-xs mb-4 flex items-center gap-1">
                  <Clock size={12} />
                  {formatearFecha(fav.created_at)}
                </p>

                {/* Botones */}
                <div className="flex gap-3">
                  <button
                    onClick={() => iniciarChatConFavorito(fav.id, fav.name)}
                    disabled={processingAction === fav.id}
                    className="flex-1 bg-[#ff007a] hover:bg-[#e6006e] text-white px-3 py-2 rounded-full text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                  >
                    {processingAction === fav.id ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <MessageSquare size={14} />
                        {t('favorites.actions.chat')}
                      </>
                    )}
                  </button>
                  {/* 🔥 BOTÓN DE LLAMAR SIEMPRE DISPONIBLE */}
                  <button
                    className="flex-1 bg-[#2b2d31] hover:bg-[#373a40] text-white/80 px-3 py-2 rounded-full text-sm flex items-center justify-center gap-1"
                    onClick={() => iniciarLlamadaReal(fav.id, fav.name)}
                    disabled={processingAction === fav.id}
                  >
                    <Video size={14} />
                    {t('favorites.actions.call')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 🔥 OVERLAYS DE LLAMADAS (igual que en mensajes) */}
      <CallingSystem
        isVisible={isCallActive}
        callerName={currentCall?.name}
        onCancel={cancelarLlamada}
        callStatus={currentCall?.status || 'initiating'}
      />

      <IncomingCallOverlay
        isVisible={isReceivingCall}
        callData={incomingCall}
      />

      {/* 🔥 MODAL DE USUARIOS BLOQUEADOS */}
      {showBloqueadosModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-[#1f2125] border border-[#ff007a]/30 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden">
            {/* Header del modal */}
            <div className="p-6 border-b border-[#ff007a]/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Ban size={24} className="text-[#ff007a]" />
                  <div>
                    <h3 className="text-lg font-bold text-white">{t('favorites.blockedUsers.title')}</h3>
                    <p className="text-gray-400 text-sm mt-1">
                      {usuariosBloqueados.length} {usuariosBloqueados.length === 1 ? t('favorites.blockedUsers.count') : t('favorites.blockedUsers.countPlural')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowBloqueadosModal(false)}
                  className="text-white/60 hover:text-white p-2 hover:bg-[#3a3d44] rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            
            {/* Contenido del modal */}
            <div className="p-6 overflow-y-auto max-h-[calc(85vh-140px)]">
              {loadingBloqueados ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff007a] mx-auto mb-3"></div>
                    <p className="text-gray-400">{t('favorites.blockedUsers.loading')}</p>
                  </div>
                </div>
              ) : usuariosBloqueados.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🛡️</div>
                  <h4 className="text-xl font-bold mb-2">{t('favorites.blockedUsers.noBlocked')}</h4>
                  <p className="text-gray-400">{t('favorites.blockedUsers.noBlockedDesc')}</p>
                </div>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3">
                  {usuariosBloqueados.map((user) => (
                    <div
                      key={user.id}
                      className="bg-[#2b2d31] rounded-xl p-5 shadow-lg border border-[#ff007a]/10 relative hover:border-[#ff007a]/30 transition-colors"
                    >
                      {/* Chica info */}
                      <div className="flex items-center gap-3 mb-4">
                        <div className="relative">
                          <div className="w-12 h-12 bg-gradient-to-br from-[#ff007a] to-[#cc0062] rounded-full flex items-center justify-center font-bold text-white text-lg">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          {/* Indicador de bloqueado */}
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#2b2d31] bg-red-500 flex items-center justify-center">
                            <Ban size={10} className="text-white" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-base text-white">{user.name}</p>
                          <p className="text-red-400 text-sm flex items-center gap-1">
                            <Ban size={12} />
                            Bloqueado
                          </p>
                        </div>
                      </div>

                      {/* Motivo */}
                      {user.reason && (
                        <div className="bg-[#1a1c20] p-3 rounded-lg mb-3 border border-[#ff007a]/10">
                          <p className="text-[#ff007a] text-xs font-medium mb-1">{t('favorites.blockedUsers.blockedReason')}</p>
                          <p className="text-white/70 text-sm italic">"{user.reason}"</p>
                        </div>
                      )}

                      {/* Fecha */}
                      <p className="text-gray-500 text-xs mb-4 flex items-center gap-1">
                        <Clock size={12} />
                        {(() => {
                          const fecha = new Date(user.created_at);
                          const ahora = new Date();
                          const diffTime = Math.abs(ahora - fecha);
                          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                          const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
                          const diffMinutes = Math.ceil(diffTime / (1000 * 60));
                          
                          if (diffMinutes < 60) return t('favorites.blockedUsers.blockedAgo', { time: 'tiempo' });
                          if (diffHours < 24) return `Bloqueado hace ${diffHours}h`;
                          if (diffDays < 7) return `Bloqueado hace ${diffDays}d`;
                          return `Bloqueado ${fecha.toLocaleDateString()}`;
                        })()}
                      </p>

                      {/* Botón desbloquear */}
                      <button
                        onClick={() => desbloquearUsuarioModal(user.id, user.name)}
                        disabled={processingAction === user.id}
                        className="w-full bg-[#ff007a] hover:bg-[#e6006e] text-white px-3 py-2 rounded-full text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                      >
                        {processingAction === user.id ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            {t('favorites.blocking.unblocking')}
                          </>
                        ) : (
                          <>
                            <Shield size={14} />
                            {t('favorites.actions.unblock')}
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Footer del modal */}
            {usuariosBloqueados.length > 0 && (
              <div className="p-4 border-t border-[#ff007a]/20 bg-[#1a1c20]">
                <p className="text-gray-400 text-xs">
                  {t('favorites.blockedUsers.tip')}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 🔥 MODAL DE CONFIRMACIÓN */}
      {showConfirmModal && confirmAction && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-[#1f2125] border border-[#ff007a]/30 rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-bold text-white mb-3">{confirmAction.title}</h3>
              <p className="text-gray-300 mb-6">{confirmAction.message}</p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 bg-[#2b2d31] hover:bg-[#373a40] text-white px-4 py-2 rounded-lg transition-colors"
                >
                  {t('favorites.actions.cancel')}
                </button>
                {confirmAction.type !== 'blocked' && confirmAction.type !== 'error' && (
                  <button
                    onClick={confirmAction.action}
                    className={`flex-1 px-4 py-2 rounded-lg transition-colors text-white ${
                      confirmAction.type === 'block' 
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-[#ff007a] hover:bg-[#e6006e]'
                    }`}
                  >
                    {confirmAction.confirmText}
                  </button>
                )}
                {(confirmAction.type === 'blocked' || confirmAction.type === 'error') && (
                  <button
                    onClick={confirmAction.action}
                    className="flex-1 bg-[#ff007a] hover:bg-[#e6006e] text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    {confirmAction.confirmText}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      <BlockConfirmModal
        isOpen={showBlockModal}
        onClose={() => setShowBlockModal(false)}
        userData={selectedUserToBlock}
        loading={loadingBlock}
        onConfirm={async (motivo) => {
          if (!selectedUserToBlock) return;
          setLoadingBlock(true);
          await bloquearUsuario(selectedUserToBlock.id, selectedUserToBlock.name, motivo);
          setLoadingBlock(false);
        }}
      />

    </div>
  );
}
