import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { initializeAuth } from "./utils/auth";

// 🔥 IMPORTAR AMBOS SISTEMAS DE PROTECCIÓN
import { ProtectedPage } from "./components/hooks/usePageAccess.jsx";
import { useUserLanguage } from "./components/hooks/useUserLanguage.js";
import { RegistrationProtectedPage } from "./components/hooks/useRegistrationAccess.jsx";
import VerificarSesionActiva from "./components/verificacion/login/verifysession.jsx"; 

import LigandHome from "./components/ligandHome";
import LoginLigand from "./components/verificacion/login/loginligand";
import Logout from "./components/verificacion/login/logout";

import VerificarCodigo from "./components/verificacion/register/verificarcodigo";
import Genero from "./components/verificacion/register/genero";
import Verificacion from "./components/verificacion/register/verificacion";
import Anteveri from "./components/verificacion/register/anteveri";
import Esperando from "./components/verificacion/register/esperandoverifi";

import HomeLlamadas from "./components/modelo/homellamadas.jsx";
import Mensajes from "./components/modelo/mensajes.jsx";
import MensajesMobile from "./components/modelo/mensajesmobile.jsx";
import Favoritos from "./components/modelo/favorites.jsx";
import HistorySub from "./components/modelo/historysu.jsx";
import EsperancoCall from "./components/modelo/esperacall.jsx";
import EsperandoCallCliente from "./components/client/esperacallclient";
import ConfiPerfil from "./components/modelo/confiperfil.jsx";
import ConfiClient from "./components/client/configclient.jsx";
import MessageClient from "./components/client/message.jsx"
import MensajesMobileClient from "./components/client/mensajesmobileclient.jsx"
import Favoritesboy from "./components/client/favoritesclient.jsx"
import ResetPasswordPage from './components/verificacion/login/ResetPasswordPage.jsx';

import RouteGuard, { VideochatEndedNotice } from "./routes/blockchat";
import './components/hooks/debugLogs'; // Cargar funciones de debug
import VerificacionesAdmin from "./components/admin/adminverification";
import { AdminCodeVerification } from "./components/admin/AdminCodeVerification";
import AdminDashboardLayout from "./components/admin/dashboard";
import Homecliente from "./components/client/homecliente";
import { RateLimitProvider } from './contexts/RateLimitContext.jsx';
import UserSearch from "./components/search.jsx";
import VideoRecorderUpload from "./components//modelo/VideoRecorderUpload";

import { ToastContainer } from "react-toastify";

import RateLimitWait from "./components/RateLimitWait";

import { SearchingProvider } from './contexts/SearchingContext.jsx';
import { GlobalTranslationProvider } from './contexts/GlobalTranslationContext.jsx';
import { NotificationProvider } from './contexts/NotificationContext.jsx';
import { GlobalCallProvider } from './contexts/GlobalCallContext.jsx';
import GoogleCallback from './components/auth/GoogleCallback.jsx';
import ProfileChatRedirect from './components/ProfileChatRedirect.jsx';
import PublicProfile from './components/PublicProfile';
import VideoChatClient from "./components/client/videochatclient";
import audioManager from './utils/AudioManager.js';


function App() {
  useEffect(() => {
    initializeAuth();
    
    // 🔥 INICIALIZAR AudioManager AL INICIO DE LA APP (UNA SOLA VEZ)
    audioManager.initialize().then(success => {
      if (success) {
        console.log('✅ [App] AudioManager inicializado correctamente');
        
        // Si ya está desbloqueado en localStorage, no necesitamos interacción
        if (audioManager.isAudioReady()) {
          console.log('✅ [App] Audio ya desbloqueado desde localStorage');
        }
      } else {
        console.warn('⚠️ [App] AudioManager no se pudo inicializar completamente');
      }
    });
    
    // 🔥 ESCUCHAR CUALQUIER INTERACCIÓN DEL USUARIO PARA DESBLOQUEAR AUDIO
    // Esto funciona ANTES del login, en cualquier momento que el usuario interactúe
    const unlockOnInteraction = async (event) => {
      if (!audioManager.isAudioReady()) {
        try {
          // Desbloquear inmediatamente durante la interacción
          const unlocked = await audioManager.unlockOnUserInteraction();
          if (unlocked) {
            console.log('✅ [App] Audio desbloqueado exitosamente');
            // Remover listeners una vez desbloqueado (opcional, pero más eficiente)
            events.forEach(eventType => {
              document.removeEventListener(eventType, unlockOnInteraction);
            });
          }
        } catch (error) {
          // Silencioso
        }
      }
    };

    // Eventos que desbloquean audio (cualquier interacción)
    const events = ['click', 'touchstart', 'keydown', 'mousedown', 'pointerdown'];
    
    events.forEach(eventType => {
      document.addEventListener(eventType, unlockOnInteraction, { once: false, passive: true });
    });

    return () => {
      events.forEach(eventType => {
        document.removeEventListener(eventType, unlockOnInteraction);
      });
    };
  }, []);

  useUserLanguage();
  return (
    <BrowserRouter>
      <RateLimitProvider>
        <SearchingProvider>
          <GlobalTranslationProvider>
            <GlobalCallProvider>
              <NotificationProvider>

              <ToastContainer />
              <VerificarSesionActiva /> 
              <VideochatEndedNotice />

              
            <Routes>
              {/* 🔓 RUTAS PÚBLICAS (sin protección) */}
              <Route path="/home" element={<LigandHome />} />
              <Route path="/login" element={<LoginLigand />} />
              <Route path="/logout" element={<Logout />} />
              <Route path="/rate-limit-wait" element={<RateLimitWait />} />
              <Route path="/auth/google/callback" element={<GoogleCallback />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/chat/:slug" element={<ProfileChatRedirect />} />
              <Route path="/visit/:slug" element={<PublicProfile />} />
              
              {/* 🔐 RUTAS DE ADMIN - PÚBLICAS (sin protección inicial) */}
              <Route path="/AdminCodeVerification" element={<AdminCodeVerification />} />



              {/* 🔒 RUTAS PROTEGIDAS */}
              <Route path="/*" element={
                <RouteGuard>
                  <Routes>
                    
                    {/* 🏠 RUTA RAÍZ */}
                    <Route 
                      path="/" 
                      element={<Navigate to="/dashboard" replace />} 
                    />

                    {/* 🎯 DASHBOARD - Los hooks se encargarán de redirigir */}
                    <Route 
                      path="/dashboard" 
                      element={
                        <ProtectedPage>
                          <div className="min-h-screen flex items-center justify-center bg-black text-white">
                            <div className="text-center">
                              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-pink-500 mx-auto mb-4"></div>
                              <p>Redirigiendo al área correspondiente...</p>
                            </div>
                          </div>
                        </ProtectedPage>
                      } 
                    />

                    {/* 📧 PROCESO DE REGISTRO - Protegidas por RegistrationProtectedPage */}
                    <Route 
                      path="/verificaremail" 
                      element={
                        <RegistrationProtectedPage>
                          <VerificarCodigo />
                        </RegistrationProtectedPage>
                      } 
                    />
                    <Route 
                      path="/genero" 
                      element={
                        <RegistrationProtectedPage>
                          <Genero />
                        </RegistrationProtectedPage>
                      } 
                    />
                    <Route 
                      path="/anteveri" 
                      element={
                        <RegistrationProtectedPage>
                          <Anteveri />
                        </RegistrationProtectedPage>
                      } 
                    />
                    <Route 
                      path="/verificacion" 
                      element={
                        <RegistrationProtectedPage>
                          <Verificacion />
                        </RegistrationProtectedPage>
                      } 
                    />
                    <Route 
                      path="/esperando" 
                      element={
                        <RegistrationProtectedPage>
                          <Esperando />
                        </RegistrationProtectedPage>
                      } 
                    />

                    {/* 👨‍💼 ÁREA DEL CLIENTE - Protegidas por ProtectedPage */}
                    <Route 
                      path="/homecliente" 
                      element={
                        <ProtectedPage>
                          <Homecliente />
                        </ProtectedPage>
                      } 
                    />
                    <Route 
                      path="/esperandocallcliente" 
                      element={
                        <ProtectedPage>
                          <EsperandoCallCliente />
                        </ProtectedPage>
                      } 
                    />
                    <Route 
                      path="/videochatclient" 
                      element={
                        <ProtectedPage>
                          <VideoChatClient />
                        </ProtectedPage>
                      } 
                    />
                    <Route 
                      path="/message" 
                      element={
                        <ProtectedPage>
                          <MessageClient />
                        </ProtectedPage>
                      } 
                    />
                    <Route 
                      path="/mensajesmobileclient" 
                      element={
                        <ProtectedPage>
                          <MensajesMobileClient />
                        </ProtectedPage>
                      } 
                    />
                    <Route 
                      path="/favoritesboy" 
                      element={
                        <ProtectedPage>
                          <Favoritesboy />
                        </ProtectedPage>
                      } 
                    />
                    <Route 
                      path="/settings" 
                      element={
                        <ProtectedPage>
                          <ConfiClient />
                        </ProtectedPage>
                      } 
                    />

                    {/* 👩‍💼 ÁREA DE LA MODELO - Protegidas por ProtectedPage */}
                    <Route 
                      path="/homellamadas" 
                      element={
                        <ProtectedPage>
                          <HomeLlamadas />
                        </ProtectedPage>
                      } 
                    />
                    <Route 
                      path="/mensajes" 
                      element={
                        <ProtectedPage>
                          <Mensajes />
                        </ProtectedPage>
                      } 
                    />
                    <Route 
                      path="/mensajesmobile" 
                      element={
                        <ProtectedPage>
                          <MensajesMobile />
                        </ProtectedPage>
                      } 
                    />
                    <Route 
                      path="/favorites" 
                      element={
                        <ProtectedPage>
                          <Favoritos />
                        </ProtectedPage>
                      } 
                    />
                    <Route 
                      path="/historysu" 
                      element={
                        <ProtectedPage>
                          <HistorySub />
                        </ProtectedPage>
                      } 
                    />
                    <Route 
                      path="/esperandocall" 
                      element={
                        <ProtectedPage>
                          <EsperancoCall />
                        </ProtectedPage>
                      } 
                    />
                    <Route 
                      path="/videochat" 
                      element={
                        <ProtectedPage>
                          <VideoChatClient />
                        </ProtectedPage>
                      } 
                    />
                    <Route 
                      path="/configuracion" 
                      element={
                        <ProtectedPage>
                          <ConfiPerfil />
                        </ProtectedPage>
                      } 
                    />
                    <Route 
                      path="/VideoRecorderUpload" 
                      element={
                        <ProtectedPage>
                          <VideoRecorderUpload />
                        </ProtectedPage>
                      } 
                    />
                    <Route 
                      path="/usersearch" 
                      element={
                        <ProtectedPage>
                          <UserSearch />
                        </ProtectedPage>
                      } 
                    />

                    {/* 🛡️ ADMIN - Sin ProtectedPage (tiene su propia validación) */}
                    <Route 
                      path="/admin/dashboard" 
                      element={<AdminDashboardLayout />} 
                    />
                    <Route 
                      path="/admin/dashboard/:section" 
                      element={<AdminDashboardLayout />} 
                    />
                    <Route 
                      path="/verificacionesadmin" 
                      element={
                        <ProtectedPage>
                          <VerificacionesAdmin />
                        </ProtectedPage>
                      } 
                    />

                    {/* 🚫 FALLBACK */}
                    <Route path="*" element={<Navigate to="/home" replace />} />
                    
                  </Routes>
                </RouteGuard>
              } />
            </Routes>
              </NotificationProvider>
            </GlobalCallProvider>
          </GlobalTranslationProvider>
        </SearchingProvider>
      </RateLimitProvider>
    </BrowserRouter>
  );
}

export default App;