import React, { useState, useEffect, useRef } from 'react';
import { Heart, ChevronDown, HelpCircle, Menu } from 'lucide-react';
import pruebahistorias from './imagenes/pruebahistorias.png';
import logoproncipal from './imagenes/logoprincipal.png';
import LoginLigand from "./verificacion/login/loginligand";
import Register from "./verificacion/register/register";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Play, X, User, MessageCircle, Gift, Video } from "lucide-react";
import api from '../api/axios';
import { useTranslation } from 'react-i18next';
import LanguageSelector from "../components/languageSelector";
import { useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiddenLoginModal } from "../components/admin/HiddenLoginModal.jsx";
import SessionSuspendedModal from "./SessionSuspendedModal";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// 🔥 VERIFICAR SI HAY SESIÓN ACTIVA Y REDIRIGIR
const checkActiveSession = (navigate) => {
  const token = localStorage.getItem('token');
  const roomName = localStorage.getItem('roomName');
  const videochatActive = localStorage.getItem('videochatActive');
  const inCall = localStorage.getItem('inCall');
  const callEndedManually = localStorage.getItem('call_ended_manually');
  
  // Si hay sesión activa y NO se finalizó manualmente, verificar con backend
  if (token && roomName && (videochatActive === 'true' || inCall === 'true') && callEndedManually !== 'true') {
    // Verificar con backend si la sesión sigue activa
    fetch(`${API_BASE_URL}/api/heartbeat/check-user-status`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        const activeSession = data.sessions?.find(
          session => session.room_name === roomName && 
                    (session.status === 'active' || session.status === 'waiting')
        );
        
        if (activeSession) {
          // Hay sesión activa, redirigir a videochat
          const userName = localStorage.getItem('userName');
          const userRole = data.user_role || 'cliente';
          const videochatRoute = userRole === 'cliente' ? '/videochatclient' : '/videochat';
          
          if (userName) {
            navigate(`${videochatRoute}?roomName=${encodeURIComponent(roomName)}&userName=${encodeURIComponent(userName)}`, { replace: true });
          } else {
            navigate(videochatRoute, { replace: true });
          }
        }
      }
    })
    .catch(() => {
      // En caso de error, no hacer nada
    });
  }
};

// Componente de selector de idioma mejorado para móvil
const MobileLanguageSelector = () => {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  
  const languages = [
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'pt', name: 'Português', flag: '🇧🇷' }
  ];

  const handleLanguageChange = (langCode) => {
    // 🔥 GUARDAR EN TODAS LAS CLAVES PARA COMPATIBILIDAD
    localStorage.setItem("lang", langCode);
    localStorage.setItem("selectedLanguage", langCode);
    localStorage.setItem("userPreferredLanguage", langCode);
    
    // 🔥 CAMBIAR IDIOMA EN i18n
    i18n.changeLanguage(langCode);
    
    setIsOpen(false);
  };

  const currentLang = languages.find(lang => lang.code === i18n.language) || languages[0];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-fucsia/10 border border-fucsia/30 rounded-lg text-fucsia hover:bg-fucsia/20 transition-colors min-w-[100px]"
      >
        <span className="text-sm">{currentLang.flag}</span>
        <span className="text-sm font-medium">{currentLang.name}</span>
        <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-2 w-full bg-gray-800 border border-fucsia/30 rounded-lg shadow-lg z-50 min-w-[140px]">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-fucsia/20 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                  lang.code === i18n.language ? 'bg-fucsia/10' : ''
                }`}
              >
                <span>{lang.flag}</span>
                <span className="text-white text-sm">{lang.name}</span>
                {lang.code === i18n.language && (
                  <span className="ml-auto text-fucsia text-xs">✓</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// Componente para el menú dropdown móvil
const MobileDropdownMenu = ({ onHelpClick }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    { 
      label: t('idioma'), 
      action: () => {}, 
      isLanguageSelector: true
    },
    { 
      label: t('ayuda'), 
      action: () => {},
      isHelp: true
    }
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 bg-fucsia rounded-lg flex items-center justify-center hover:bg-pink-600 transition-colors"
      >
        <Menu size={20} className="text-white" />
      </button>
      
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full right-0 mt-2 w-48 bg-gray-800 border border-fucsia/30 rounded-lg shadow-lg z-50">
            {menuItems.map((item, index) => (
              <div key={index} className="first:rounded-t-lg last:rounded-b-lg">
                {item.isLanguageSelector ? (
                  <div className="px-3 py-2 border-b border-gray-700">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-white text-sm font-medium">{item.label}:</span>
                    </div>
                    <MobileLanguageSelector />
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      if (item.isHelp && onHelpClick) {
                        onHelpClick();
                      }
                    }}
                    className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-fucsia/20 transition-colors text-white"
                  >
                    <HelpCircle size={18} />
                    <span className="text-sm">{item.label}</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default function ParlandomChatApp() {
  const { t, i18n } = useTranslation();
  const [showHelpModal, setShowHelpModal] = useState(false);
  
  // Configurar el título y favicon de la página
useEffect(() => {
  document.title = "Ligando";
  
  // Usar la imagen del logo como favicon
  const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
  link.type = 'image/png';
  link.rel = 'shortcut icon';
  link.href = logoproncipal; // Usar la imagen importada
  document.getElementsByTagName('head')[0].appendChild(link);
}, []);

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const savedLang = localStorage.getItem("lang");
    if (savedLang && savedLang !== i18n.language) {
      i18n.changeLanguage(savedLang);
    }
  }, []);

  // 🔥 VERIFICAR SI HAY SESIÓN ACTIVA Y REDIRIGIR (NO PERMITIR ESTAR EN /home SI HAY SESIÓN)
  useEffect(() => {
    checkActiveSession(navigate);
  }, [navigate]);
  const [loading, setLoading] = useState(true);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const hasChecked = useRef(false);

  const auth = searchParams.get("auth");
  const showLogin = auth === "login";
  const showRegister = auth === "register";
  const [currentIndex, setCurrentIndex] = useState(0);
  const [expandedIndex, setExpandedIndex] = useState(null);
  const intervalRef = useRef(null);
  const [historias, setHistorias] = useState([]);
  const [loadingHistorias, setLoadingHistorias] = useState(true);

  const cargarHistorias = async () => {
    try {
      setLoadingHistorias(true);
            
      const historiasPrueba = [
        { 
          id: 'prueba1', 
          nombre: "Mía", 
          estado: "activa", // 🔄 SIEMPRE ACTIVA
          img: pruebahistorias, 
          image: pruebahistorias,
          mime_type: 'image/jpeg',
          source_type: 'upload'
        },
        { 
          id: 'prueba2', 
          nombre: "Emilia", 
          estado: "activa", // 🔄 SIEMPRE ACTIVA
          img: pruebahistorias, 
          image: pruebahistorias,
          mime_type: 'image/jpeg',
          source_type: 'upload'
        },
        { 
          id: 'prueba3', 
          nombre: "Valentina", 
          estado: "activa", // 🔄 SIEMPRE ACTIVA
          img: pruebahistorias, 
          image: pruebahistorias,
          mime_type: 'image/jpeg',
          source_type: 'upload'
        },
        { 
          id: 'prueba4', 
          nombre: "Sofía", 
          estado: "activa", // 🔄 SIEMPRE ACTIVA
          img: pruebahistorias, 
          image: pruebahistorias,
          mime_type: 'image/jpeg',
          source_type: 'upload'
        },
        { 
          id: 'prueba5', 
          nombre: "Camila", 
          estado: "activa", // 🔄 SIEMPRE ACTIVA
          img: pruebahistorias, 
          image: pruebahistorias,
          mime_type: 'image/jpeg',
          source_type: 'upload'
        }
      ];
      
      try {
        const response = await api.get('/api/stories', {
          timeout: 10000
        });
        const historiasData = response.data.map(story => ({
          id: story.id,
          nombre: story.user?.display_name || story.user?.nickname || story.user?.name || 'Usuario',
          estado: "activa", // 🔄 SIEMPRE MOSTRAR COMO ACTIVA
          img: story.file_path ? `${API_BASE_URL}/storage/${story.file_path}` : pruebahistorias,
          image: story.file_path ? `${API_BASE_URL}/storage/${story.file_path}` : pruebahistorias,
          mime_type: story.mime_type,
          source_type: story.source_type,
          created_at: story.created_at,
          expires_at: story.expires_at,
          user_id: story.user_id
        }));
        
        let historiasFinales = [...historiasData];
        
        if (historiasFinales.length < 3) {
          const historiasNecesarias = 3 - historiasFinales.length;
          const historiasPruebaAUsar = historiasPrueba.slice(0, historiasNecesarias);
          historiasFinales = [...historiasFinales, ...historiasPruebaAUsar];
                  }
        
        setHistorias(historiasFinales);
              } catch (apiError) {
                setHistorias(historiasPrueba);
      }
      
    } catch (error) {
            setHistorias([]);
    } finally {
      setLoadingHistorias(false);
    }
  };

  useEffect(() => {
    cargarHistorias();
  }, []);

  const visibleCards = 3;
  const delayMs = 5000;

  useEffect(() => {
    if (expandedIndex === null && historias.length > 0) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % historias.length);
      }, delayMs);
    }
    return () => clearInterval(intervalRef.current);
  }, [expandedIndex, historias.length]);

  const handleExpand = (index) => {
    setExpandedIndex(index);
    clearInterval(intervalRef.current);
    document.body.style.overflow = 'hidden';
  };

  const handleClose = () => {
        setExpandedIndex(null);
    document.body.style.overflow = 'auto';
    
    setTimeout(() => {
      if (expandedIndex === null) {
                intervalRef.current = setInterval(() => {
          setCurrentIndex((prevIndex) => {
            const newIndex = (prevIndex + 1) % historias.length;
                        return newIndex;
          });
        }, 5000);
      }
    }, 100);
  };

  useEffect(() => {
    clearInterval(intervalRef.current);
    
    if (expandedIndex === null) {
            intervalRef.current = setInterval(() => {
        setCurrentIndex((prevIndex) => {
          const newIndex = (prevIndex + 1) % historias.length;
                    return newIndex;
        });
      }, 5000);
    } else {
          }

    return () => {
            clearInterval(intervalRef.current);
    };
  }, [expandedIndex]);

  const getVisibleHistorias = () => {
    if (historias.length === 0) return [];
    
    const start = currentIndex;
    const end = start + visibleCards;
    
    if (end <= historias.length) {
      return historias.slice(start, end);
    } else {
      const firstPart = historias.slice(start);
      const remaining = visibleCards - firstPart.length;
      const secondPart = historias.slice(0, remaining);
      return [...firstPart, ...secondPart];
    }
  };

  const visibleHistorias = getVisibleHistorias();

  useEffect(() => {
    const videos = document.querySelectorAll('video[data-carousel="true"]');
    videos.forEach((video) => {
      video.currentTime = 0;
      video.play().catch(() => {});
    });
  }, [currentIndex, expandedIndex, historias]);

  // 🔥 VERIFICACIÓN TEMPRANA: Verificar sesión inmediatamente si hay token
  useEffect(() => {
    const checkUserAndRedirect = async () => {
      if (hasChecked.current) {
        return;
      }

      try {
        hasChecked.current = true;
        
        // 🔥 PASO 1: Verificar si hay token en localStorage
        const token = localStorage.getItem('token');
        
        // Si NO hay token, mostrar landing page inmediatamente
        if (!token || token.trim() === '') {
          setIsCheckingSession(false);
          setLoading(false);
          return;
        }

        // 🔥 PASO 2: Si hay token, verificar sesión inmediatamente
        try {
          // Si acabamos de registrar, NO redirigir desde aquí, dejar que RegistrationProtectedPage maneje
          // NO limpiar la bandera aquí, dejarla para que useRegistrationAccess la maneje
          if (localStorage.getItem("just_registered") === "true") {
            setIsCheckingSession(false);
            setLoading(false);
            return;
          }

          // Si acabamos de verificar email, NO redirigir desde aquí
          if (localStorage.getItem("email_just_verified") === "true") {
            setIsCheckingSession(false);
            setLoading(false);
            return;
          }

          const res = await api.get(`${API_BASE_URL}/api/profile`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          const user = res.data.user;

          // 🔥 Si hay usuario válido, redirigir según rol SIN mostrar landing
          if (user && user.id) {
            const sessionRoomName = localStorage.getItem('roomName');
            const sessionUserName = localStorage.getItem('userName');

            // Verificar si hay sesión de videochat activa
            if (sessionRoomName && sessionRoomName !== 'null' && sessionRoomName !== 'undefined') {
              if (user.rol === "cliente") {
                navigate(`/videochatclient?roomName=${sessionRoomName}&userName=${sessionUserName}`, { replace: true });
                return;
              } else if (user.rol === "modelo") {
                navigate(`/videochatclient?roomName=${sessionRoomName}&userName=${sessionUserName}`, { replace: true });
                return;
              }
            }

            // Verificar perfil completo
            if (!user.rol || !user.name) {
              navigate("/genero", { replace: true });
              return;
            }

            // 🔄 Verificar si hay una acción pendiente de historias
            const pendingAction = localStorage.getItem('pendingStoryAction');
            if (pendingAction) {
              try {
                const actionData = JSON.parse(pendingAction);
                
                // Limpiar la acción pendiente
                localStorage.removeItem('pendingStoryAction');
                
                // Ejecutar la acción pendiente
                if (user.rol === "cliente") {
                  if (actionData.action === 'chat') {
                    // Generar room_name (mismo formato que usa el backend)
                    const currentUserId = user.id || user.user?.id;
                    const otherUserId = actionData.userId;
                    const roomName = [currentUserId, otherUserId].sort().join('_');
                    
                    const chatData = {
                      other_user_id: otherUserId,
                      other_user_name: actionData.userName || 'Usuario',
                      other_user_display_name: actionData.userName || 'Usuario',
                      other_user_role: 'modelo',
                      room_name: roomName,
                      createdLocally: true,
                      needsSync: true
                    };
                    
                    // Redirigir al chat con la chica usando navigate con estado
                    navigate({
                      pathname: '/message',
                      search: `?user=${encodeURIComponent(actionData.userName || 'Usuario')}`,
                      state: {
                        openChatWith: chatData
                      }
                    }, { replace: true });
                    return;
                  } else if (actionData.action === 'videocall') {
                    // Verificar balance y luego iniciar llamada o redirigir a compra
                    verificarBalanceYEjecutarAccion(actionData);
                    return;
                  }
                }
              } catch (error) {
                localStorage.removeItem('pendingStoryAction');
              }
            }
            
            // 🎯 REDIRECCIÓN INMEDIATA POR ROL
            if (user.rol === "cliente") {
              navigate("/homecliente", { replace: true });
              return;
            }

            if (user.rol === "modelo") {
              const estado = user.verificacion?.estado;
              
              switch (estado) {
                case null:
                case undefined:
                case "rechazada":
                  navigate("/anteveri", { replace: true });
                  break;
                case "pendiente":
                  navigate("/esperando", { replace: true });
                  break;
                case "aprobada":
                  navigate("/homellamadas", { replace: true });
                  break;
                default:
                  navigate("/anteveri", { replace: true });
              }
              return;
            }
          }
        } catch (apiError) {
          // Si la verificación falla (token inválido, 401, etc.), mostrar landing
          // Limpiar token inválido si es necesario
          if (apiError.response?.status === 401 || apiError.response?.status === 403) {
            try {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
            } catch (e) {
              // Ignorar errores de localStorage
            }
          }
        }

        // Si llegamos aquí, no hay sesión activa válida, mostrar landing
        setIsCheckingSession(false);
        setLoading(false);

      } catch (error) {
        // Cualquier otro error, mostrar landing page
        if (error.response?.status === 429) {
          setIsCheckingSession(false);
          setLoading(false);
          return;
        }
        
        setIsCheckingSession(false);
        setLoading(false);
      }
    };

    if (!hasChecked.current) {
      checkUserAndRedirect();
    }
  }, [navigate]);

  const todasLasChicas = [
    "Ana", "Lucía", "Sofía", "Camila", "Valentina", "Isabela", "Mía", "Emilia"
  ];
  const [startIndex, setStartIndex] = useState(0);

  const chicasMostradas = [
    todasLasChicas[startIndex % todasLasChicas.length],
    todasLasChicas[(startIndex + 1) % todasLasChicas.length],
    todasLasChicas[(startIndex + 2) % todasLasChicas.length],
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setStartIndex((prev) => (prev + 1) % todasLasChicas.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleButtonClick = async (action, historia) => {
    const token = localStorage.getItem('token');
    const isAuthenticated = !!token;
    
    // Si no está autenticado, guardar acción pendiente y redirigir a login/register
    if (!isAuthenticated) {
      const pendingAction = {
        action, // 'chat' o 'videocall'
        userId: historia?.user_id,
        userName: historia?.nombre,
        timestamp: Date.now()
      };
      
      localStorage.setItem('pendingStoryAction', JSON.stringify(pendingAction));
      
      // Redirigir a registro (o login según prefieras)
      navigate("/home?auth=register");
      return;
    }
    
    // Usuario autenticado - ejecutar acción directamente
    if (action === 'chat') {
      handleChatAction(historia);
    } else if (action === 'videocall') {
      await handleVideoCallAction(historia);
    }
  };
  
  // 💬 Manejar acción de chat
  const handleChatAction = (historia) => {
    
    if (!historia?.user_id) {
      return;
    }
    
    // Cerrar modal de historia si está abierto
    if (expandedIndex !== null) {
      handleClose();
    }
    
    // Obtener el usuario actual para generar el room_name
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const currentUserId = user?.id || user?.user?.id;
    const otherUserId = historia.user_id;
    
    if (!currentUserId || !otherUserId) {
      // Si no hay usuario autenticado, guardar acción pendiente
      const pendingAction = {
        action: 'chat',
        userId: otherUserId,
        userName: historia.nombre || 'Usuario',
        timestamp: Date.now()
      };
      localStorage.setItem('pendingStoryAction', JSON.stringify(pendingAction));
      navigate("/home?auth=register");
      return;
    }
    
    // Generar room_name (mismo formato que usa el backend)
    const roomName = [currentUserId, otherUserId].sort().join('_');
    
    const chatData = {
      other_user_id: otherUserId,
      other_user_name: historia.nombre || 'Usuario',
      other_user_display_name: historia.nombre || 'Usuario',
      other_user_role: 'modelo',
      room_name: roomName,
      createdLocally: true,
      needsSync: true
    };
    
    // Navegar al chat con la chica usando navigate con estado
    navigate({
      pathname: '/message',
      search: `?user=${encodeURIComponent(historia.nombre || 'Usuario')}`,
      state: {
        openChatWith: chatData
      }
    });
  };
  
  // 📹 Manejar acción de videollamada
  const handleVideoCallAction = async (historia) => {
    
    if (!historia?.user_id) {
      return;
    }
    
    try {
      // Verificar balance del usuario
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/videochat/coins/balance`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.success && data.can_start_call) {
          // ✅ Tiene saldo suficiente - iniciar llamada directa a la chica
          
          // Cerrar modal de historia si está abierto
          if (expandedIndex !== null) {
            handleClose();
          }
          
          // Iniciar llamada directa a la chica
          await iniciarLlamadaDirecta(historia.user_id);
          
        } else {
          // ❌ No tiene saldo suficiente - redirigir a comprar minutos
          
          // Cerrar modal de historia si está abierto
          if (expandedIndex !== null) {
            handleClose();
          }
          
          // Redirigir a la página de compra de minutos/coins
          navigate('/homecliente?action=buy-coins');
        }
      } else {
        // En caso de error, también redirigir a compra
        navigate('/homecliente?action=buy-coins');
      }
    } catch (error) {
      navigate('/homecliente?action=buy-coins');
    }
  };
  
  // 🔄 Verificar balance y ejecutar acción pendiente
  const verificarBalanceYEjecutarAccion = async (actionData) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/videochat/coins/balance`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.success && data.can_start_call) {
          // ✅ Tiene saldo - iniciar llamada directa
          await iniciarLlamadaDirecta(actionData.userId);
        } else {
          // ❌ No tiene saldo - redirigir a compra
          navigate('/homecliente?action=buy-coins');
        }
      } else {
        navigate('/homecliente?action=buy-coins');
      }
    } catch (error) {
      navigate('/homecliente?action=buy-coins');
    }
  };
  
  // 📞 Iniciar llamada directa a una chica específica
  const iniciarLlamadaDirecta = async (modeloUserId) => {
    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_BASE_URL}/api/calls/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          receiver_id: modeloUserId,
          call_type: 'video'
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.success && data.room_name) {
          // Guardar datos de la sala
          localStorage.setItem('roomName', data.room_name);
          localStorage.setItem('userName', data.receiver?.name || 'Cliente');
          localStorage.setItem('currentRoom', data.room_name);
          localStorage.setItem('inCall', 'true');
          localStorage.setItem('videochatActive', 'true');
          
          // Redirigir al videochat
          window.location.href = '/videochatclient';
        } else {
          // Mostrar error o redirigir a espera
          navigate('/esperandocallcliente');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        navigate('/esperandocallcliente');
      }
    } catch (error) {
      navigate('/esperandocallcliente');
    }
  };

  // 🔥 NO mostrar contenido mientras se verifica la sesión
  // Si hay sesión activa, el useEffect redirigirá antes de llegar aquí
  if (isCheckingSession || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p className="text-white/80 mt-4">
            {isCheckingSession ? "Verificando sesión..." : "Cargando..."}
          </p>
        </div>
      </div>
    );
  }

  // 🔥 Solo mostrar historias si ya terminó la verificación de sesión
  if (loadingHistorias && !isCheckingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p className="text-white/80 mt-4">
            Cargando historias...
          </p>
        </div>
      </div>
    );
  }

  if (!loadingHistorias && historias.length === 0) {
      }

  return (
    <>
      <SessionSuspendedModal />
    <div className="bg-ligand-mix-dark h-screen flex flex-col px-2 sm:px-4">
      {/* Header para escritorio */}
      <header className="hidden sm:flex justify-between items-center p-3 gap-0 flex-shrink-0">
        <div className="flex items-center space-x-3">
          <span className="text-[19px] font-semibold" style={{ color: '#ff007a' }}>
            {t('idioma')}:
          </span>
          <LanguageSelector />
        </div>

        <div className="flex items-center justify-center">
          <img src={logoproncipal} alt="Logo" className="w-16 h-16" />
          <span className="text-2xl text-zorrofucsia font-pacifico ml-[-5px]">Ligando</span>
        </div>

        <div className="flex items-center space-x-4">
          <button
            className="border text-white bg-fucsia border-fucsia px-4 py-2 rounded-lg hover:bg-pink-600 transition-colors text-base"
            onClick={() => navigate("/home?auth=login")}
          >
            {t('iniciarSesion')}
          </button>
          <button 
            onClick={() => setShowHelpModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#ff007a] text-white rounded-lg hover:bg-pink-600 transition text-base"
          >
            <HelpCircle size={20} />
            {t('ayuda')}
          </button>
        </div>
      </header>

      {/* Header para móvil - EXACTO COMO EN LA IMAGEN */}
      <header className="flex sm:hidden justify-between items-center p-3 sm:p-4 flex-shrink-0">
        {/* Logo + Ligand */}
        <div className="flex items-center">
          <img src={logoproncipal} alt="Logo" className="w-7 h-7 sm:w-8 sm:h-8 mr-1.5 sm:mr-2" />
          <span className="text-base sm:text-lg text-zorrofucsia font-pacifico ml-[-3px] sm:ml-[-5px]">Ligando</span>
        </div>

        {/* Iniciar Sesión + Selector de Idioma */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            className="bg-fucsia text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg hover:bg-pink-600 transition-colors font-medium text-xs sm:text-sm"
            onClick={() => navigate("/home?auth=login")}
          >
            {t('iniciarSesion')}
          </button>
          
          <LanguageSelector />
        </div>
      </header>
      {/* Contenido principal */}
      <div className="flex flex-col lg:flex-row items-start justify-between py-2 sm:py-3 md:py-4 lg:py-6 max-w-7xl mx-auto gap-0 sm:gap-2 md:gap-4 lg:gap-8 xl:gap-10 flex-1 overflow-y-auto px-2 sm:px-4 main-content-container">
        {/* Lado Izquierdo */}
        <div className="w-full lg:max-w-lg">
          <div className="text-center mb-4 sm:mb-5 md:mb-6 lg:mb-8">
            <h1 className="font-pacifico text-fucsia text-[3.5rem] sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl 2xl:text-11xl leading-tight sm:leading-none bg-backgroundDark rounded-lg px-4 sm:px-5 md:px-6 lg:px-4 inline-block">Ligando</h1>
            <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl text-pink-200 mt-3 sm:mt-4 md:mt-5 lg:mt-[30px] font-semibold italic px-2 break-words">{t('frasePrincipal')}</p>
          </div>

          <div className="text-center mb-4 sm:mb-5 md:mb-6">
            <button
              className="w-full max-w-[320px] sm:max-w-md md:max-w-sm mx-auto py-3.5 sm:py-4 md:py-3 lg:py-4 px-6 sm:px-7 md:px-6 lg:px-8 rounded-full text-white font-bold text-lg sm:text-xl md:text-xl lg:text-xl bg-fucsia hover:bg-fucsia-400 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
              onClick={() => navigate("/home?auth=register")}
            >
              {t('comenzar')}
            </button>
          </div>

          <div className="text-center mb-4 sm:mb-5 md:mb-6 lg:mb-8 px-2">
            <p className="text-white text-base sm:text-lg md:text-base lg:text-lg leading-relaxed">
              {t('subtitulo')}
            </p>
          </div>

          <div className="flex justify-center items-center space-x-4 sm:space-x-5 md:space-x-6 px-2 mb-0 sm:mb-1 md:mb-2 lg:mb-0">
            {['Femenino', 'Masculino'].map((gender) => (
              <label key={gender} className="flex items-center cursor-pointer group">
                <div className="relative">
                  <input type="radio" name="gender" value={gender.toLowerCase()} className="sr-only" />
                  <div className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 rounded-full border-2 border-gray-400 group-hover:border-red-400 flex items-center justify-center transition-all duration-200" />
                </div>
                <span className="ml-1.5 sm:ml-2 md:ml-3 text-xs sm:text-sm md:text-base lg:text-lg font-medium text-gray-300 transition-colors duration-200">
                  {t(`genero.${gender.toLowerCase()}`)}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Lado derecho */}
        <div className="w-full lg:ml-16 -mt-1 sm:mt-0 md:mt-1 lg:mt-0">
          <div className="text-center text-white italic text-base sm:text-lg md:text-xl lg:text-3xl mb-0 sm:mb-1 md:mb-2 lg:mb-6 font-semibold px-2">
            {t(`chicasRelevantes`)}
          </div>

          {/* Carrusel mejorado */}
          {historias.length > 0 ? (
            <div className="bg-gradient-to-b flex items-center justify-center">
              <div className="relative w-full max-w-full overflow-hidden py-0 sm:py-0 md:py-1 lg:py-8 px-2 sm:px-4">
                <motion.div 
                  className="flex justify-center gap-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5 }}
                >
                  <AnimatePresence mode="popLayout">
                    {visibleHistorias.map((historia, index) => {
                      const realIndex = historias.findIndex(h => h.id === historia.id);
                      const isCenter = index === 1;
                      const isExpanded = expandedIndex === realIndex;

                      return (
                        <motion.div
                          key={historia.id}
                          className={`relative cursor-pointer rounded-2xl overflow-hidden shadow-lg flex-shrink-0 ${
                            isExpanded
                              ? "z-50 fixed inset-0 w-screen h-screen rounded-none bg-black/40 backdrop-blur-md"
                              : "w-[100px] sm:w-[120px] md:w-[140px] lg:w-[160px] xl:w-[180px] aspect-[9/16]"
                          } ${
                            isCenter && !isExpanded
                              ? "border-4 border-fuchsia-500 box-content"
                              : ""
                          } ${
                            expandedIndex !== null && !isExpanded
                              ? "blur-sm pointer-events-none"
                              : ""
                          }`}
                          onClick={() => !isExpanded && isCenter && handleExpand(realIndex)}
                          
                          layout
                          layoutId={`card-${historia.id}`}
                          
                          initial={{ 
                            x: 150,
                            opacity: 0,
                            scale: 0.8
                          }}
                          animate={{ 
                            x: 0,
                            opacity: isCenter ? 1 : 0.6,
                            scale: isExpanded ? 1 : isCenter ? 1.1 : 0.95
                          }}
                          exit={{ 
                            x: -150,
                            opacity: 0,
                            scale: 0.8
                          }}
                          
                          transition={{
                            layout: {
                              type: "spring",
                              stiffness: 400,
                              damping: 30,
                              mass: 0.8
                            },
                            x: { 
                              type: "spring",
                              stiffness: 300,
                              damping: 25,
                              duration: 0.6
                            },
                            scale: {
                              type: "spring", 
                              stiffness: 400,
                              damping: 25,
                              duration: 0.4
                            },
                            opacity: { 
                              duration: 0.3,
                              ease: "easeInOut"
                            }
                          }}
                          
                          whileHover={!isExpanded && isCenter ? { 
                            scale: 1.15,
                            transition: { 
                              type: "spring",
                              stiffness: 400,
                              damping: 25,
                              duration: 0.2
                            }
                          } : {}}
                          
                          whileTap={!isExpanded && isCenter ? { 
                            scale: 1.05,
                            transition: { duration: 0.1 }
                          } : {}}

                          style={isExpanded ? {
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            zIndex: 50,
                            width: '100vw',
                            height: '100vh'
                          } : {}}
                        >
                          {!isExpanded ? (
                            <motion.div
                              className="rounded-3xl shadow-2xl overflow-hidden"
                              style={{
                                width: 'min(100%, 70vw)',
                                aspectRatio: '9/16',
                                minWidth: '100%',
                                height: 'auto'
                              }}
                            >
                              {historia.mime_type?.startsWith("video") ? (
                                <video
                                  key={`video-${historia.id}-${currentIndex}`}
                                  src={historia.image}
                                  className="w-full h-full object-cover"
                                  muted
                                  playsInline
                                  autoPlay
                                  loop
                                  preload="metadata"
                                  data-carousel="true"
                                  data-historia-id={historia.id}
                                />
                              ) : (
                                <img
                                  src={historia.image}
                                  alt={historia.nombre}
                                  className="w-full h-full object-cover"
                                />
                              )}

                              <div className="absolute top-3 right-3 text-xs md:text-sm px-2 md:px-3 py-1 rounded-full font-semibold bg-green-500 text-white">
                                {t('activa')}
                              </div>
                            </motion.div>
                          ) : (
                            // Vista expandida (modal) - OPTIMIZADA PARA MÓVIL
                            <motion.div
                              className="relative w-full h-full flex items-center justify-centeroverflow-hidden"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ duration: 0.7 }}
                            >
                              <button
                                className="absolute top-4 right-4 text-white bg-black/60 p-2 rounded-full hover:bg-black/80 transition-all duration-300 z-50 backdrop-blur-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  handleClose();
                                }}
                              >
                                <X size={20} />
                              </button>

                              <div className="flex items-center justify-center w-full h-full gap-4 px-4 md:px-8 flex-col lg:flex-row py-4">
                                <motion.div 
                                  className="relative flex-shrink-0"
                                  style={{
                                    width: 'min(75vw, 280px)',
                                    height: 'min(55vh, 420px)',
                                    aspectRatio: '9/16'
                                  }}
                                >
                                  <div className="w-full h-full rounded-xl overflow-hidden shadow-2xl">
                                    {historia.mime_type?.startsWith("video") ? (
                                      <video
                                        key={`modal-video-${historia.id}`}
                                        src={historia.image}
                                        className="w-full h-full object-cover"
                                        muted
                                        playsInline
                                        autoPlay
                                        loop
                                        preload="metadata"
                                      />
                                    ) : (
                                      <img
                                        src={historia.image}
                                        alt={historia.nombre}
                                        className="w-full h-full object-cover"
                                      />
                                    )}

                                    <div className="absolute bottom-3 right-3 z-40 text-xs px-2 py-1 rounded-full font-semibold bg-green-600 text-white">
                                      {t('activa')}
                                    </div>

                                    <div className="absolute bottom-3 left-3 text-white text-sm font-bold bg-black/60 px-2 py-1 rounded-lg backdrop-blur-sm">
                                      {historia.nombre}
                                    </div>
                                  </div>
                                </motion.div>

                                <motion.div
                                  className="text-white space-y-3 max-w-xs w-full px-2 lg:px-0"
                                  initial={{ opacity: 0, x: 50 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ 
                                    duration: 0.6, 
                                    ease: "easeOut",
                                    delay: 0.4
                                  }}
                                >
                                  <motion.div 
                                    className="text-xl lg:text-4xl font-bold text-center text-fucsia mb-4"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.6, duration: 0.5 }}
                                  >
                                    {historia.nombre}
                                  </motion.div>
                                  
                                  <motion.div 
                                    className="grid grid-cols-1 gap-3"
                                    initial={{ opacity: 0, y: 30 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.8, duration: 0.5 }}
                                  >
                                    <button 
                                      className="bg-fucsia hover:bg-pink-600 px-4 py-3 rounded-xl flex items-center justify-center gap-2 text-white font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg text-sm lg:text-lg"
                                      onClick={() => handleButtonClick('chat', historia)}
                                    >
                                      <MessageCircle size={20} /> {t('chatear')}
                                    </button>

                                    <button 
                                      className="bg-gradient-to-r from-fucsia to-pink-600 hover:from-pink-600 hover:to-pink-700 px-4 py-3 rounded-xl flex items-center justify-center gap-2 text-white font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg text-sm lg:text-lg"
                                      onClick={() => handleButtonClick('videocall', historia)}
                                    >
                                      <Video size={20} /> {t('videollamada')}
                                    </button>
                                  </motion.div>
                                </motion.div>
                              </div>
                            </motion.div>
                          )}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </motion.div>
              </div>
            </div>
          ) : (
            <div className="text-center text-white/60 py-16">
              <p className="text-lg">No hay historias disponibles en este momento</p>
            </div>
          )}

          <style>{`
            /* Estilos personalizados para el contenedor principal en móvil */
            @media (max-width: 1023px) {
              .main-content-container {
                padding-top: 0.5rem !important;
                padding-bottom: 0.5rem !important;
                padding-left: 0.2rem !important;
                padding-right: 1.5rem !important;
                overflow-y: auto !important;
                gap: 50px !important;
                justify-content: flex-start !important;
                align-items: flex-start !important;
              }
            }

            @keyframes slideUp {
              from {
                transform: translateY(100px);
                opacity: 0;
              }
              to {
                transform: translateY(0);
                opacity: 1;
              }
            }

            @keyframes slideDown {
              from {
                transform: translateY(-50px);
                opacity: 0;
              }
              to {
                transform: translateY(0);
                opacity: 1;
              }
            }

            @keyframes slideIn {
              from {
                transform: translateX(100px);
                opacity: 0;
              }
              to {
                transform: translateX(0);
                opacity: 1;
              }
            }

            .transition-all {
              transition-property: all;
              transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
            }

            body.modal-open {
              overflow: hidden;
            }

            .modal-backdrop {
              backdrop-filter: blur(8px);
            }
          `}</style>
        </div>
      </div>

      {/* Modales */}
      {showLogin && <LoginLigand onClose={() => navigate("/home")} />}
      {showRegister && <Register onClose={() => navigate("/home")} />}
      <HiddenLoginModal />

      {/* Modal de Ayuda */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-gradient-to-b from-[#0a0d10] to-[#131418] border border-[#ff007a]/30 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden transform animate-fadeIn">
            {/* Header */}
            <div className="p-6 border-b border-[#ff007a]/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-[#ff007a]/20 rounded-full flex items-center justify-center">
                  <HelpCircle size={24} className="text-[#ff007a]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{t('helpModal.title') || 'Centro de Ayuda'}</h3>
                  <p className="text-gray-400 text-sm">{t('helpModal.subtitle') || 'Todo lo que necesitas saber'}</p>
                </div>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className="text-white/60 hover:text-white p-2 hover:bg-[#3a3d44] rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Contenido */}
            <div className="p-6 overflow-y-auto max-h-[calc(85vh-180px)]">
              <div className="space-y-6">
                {/* Sección: Iniciar Sesión */}
                <div className="bg-[#1f2125] rounded-xl p-5 border border-[#ff007a]/10">
                  <div className="flex items-center gap-3 mb-3">
                    <User size={20} className="text-[#ff007a]" />
                    <h4 className="text-lg font-semibold text-white">{t('helpModal.login.title') || '¿Cómo iniciar sesión?'}</h4>
                  </div>
                  <p className="text-gray-300 text-sm mb-3">
                    {t('helpModal.login.description') || 'Para iniciar sesión en Ligando, haz clic en el botón "Iniciar Sesión" en la parte superior de la página. Puedes usar tu correo electrónico y contraseña, o iniciar sesión con Google.'}
                  </p>
                  <ul className="text-gray-300 text-sm space-y-2 ml-4">
                    <li className="flex items-start gap-2">
                      <span className="text-[#ff007a] mt-1">•</span>
                      <span>{t('helpModal.login.step1') || 'Haz clic en "Iniciar Sesión" en el header'}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#ff007a] mt-1">•</span>
                      <span>{t('helpModal.login.step2') || 'Ingresa tu correo y contraseña, o usa Google'}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#ff007a] mt-1">•</span>
                      <span>{t('helpModal.login.step3') || '¡Listo! Ya puedes comenzar a chatear'}</span>
                    </li>
                  </ul>
                </div>

                {/* Sección: Registrarse */}
                <div className="bg-[#1f2125] rounded-xl p-5 border border-[#ff007a]/10">
                  <div className="flex items-center gap-3 mb-3">
                    <User size={20} className="text-[#ff007a]" />
                    <h4 className="text-lg font-semibold text-white">{t('helpModal.register.title') || '¿No tienes cuenta?'}</h4>
                  </div>
                  <p className="text-gray-300 text-sm mb-3">
                    {t('helpModal.register.description') || 'Crear una cuenta en Ligando es muy fácil. Solo necesitas un correo electrónico y seguir unos simples pasos.'}
                  </p>
                  <ul className="text-gray-300 text-sm space-y-2 ml-4">
                    <li className="flex items-start gap-2">
                      <span className="text-[#ff007a] mt-1">•</span>
                      <span>{t('helpModal.register.step1') || 'Haz clic en "Iniciar Sesión"'}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#ff007a] mt-1">•</span>
                      <span>{t('helpModal.register.step2') || 'Selecciona "Regístrate aquí" o "Crear cuenta"'}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#ff007a] mt-1">•</span>
                      <span>{t('helpModal.register.step3') || 'Completa el formulario y verifica tu correo'}</span>
                    </li>
                  </ul>
                </div>

                {/* Sección: Sobre la Plataforma */}
                <div className="bg-[#1f2125] rounded-xl p-5 border border-[#ff007a]/10">
                  <div className="flex items-center gap-3 mb-3">
                    <MessageCircle size={20} className="text-[#ff007a]" />
                    <h4 className="text-lg font-semibold text-white">{t('helpModal.about.title') || '¿Qué es Ligando?'}</h4>
                  </div>
                  <p className="text-gray-300 text-sm">
                    {t('helpModal.about.description') || 'Ligando es una plataforma de video chat donde puedes conectar con personas de todo el mundo. Puedes chatear, hacer videollamadas y conocer nuevas personas de forma segura y divertida.'}
                  </p>
                </div>

                {/* Sección: Preguntas Frecuentes */}
                <div className="bg-[#1f2125] rounded-xl p-5 border border-[#ff007a]/10">
                  <div className="flex items-center gap-3 mb-3">
                    <HelpCircle size={20} className="text-[#ff007a]" />
                    <h4 className="text-lg font-semibold text-white">{t('helpModal.faq.title') || 'Preguntas Frecuentes'}</h4>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-[#ff007a] font-medium text-sm mb-1">{t('helpModal.faq.q1') || '¿Es gratis?'}</p>
                      <p className="text-gray-300 text-sm">{t('helpModal.faq.a1') || 'Registrarse es completamente gratis. Algunas funciones premium pueden requerir monedas.'}</p>
                    </div>
                    <div>
                      <p className="text-[#ff007a] font-medium text-sm mb-1">{t('helpModal.faq.q2') || '¿Cómo funcionan las videollamadas?'}</p>
                      <p className="text-gray-300 text-sm">{t('helpModal.faq.a2') || 'Puedes iniciar una videollamada con cualquier usuario en línea. Las llamadas se realizan en tiempo real y son completamente privadas.'}</p>
                    </div>
                    <div>
                      <p className="text-[#ff007a] font-medium text-sm mb-1">{t('helpModal.faq.q3') || '¿Necesito verificar mi cuenta?'}</p>
                      <p className="text-gray-300 text-sm">{t('helpModal.faq.a3') || 'Sí, después de registrarte recibirás un código de verificación en tu correo electrónico para activar tu cuenta.'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-[#ff007a]/20 bg-[#1a1c20]">
              <div className="flex items-center justify-between">
                <p className="text-gray-400 text-xs">
                  {t('helpModal.footer') || '¿Necesitas más ayuda? Contacta a nuestro equipo de soporte.'}
                </p>
                <button
                  onClick={() => {
                    setShowHelpModal(false);
                    navigate("/home?auth=login");
                  }}
                  className="bg-[#ff007a] hover:bg-[#e6006f] text-white px-6 py-2 rounded-lg transition-colors text-sm font-medium"
                >
                  {t('helpModal.startButton') || 'Comenzar ahora'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
export const Dashboard = () => {
  return (
    <>
      <Header />
      <HiddenLoginModal />
      <main className="flex-1 flex flex-col">{/* etc... */}</main>
    </>
  );
};