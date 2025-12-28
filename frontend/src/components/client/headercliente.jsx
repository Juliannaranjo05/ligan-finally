import { useState, useRef, useEffect } from "react";
import { 
  Home, 
  Star, 
  MessageSquare, 
  LogOut, 
  Settings, 
  DollarSign, 
  Menu, 
  X,
  Coins,
  Play,
  User    // Para el icono de usuario por defecto
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from 'react-i18next';
import logoproncipal from "../imagenes/logoprincipal.png";
import LanguageSelector from "../../components/languageSelector";
import { getUser } from "../../utils/auth";
import UnifiedPaymentModal from '../../components/payments/UnifiedPaymentModal';
import StoriesModal from './StoriesModal';
import { useAppNotifications } from '../../contexts/NotificationContext';
import { useCurrentUser } from '../hooks/useCurrentUser.js';

export default function HeaderCliente({ showMessagesButton = false, onMessagesClick = null }) {
  const navigate = useNavigate();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [comprasAbierto, setComprasAbierto] = useState(false);
  const [mobileMenuAbierto, setMobileMenuAbierto] = useState(false);
  const [showBuyCoins, setShowBuyCoins] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  
  // ESTADOS PARA MODALES
  const [showStoriesModal, setShowStoriesModal] = useState(false);
  
  // 🔥 USAR HOOK DE USUARIO ACTUAL (fuente única desde BD)
  const { user: currentUser } = useCurrentUser();
  
  // 🚫 ESTADO PARA CONTROLAR EL BLOQUEO
  const [isBlocked, setIsBlocked] = useState(false);
  const [showHoverBanner, setShowHoverBanner] = useState(false);
  
  const menuRef = useRef(null);
  const comprasRef = useRef(null);
  const mobileMenuRef = useRef(null);
  const { t, i18n } = useTranslation();
  const notifications = useAppNotifications();

  // 🔍 FUNCIÓN PARA VERIFICAR SI HAY roomName EN LOCALSTORAGE
  const checkRoomNameInStorage = () => {
    try {
      const roomName = localStorage.getItem('roomName');
      const hasRoomName = roomName && roomName.trim() !== '';
            return hasRoomName;
    } catch (error) {
            return false;
    }
  };

  // 🚫 FUNCIÓN PARA MANEJAR NAVEGACIÓN BLOQUEADA
  const handleBlockedNavigation = (actionName) => {
        notifications.error('No puedes navegar mientras estás en una videollamada activa');
  };

  // VERIFICAR BLOQUEO AL INICIALIZAR
  useEffect(() => {
    // Verificar estado de bloqueo inicial
    const blocked = checkRoomNameInStorage();
    setIsBlocked(blocked);
  }, []);

  // 👁️ LISTENER PARA CAMBIOS EN LOCALSTORAGE
  useEffect(() => {
    const handleStorageChange = () => {
      const blocked = checkRoomNameInStorage();
      setIsBlocked(blocked);
          };

    // Escuchar cambios en localStorage
    window.addEventListener('storage', handleStorageChange);
    
    // También verificar periódicamente (por si los cambios son en la misma pestaña)
    const interval = setInterval(handleStorageChange, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  // FUNCIÓN PARA ABRIR MODAL DE HISTORIAS
  const handleOpenStories = () => {
    if (isBlocked) {
      handleBlockedNavigation('Historias');
      return;
    }
        setShowStoriesModal(true);
  };

  // FUNCIÓN PARA CERRAR MODAL DE HISTORIAS
  const handleCloseStories = () => {
        setShowStoriesModal(false);
  };




  // ✅ FUNCIONES CORREGIDAS PARA COMPRAS
  const abrirModalCompraMonedas = () => {
    if (isBlocked) {
      handleBlockedNavigation('Compra de monedas');
      return;
    }
        setShowBuyCoins(true);
  };

  const cerrarModalCompraMonedas = () => {
        setShowBuyCoins(false);
  };

  const isMobile = () => {
    return window.innerWidth < 768;
  };

  // FUNCIÓN PARA MANEJAR MENSAJES DESKTOP
  const handleMessagesDesktop = () => {
    if (isBlocked) {
      handleBlockedNavigation('Mensajes Desktop');
      return;
    }
        navigate("/message");
  };

  // FUNCIÓN PARA MANEJAR MENSAJES MÓVIL
  const handleMessagesMobile = () => {
    if (isBlocked) {
      handleBlockedNavigation('Mensajes Móvil');
      return;
    }
    // 🔥 En móvil, navegar directamente a la ruta móvil
    const isMobileDevice = window.innerWidth < 768;
    navigate(isMobileDevice ? "/mensajesmobileclient" : "/message");
  };

  // 🚫 FUNCIÓN PARA MANEJAR NAVEGACIÓN CON BLOQUEO
  const handleNavigateWithBlock = (path, actionName) => {
    if (isBlocked) {
      handleBlockedNavigation(actionName);
      return;
    }
        navigate(path);
  };

  const toggleMenu = () => setMenuAbierto(!menuAbierto);
  const toggleCompras = () => setComprasAbierto(!comprasAbierto);
  const toggleMobileMenu = () => setMobileMenuAbierto(!mobileMenuAbierto);

  // Cerrar menús al hacer clic fuera
  useEffect(() => {
    const manejarClickFuera = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuAbierto(false);
      }
      if (comprasRef.current && !comprasRef.current.contains(e.target)) {
        setComprasAbierto(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target)) {
        setMobileMenuAbierto(false);
      }
    };
    document.addEventListener("mousedown", manejarClickFuera);
    return () => document.removeEventListener("mousedown", manejarClickFuera);
  }, []);

  // Cerrar menú móvil al cambiar de ruta
  useEffect(() => {
    setMobileMenuAbierto(false);
  }, [navigate]);

  return (
    <>
      <header className="flex justify-between items-center mb-4 px-4 relative">
        {/* Logo + Nombre */}
        <div
          className={`flex items-center cursor-pointer ${isBlocked ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={() => handleNavigateWithBlock("/homecliente", "Home")}
        >
          <img src={logoproncipal} alt="Logo" className="w-12 h-12 sm:w-14 sm:h-14" />
          <span className="text-xl sm:text-2xl text-[#ff007a] font-pacifico ml-[-5px]">
            Ligand
          </span>
        </div>

        {/* Navegación Desktop - oculta en móvil */}
        <nav className="hidden md:flex items-center gap-4 lg:gap-6 text-lg">
          <LanguageSelector />
          
          {/* ICONO DE HISTORIAS - ABRE EL MODAL */}
          <button
            onClick={handleOpenStories}
            className={`hover:scale-110 transition p-2 ${isBlocked ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={t('viewStories')}
            disabled={isBlocked}
            onMouseEnter={() => isBlocked && setShowHoverBanner(true)}
            onMouseLeave={() => setShowHoverBanner(false)}
          >
            <Play size={24} className="text-[#ff007a]" />
          </button>
        
          
          <button
            className={`hover:scale-110 transition p-2 ${isBlocked ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={() => handleNavigateWithBlock("/homecliente", "Home")}
            title={t('home')}
            disabled={isBlocked}
            onMouseEnter={() => isBlocked && setShowHoverBanner(true)}
            onMouseLeave={() => setShowHoverBanner(false)}
          >
            <Home className="text-[#ff007a]" size={24} />
          </button>
          
          <button
            className={`hover:scale-110 transition p-2 ${isBlocked ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={handleMessagesDesktop}
            title={t('messages')}
            disabled={isBlocked}
            onMouseEnter={() => isBlocked && setShowHoverBanner(true)}
            onMouseLeave={() => setShowHoverBanner(false)}
          >
            <MessageSquare className="text-[#ff007a]" size={24} />
          </button>
          
          <button
            className={`hover:scale-110 transition p-2 ${isBlocked ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={() => handleNavigateWithBlock("/favoritesboy", "Favoritos")}
            title={t('favoritesHome')}
            disabled={isBlocked}
            onMouseEnter={() => isBlocked && setShowHoverBanner(true)}
            onMouseLeave={() => setShowHoverBanner(false)}
          >
            <Star className="text-[#ff007a]" size={24} />
          </button>

          {/* Botón de perfil desktop */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={toggleMenu}
              className={`w-10 h-10 rounded-full bg-[#ff007a] text-white font-bold text-sm hover:scale-105 transition flex items-center justify-center overflow-hidden border-2 border-[#ff007a] ${isBlocked ? 'opacity-50' : ''}`}
              title={t('accountMenu')}
              onMouseEnter={() => isBlocked && !menuAbierto && setShowHoverBanner(true)}
              onMouseLeave={() => setShowHoverBanner(false)}
            >
              {currentUser?.avatar_url ? (
                <img 
                  src={currentUser.avatar_url} 
                  alt={currentUser.name || 'Usuario'} 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextElementSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <span className={currentUser?.avatar_url ? 'hidden' : ''}>
                {(currentUser?.name || 'C').charAt(0).toUpperCase()}
              </span>
            </button>

            {/* Menú desplegable desktop */}
            {menuAbierto && (
              <div className="absolute right-0 mt-2 w-48 bg-[#1f2125] rounded-xl shadow-lg border border-[#ff007a]/30 z-50 overflow-hidden">
                <button
                  onClick={() => {
                    if (isBlocked) {
                      handleBlockedNavigation('Configuración');
                      setMenuAbierto(false);
                      return;
                    }
                    navigate("/settings");
                    setMenuAbierto(false);
                  }}
                  className={`flex items-center w-full px-4 py-3 text-sm text-white hover:bg-[#2b2d31] transition ${isBlocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Settings size={16} className="mr-3 text-[#ff007a]" />
                  {t('settingsHome')}
                </button>
                <button
                  onClick={() => {
                    if (isBlocked) {
                      handleBlockedNavigation('Logout');
                      setMenuAbierto(false);
                      return;
                    }
                    navigate("/logout");
                    setMenuAbierto(false);
                  }}
                  className={`flex items-center w-full px-4 py-3 text-sm text-white hover:bg-[#2b2d31] transition ${isBlocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <LogOut size={16} className="mr-3 text-[#ff007a]" />
                  {t('logout')}
                </button>
              </div>
            )}
          </div>
        </nav>

        {/* Botón menú móvil - solo visible en móvil */}
        <div className="md:hidden flex items-center gap-2">
          {/* Botón de mensajes - al lado del menú */}
          {showMessagesButton && onMessagesClick && (
            <button
              onClick={onMessagesClick}
              className="w-10 h-10 rounded-full bg-[#ff007a] text-white hover:scale-105 transition flex items-center justify-center"
              title={t('messages')}
            >
              <MessageSquare size={20} />
            </button>
          )}
          
          <div className="relative" ref={mobileMenuRef}>
            <button
              onClick={toggleMobileMenu}
              className="w-10 h-10 rounded-full bg-[#ff007a] text-white hover:scale-105 transition flex items-center justify-center"
              title={t('header.menu')}
            >
              {mobileMenuAbierto ? <X size={20} /> : <Menu size={20} />}
            </button>

            {/* Menú móvil desplegable */}
            {mobileMenuAbierto && (
              <div className="absolute right-0 mt-2 w-72 bg-[#1f2125] rounded-xl shadow-xl border border-[#ff007a]/30 z-50 overflow-hidden">
                {/* Selector de idioma móvil */}
                <div className="px-4 py-3 border-b border-[#ff007a]/20">
                  <div className="text-xs text-gray-400 mb-2">{t('idioma')}</div>
                  <LanguageSelector />
                </div>

                {/* 🚫 INDICADOR DE ESTADO BLOQUEADO EN MÓVIL */}
                {isBlocked && (
                  <div className="px-4 py-3 border-b border-red-500/20 bg-red-500/10">
                    <div className="flex items-center gap-2 text-red-400">
                      <span className="text-sm">🔒</span>
                      <span className="text-xs">Videollamada activa - Navegación limitada</span>
                    </div>
                  </div>
                )}

                {/* 👈 OPCIONES MÓVILES PARA HISTORIAS */}
                <div className="py-2 border-b border-[#ff007a]/20">
                  <button
                    onClick={() => {
                      handleOpenStories();
                      setMobileMenuAbierto(false);
                    }}
                    className={`flex items-center w-full px-4 py-3 text-sm text-white hover:bg-[#2b2d31] transition ${isBlocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={isBlocked}
                  >
                    <Play size={18} className="mr-3 text-[#ff007a]"/>
                    {t('viewStories') || 'Ver Historias'}
                  </button>
                </div>

                {/* Sección de compras móvil */}
                <div className={`px-4 py-3 border-b border-[#ff007a]/20 ${isBlocked ? 'opacity-50' : ''}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Coins size={18} className="text-[#ff007a]" strokeWidth={2.5} />
                      <span className="text-white font-semibold">🪙 {t('coinPackages')}</span>
                    </div>
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  </div>
                </div>
                
                {/* Navegación móvil */}
                <div className="py-2 border-b border-[#ff007a]/20">
                  <button
                    onClick={() => {
                      handleNavigateWithBlock("/homecliente", "Home");
                      setMobileMenuAbierto(false);
                    }}
                    className={`flex items-center w-full px-4 py-3 text-sm text-white hover:bg-[#2b2d31] transition ${isBlocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Home size={18} className="mr-3 text-[#ff007a]"/>
                    {t('home')}
                  </button>
                  
                  <button
                    onClick={() => {
                      handleMessagesMobile();
                      setMobileMenuAbierto(false);
                    }}
                    className={`flex items-center w-full px-4 py-3 text-sm text-white hover:bg-[#2b2d31] transition ${isBlocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <MessageSquare size={18} className="mr-3 text-[#ff007a]"/>
                    {t('messages')}
                  </button>
                  
                  <button
                    onClick={() => {
                      handleNavigateWithBlock("/favoritesboy", "Favoritos");
                      setMobileMenuAbierto(false);
                    }}
                    className={`flex items-center w-full px-4 py-3 text-sm text-white hover:bg-[#2b2d31] transition ${isBlocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Star size={18} className="mr-3 text-[#ff007a]"/>
                    {t('favoritesHome')}
                  </button>
                </div>

                {/* Opciones de cuenta móvil */}
                <div className="py-2">
                  <button
                    onClick={() => {
                      handleNavigateWithBlock("/settings", "Configuración");
                      setMobileMenuAbierto(false);
                    }}
                    className={`flex items-center w-full px-4 py-3 text-sm text-white hover:bg-[#2b2d31] transition ${isBlocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Settings size={18} className="mr-3 text-[#ff007a]"/>
                    {t('settingsHome')}
                  </button>
                  
                  <button
                    onClick={() => {
                      handleNavigateWithBlock("/logout", "Logout");
                      setMobileMenuAbierto(false);
                    }}
                    className={`flex items-center w-full px-4 py-3 text-sm text-white hover:bg-[#2b2d31] transition ${isBlocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <LogOut size={18} className="mr-3 text-[#ff007a]"/>
                    {t('logout')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* MODAL DE HISTORIAS INTEGRADO */}
      <StoriesModal 
        isOpen={showStoriesModal}
        onClose={handleCloseStories}
        currentUser={currentUser}
      />

      {/* Modal de compra de monedas */}
      {showBuyCoins && (
        <UnifiedPaymentModal 
          onClose={cerrarModalCompraMonedas}
        />
      )}

      {/* Modal de confirmación */}
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

      {/* 🚨 NOTIFICACIÓN FLOTANTE DE VIDEOLLAMADA ACTIVA - SOLO EN HOVER */}
      {isBlocked && showHoverBanner && (
        <div className="fixed top-10 left-1/2 transform -translate-x-1/2 bg-red-500/90 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-medium z-40 shadow-lg border border-red-400 transition-opacity">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <span>📹 Videollamada activa - Navegación limitada</span>
          </div>
        </div>
      )}
    </>
  );
}