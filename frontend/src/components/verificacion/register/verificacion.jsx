import React, { useState } from "react";
import { useTranslation } from 'react-i18next';
import EjemploSelfie from "../../imagenes/selfie.png";
import EjemploDocumento from "../../imagenes/documento.png";
import EjemploSelfieDocumento from "../../imagenes/fotodocu.png";
import logoproncipal from '../../imagenes/logoprincipal.png';
import VideoRecorder from "./recorderGen";
import api from "../../../api/axios";
import Header from "../../modelo/header";
import { useNavigate } from "react-router-dom";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function VerificacionIdentidad() {
  const [paso, setPaso] = useState(1);
  const [imagenes, setImagenes] = useState({
    selfie: null,
    documento: null,
    selfieDoc: null,
  });
  const [previewImagenes, setPreviewImagenes] = useState({
    selfie: null,
    documento: null,
    selfieDoc: null,
  });
  const [mostrarModalVideo, setMostrarModalVideo] = useState(false);
  const [video, setVideo] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const navigate = useNavigate();
  const [mensaje, setMensaje] = useState(null);
  const { t } = useTranslation();

  // Función para corregir orientación de imagen (específica para móviles)
  const corregirOrientacionImagen = (file) => {
    return new Promise((resolve, reject) => {
      // Si no es imagen, retornar original
      if (!file.type.startsWith('image/')) {
        resolve(file);
        return;
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      const timeout = setTimeout(() => {
        console.error('Timeout procesando imagen');
        resolve(file); // Si toma mucho tiempo, usar original
      }, 10000); // 10 segundos timeout
      
      img.onload = () => {
        clearTimeout(timeout);
        
        try {
          // Para móviles, mantener dimensiones razonables
          let { width, height } = img;
          const maxSize = 1920;
          
          // Redimensionar si es muy grande
          if (width > maxSize || height > maxSize) {
            const ratio = Math.min(maxSize / width, maxSize / height);
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
          }
          
          // Configurar canvas
          canvas.width = width;
          canvas.height = height;
          
          // Limpiar canvas
          ctx.clearRect(0, 0, width, height);
          
          // Dibujar imagen redimensionada
          ctx.drawImage(img, 0, 0, width, height);
          
          // Convertir a blob - usar JPEG para mejor compatibilidad móvil
          canvas.toBlob((blob) => {
            if (!blob) {
              console.error('Error creando blob');
              resolve(file);
              return;
            }
            
            // Crear nuevo archivo con nombre seguro
            const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
            const correctedFile = new File([blob], fileName, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            
            console.log(`✅ Imagen procesada:`, {
              original: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
              procesada: `${(correctedFile.size / 1024 / 1024).toFixed(2)}MB`,
              dimensiones: `${width}x${height}`
            });
            
            resolve(correctedFile);
          }, 'image/jpeg', 0.85); // Calidad 85% para balance
          
        } catch (error) {
          console.error('Error procesando imagen:', error);
          clearTimeout(timeout);
          resolve(file); // Si hay error, usar archivo original
        }
      };
      
      img.onerror = () => {
        console.error('Error cargando imagen');
        clearTimeout(timeout);
        resolve(file); // Si no se puede cargar, usar original
      };
      
      // Crear URL para la imagen
      try {
        img.src = URL.createObjectURL(file);
      } catch (error) {
        console.error('Error creando URL:', error);
        clearTimeout(timeout);
        resolve(file);
      }
    });
  };

  const handleImagen = async (e, tipo) => {
    const file = e.target.files[0];
    if (file) {
      try {
        console.log(`📱 Procesando ${tipo}:`, {
          nombre: file.name,
          tamaño: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
          tipo: file.type,
          dispositivo: navigator.userAgent.includes('Mobile') ? 'Móvil' : 'Desktop'
        });

        // Validación previa para móviles
        if (file.size > 10 * 1024 * 1024) { // 10MB
          setMensaje({
            tipo: "error",
            texto: `⚠️ La imagen es muy grande (${(file.size / 1024 / 1024).toFixed(2)}MB). Máximo 10MB.`
          });
          return;
        }

        // Corregir orientación antes de guardar
        const imagenCorregida = await corregirOrientacionImagen(file);
        
        console.log(`✅ Imagen ${tipo} procesada:`, {
          tamañoOriginal: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
          tamañoFinal: `${(imagenCorregida.size / 1024 / 1024).toFixed(2)}MB`
        });
        
        setImagenes(prev => ({ ...prev, [tipo]: imagenCorregida }));
        setPreviewImagenes(prev => ({ ...prev, [tipo]: URL.createObjectURL(imagenCorregida) }));
        
        // Avanzar al siguiente paso
        if (tipo === "selfie") setPaso(2);
        else if (tipo === "documento") setPaso(3);
        else if (tipo === "selfieDoc") {
          setPaso(4);
          // Abrir modal automáticamente al completar la tercera etapa
          setTimeout(() => {
            setMostrarModalVideo(true);
          }, 500); // Pequeño delay para mejor UX
        }
      } catch (error) {
        console.error(`❌ Error procesando ${tipo}:`, error);
        setMensaje({
          tipo: "error",
          texto: `Error procesando la imagen ${tipo}. Por favor, intenta con otra foto.`
        });
      }
    }
  };

  const calcularProgreso = () => {
    const completas = Object.values(imagenes).filter(Boolean).length;
    const tieneVideo = video ? 1 : 0;
    const total = completas + tieneVideo;
    return `${Math.round((total / 4) * 100)}%`;
  };

  const pasosCompletos = imagenes.selfie && imagenes.documento && imagenes.selfieDoc;

  const handleEnviarVerificacion = async () => {
    if (!video || !pasosCompletos) {
      setMensaje({ 
        tipo: "error", 
        texto: `⚠️ ${t('verificacion.messages.incompleteSteps')}` 
      });
      return;
    }

    const tiposVideoValidos = ['video/webm', 'video/mp4', 'video/quicktime'];
    if (!tiposVideoValidos.includes(video.type)) {
      setMensaje({ 
        tipo: "error", 
        texto: `❌ ${t('verificacion.messages.invalidVideoType', { type: video.type })}` 
      });
      return;
    }

    console.log('📤 Enviando verificación con chunks desde:', {
      dispositivo: navigator.userAgent.includes('Mobile') ? 'Móvil' : 'Desktop',
      userAgent: navigator.userAgent,
      archivos: {
        selfie: `${(imagenes.selfie.size / 1024 / 1024).toFixed(2)}MB - ${imagenes.selfie.type}`,
        documento: `${(imagenes.documento.size / 1024 / 1024).toFixed(2)}MB - ${imagenes.documento.type}`,
        selfieDoc: `${(imagenes.selfieDoc.size / 1024 / 1024).toFixed(2)}MB - ${imagenes.selfieDoc.type}`,
        video: `${(video.size / 1024 / 1024).toFixed(2)}MB - ${video.type}`
      }
    });

    // Validaciones de tamaño
    const maxImageSize = 5 * 1024 * 1024; // 5MB
    const maxVideoSize = 100 * 1024 * 1024; // 100MB
    
    if (imagenes.selfie.size > maxImageSize) {
      setMensaje({ tipo: "error", texto: `⚠️ Selfie muy grande: ${(imagenes.selfie.size / 1024 / 1024).toFixed(2)}MB. Máximo: 5MB` });
      return;
    }
    
    if (imagenes.documento.size > maxImageSize) {
      setMensaje({ tipo: "error", texto: `⚠️ Documento muy grande: ${(imagenes.documento.size / 1024 / 1024).toFixed(2)}MB. Máximo: 5MB` });
      return;
    }
    
    if (imagenes.selfieDoc.size > maxImageSize) {
      setMensaje({ tipo: "error", texto: `⚠️ Selfie con documento muy grande: ${(imagenes.selfieDoc.size / 1024 / 1024).toFixed(2)}MB. Máximo: 5MB` });
      return;
    }
    
    if (video.size > maxVideoSize) {
      setMensaje({ tipo: "error", texto: `⚠️ Video muy grande: ${(video.size / 1024 / 1024).toFixed(2)}MB. Máximo: 100MB` });
      return;
    }

    try {
      setEnviando(true);
      setMensaje({ tipo: "info", texto: `📤 Preparando archivos...` });

              // ========== FUNCIÓN PARA SUBIR VIDEO POR CHUNKS ==========
      const subirVideoPorChunks = async (videoFile) => {
        // Chunks más grandes para reducir requests
        const CHUNK_SIZE = 1.5 * 1024 * 1024; // 1.5MB por chunk (bajo límite de 2MB)
        const totalChunks = Math.ceil(videoFile.size / CHUNK_SIZE);
        const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        console.log(`🎬 Iniciando subida por chunks optimizada:`, {
          videoSize: `${(videoFile.size / 1024 / 1024).toFixed(2)}MB`,
          totalChunks,
          chunkSize: `${(CHUNK_SIZE / 1024 / 1024).toFixed(1)}MB`,
          uploadId
        });

        // Subir chunks con reintentos
        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
          const start = chunkIndex * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, videoFile.size);
          const chunk = videoFile.slice(start, end);
          
          const progreso = Math.round(((chunkIndex + 1) / totalChunks) * 70); // 70% para video chunks
          setMensaje({ 
            tipo: "info", 
            texto: `📤 Subiendo video... ${progreso}% (${chunkIndex + 1}/${totalChunks} partes)` 
          });

          // Función para subir un chunk con reintentos
          const subirChunkConReintentos = async (intentos = 3) => {
            for (let intento = 1; intento <= intentos; intento++) {
              try {
                const chunkFormData = new FormData();
                chunkFormData.append('chunk', chunk);
                chunkFormData.append('chunkIndex', chunkIndex);
                chunkFormData.append('totalChunks', totalChunks);
                chunkFormData.append('uploadId', uploadId);
                chunkFormData.append('originalName', videoFile.name || 'video.mp4');
                
                const response = await api.post(`${API_BASE_URL}/api/verificacion/upload-chunk`, chunkFormData, {
                  headers: { 'Content-Type': 'multipart/form-data' },
                  timeout: 15000 // 15 segundos por chunk (más rápido)
                });
                
                console.log(`✅ Chunk ${chunkIndex + 1}/${totalChunks} subido (intento ${intento}):`, response.data);
                return; // Éxito, salir del loop de reintentos
                
              } catch (chunkError) {
                console.warn(`⚠️ Chunk ${chunkIndex + 1} falló en intento ${intento}:`, chunkError.message);
                
                if (intento === intentos) {
                  // Último intento, lanzar error
                  throw new Error(`Chunk ${chunkIndex + 1} falló después de ${intentos} intentos: ${chunkError.response?.data?.message || chunkError.message}`);
                }
                
                // Esperar antes del siguiente intento
                await new Promise(resolve => setTimeout(resolve, 1000 * intento));
              }
            }
          };

          await subirChunkConReintentos();
        }
        
        return uploadId;
      };

      // 1. Subir video por chunks (si es mayor a 1.5MB)
      let videoUploadId = null;
      if (video.size > 1.5 * 1024 * 1024) { // Si es mayor a 1.5MB, usar chunks
        videoUploadId = await subirVideoPorChunks(video);
        setMensaje({ tipo: "info", texto: `✅ Video subido por chunks. Enviando imágenes...` });
      }

      // 2. Crear FormData con imágenes y referencia del video
      const formData = new FormData();
      formData.append("selfie", imagenes.selfie, imagenes.selfie.name || 'selfie.jpg');
      formData.append("documento", imagenes.documento, imagenes.documento.name || 'documento.jpg');
      formData.append("selfie_doc", imagenes.selfieDoc, imagenes.selfieDoc.name || 'selfie_doc.jpg');
      
      if (videoUploadId) {
        // Si se subió por chunks, enviar solo el ID
        formData.append("video_upload_id", videoUploadId);
      } else {
        // Si es pequeño, enviar normal
        formData.append("video", video, video.name || 'video.mp4');
      }
      
      console.log('📋 FormData final creado:', {
        selfie: formData.get('selfie'),
        documento: formData.get('documento'), 
        selfie_doc: formData.get('selfie_doc'),
        video_upload_id: formData.get('video_upload_id'),
        video_directo: formData.get('video')
      });

      // 3. Enviar verificación final
      setMensaje({ tipo: "info", texto: `📤 Finalizando verificación...` });
      
      const response = await api.post(`${API_BASE_URL}/api/verificacion`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000, // 1 minuto para el request final
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          const progresoTotal = 70 + Math.round(percentCompleted * 0.3); // 70% video + 30% imágenes
          setMensaje({ 
            tipo: "info", 
            texto: `📤 Finalizando... ${progresoTotal}%` 
          });
        }
      });

      console.log('✅ Verificación enviada exitosamente:', response.data);

      // Limpiar estado
      setImagenes({ selfie: null, documento: null, selfieDoc: null });
      setPreviewImagenes({ selfie: null, documento: null, selfieDoc: null });
      setVideo(null);
      setPaso(1);
      setMensaje({ tipo: "exito", texto: `✅ ${t('verificacion.messages.success')}` });
      
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
    } catch (error) {
      console.error("❌ Error detallado al enviar verificación:", {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });

      if (error.response?.status === 422) {
        const errores = error.response.data.errors || {};
        let mensajeError = `❌ ${t('verificacion.messages.validationError')}\n\n`;
        Object.keys(errores).forEach(campo => {
          mensajeError += `• ${campo}: ${errores[campo].join(', ')}\n`;
        });
        setMensaje({ tipo: "error", texto: mensajeError });
      } else if (error.response?.status === 413) {
        setMensaje({ tipo: "error", texto: `📁 ${t('verificacion.messages.fileTooLarge')}` });
      } else if (error.message.includes('chunk')) {
        setMensaje({ tipo: "error", texto: `❌ Error subiendo video: ${error.message}` });
      } else {
        setMensaje({ tipo: "error", texto: `❌ ${t('verificacion.messages.genericError')}` });
      }
    } finally {
      setEnviando(false);
    }
  };

  const eliminarImagen = (tipo) => {
    setImagenes(prev => ({ ...prev, [tipo]: null }));
    setPreviewImagenes(prev => ({ ...prev, [tipo]: null }));
    
    // Retroceder paso si es necesario
    if (tipo === "selfieDoc") setPaso(3);
    else if (tipo === "documento") setPaso(2);
    else if (tipo === "selfie") setPaso(1);
  };

  const eliminarVideo = () => {
    setVideo(null);
    if (pasosCompletos) setPaso(3);
  };

  // Configuración de pasos con traducciones
  const pasos = [
    { 
      key: "selfie",
      tipo: "selfie", 
      pasoMinimo: 1, 
      imagen: EjemploSelfie
    },
    { 
      key: "document",
      tipo: "documento", 
      pasoMinimo: 2, 
      imagen: EjemploDocumento
    },
    { 
      key: "selfieDoc",
      tipo: "selfieDoc", 
      pasoMinimo: 3, 
      imagen: EjemploSelfieDocumento
    },
  ];

  return (
    <>
      {/* Estilos CSS personalizados */}
      <style jsx>{`
        .card-step {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          transform: scale(0.98);
        }
        
        .card-step.active {
          transform: scale(1);
          box-shadow: 0 20px 25px -5px rgba(255, 0, 122, 0.1), 0 10px 10px -5px rgba(255, 0, 122, 0.04);
        }
        
        .card-step.completed {
          transform: scale(1);
          background: linear-gradient(135deg, rgba(255, 0, 122, 0.1) 0%, rgba(255, 0, 122, 0.05) 100%);
        }
        
        .progress-bar {
          background: linear-gradient(90deg, #ff007a 0%, #e6006e 100%);
          box-shadow: 0 4px 15px rgba(255, 0, 122, 0.3);
        }
        
        .file-input {
          transition: all 0.2s ease;
        }
        
        .file-input:hover {
          transform: translateY(-1px);
        }
        
        .preview-image {
          object-fit: cover;
          transform: none !important;
          image-orientation: from-image;
        }
        
        .floating-action {
          animation: float 3s ease-in-out infinite;
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-5px); }
        }
        
        .message-enter {
          animation: slideInFromRight 0.3s ease-out;
        }
        
        @keyframes slideInFromRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>

      <div className="bg-ligand-mix-dark min-h-screen flex flex-col">
        <Header />

        <div className="flex-grow flex flex-col items-center justify-center px-4 py-10">
          {/* Título con icono */}
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-gradient-to-r from-[#ff007a] to-[#e6006e] rounded-full">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h1 className="text-white text-4xl font-bold">{t('verificacion.title')}</h1>
          </div>

          {/* Barra de progreso mejorada */}
          <div className="w-full max-w-2xl mb-10">
            <div className="flex justify-between items-center mb-3">
              <span className="text-white/70 text-sm">{t('verificacion.progressLabel')}</span>
              <span className="text-[#ff007a] font-bold">{calcularProgreso()}</span>
            </div>
            <div className="w-full h-3 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-3 progress-bar rounded-full transition-all duration-500"
                style={{ width: calcularProgreso() }}
              ></div>
            </div>
          </div>

          {/* Mensajes de estado */}
          {mensaje && (
            <div className={`mb-6 p-4 rounded-xl border message-enter max-w-2xl w-full ${
              mensaje.tipo === "exito" ? "bg-green-900/20 border-green-500 text-green-300" :
              mensaje.tipo === "error" ? "bg-red-900/20 border-red-500 text-red-300" :
              "bg-blue-900/20 border-blue-500 text-blue-300"
            }`}>
              <p className="text-center whitespace-pre-line">{mensaje.texto}</p>
            </div>
          )}

          {/* Tarjetas de pasos */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl mb-8">
            {pasos.map(({ key, tipo, pasoMinimo, imagen }) => (
              <div
                key={tipo}
                className={`card-step p-6 rounded-2xl border-2 ${
                  imagenes[tipo] ? "card-step completed border-[#ff007a]" :
                  paso >= pasoMinimo ? "card-step active border-[#ff007a] bg-[#2b2d31]" : 
                  "border-gray-600 bg-[#1f2125] opacity-60"
                }`}
              >
                {/* Header de la tarjeta */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{t(`verificacion.steps.${key}.icon`)}</span>
                    <div>
                      <h3 className="text-white font-bold text-lg">{t(`verificacion.steps.${key}.title`)}</h3>
                      <p className="text-white/60 text-sm">{t(`verificacion.steps.${key}.description`)}</p>
                    </div>
                  </div>
                  {imagenes[tipo] && (
                    <button
                      onClick={() => eliminarImagen(tipo)}
                      className="text-red-400 hover:text-red-300 p-1"
                      title={t('verificacion.actions.deleteImage')}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Preview de imagen */}
                <div className="w-full h-48 bg-[#1a1c20] rounded-xl mb-4 overflow-hidden flex items-center justify-center border-2 border-dashed border-gray-500 relative">
                  <img
                    src={previewImagenes[tipo] || imagen}
                    alt={t(`verificacion.steps.${key}.title`)}
                    className="preview-image w-full h-full"
                  />
                  {imagenes[tipo] && (
                    <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Input de archivo optimizado para móvil */}
                <label className={`file-input block w-full p-3 rounded-lg text-center cursor-pointer transition-all ${
                  paso >= pasoMinimo ? 
                    "bg-[#ff007a] hover:bg-[#e6006e] text-white font-semibold" : 
                    "bg-gray-600 text-gray-300 cursor-not-allowed"
                }`}>
                  <input
                    type="file"
                    accept="image/*"
                    capture={tipo === "selfie" ? "user" : "environment"} // Cámara frontal para selfie, trasera para documentos
                    onChange={(e) => handleImagen(e, tipo)}
                    disabled={paso < pasoMinimo}
                    className="hidden"
                  />
                  {imagenes[tipo] ? 
                    `✅ ${t(`verificacion.steps.${key}.changeText`)}` : 
                    `📷 ${t(`verificacion.steps.${key}.uploadText`)}`
                  }
                </label>
              </div>
            ))}
          </div>

          {/* Sección de video - Solo mostrar el botón si no está el modal abierto */}
          {pasosCompletos && !mostrarModalVideo && (
            <div className="w-full max-w-2xl">
              <div className="bg-[#2b2d31] p-6 rounded-2xl border-2 border-[#ff007a] mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{t('verificacion.video.icon')}</span>
                    <div>
                      <h3 className="text-white font-bold text-xl">{t('verificacion.video.title')}</h3>
                      <p className="text-white/60">{t('verificacion.video.description')}</p>
                    </div>
                  </div>
                  {video && (
                    <button
                      onClick={eliminarVideo}
                      className="text-red-400 hover:text-red-300 p-1"
                      title={t('verificacion.actions.deleteVideo')}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>

                {video ? (
                  <div className="bg-green-900/20 border border-green-500 rounded-lg p-4 mb-4">
                    <div className="flex items-center justify-center gap-3">
                      <svg className="w-6 h-6 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-green-300 font-semibold">
                        {t('verificacion.video.recorded')} ({(video.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setMostrarModalVideo(true)}
                    className="floating-action w-full bg-gradient-to-r from-[#ff007a] to-[#e6006e] hover:from-[#e6006e] hover:to-[#cc005a] text-white font-bold py-4 px-6 rounded-xl shadow-lg transition-all transform hover:scale-105"
                  >
                    🎬 {t('verificacion.video.recordButton')}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Botón final de envío */}
          {pasosCompletos && video && (
            <button
              onClick={handleEnviarVerificacion}
              disabled={enviando}
              className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-4 px-8 rounded-xl shadow-lg transition-all transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed flex items-center gap-3"
            >
              {enviando ? (
                <>
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t('verificacion.actions.submitting')}
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  {t('verificacion.actions.submit')}
                </>
              )}
            </button>
          )}
        </div>

        {/* Modal para grabar video - Centrado y con animación */}
        {mostrarModalVideo && (
          <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
            <div className="bg-[#1a1c20] p-8 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border-2 border-[#ff007a] transform transition-all duration-300 scale-100">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-white text-2xl font-bold flex items-center gap-2">
                  <span className="text-3xl">{t('verificacion.video.icon')}</span>
                  {t('verificacion.video.modal.title')}
                </h2>
                <button
                  onClick={() => setMostrarModalVideo(false)}
                  className="text-white/50 hover:text-white p-2 rounded-full hover:bg-white/10 transition-all"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="bg-[#ff007a]/10 border border-[#ff007a]/30 rounded-lg p-4 mb-6">
                <h3 className="text-[#ff007a] font-semibold mb-2 flex items-center gap-2">
                  📋 {t('verificacion.video.modal.instructions')}
                </h3>
                <ul className="text-white/80 text-sm space-y-2">
                  {t('verificacion.video.modal.steps', { returnObjects: true }).map((step, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-[#ff007a] font-bold">•</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <VideoRecorder
                onRecorded={(file) => {
                  setVideo(file);
                  setMostrarModalVideo(false);
                  setPaso(4);
                }}
                onCancel={() => setMostrarModalVideo(false)}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}