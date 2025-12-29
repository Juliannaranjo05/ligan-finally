import React, { useState, useEffect, useRef } from 'react';
import { Camera, Upload, Trash2, User, Globe, X, Check, AlertCircle } from 'lucide-react';
import Header from "../components/modelo/header";
import { useCurrentUser } from './hooks/useCurrentUser.js';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://ligandome.com';

const ProfileSettings = () => {
  const { t } = useTranslation();
  // 🔥 USAR HOOK DE USUARIO ACTUAL PARA REFRESCAR DESPUÉS DE SUBIR/ELIMINAR FOTO
  const { refresh: refreshCurrentUser } = useCurrentUser();
  
  // Estados principales
  const [modalActivo, setModalActivo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });
  
  // Estados de datos del usuario
  const [userInfo, setUserInfo] = useState({
    name: '',
    nickname: '',
    display_name: '',
    avatar_url: null,
    preferred_language: 'es'
  });
  
  // Estados del modal de fotos
  const [fotoSeleccionada, setFotoSeleccionada] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [camaraActiva, setCamaraActiva] = useState(false);
  const [stream, setStream] = useState(null);
  
  // Estados del modal de apodo
  const [nuevoApodo, setNuevoApodo] = useState('');
  
  // Estados del modal de idioma
  const [idiomaSeleccionado, setIdiomaSeleccionado] = useState('es');
  
  // Referencias
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  const idiomas = {
    'es': 'Español',
    'en': 'English',
    'fr': 'Français',
    'de': 'Deutsch',
    'it': 'Italiano',
    'pt': 'Português',
    'ru': 'Русский',
    'tr': 'Türkçe',
    'hi': 'हिन्दी'
  };

  // Función para obtener headers con autenticación
  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      'X-Requested-With': 'XMLHttpRequest'
    };
  };

  // Cargar información del usuario al montar
  useEffect(() => {
    cargarInfoUsuario();
  }, []);

  // Depuración: Monitorear cambios de estado
  useEffect(() => {
    // debug: modalActivo, camaraActiva, stream, videoRef (omitted)
  }, [modalActivo, camaraActiva, stream]);

  // Configurar video cuando la cámara se active
  useEffect(() => {
    const esManagePhoto = modalActivo === 'managePhoto';

    // Solo configurar si el modal está abierto y la cámara está activa
    if (modalActivo !== 'managePhoto' || !camaraActiva || !stream) {
      return;
    }
    
    
    // Esperar un momento para asegurar que el video esté en el DOM
    const timer = setTimeout(() => {
      if (!videoRef.current) {
        return;
      }
      
      const video = videoRef.current;
      // debug: video.isConnected, video.srcObject (omitted)
      
      // Verificar que el video esté conectado al DOM
      if (!video.isConnected) {
        return;
      }
      
      // Si el video ya tiene el mismo stream, no hacer nada
      if (video.srcObject === stream) {
        return;
      }
      
      // Configurar el stream
      video.srcObject = stream;
      
      // Intentar reproducir con manejo de errores mejorado
      const playPromise = video.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            // Video reproducido exitosamente
          })
          .catch(err => {
            // Ignorar errores comunes que no son críticos
            if (err.name === 'AbortError') {
              // El video fue removido del DOM, esto es normal al cerrar el modal
              return;
            }
            if (err.name === 'NotAllowedError') {
              // El usuario denegó el permiso, ya se maneja en activarCamara
              return;
            }
            // Solo mostrar otros errores
            setMensaje({ tipo: 'error', texto: 'Error al iniciar la cámara' });
          });
      }
    }, 100); // Pequeño delay para asegurar que el DOM esté listo
    
    return () => {
      clearTimeout(timer);
    };
  }, [modalActivo, camaraActiva, stream]);

  // Cleanup de la cámara al desmontar el componente
  useEffect(() => {
    return () => {
      // Este cleanup solo se ejecuta cuando el componente se desmonta completamente
      // No cuando cambia el stream, para evitar reseteos innecesarios
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []); // Array vacío = solo se ejecuta al montar/desmontar

  const cargarInfoUsuario = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/profile/info`, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        setUserInfo(data.user);
        setNuevoApodo(data.user.nickname || '');
        setIdiomaSeleccionado(data.user.preferred_language || 'es');
        
        // 🔥 SINCRONIZAR IDIOMA CON i18n
        if (data.user.preferred_language) {
          const lang = data.user.preferred_language;
          localStorage.setItem('lang', lang); // Clave que usa i18n
          localStorage.setItem('userPreferredLanguage', lang);
          localStorage.setItem('selectedLanguage', lang);
          
          // Cambiar idioma en i18n
          if (i18n.language !== lang) {
            i18n.changeLanguage(lang);
          }
        }
      }
    }
  } catch (error) {
  }
};

  const mostrarMensaje = (tipo, texto) => {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje({ tipo: '', texto: '' }), 5000);
  };

  const abrirModal = (tipo) => {
    setModalActivo(tipo);
    setMensaje({ tipo: '', texto: '' });
    
    if (tipo === 'editAlias') {
      setNuevoApodo(userInfo.nickname || '');
    } else if (tipo === 'language') {
      setIdiomaSeleccionado(userInfo.preferred_language || 'es');
    }
  };

  const cerrarModal = () => {
    // Detener stream antes de cerrar el modal
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    
    // Limpiar video ref
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setCamaraActiva(false);
    setModalActivo(null);
    setFotoSeleccionada(null);
    setFotoPreview(null);
  };

  // 📸 FUNCIONES DE GESTIÓN DE FOTOS

  const manejarSeleccionArchivo = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        mostrarMensaje('error', 'El archivo no puede ser mayor a 5MB');
        return;
      }
      
      if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
        mostrarMensaje('error', 'Solo se permiten archivos JPEG, PNG o WebP');
        return;
      }
      
      setFotoSeleccionada(file);
      const reader = new FileReader();
      reader.onload = (e) => setFotoPreview(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  const subirFoto = async () => {
    if (!fotoSeleccionada) return;
    
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('photo', fotoSeleccionada);
      
      const response = await fetch(`${API_BASE_URL}/api/profile/photo/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem("token")}`,
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: formData
      });
      
      const data = await response.json();
      
      if (data.success) {
        setUserInfo(prev => ({ ...prev, avatar_url: data.avatar_url }));
        // 🔥 REFRESCAR CONTEXTO GLOBAL DE USUARIO PARA QUE EL HEADER MUESTRE LA NUEVA FOTO
        await refreshCurrentUser();
        mostrarMensaje('success', 'Foto subida exitosamente');
        cerrarModal();
      } else {
        mostrarMensaje('error', data.error || 'Error subiendo la foto');
      }
    } catch (error) {
      mostrarMensaje('error', 'Error de conexión al subir la foto');
    } finally {
      setLoading(false);
    }
  };

  const activarCamara = async () => {
    
    try {
      // Verificar si getUserMedia está disponible
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        mostrarMensaje('error', 'Tu navegador no soporta acceso a la cámara');
        return;
      }

      // Solicitar acceso a la cámara
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 640 },
          facingMode: 'user' // Cámara frontal
        },
        audio: false
      });
      
      
      // Establecer estados
      setCamaraActiva(true);
      setStream(mediaStream);
      
      // Configurar el video inmediatamente si está disponible
      // Esto ayuda a evitar problemas de timing
      // Nota: El useEffect también intentará configurar el video cuando esté listo
      setTimeout(() => {
        if (videoRef.current && mediaStream) {
          const video = videoRef.current;
          if (video.isConnected && !video.srcObject) {
            video.srcObject = mediaStream;
            video.play()
              .then(() => {
              })
              .catch(err => {
              });
          } else if (video.srcObject) {
          } else {
          }
        } else {
        }
      }, 300); // Aumentado a 300ms para dar más tiempo a React
    } catch (error) {
      let mensajeError = 'No se pudo acceder a la cámara';
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        mensajeError = 'Se necesita permiso para acceder a la cámara. Por favor, permite el acceso en la configuración de tu navegador.';
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        mensajeError = 'No se encontró ninguna cámara disponible';
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        mensajeError = 'La cámara está siendo usada por otra aplicación';
      }
      
      mostrarMensaje('error', mensajeError);
      setCamaraActiva(false);
      setStream(null);
    }
  };

  const tomarFoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    canvas.width = 400;
    canvas.height = 400;
    
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, 400, 400);
    
    canvas.toBlob(async (blob) => {
      const reader = new FileReader();
      reader.onload = async () => {
        const photoData = reader.result;
        await enviarFotoTomada(photoData);
      };
      reader.readAsDataURL(blob);
    }, 'image/jpeg', 0.85);
  };

  const enviarFotoTomada = async (photoData) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/profile/photo/take`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ photo_data: photoData })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setUserInfo(prev => ({ ...prev, avatar_url: data.avatar_url }));
        // 🔥 REFRESCAR CONTEXTO GLOBAL DE USUARIO PARA QUE EL HEADER MUESTRE LA NUEVA FOTO
        await refreshCurrentUser();
        mostrarMensaje('success', 'Foto tomada exitosamente');
        cerrarModal();
      } else {
        mostrarMensaje('error', data.error || 'Error tomando la foto');
      }
    } catch (error) {
      mostrarMensaje('error', 'Error de conexión al tomar la foto');
    } finally {
      setLoading(false);
    }
  };

  const eliminarFoto = async () => {
    if (!confirm('¿Estás seguro de que quieres eliminar tu foto de perfil?')) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/profile/photo/delete`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      
      const data = await response.json();
      
      if (data.success) {
        setUserInfo(prev => ({ ...prev, avatar_url: null }));
        // 🔥 REFRESCAR CONTEXTO GLOBAL DE USUARIO PARA QUE EL HEADER ACTUALICE
        await refreshCurrentUser();
        mostrarMensaje('success', 'Foto eliminada exitosamente');
        cerrarModal();
      } else {
        mostrarMensaje('error', data.error || 'Error eliminando la foto');
      }
    } catch (error) {
      mostrarMensaje('error', 'Error de conexión al eliminar la foto');
    } finally {
      setLoading(false);
    }
  };

  // 👤 FUNCIONES DE GESTIÓN DE APODOS

  const guardarApodo = async () => {
    const apodo = nuevoApodo.trim();
    
    if (!apodo) {
      mostrarMensaje('error', 'El apodo no puede estar vacío');
      return;
    }
    
    if (apodo.length > 8) {
      mostrarMensaje('error', 'El apodo no puede tener más de 8 caracteres');
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/profile/nickname/update`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ nickname: apodo })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setUserInfo(prev => ({ 
          ...prev, 
          nickname: data.nickname,
          display_name: data.display_name || data.name,
          name: data.name || data.display_name
        }));
        // 🔥 REFRESCAR CONTEXTO GLOBAL DE USUARIO PARA QUE EL HEADER ACTUALICE EL NOMBRE
        await refreshCurrentUser();
        mostrarMensaje('success', 'Apodo actualizado exitosamente');
        cerrarModal();
      } else {
        mostrarMensaje('error', data.error || 'Error actualizando el apodo');
      }
    } catch (error) {
      mostrarMensaje('error', 'Error de conexión al actualizar el apodo');
    } finally {
      setLoading(false);
    }
  };

  const eliminarApodo = async () => {
    if (!confirm('¿Quieres volver a usar tu nombre real?')) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/profile/nickname/delete`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      
      const data = await response.json();
      
      if (data.success) {
        setUserInfo(prev => ({ 
          ...prev, 
          nickname: null,
          display_name: data.display_name || prev.name,
          name: data.display_name || prev.name
        }));
        setNuevoApodo('');
        // 🔥 REFRESCAR CONTEXTO GLOBAL DE USUARIO PARA QUE EL HEADER ACTUALICE
        await refreshCurrentUser();
        mostrarMensaje('success', 'Apodo eliminado exitosamente');
        cerrarModal();
      } else {
        mostrarMensaje('error', data.error || 'Error eliminando el apodo');
      }
    } catch (error) {
      mostrarMensaje('error', 'Error de conexión al eliminar el apodo');
    } finally {
      setLoading(false);
    }
  };

  // 🌍 FUNCIONES DE GESTIÓN DE IDIOMA

  // 🌍 FUNCIONES DE GESTIÓN DE IDIOMA - MODIFICACIÓN

  const guardarIdioma = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/profile/language/update`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ language: idiomaSeleccionado })
      });
      
      const data = await response.json();
      
      if (data.success) {
        const newLang = data.preferred_language;
        
        // 🔥 ACTUALIZAR EL ESTADO DEL COMPONENTE
        setUserInfo(prev => ({ 
          ...prev, 
          preferred_language: newLang 
        }));
        
        // 🔥 ACTUALIZAR LOCALSTORAGE CON LA CLAVE CORRECTA PARA i18n
        localStorage.setItem('lang', newLang); // Clave que usa i18n
        localStorage.setItem('userPreferredLanguage', newLang);
        localStorage.setItem('selectedLanguage', newLang);
        
        // 🔥 CAMBIAR IDIOMA EN i18n
        await i18n.changeLanguage(newLang);
        
        mostrarMensaje('success', `Idioma cambiado a ${data.language_name}`);
        cerrarModal();
        
        // 🔥 RECARGAR LA PÁGINA PARA APLICAR EL CAMBIO EN TODA LA PLATAFORMA
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        mostrarMensaje('error', data.error || 'Error actualizando el idioma');
      }
    } catch (error) {
      mostrarMensaje('error', 'Error de conexión al actualizar el idioma');
    } finally {
      setLoading(false);
    }
  };

  // 🎨 COMPONENTES DE UI

  const Seccion = ({ titulo, children }) => (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-white mb-3 border-b border-[#ff007a]/20 pb-2">
        {titulo}
      </h3>
      <div className="space-y-2">
        {children}
      </div>
    </div>
  );

  const ConfigBoton = ({ icon, texto, onClick }) => (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 bg-[#131418] hover:bg-[#1c1f25] transition px-4 py-2 rounded-lg text-left border border-white/10"
    >
      <div className="text-[#ff007a] group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <span className="text-white text-sm">{texto}</span>
    </button>
  );

  const MensajeEstado = () => {
    if (!mensaje.texto) return null;
    
    return (
      <div className={`p-3 rounded-lg mb-4 flex items-center gap-2 ${
        mensaje.tipo === 'success' 
          ? 'bg-green-600/20 text-green-400 border border-green-600/30' 
          : 'bg-red-600/20 text-red-400 border border-red-600/30'
      }`}>
        {mensaje.tipo === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
        <span className="text-sm">{mensaje.texto}</span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Mensaje de estado global */}
      <MensajeEstado />
      
      {/* Información actual del usuario */}
      <div className="bg-[#2b2d31] rounded-lg p-4 border border-[#ff007a]/20">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="relative">
            {userInfo.avatar_url ? (
              <img 
                src={userInfo.avatar_url} 
                alt="Avatar" 
                className="w-16 h-16 rounded-full object-cover border-2 border-[#ff007a]"
              />
            ) : (
              <div className="w-16 h-16 bg-gradient-to-br from-[#ff007a] to-[#cc0062] rounded-full flex items-center justify-center text-white font-bold text-xl">
                {userInfo.display_name ? userInfo.display_name.charAt(0).toUpperCase() : '?'}
              </div>
            )}
          </div>
          
          {/* Info del usuario */}
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white">
              {userInfo.display_name || userInfo.name}
            </h3>
            {userInfo.nickname && (
              <p className="text-sm text-white/60">
                Nombre real: {userInfo.name}
              </p>
            )}
            <p className="text-sm text-[#ff007a]">
              {t("settings.languageLabel")}: {idiomas[userInfo.preferred_language] || 'Español'}
            </p>
          </div>
        </div>
      </div>

      {/* Configuraciones */}
      <Seccion titulo={t("settings.profile")}>
        <ConfigBoton 
          icon={<Camera size={18} />} 
          texto={t("settings.managePhoto")} 
          onClick={() => abrirModal("managePhoto")} 
        />
        <ConfigBoton 
          icon={<User size={18} />} 
          texto={t("settings.editAlias")} 
          onClick={() => abrirModal("editAlias")} 
        />
        <ConfigBoton 
          icon={<Globe size={18} />} 
          texto={t("settings.language")} 
          onClick={() => abrirModal("language")} 
        />
      </Seccion>

      {/* MODAL GESTIONAR FOTO */}
      {modalActivo === "managePhoto" && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1f2125] border border-[#ff007a]/30 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="p-6 border-b border-[#ff007a]/20 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">{t("settings.managePhotoTitle")}</h3>
              <button onClick={cerrarModal} className="text-white/60 hover:text-white">
                <X size={20} />
              </button>
            </div>

            {/* Contenido */}
            <div className="p-6">
              <MensajeEstado />
              
              {/* Opciones de foto */}
              <div className="space-y-4">
                {/* Subir archivo */}
                <div className="border-2 border-dashed border-[#ff007a]/30 rounded-lg p-6 text-center">
                  <Upload className="mx-auto mb-3 text-[#ff007a]" size={32} />
                  <h4 className="font-medium text-white mb-2">{t?.('settings.managePhotoModal.uploadFromFile') || 'Subir desde archivo'}</h4>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={manejarSeleccionArchivo}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-[#ff007a] hover:bg-[#e6006e] text-white px-4 py-2 rounded-lg text-sm"
                  >
                    {t?.('settings.managePhotoModal.selectFile') || 'Seleccionar archivo'}
                  </button>
                  <p className="text-xs text-white/60 mt-2">{t?.('settings.managePhotoModal.fileFormats') || 'JPEG, PNG, WebP (máx. 5MB)'}</p>
                </div>

                {/* Vista previa de archivo seleccionado */}
                {fotoPreview && (
                  <div className="border border-[#ff007a]/30 rounded-lg p-4">
                    <h4 className="font-medium text-white mb-2">{t?.('settings.managePhotoModal.preview') || 'Vista previa'}</h4>
                    <div className="flex items-center gap-4">
                      <img src={fotoPreview} alt="Preview" className="w-20 h-20 rounded-full object-cover" />
                      <div className="flex-1">
                        <button
                          onClick={subirFoto}
                          disabled={loading}
                          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50 mr-2"
                        >
                          {loading ? (t?.('settings.managePhotoModal.uploading') || 'Subiendo...') : (t?.('settings.managePhotoModal.confirmUpload') || 'Confirmar subida')}
                        </button>
                        <button
                          onClick={() => {
                            setFotoSeleccionada(null);
                            setFotoPreview(null);
                          }}
                          className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm"
                        >
                          {t?.('settings.managePhotoModal.cancel') || 'Cancelar'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Separador */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#ff007a]/20"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-[#1f2125] text-white/60">{t?.('settings.managePhotoModal.or') || 'o'}</span>
                  </div>
                </div>

                {/* Tomar foto con cámara */}
                <div className="border border-[#ff007a]/30 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Camera className="text-[#ff007a]" size={24} />
                    <h4 className="font-medium text-white">{t?.('settings.managePhotoModal.takePhoto') || 'Tomar foto'}</h4>
                  </div>
                  
                  {(() => { return null; })()}
                  
                  {!camaraActiva ? (
                    <button
                      onClick={() => {
                        activarCamara();
                      }}
                      disabled={loading}
                      className="bg-[#ff007a] hover:bg-[#e6006e] text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
                    >
                      {loading ? (t?.('settings.managePhotoModal.activating') || 'Activando...') : (t?.('settings.managePhotoModal.activateCamera') || 'Activar cámara')}
                    </button>
                  ) : (
                    <div className="space-y-3">
                      {(() => { return null; })()}
                      <div className="relative w-full max-w-sm mx-auto bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '1/1', minHeight: '300px' }}>
                        <video
                          ref={(el) => {
                              videoRef.current = el;
                              if (el) {
                                // debug: element attached
                              }
                            }}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover"
                          style={{ display: stream ? 'block' : 'none', width: '100%', height: '100%' }}
                          onLoadedMetadata={() => {
                            if (videoRef.current) {
                              // metadata disponible: videoWidth/videoHeight/readyState
                            }
                          }}
                          onCanPlay={() => {
                          }}
                          onPlay={() => {
                          }}
                          onError={(e) => {
                            if (videoRef.current) {
                            }
                          }}
                        />
                        {!stream && (
                          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                            <p className="text-white/60">{t?.('settings.managePhotoModal.loadingCamera') || 'Cargando cámara...'}</p>
                          </div>
                        )}
                      </div>
                      <canvas ref={canvasRef} className="hidden" />
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={tomarFoto}
                          disabled={loading || !stream}
                          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
                        >
                          {loading ? (t?.('settings.managePhotoModal.processing') || 'Procesando...') : (t?.('settings.managePhotoModal.capturePhoto') || 'Tomar foto')}
                        </button>
                        <button
                          onClick={() => {
                            // Detener stream
                            if (stream) {
                              stream.getTracks().forEach(track => track.stop());
                              setStream(null);
                            }
                            
                            // Limpiar video ref
                            if (videoRef.current) {
                              videoRef.current.srcObject = null;
                            }
                            
                            setCamaraActiva(false);
                          }}
                          className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm"
                        >
                          {t?.('settings.managePhotoModal.cancel') || 'Cancelar'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Eliminar foto actual */}
                {userInfo.avatar_url && (
                  <>
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-[#ff007a]/20"></div>
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-[#1f2125] text-white/60">{t?.('settings.managePhotoModal.or') || 'o'}</span>
                      </div>
                    </div>
                    
                    <div className="border border-red-600/30 rounded-lg p-4 bg-red-600/10">
                      <div className="flex items-center gap-3 mb-3">
                        <Trash2 className="text-red-400" size={24} />
                        <h4 className="font-medium text-white">{t?.('settings.managePhotoModal.deleteCurrentPhoto') || 'Eliminar foto actual'}</h4>
                      </div>
                      <button
                        onClick={eliminarFoto}
                        disabled={loading}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
                      >
                        {loading ? (t?.('settings.managePhotoModal.deleting') || 'Eliminando...') : (t?.('settings.managePhotoModal.deletePhoto') || 'Eliminar foto')}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR APODO */}
      {modalActivo === "editAlias" && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1f2125] border border-[#ff007a]/30 rounded-xl shadow-2xl w-full max-w-md">
            {/* Header */}
            <div className="p-6 border-b border-[#ff007a]/20 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">{t?.('settings.editAliasModal.title') || 'Editar Apodo'}</h3>
              <button onClick={cerrarModal} className="text-white/60 hover:text-white">
                <X size={20} />
              </button>
            </div>

            {/* Contenido */}
            <div className="p-6">
              <MensajeEstado />
              
              <div className="space-y-4">
                <div>
                  <label className="block text-white text-sm font-medium mb-2">
                    {t?.('settings.editAliasModal.customNickname') || 'Tu apodo personalizado'}
                  </label>
                  <input
                    type="text"
                    value={nuevoApodo}
                    onChange={(e) => setNuevoApodo(e.target.value)}
                    maxLength={8}
                    className="w-full px-4 py-3 bg-[#1a1c20] text-white placeholder-white/60 rounded-lg outline-none focus:ring-2 focus:ring-[#ff007a]/50 border border-[#3a3d44]"
                    placeholder={t?.('settings.editAliasModal.nicknamePlaceholder') || 'Ingresa tu apodo'}
                  />
                  <p className="text-xs text-white/50 mt-1">
                    {nuevoApodo.length}/8 {t?.('settings.editAliasModal.characters') || 'caracteres'}
                  </p>
                </div>

                {/* Vista previa */}
                <div className="bg-[#2b2d31] rounded-lg p-3">
                  <p className="text-white/70 text-xs mb-1">{t?.('settings.editAliasModal.preview') || 'Vista previa:'}</p>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-[#ff007a] to-[#cc0062] rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {(nuevoApodo.trim() || userInfo.name || '?').charAt(0).toUpperCase()}
                    </div>
                    <span className="text-white font-medium">
                      {nuevoApodo.trim() || userInfo.name}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-white/60 bg-[#ff007a]/10 p-2 rounded border-l-2 border-[#ff007a]">
                  💡 {t?.('settings.editAliasModal.nicknameInfo') || 'Tu apodo es como te verán otros usuarios. Tu nombre real seguirá siendo'} {userInfo.name}
                </div>
              </div>
            </div>

            {/* Botones */}
            <div className="p-6 border-t border-[#ff007a]/20 flex gap-3">
              {userInfo.nickname && (
                <button
                  onClick={eliminarApodo}
                  disabled={loading}
                  className="flex-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  {loading ? (t?.('settings.editAliasModal.deleting') || 'Eliminando...') : (t?.('settings.editAliasModal.useRealName') || 'Usar nombre real')}
                </button>
              )}
              <button
                onClick={cerrarModal}
                disabled={loading}
                className="flex-1 bg-[#3a3d44] hover:bg-[#4a4d54] text-white px-4 py-2 rounded-lg transition-colors"
              >
                {t?.('settings.editAliasModal.cancel') || 'Cancelar'}
              </button>
              <button
                onClick={guardarApodo}
                disabled={loading || !nuevoApodo.trim()}
                className="flex-1 bg-[#ff007a] hover:bg-[#e6006e] text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? (t?.('settings.editAliasModal.saving') || 'Guardando...') : (t?.('settings.editAliasModal.save') || 'Guardar')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SELECCIÓN DE IDIOMA */}
      {modalActivo === "language" && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1f2125] border border-[#ff007a]/30 rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="p-6 border-b border-[#ff007a]/20 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">{t?.('settings.languageModal.title') || 'Seleccionar Idioma'}</h3>
              <button onClick={cerrarModal} className="text-white/60 hover:text-white">
                <X size={20} />
              </button>
            </div>

            {/* Contenido */}
            <div className="p-6">
              <MensajeEstado />
              
              <p className="text-white/70 text-sm mb-4">
                {t?.('settings.languageModal.description') || 'Selecciona tu idioma preferido para las traducciones automáticas'}
              </p>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {Object.entries(idiomas).map(([codigo, nombre]) => (
                  <label
                    key={codigo}
                    className="flex items-center gap-3 p-3 hover:bg-[#2b2d31] rounded-lg cursor-pointer transition-colors"
                  >
                    <input
                      type="radio"
                      name="idioma"
                      value={codigo}
                      checked={idiomaSeleccionado === codigo}
                      onChange={(e) => setIdiomaSeleccionado(e.target.value)}
                      className="w-4 h-4 text-[#ff007a] focus:ring-[#ff007a] focus:ring-2"
                    />
                    <span className="text-white">{nombre}</span>
                    {codigo === userInfo.preferred_language && (
                      <span className="text-xs bg-[#ff007a]/20 text-[#ff007a] px-2 py-1 rounded-full">
                        {t?.('settings.languageModal.current') || 'Actual'}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>

            {/* Botones */}
            <div className="p-6 border-t border-[#ff007a]/20 flex gap-3">
              <button
                onClick={cerrarModal}
                disabled={loading}
                className="flex-1 bg-[#3a3d44] hover:bg-[#4a4d54] text-white px-4 py-2 rounded-lg transition-colors"
              >
                {t?.('settings.languageModal.cancel') || 'Cancelar'}
              </button>
              <button
                onClick={guardarIdioma}
                disabled={loading || idiomaSeleccionado === userInfo.preferred_language}
                className="flex-1 bg-[#ff007a] hover:bg-[#e6006e] text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? (t?.('settings.languageModal.saving') || 'Guardando...') : (t?.('settings.languageModal.saveLanguage') || 'Guardar idioma')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileSettings;