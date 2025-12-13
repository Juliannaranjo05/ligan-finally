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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

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
    i18n.changeLanguage(langCode);
    localStorage.setItem("lang", langCode);
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
const MobileDropdownMenu = () => {
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
      action: () => <HelpCircle size={18} />
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
                      item.action();
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-fucsia/20 transition-colors text-white"
                  >
                    {item.icon}
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

  useEffect(() => {
    const savedLang = localStorage.getItem("lang");
    if (savedLang && savedLang !== i18n.language) {
      i18n.changeLanguage(savedLang);
    }
  }, []);

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
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
    console.log('🚀 cargarHistorias iniciado');
    try {
      setLoadingHistorias(true);
      console.log('📡 VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL);
      console.log('📡 API_BASE_URL:', API_BASE_URL);
            
      const historiasPrueba = [
        { 
          id: 'prueba1', 
          nombre: "Mía", 
          estado: "activa", 
          img: pruebahistorias, 
          image: pruebahistorias,
          mime_type: 'image/jpeg',
          source_type: 'upload'
        },
        { 
          id: 'prueba2', 
          nombre: "Emilia", 
          estado: "inactiva", 
          img: pruebahistorias, 
          image: pruebahistorias,
          mime_type: 'image/jpeg',
          source_type: 'upload'
        },
        { 
          id: 'prueba3', 
          nombre: "Valentina", 
          estado: "activa", 
          img: pruebahistorias, 
          image: pruebahistorias,
          mime_type: 'image/jpeg',
          source_type: 'upload'
        },
        { 
          id: 'prueba4', 
          nombre: "Sofía", 
          estado: "inactiva", 
          img: pruebahistorias, 
          image: pruebahistorias,
          mime_type: 'image/jpeg',
          source_type: 'upload'
        },
        { 
          id: 'prueba5', 
          nombre: "Camila", 
          estado: "activa", 
          img: pruebahistorias, 
          image: pruebahistorias,
          mime_type: 'image/jpeg',
          source_type: 'upload'
        }
      ];
      
      try {
        console.log('🔍 Intentando cargar historias desde:', import.meta.env.VITE_API_BASE_URL);
        console.log('🔍 axios baseURL configurado:', api.defaults.baseURL);
        console.log('🔍 URL completa será:', `${api.defaults.baseURL || import.meta.env.VITE_API_BASE_URL}/api/stories`);
        const response = await api.get('/api/stories', {
          timeout: 10000
        });
        console.log('✅ Respuesta recibida:', response.status, response.data);
        const historiasData = response.data.map(story => ({
          id: story.id,
          nombre: story.user?.name || 'Usuario',
          estado: story.user?.is_online ? "activa" : "inactiva",
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
                console.error('❌ Error al cargar historias desde API:', apiError);
                console.error('❌ Detalles del error:', apiError.response?.data || apiError.message);
                setHistorias(historiasPrueba);
      }
      
    } catch (error) {
            console.error('❌ Error general al cargar historias:', error);
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
      video.play().catch(console.log);
    });
  }, [currentIndex, expandedIndex, historias]);

  useEffect(() => {
    const checkUserAndRedirect = async () => {
      if (hasChecked.current) {
                return;
      }

      try {
                hasChecked.current = true;

        const res = await apiCall('/api/profile');
        const user = res.data.user;

        
        if (user) {
          const sessionToken = localStorage.getItem('token');
          const sessionRoomName = localStorage.getItem('roomName');
          const sessionUserName = localStorage.getItem('userName');

          
          if (sessionToken && sessionRoomName && sessionRoomName !== 'null' && sessionRoomName !== 'undefined') {
                        
            if (user.rol === "cliente") {
                            navigate(`/videochatclient?roomName=${sessionRoomName}&userName=${sessionUserName}`, { replace: true });
              return;
            } else if (user.rol === "modelo") {
                            navigate(`/videochat?roomName=${sessionRoomName}&userName=${sessionUserName}`, { replace: true });
              return;
            }
          }

          if (!user.email_verified_at) {
                        navigate("/verificaremail", { replace: true });
            return;
          }

          if (!user.rol || !user.name) {
                        navigate("/genero", { replace: true });
            return;
          }

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

                setLoading(false);

      } catch (error) {
                
        if (error.response?.status === 429) {
                    setLoading(false);
          return;
        }
        
        setLoading(false);
      }
    };

    if (!hasChecked.current) {
      checkUserAndRedirect();
    }
  }, []);

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

  const handleButtonClick = (action) => {
        navigate("/home?auth=register");
  };

  if (loading || loadingHistorias) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p className="text-white/80 mt-4">
            {loading ? "Verificando estado..." : "Cargando historias..."}
          </p>
        </div>
      </div>
    );
  }

  if (!loadingHistorias && historias.length === 0) {
      }

  return (
    <div className="bg-ligand-mix-dark min-h-screen px-4">
      {/* Header para escritorio */}
      <header className="hidden sm:flex justify-between items-center p-3 gap-0">
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
          <button className="flex items-center gap-2 px-4 py-2 bg-[#ff007a] text-white rounded-lg hover:bg-pink-600 transition text-base">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 1 1 5.83 1c0 2-3 2-3 4" />
              <line x1="12" y1="17" x2="12" y2="17" />
            </svg>
            {t('ayuda')}
          </button>
        </div>
      </header>

      {/* Header para móvil - EXACTO COMO EN LA IMAGEN */}
      <header className="flex sm:hidden justify-between items-center p-4">
        {/* Logo + Ligand */}
        <div className="flex items-center">
          <img src={logoproncipal} alt="Logo" className="w-8 h-8 mr-2" />
          <span className="text-lg text-zorrofucsia font-pacifico ml-[-5px]">Ligando</span>
        </div>

        {/* Iniciar Sesión + Dropdown */}
        <div className="flex items-center gap-3">
          <button
            className="bg-fucsia text-white px-4 py-2 rounded-lg hover:bg-pink-600 transition-colors font-medium text-sm"
            onClick={() => navigate("/home?auth=login")}
          >
            {t('iniciarSesion')}
          </button>
          
          <MobileDropdownMenu />
        </div>
      </header>
      {/* Contenido principal */}
      <div className="flex flex-col lg:flex-row items-start justify-between py-10 sm:py-12 max-w-7xl mx-auto gap-10">
        {/* Lado Izquierdo */}
        <div className="w-full lg:max-w-lg">
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="font-pacifico text-fucsia text-8xl sm:text-11xl bg-backgroundDark rounded-lg">Ligando</h1>
            <p className="text-lg sm:text-4xl text-pink-200 mt-4 sm:mt-[30px] font-semibold italic">{t('frasePrincipal')}</p>
          </div>

          <div className="text-center mb-6">
            <button
              className="w-full py-3 sm:py-4 px-6 sm:px-8 rounded-full text-white font-bold text-base sm:text-xl bg-fucsia hover:bg-fucsia-400 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
              onClick={() => navigate("/home?auth=register")}
            >
              {t('comenzar')}
            </button>
          </div>

          <div className="text-center mb-8">
            <p className="text-white text-sm sm:text-lg leading-relaxed">
              {t('subtitulo')}
            </p>
          </div>

          <div className="flex justify-center space-x-6">
            {['Femenino', 'Masculino'].map((gender) => (
              <label key={gender} className="flex items-center cursor-pointer group">
                <div className="relative">
                  <input type="radio" name="gender" value={gender.toLowerCase()} className="sr-only" />
                  <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 border-gray-400 group-hover:border-red-400 flex items-center justify-center transition-all duration-200" />
                </div>
                <span className="ml-2 sm:ml-3 text-sm sm:text-lg font-medium text-gray-300 transition-colors duration-200">
                  {t(`genero.${gender.toLowerCase()}`)}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Lado derecho */}
        <div className="w-full lg:ml-16">
          <div className="text-center text-white italic text-xl sm:text-3xl mb-6 font-semibold">
            {t(`chicasRelevantes`)}
          </div>

          {/* Carrusel mejorado */}
          {historias.length > 0 ? (
            <div className="bg-gradient-to-b flex items-center justify-center">
              <div className="relative w-full max-w-full overflow-hidden py-8 px-2">
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
                              : "w-[150px] md:w-[180px] aspect-[9/16]"
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

                              <div className={`absolute top-3 right-3 text-xs md:text-sm px-2 md:px-3 py-1 rounded-full font-semibold ${
                                historia.estado === "activa"
                                  ? "bg-green-500 text-white"
                                  : "bg-red-500 text-white"
                              }`}>
                                {historia.estado === "activa" ? t('activa') : t('inactiva')}
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

                                    <div className={`absolute bottom-3 right-3 z-40 text-xs px-2 py-1 rounded-full font-semibold ${
                                      historia.estado === "activa"
                                        ? "bg-green-600 text-white"
                                        : "bg-red-600 text-white"
                                    }`}>
                                      {historia.estado === "activa" ? t('activa') : t('inactiva')}
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
                                      onClick={() => handleButtonClick('chat')}
                                    >
                                      <MessageCircle size={20} /> {t('chatear')}
                                    </button>

                                    <button 
                                      className="bg-gradient-to-r from-fucsia to-pink-600 hover:from-pink-600 hover:to-pink-700 px-4 py-3 rounded-xl flex items-center justify-center gap-2 text-white font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg text-sm lg:text-lg"
                                      onClick={() => handleButtonClick('videocall')}
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
    </div>
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