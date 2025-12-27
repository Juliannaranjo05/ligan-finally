// components/StoriesModal.jsx - Modal para que CLIENTES vean historias de MODELOS
import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Eye, 
  Heart, 
  Phone, 
  MessageSquare, 
  Clock, 
  Play,
  Pause,
  Volume2,
  VolumeX,
  ChevronLeft,
  ChevronRight,
  User,
  Loader,
  Star,
  CheckCircle,
  RotateCcw // 👈 AGREGAR ESTE IMPORT
} from 'lucide-react';
import { useAppNotifications } from '../../contexts/NotificationContext';
import CallingSystem from '../CallingOverlay';
import IncomingCallOverlay from '../IncomingCallOverlay';
import axios from '../../api/axios';
import { useTranslation } from 'react-i18next';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const StoriesModal = ({ 
  isOpen, 
  onClose, 
  currentUser // Usuario actual (cliente)
}) => {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [storyDuration, setStoryDuration] = useState(5000);
  
  // Estados de interacciones
  const [hasLiked, setHasLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [viewsCount, setViewsCount] = useState(0);
  
  // Estados para llamadas
  const [isCallActive, setIsCallActive] = useState(false);
  const [currentCall, setCurrentCall] = useState(null);
  const [isReceivingCall, setIsReceivingCall] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [callPollingInterval, setCallPollingInterval] = useState(null);
  
  const videoRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const storyTimeoutRef = useRef(null);
  const notifications = useAppNotifications();

  const DEFAULT_STORY_DURATION = 5000; // 5 segundos para imágenes
  const MAX_VIDEO_DURATION = 15000; // 15 segundos máximo para videos
  const { t } = useTranslation();

  // 🔄 Cargar historias de modelos al abrir el modal
  useEffect(() => {
    if (isOpen) {
      loadStories();
      setCurrentStoryIndex(0);
      setProgress(0);
    } else {
      // Limpiar cuando se cierre
      stopStoryProgress();
      setStories([]);
    }
  }, [isOpen]);

  // 🔄 Manejar cambio de historia actual
  useEffect(() => {
    if (stories.length > 0 && currentStoryIndex < stories.length) {
      const currentStory = stories[currentStoryIndex];
      loadStoryData(currentStory);
      startStoryProgress();
      
      // Registrar vista automáticamente
      registerStoryView(currentStory.id);
    }
  }, [currentStoryIndex, stories]);

  // 🔄 Cleanup al cerrar
  useEffect(() => {
    return () => {
      stopStoryProgress();
      if (callPollingInterval) {
        clearInterval(callPollingInterval);
      }
    };
  }, []);

  // 📱 Cargar historias activas de modelos
  const loadStories = async () => {
    try {
      setLoading(true);
      
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/stories/active`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (response.data && response.data.length > 0) {
        setStories(response.data);
      } else {
        setStories([]);
        notifications.info(t('storiesModal.noStoriesAvailable'));
      }
    } catch (error) {
            notifications.error("Error al cargar las historias");
      setStories([]);
    } finally {
      setLoading(false);
    }
  };

  // 📊 Cargar datos específicos de la historia actual
  const loadStoryData = (story) => {
    console.log({
      storyId: story.id,
      views_count: story.views_count,
      likes_count: story.likes_count,
      storyObject: story
    });
    
    // Usar los valores del objeto story que viene del servidor
    const views = story.views_count || 0;
    const likes = story.likes_count || 0;
    
    console.log({
      views,
      likes,
      storyLikesCount: story.likes_count,
      storyViewsCount: story.views_count
    });
    
    setViewsCount(views);
    setLikesCount(likes);
    
    // Verificar si el usuario ya dio like (esto requeriría un endpoint adicional)
    checkIfUserLiked(story.id);
    
    // Establecer duración según el tipo de contenido
    if (story.mime_type?.startsWith('video/')) {
      // Para videos, intentar obtener duración real
      if (videoRef.current) {
        videoRef.current.onloadedmetadata = () => {
          const duration = Math.min(videoRef.current.duration * 1000, MAX_VIDEO_DURATION);
          setStoryDuration(duration);
        };
      } else {
        setStoryDuration(MAX_VIDEO_DURATION);
      }
    } else {
      setStoryDuration(DEFAULT_STORY_DURATION);
    }
  };

  // ❤️ Verificar si el usuario ya dio like
  const checkIfUserLiked = async (storyId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/stories/${storyId}/like-status`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      setHasLiked(response.data.has_liked || false);
    } catch (error) {
            setHasLiked(false);
    }
  };

  // 👁️ Registrar vista de historia
  const registerStoryView = async (storyId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/api/stories/${storyId}/view`, {}, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      // Actualizar contador local
      setViewsCount(prev => prev + 1);
    } catch (error) {
          }
  };

  // ❤️ Manejar like/unlike
  const handleLike = async () => {
    if (stories.length === 0) return;
    
    const currentStory = stories[currentStoryIndex];

      try {
        const token = localStorage.getItem('token');
        const endpoint = hasLiked ? 'unlike' : 'like';
        const url = `${API_BASE_URL}/api/stories/${currentStory.id}/${endpoint}`;

        const response = await axios.post(url, {}, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });

        if (response.data.has_liked !== undefined) {
          setHasLiked(response.data.has_liked);
        } else {
          setHasLiked(!hasLiked);
        }
      
      // Usar el contador del servidor si está disponible, sino hacer cálculo local
      if (response.data.likes_count !== undefined) {
        setLikesCount(response.data.likes_count);
        
        // Actualizar también el array de stories para mantener sincronización
        setStories(prevStories => 
          prevStories.map(story => 
            story.id === currentStory.id 
              ? { ...story, likes_count: response.data.likes_count }
              : story
          )
        );
      } else {
        const newCount = hasLiked ? likesCount - 1 : likesCount + 1;
        setLikesCount(newCount);
        
        // Actualizar también el array de stories
        setStories(prevStories => 
          prevStories.map(story => 
            story.id === currentStory.id 
              ? { ...story, likes_count: newCount }
              : story
          )
        );
      }
      
      if (!hasLiked) {
        notifications.success(t('storiesModal.likedStory'));
      }
    } catch (error) {
      console.error('handleLike error', error);
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          t('storiesModal.errorProcessingReaction');
      notifications.error(errorMessage);
    }
  };

  // ⏯️ Control de reproducción
  const startStoryProgress = () => {
    stopStoryProgress(); // Limpiar anterior
    setProgress(0);
    setIsPlaying(true);
    
    const interval = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev + (100 / (storyDuration / 100));
        
        if (newProgress >= 100) {
          // Historia completada, NO auto-avanzar automáticamente
          stopStoryProgress();
          return 100;
        }
        
        return newProgress;
      });
    }, 100);
    
    progressIntervalRef.current = interval;
    
    // 🔧 REMOVIDO: Auto-avanzar después de la duración
    // Ya no avanza automáticamente, el usuario debe hacer clic
  };

  const stopStoryProgress = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    
    if (storyTimeoutRef.current) {
      clearTimeout(storyTimeoutRef.current);
      storyTimeoutRef.current = null;
    }
    
    setIsPlaying(false);
  };

  const pauseStory = () => {
    if (isPlaying) {
      stopStoryProgress();
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
      }
    } else {
      startStoryProgress();
      if (videoRef.current && videoRef.current.paused) {
        videoRef.current.play();
      }
    }
  };

  // 🔄 Navegación entre historias
  const nextStory = () => {
    if (currentStoryIndex < stories.length - 1) {
      setCurrentStoryIndex(prev => prev + 1);
    } else {
      // Última historia, mostrar opción de cerrar o reiniciar
      setCurrentStoryIndex(0); // Reiniciar desde el principio
    }
  };

  const previousStory = () => {
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex(prev => prev - 1);
    } else {
      // Primera historia, ir a la última
      setCurrentStoryIndex(stories.length - 1);
    }
  };

  // 📞 Iniciar llamada con la modelo
  const handleCall = async () => {
    if (stories.length === 0) return;
    
    const currentStory = stories[currentStoryIndex];
    const modelo = currentStory.user;
    // Obtener el nombre a mostrar (nickname o name)
    const modeloDisplayName = modelo?.display_name || modelo?.nickname || modelo?.name || 'Usuario';
    
    try {
      // 💰 VERIFICAR SALDO ANTES DE INICIAR LLAMADA
      const token = localStorage.getItem('token');
      const balanceResponse = await fetch(`${API_BASE_URL}/api/videochat/coins/balance`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (balanceResponse.ok) {
        const balanceData = await balanceResponse.json();
        if (balanceData.success && !balanceData.can_start_call) {
          // ❌ NO TIENE SALDO SUFICIENTE - CERRAR MODAL Y REDIRIGIR
          notifications.error(t('storiesModal.insufficientBalance') || 'No tienes saldo suficiente para llamar');
          onClose();
          setTimeout(() => {
            window.location.href = '/buy-minutes';
          }, 1000);
          return;
        }
      }
            
      // Pausar historia durante la llamada
      stopStoryProgress();
      
      setCurrentCall({
        ...modelo,
        status: 'initiating'
      });
      setIsCallActive(true);
      
      const response = await fetch(`${API_BASE_URL}/api/calls/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          receiver_id: modelo.id,
          call_type: 'video'
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
                
        setCurrentCall({
          ...modelo,
          callId: data.call_id,
          roomName: data.room_name,
          status: 'calling'
        });
        
        // Iniciar polling para verificar estado de la llamada
        startCallPolling(data.call_id);
        
        notifications.success(t('storiesModal.callingUser', { name: modeloDisplayName }));
        
      } else {
        setIsCallActive(false);
        setCurrentCall(null);
        
        // 🔥 DETECTAR ERRORES ESPECÍFICOS
        const errorMessage = data.error || data.message || '';
        const isBalanceError = errorMessage.toLowerCase().includes('saldo') || 
                              errorMessage.toLowerCase().includes('balance') ||
                              errorMessage.toLowerCase().includes('insufficient') ||
                              errorMessage.toLowerCase().includes('coins');
        
        if (isBalanceError) {
          notifications.error(t('storiesModal.insufficientBalance') || 'No tienes saldo suficiente para llamar');
          onClose();
          setTimeout(() => {
            window.location.href = '/buy-minutes';
          }, 1000);
          return;
        }
        
        if (data.error && data.error.includes('bloqueado')) {
          notifications.warning(t('storiesModal.cannotCallUser'));
        } else {
          notifications.error(t('storiesModal.callStartError'));
        }
        
        // Reanudar historia
        startStoryProgress();
      }
      
    } catch (error) {
      setIsCallActive(false);
      setCurrentCall(null);
      
      // 🔥 DETECTAR ERRORES DE SALDO EN LA EXCEPCIÓN
      const errorMessage = error.message || '';
      const isBalanceError = errorMessage.toLowerCase().includes('saldo') || 
                            errorMessage.toLowerCase().includes('balance') ||
                            errorMessage.toLowerCase().includes('insufficient') ||
                            errorMessage.toLowerCase().includes('coins');
      
      if (isBalanceError) {
        notifications.error(t('storiesModal.insufficientBalance') || 'No tienes saldo suficiente para llamar');
        onClose();
        setTimeout(() => {
          window.location.href = '/buy-minutes';
        }, 1000);
        return;
      }
      
      notifications.error('Error al iniciar llamada');
      
      // Reanudar historia
      startStoryProgress();
    }
  };

  // 📞 Polling para verificar estado de llamada
  const startCallPolling = (callId) => {
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
            // Llamada aceptada, redirigir a videochat
            clearInterval(interval);
            setCallPollingInterval(null);
            redirectToVideoChat(data.call);
            
          } else if (callStatus === 'rejected') {
            // Llamada rechazada
            clearInterval(interval);
            setCallPollingInterval(null);
            setIsCallActive(false);
            setCurrentCall(null);
            notifications.warning(t('storiesModal.callRejected'));
            startStoryProgress(); // Reanudar historia
            
          } else if (callStatus === 'cancelled') {
            // Llamada cancelada por timeout
            clearInterval(interval);
            setCallPollingInterval(null);
            setIsCallActive(false);
            setCurrentCall(null);
            notifications.warning(t('storiesModal.callExpired'));
            startStoryProgress(); // Reanudar historia
          }
        }
        
      } catch (error) {
              }
    }, 2000);
    
    setCallPollingInterval(interval);
    
    // Timeout después de 35 segundos
    setTimeout(() => {
      if (interval) {
        clearInterval(interval);
        setCallPollingInterval(null);
        if (isCallActive) {
          setIsCallActive(false);
          setCurrentCall(null);
          notifications.warning(t('storiesModal.timeoutExpired'));
          startStoryProgress(); // Reanudar historia
        }
      }
    }, 35000);
  };

  // 📞 Cancelar llamada
  const cancelCall = async () => {
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
      
      if (callPollingInterval) {
        clearInterval(callPollingInterval);
        setCallPollingInterval(null);
      }
      
    } catch (error) {
          }
    
    setIsCallActive(false);
    setCurrentCall(null);
    
    // Reanudar historia
    startStoryProgress();
  };

  // 🚀 Redirigir al videochat
  const redirectToVideoChat = (callData) => {
        
    // Cerrar modal de historias
    onClose();
    
    // Guardar datos de la sala
    localStorage.setItem('roomName', callData.room_name);
    localStorage.setItem('userName', currentUser?.name || 'Cliente');
    localStorage.setItem('currentRoom', callData.room_name);
    localStorage.setItem('inCall', 'true');
    localStorage.setItem('videochatActive', 'true');
    
    setIsCallActive(false);
    setCurrentCall(null);
    
    if (callPollingInterval) {
      clearInterval(callPollingInterval);
      setCallPollingInterval(null);
    }
    
    // Navegar al videochat del cliente
    window.location.href = '/videochatclient';
  };

  // 💬 Abrir chat con la modelo
  const handleMessage = () => {
    if (stories.length === 0) return;
    
    const currentStory = stories[currentStoryIndex];
    const modelo = currentStory.user;
    
        
    // Cerrar modal de historias
    onClose();
    
    // Obtener el nombre a mostrar (nickname o name)
    const modeloDisplayName = modelo?.display_name || modelo?.nickname || modelo?.name || 'Usuario';
    
    // Navegar al chat con estado para abrir conversación específica
    window.location.href = `/mensajes?openChatWith=${modelo.id}&userName=${encodeURIComponent(modeloDisplayName)}&userRole=${modelo.role || 'modelo'}`;
  };

  // 🎨 Obtener inicial del nombre
  const getInitial = (name) => {
    return name ? name.charAt(0).toUpperCase() : '?';
  };

  // 📱 Renderizado principal
  if (!isOpen) return null;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-[#1f2125] rounded-2xl p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff007a] mx-auto mb-4"></div>
          <p className="text-white">{t('storiesModal.loadingStories')}</p>
        </div>
      </div>
    );
  }

  if (stories.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-[#1f2125] rounded-2xl p-8 text-center max-w-sm">
          <User className="w-16 h-16 text-white/20 mx-auto mb-4" />
          <h3 className="text-white font-bold text-lg mb-2">{t('storiesModal.noStoriesTitle')}</h3>
          <p className="text-white/70 text-sm mb-6">
            {t('storiesModal.noStoriesAvailable')}
          </p>
          <button
            onClick={onClose}
            className="bg-[#ff007a] hover:bg-[#e6006e] text-white px-6 py-2 rounded-lg font-semibold transition-colors"
          >
            {t('storiesModal.close')}
          </button>
        </div>
      </div>
    );
  }

  const currentStory = stories[currentStoryIndex];
  const isVideo = currentStory?.mime_type?.startsWith('video/');
  const fileUrl = currentStory?.file_url?.startsWith('http') 
    ? currentStory.file_url 
    : `${API_BASE_URL}${currentStory.file_url}`;
  
  // Debug: verificar datos del usuario actual
  if (currentStory?.user) {
      console.log({
        id: currentStory.user.id,
        name: currentStory.user.name,
        display_name: currentStory.user.display_name,
        nickname: currentStory.user.nickname,
        willShow: currentStory.user.display_name || currentStory.user.nickname || currentStory.user.name
      });
  }

  return (
    <>
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
        {/* 🔄 CONTENEDOR PRINCIPAL CENTRADO - 70% ANCHO EN DESKTOP, 100% EN MÓVIL */}
        <div className="w-full md:w-[70%] h-full flex flex-col">
          {/* Header con información de la modelo */}
          <div className="flex items-center justify-between p-4">
            {/* Info de la modelo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#ff007a] flex items-center justify-center font-bold text-sm">
                {getInitial(currentStory.user?.display_name || currentStory.user?.nickname || currentStory.user?.name)}
              </div>
              <div>
                <p className="text-white font-semibold text-sm">
                  {currentStory.user?.display_name || currentStory.user?.nickname || currentStory.user?.name || 'Usuario'}
                </p>
                <p className="text-white/60 text-xs">
                  {new Date(currentStory.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Botón cerrar */}
            <button
              onClick={onClose}
              className="w-10 h-10 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Barra de progreso */}
          <div className="flex gap-1 px-4 mb-4">
            {stories.map((_, index) => (
              <div
                key={index}
                className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden"
              >
                <div
                  className={`h-full bg-white transition-all duration-100 ${
                    index === currentStoryIndex ? 'opacity-100' : 
                    index < currentStoryIndex ? 'opacity-100 w-full' : 'opacity-30 w-0'
                  }`}
                  style={{
                    width: index === currentStoryIndex ? `${progress}%` : 
                          index < currentStoryIndex ? '100%' : '0%'
                  }}
                />
              </div>
            ))}
          </div>

          {/* 📱 CONTENIDO: HISTORIA + PANEL LATERAL (RESPONSIVE) */}
          <div className="flex flex-col md:flex-row flex-1">
            {/* HISTORIA - OCUPA EL ESPACIO PRINCIPAL */}
            <div className="flex-1 relative">
              {/* Área clickeable para pausa/play */}
              <div
                className="absolute inset-x-12 inset-y-0 z-5"
                onClick={pauseStory}
              />

              {/* BOTONES DE NAVEGACIÓN */}
              <button
                onClick={previousStory}
                className="absolute left-2 top-1/2 transform -translate-y-1/2 w-12 h-12 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-black/80 transition-all duration-200 z-20"
              >
                <ChevronLeft className="w-6 h-6 text-white" strokeWidth={2} />
              </button>

              <button
                onClick={nextStory}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 w-12 h-12 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-black/80 transition-all duration-200 z-20"
              >
                <ChevronRight className="w-6 h-6 text-white" strokeWidth={2} />
              </button>

              {/* BOTÓN PARA SALTAR HISTORIA COMPLETADA - RESPONSIVE */}
              {progress >= 100 && (
                <div className="absolute bottom-8 md:bottom-8 left-1/2 transform -translate-x-1/2 z-20">
                  <button
                    onClick={nextStory}
                    className="bg-[#ff007a] hover:bg-[#e6006e] text-white px-4 py-2 rounded-full font-semibold shadow-lg transition-all duration-200 hover:scale-105 flex items-center gap-2 text-sm"
                  >
                    {currentStoryIndex < stories.length - 1 ? (
                      <>
                        {t('storiesModal.next')} <ChevronRight className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        {t('storiesModal.restart')} <RotateCcw className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Contenido multimedia */}
              <div className="w-full h-full flex items-center justify-center bg-black md:rounded-l-lg overflow-hidden">
                {isVideo ? (
                  <video
                    ref={videoRef}
                    src={fileUrl}
                    className="w-full h-full object-cover"
                    autoPlay
                    muted={isMuted}
                    loop={false}
                    onEnded={() => {
                      stopStoryProgress();
                      setProgress(100);
                    }}
                    onLoadedMetadata={() => {
                      if (videoRef.current) {
                        const duration = Math.min(videoRef.current.duration * 1000, MAX_VIDEO_DURATION);
                        setStoryDuration(duration);
                      }
                    }}
                  />
                ) : (
                  <img
                    src={fileUrl}
                    alt="Historia"
                    className="w-full h-full object-cover"
                  />
                )}
              </div>

              {/* Indicador de pausa */}
              {!isPlaying && progress < 100 && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <div className="w-16 h-16 bg-black/70 backdrop-blur-sm rounded-full flex items-center justify-center">
                    <Play className="w-8 h-8 text-white ml-1" />
                  </div>
                </div>
              )}

              {/* Mensaje cuando la historia termina */}
              {progress >= 100 && !isVideo && (
                <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/30">
                  <div className="text-center text-white">
                    <CheckCircle className="w-12 h-12 mx-auto mb-3 text-[#ff007a]" />
                    <p className="text-lg font-semibold mb-1">{t('storiesModal.storyViewed')}</p>
                    <p className="text-sm opacity-80">{t('storiesModal.tapNextToContinue')}</p>
                  </div>
                </div>
              )}
            </div>

            {/* 📱 PANEL CON ACCIONES - LATERAL EN DESKTOP, ABAJO EN MÓVIL */}
            <div className="
              w-full h-20 md:w-20 md:h-full 
              bg-black/50 backdrop-blur-sm 
              flex flex-row md:flex-col 
              items-center justify-center md:justify-center
              gap-4 md:gap-6 
              border-t md:border-t-0 md:border-l border-white/10 
              md:rounded-r-lg
              px-4 md:px-0
            ">
              {/* 📱 LAYOUT MÓVIL: HORIZONTAL */}
              <div className="md:hidden flex items-center justify-between w-full">
                {/* Controles de video */}
                {isVideo && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMuted(!isMuted);
                      if (videoRef.current) {
                        videoRef.current.muted = !isMuted;
                      }
                    }}
                    className="w-12 h-12 bg-black/70 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-black/80 transition-colors"
                  >
                    {isMuted ? (
                      <VolumeX className="w-5 h-5 text-white" />
                    ) : (
                      <Volume2 className="w-5 h-5 text-white" />
                    )}
                  </button>
                )}

                {/* Estadísticas móvil */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <Eye className="w-4 h-4 text-blue-400" />
                    <span className="text-white text-xs font-semibold">{viewsCount}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Heart className={`w-4 h-4 ${hasLiked ? 'text-red-500 fill-red-500' : 'text-white/60'}`} />
                    <span className="text-white text-xs font-semibold">{likesCount}</span>
                  </div>
                </div>

                {/* Botones de acción móvil */}
                <div className="flex items-center gap-2">
                  {/* Botón de like */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLike();
                    }}
                    className={`w-10 h-10 rounded-full transition-all duration-200 flex items-center justify-center ${
                      hasLiked 
                        ? 'bg-red-500/20 border border-red-500/40' 
                        : 'bg-white/10 hover:bg-white/20 border border-white/20'
                    }`}
                  >
                    <Heart 
                      className={`w-5 h-5 ${
                        hasLiked ? 'text-red-500 fill-red-500' : 'text-white'
                      }`} 
                    />
                  </button>

                  {/* Botón de mensaje */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMessage();
                    }}
                    className="w-10 h-10 bg-[#2b2d31] hover:bg-[#373a3f] rounded-full flex items-center justify-center transition-colors border border-[#ff007a]/30"
                  >
                    <MessageSquare className="w-4 h-4 text-[#ff007a]" />
                  </button>

                  {/* Botón de llamada */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCall();
                    }}
                    disabled={isCallActive}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                      isCallActive
                        ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed'
                        : 'bg-[#ff007a] hover:bg-[#e6006e] text-white'
                    }`}
                  >
                    <Phone className="w-5 h-5" />
                  </button>
                </div>

                {/* Indicador de posición móvil */}
                <div className="bg-black/70 backdrop-blur-sm rounded-full px-2 py-1">
                  <span className="text-white text-xs font-mono">
                    {currentStoryIndex + 1}/{stories.length}
                  </span>
                </div>
              </div>

              {/* 🖥️ LAYOUT DESKTOP: VERTICAL */}
              <div className="hidden md:flex md:flex-col md:items-center md:gap-6">
                {/* Controles de video */}
                {isVideo && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMuted(!isMuted);
                      if (videoRef.current) {
                        videoRef.current.muted = !isMuted;
                      }
                    }}
                    className="w-12 h-12 bg-black/70 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-black/80 transition-colors"
                  >
                    {isMuted ? (
                      <VolumeX className="w-5 h-5 text-white" />
                    ) : (
                      <Volume2 className="w-5 h-5 text-white" />
                    )}
                  </button>
                )}

                {/* Estadísticas desktop */}
                <div className="text-center">
                  <div className="flex flex-col items-center gap-1 mb-3">
                    <Eye className="w-5 h-5 text-blue-400" />
                    <span className="text-white text-xs font-semibold">{viewsCount}</span>
                  </div>
                  
                  <div className="flex flex-col items-center gap-1">
                    <Heart className={`w-5 h-5 ${hasLiked ? 'text-red-500 fill-red-500' : 'text-white/60'}`} />
                    <span className="text-white text-xs font-semibold">{likesCount}</span>
                  </div>
                </div>

                {/* Botón de like */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLike();
                  }}
                  className={`w-12 h-12 rounded-full transition-all duration-200 flex items-center justify-center ${
                    hasLiked 
                      ? 'bg-red-500/20 border border-red-500/40' 
                      : 'bg-white/10 hover:bg-white/20 border border-white/20'
                  }`}
                >
                  <Heart 
                    className={`w-6 h-6 ${
                      hasLiked ? 'text-red-500 fill-red-500' : 'text-white'
                    }`} 
                  />
                </button>

                {/* Botón de mensaje */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMessage();
                  }}
                  className="w-12 h-12 bg-[#2b2d31] hover:bg-[#373a3f] rounded-full flex items-center justify-center transition-colors border border-[#ff007a]/30"
                >
                  <MessageSquare className="w-5 h-5 text-[#ff007a]" />
                </button>

                {/* Botón de llamada */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCall();
                  }}
                  disabled={isCallActive}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                    isCallActive
                      ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed'
                      : 'bg-[#ff007a] hover:bg-[#e6006e] text-white'
                  }`}
                >
                  <Phone className="w-5 h-5" />
                </button>

                {/* Indicador de posición */}
                <div className="bg-black/70 backdrop-blur-sm rounded-full px-2 py-1">
                  <span className="text-white text-xs font-mono">
                    {currentStoryIndex + 1}/{stories.length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Overlays de llamadas */}
      <CallingSystem
        isVisible={isCallActive}
        callerName={currentCall?.display_name || currentCall?.nickname || currentCall?.name}
        callerAvatar={currentCall?.avatar}
        onCancel={cancelCall}
        callStatus={currentCall?.status || 'initiating'}
      />

      <IncomingCallOverlay
        isVisible={isReceivingCall}
        callData={incomingCall}
        onAnswer={() => {}} // Manejar llamadas entrantes si es necesario
        onDecline={() => {}} // Manejar llamadas entrantes si es necesario
      />
    </>
  );
};

export default StoriesModal;
