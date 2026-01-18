// SubirHistoria.jsx - Versión actualizada con control de 1 semana
import React, { useRef, useState, useEffect } from "react";
import {
  UploadCloud,
  Camera,
  Trash,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  Play,
  Sparkles,
  Video,
  Square,
  RotateCcw,
  Heart,
  AlertTriangle
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Header from "./header";
import axios from "../../api/axios";
import { useAppNotifications } from "../../contexts/NotificationContext";

export default function SubirHistoria() {
  const { t } = useTranslation();
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const MAX_RECORDING_TIME = 15;
  
  const notifications = useAppNotifications();
  
  // 🆕 Guardar la duración del video cuando se valida la primera vez
  const [videoDuration, setVideoDuration] = useState(null);
  
  // Estados para historia existente
  const [existingStory, setExistingStory] = useState(null);
  const [loadingStory, setLoadingStory] = useState(true);
  const [showCamera, setShowCamera] = useState(false);
  
  // 🆕 Estados para control de tiempo
  const [canUpload, setCanUpload] = useState(true);
  const [uploadRestriction, setUploadRestriction] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);

  // Estados para grabación de video
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [recording, setRecording] = useState(false);
  const streamRef = useRef(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingIntervalRef = useRef(null);
  const recordingTimeRef = useRef(0); // 🆕 Referencia para capturar el tiempo actual
  const [videoBlob, setVideoBlob] = useState(null);
  const [isFlipped, setIsFlipped] = useState(true);

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60).toString().padStart(2, '0');
    const seconds = (time % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  // 🔥 SOLUCIÓN DEFINITIVA BASADA EN TU BACKEND

  // 1. FUNCIÓN PARA CREAR ARCHIVO CON EXTENSIÓN Y TIPO MIME EXACTOS
  const createPerfectFile = (originalFile, targetExtension = null) => {
        
    let finalName = originalFile.name;
    let finalType = originalFile.type;

    // Si es un Blob sin nombre (grabación)
    if (!finalName || finalName === '') {
      finalName = `recording_${Date.now()}.webm`;
      finalType = 'video/webm';
    }

    // Obtener extensión actual
    const currentExtension = finalName.split('.').pop().toLowerCase();
    
    // Mapeo exacto que acepta tu backend
    const validMimeTypes = {
      'jpeg': 'image/jpeg',
      'jpg': 'image/jpeg',
      'png': 'image/png',
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'mov': 'video/quicktime' // .mov files (QuickTime)
    };

    // Forzar el tipo MIME correcto basado en la extensión
    if (validMimeTypes[currentExtension]) {
      finalType = validMimeTypes[currentExtension];
    } else {
      // Si la extensión no es válida, usar el target o default
      if (targetExtension && validMimeTypes[targetExtension]) {
        const newExtension = targetExtension;
        finalName = finalName.replace(/\.[^/.]+$/, `.${newExtension}`);
        finalType = validMimeTypes[newExtension];
      } else {
        // Fallback: determinar por contenido
        if (originalFile.type.startsWith('image/')) {
          finalName = finalName.replace(/\.[^/.]+$/, '.jpg');
          finalType = 'image/jpeg';
        } else {
          finalName = finalName.replace(/\.[^/.]+$/, '.webm');
          finalType = 'video/webm';
        }
      }
    }

    // Crear el archivo perfecto
    const perfectFile = new File([originalFile], finalName, {
      type: finalType,
      lastModified: Date.now()
    });

        
    return perfectFile;
  };

  const validateFileForBackend = (file) => {
    const allowedExtensions = ['jpeg', 'jpg', 'png', 'mp4', 'webm', 'mov'];
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png', 
      'video/mp4',
      'video/webm',
      'video/quicktime' // .mov files
    ];

    const extension = file.name.split('.').pop().toLowerCase();
    
    
    // Verificar extensión
    if (!allowedExtensions.includes(extension)) {
      return {
        valid: false,
        error: `Extensión no válida: ${extension}. Permitidas: ${allowedExtensions.join(', ')}`
      };
    }

    // Verificar tipo MIME
    if (!allowedMimeTypes.includes(file.type)) {
      console.warn('⚠️ Tipo MIME no ideal:', file.type);
      // No fallar aquí, el createPerfectFile lo corregirá
    }

    // No hay límite de peso - permitir archivos de alta calidad
    // El peso no importa, solo la duración para videos

    return { valid: true };
  };

  const validateFileType = (file) => {
    
    // Solo permitir fotos o videos - nada más
    const allowedImageTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png'
    ];
    
    const allowedVideoTypes = [
      'video/mp4',
      'video/webm',
      'video/quicktime', // .mov files
      'video/x-msvideo', // .avi files
      'video/mpeg' // .mpeg files
    ];

    const allAllowedTypes = [...allowedImageTypes, ...allowedVideoTypes];

    // Verificar por tipo MIME
    if (allAllowedTypes.includes(file.type)) {
      return { valid: true, mediaType: file.type.startsWith('image/') ? 'image' : 'video' };
    }

    // Verificar por extensión como fallback
    const fileName = file.name.toLowerCase();
    const imageExtensions = ['.jpg', '.jpeg', '.png'];
    const videoExtensions = ['.mp4', '.webm', '.mov', '.avi'];

    const hasValidImageExt = imageExtensions.some(ext => fileName.endsWith(ext));
    const hasValidVideoExt = videoExtensions.some(ext => fileName.endsWith(ext));

    if (hasValidImageExt) {
      return { valid: true, mediaType: 'image' };
    }

    if (hasValidVideoExt) {
      return { valid: true, mediaType: 'video' };
    }

    // Si no es foto ni video, rechazar
    return { 
      valid: false, 
      mediaType: null,
      error: 'Solo se permiten archivos de imagen (JPG, PNG) o video (MP4, WEBM, MOV).'
    };
  };

  // 🆕 Verificar si puede subir historia
  const checkCanUpload = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token || token === 'null' || token === 'undefined') {
        console.warn('❌ Token inválido o no encontrado');
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
      } else {
        setCanUpload(false);
        setUploadRestriction(response.data);
        
        // Si hay tiempo de expiración, calcular tiempo restante
        if (response.data.expires_at) {
          calculateTimeRemaining(response.data.expires_at);
        }
      }
    } catch (error) {
            if (error.response?.status === 401) {
        notifications.unauthorized();
      }
    }
  };

  // 🆕 Calcular tiempo restante
  const calculateTimeRemaining = (expiresAt) => {
    const updateTime = () => {
      const now = new Date();
      const expires = new Date(expiresAt);
      const diff = expires.getTime() - now.getTime();
      
      if (diff <= 0) {
        setCanUpload(true);
        setUploadRestriction(null);
        setTimeRemaining(null);
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
    
    // Limpiar intervalo cuando el componente se desmonte
    return () => clearInterval(interval);
  };

  // Verificar historia existente
  const checkExistingStory = async () => {
    try {
      setLoadingStory(true);
      
      const token = localStorage.getItem('token');
      
      if (!token || token === 'null' || token === 'undefined') {
        console.warn('❌ Token inválido o no encontrado');
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
      
      const response = await axios.get("/api/stories/my-story", config);
      
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

  // useEffects
  useEffect(() => {
    checkExistingStory();
    checkCanUpload();
  }, []);

  useEffect(() => {
    if (showCamera) {
      initCamera();
    } else {
      stopCamera();
    }
    
    return () => {
      stopCamera();
    };
  }, [showCamera]);

  // ... (mantener todas las funciones de cámara existentes)
  const initCamera = async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter(device => device.kind === "videoinput");

      setDevices(videoDevices);

      if (videoDevices.length > 0) {
        const defaultDeviceId = videoDevices[0].deviceId;
        setSelectedDeviceId(defaultDeviceId);
        await startCamera(defaultDeviceId);
      } else {
        notifications.error("No se encontró ninguna cámara disponible");
      }
    } catch (error) {
            notifications.error("Hubo un problema al acceder a la cámara/micrófono");
    }
  };

  const startCamera = async (deviceId) => {
    if (!videoRef.current) return;

    setRecording(false);

    try {
      const constraints = {
        video: deviceId ? { deviceId: { exact: deviceId } } : true,
        audio: true,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      videoRef.current.srcObject = stream;

    } catch (err) {
            if (err.name === "NotAllowedError") {
        notifications.error("Permiso denegado. Por favor, permite acceso a la cámara en tu navegador");
      } else if (err.name === "NotFoundError") {
        notifications.error("No se encontró cámara o micrófono");
      } else {
        notifications.error(`Error al acceder a la cámara: ${err.message}`);
      }
    }
  };

  const createValidFile = (originalFile, forceType = null) => {
    
    let finalMimeType = forceType || originalFile.type;
    let finalName = originalFile.name;

    // Si no tiene nombre (es un Blob de grabación)
    if (!finalName) {
      finalName = `recording_${Date.now()}.webm`;
      finalMimeType = 'video/webm';
    }

    // Mapear extensiones a tipos MIME específicos que acepta el backend
    const extension = finalName.split('.').pop().toLowerCase();
    const mimeTypeMap = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg', 
      'png': 'image/png',
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'mov': 'video/quicktime' // .mov files (QuickTime)
    };

    // Forzar el tipo MIME correcto basado en la extensión
    if (mimeTypeMap[extension]) {
      finalMimeType = mimeTypeMap[extension];
    }

    // Crear nuevo File con tipo MIME explícito
    const validFile = new File([originalFile], finalName, {
      type: finalMimeType,
      lastModified: Date.now()
    });

    
    return validFile;
  };

  const diagnoseFile = async (file) => {
        
    // Información básica
    
    // Leer los primeros bytes para detectar el tipo real
    const arrayBuffer = await file.slice(0, 16).arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const hex = Array.from(uint8Array).map(b => b.toString(16).padStart(2, '0')).join(' ');
    
    // Detectar tipo por magic numbers
    const magicNumbers = {
      'FFD8FF': 'image/jpeg',
      '89504E47': 'image/png', 
      '1A45DFA3': 'video/webm',
      '00000018': 'video/mp4',
      '00000020': 'video/mp4'
    };

    const hexStart = hex.replace(/\s/g, '').toUpperCase().substring(0, 8);
    for (const [magic, detectedType] of Object.entries(magicNumbers)) {
      if (hexStart.startsWith(magic)) {
                break;
      }
    }

      };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    
    setRecording(false);
    setRecordingTime(0);
  };

  useEffect(() => {
    if (selectedDeviceId && showCamera) {
      startCamera(selectedDeviceId);
    }
  }, [selectedDeviceId]);

  const startRecording = () => {
    setRecordingTime(0);
    recordingTimeRef.current = 0; // 🆕 Resetear la referencia también
    notifications.recordingStarted();

    recordingIntervalRef.current = setInterval(() => {
      setRecordingTime(prev => {
        const newTime = prev + 1;
        recordingTimeRef.current = newTime; // 🆕 Actualizar la referencia en cada intervalo
        
        if (newTime >= MAX_RECORDING_TIME) {
          notifications.recordingLimit();
          stopRecording();
          return MAX_RECORDING_TIME;
        }
        
        return newTime;
      });
    }, 1000);

    if (!streamRef.current) {
      notifications.error("No hay acceso a la cámara");
      return;
    }

    const chunks = [];
    
    // Usar configuración más estable
    const options = {
      mimeType: 'video/webm'
    };

    // Verificar soporte del navegador
    if (!MediaRecorder.isTypeSupported('video/webm')) {
      if (MediaRecorder.isTypeSupported('video/mp4')) {
        options.mimeType = 'video/mp4';
      } else {
        delete options.mimeType; // Usar default del navegador
      }
    }
    
    
    const recorder = new MediaRecorder(streamRef.current, options);

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    recorder.onstop = () => {
            
      if (chunks.length === 0) {
        notifications.warning("No se grabó ningún contenido");
        return;
      }

      // 🆕 Capturar el tiempo final usando la referencia (siempre tiene el valor más reciente)
      const finalRecordingTime = recordingTimeRef.current || recordingTime;

      // Crear blob inicial
      const originalBlob = new Blob(chunks, { 
        type: options.mimeType || 'video/webm' 
      });

      // Crear archivo perfecto para el backend
      const recordingFile = createPerfectFile(originalBlob);

      setVideoBlob(recordingFile);
      const url = URL.createObjectURL(recordingFile);

      setFile(recordingFile);
      setPreviewUrl(url);
      setRecording(false);
      setShowCamera(false);
      
      // 🆕 Guardar la duración de la grabación (ya validada por el contador)
      // Usar el tiempo final capturado de la referencia, que es el tiempo real de grabación
      setVideoDuration(finalRecordingTime);
      
      mediaRecorderRef.current = null;
      notifications.recordingStopped();
      
          };

    recorder.onerror = (e) => {
            notifications.error('Error durante la grabación');
    };

    recorder.start(1000);
    mediaRecorderRef.current = recorder;
    setRecording(true);
  };

  const testFileBeforeSend = async (file) => {
        
    // Información del archivo
    
    // Crear FormData de prueba
    const testFormData = new FormData();
    testFormData.append("file", file);
    
    // Verificar lo que realmente se está enviando
        for (let [key, value] of testFormData.entries()) {
      if (value instanceof File) {
              } else {
              }
    }

    // Leer primeros bytes para confirmar
    await diagnoseFile(file);
    
        return true;
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    
    setRecording(false);
  };

  const switchCamera = () => {
    const currentIndex = devices.findIndex(device => device.deviceId === selectedDeviceId);
    const nextIndex = (currentIndex + 1) % devices.length;
    setSelectedDeviceId(devices[nextIndex].deviceId);
  };

  const handleVideoUpload = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    
    // Validar tipo de archivo - solo fotos o videos
    const typeValidation = validateFileType(selectedFile);
    if (!typeValidation.valid) {
      notifications.error(typeValidation.error || 'Solo se permiten archivos de imagen (JPG, PNG) o video (MP4, WEBM).');
      return;
    }

    // Validar archivo (sin límite de peso)
    const validation = validateFileForBackend(selectedFile);
    if (!validation.valid) {
      notifications.error(validation.error);
      return;
    }

    // Determinar si es video ANTES de crear el archivo perfecto
    const isVideo = selectedFile.type.startsWith('video/') || 
                    selectedFile.name.toLowerCase().endsWith('.mp4') || 
                    selectedFile.name.toLowerCase().endsWith('.webm') ||
                    selectedFile.name.toLowerCase().endsWith('.mov');

    if (isVideo) {
      // Validar duración del video usando el archivo ORIGINAL antes de procesarlo
      // máximo 15 segundos
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true; // Necesario para algunos navegadores
      
      let timeoutId;
      const objectUrl = URL.createObjectURL(selectedFile);
      
      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        URL.revokeObjectURL(objectUrl);
      };
      
      // Timeout de 10 segundos para cargar metadatos
      timeoutId = setTimeout(() => {
        cleanup();
        notifications.error('El video tardó demasiado en cargar. Intenta con otro archivo.');
      }, 10000);
      
      video.onloadedmetadata = () => {
        cleanup();
        const duration = video.duration;
        
        // Primero verificar si la duración es válida y finita
        if (!isFinite(duration) || isNaN(duration) || duration <= 0) {
          notifications.error('No se pudo determinar la duración del video. Intenta con otro archivo.');
          setVideoDuration(null); // Limpiar duración inválida
          return;
        }
        
        // Luego verificar si excede el límite de 15 segundos
        if (duration > 15) {
          notifications.error(`El video no puede durar más de 15 segundos. Duración actual: ${duration.toFixed(1)}s`);
          setVideoDuration(null); // Limpiar duración inválida
          return;
        }
        
        // 🆕 Guardar la duración del video para usarla después
        setVideoDuration(duration);
        
        // Si todo está bien, crear el archivo perfecto y proceder
        const perfectFile = createPerfectFile(selectedFile);
        setFile(perfectFile);
        setPreviewUrl(URL.createObjectURL(perfectFile));
        setShowCamera(false);
        notifications.fileLoaded('video');
      };
      
      video.onerror = (error) => {
        cleanup();
        console.error('Error al cargar video:', error);
        notifications.error('Error al procesar el video. Asegúrate de que el archivo sea un video válido.');
      };
      
      video.src = objectUrl;
    } else {
      // Es una imagen - crear archivo perfecto directamente
      const perfectFile = createPerfectFile(selectedFile);
      setFile(perfectFile);
      setPreviewUrl(URL.createObjectURL(perfectFile));
      setShowCamera(false);
      notifications.fileLoaded('image');
    }

      };

  const createCompatibleBlob = (originalBlob, fileName) => {
    let mimeType = originalBlob.type;
    
    // Si el blob no tiene tipo MIME o tiene uno genérico, inferirlo del nombre
    if (!mimeType || mimeType === 'application/octet-stream') {
      const extension = fileName.split('.').pop().toLowerCase();
      
      switch (extension) {
        case 'mp4':
          mimeType = 'video/mp4';
          break;
        case 'webm':
          mimeType = 'video/webm';
          break;
        case 'jpg':
        case 'jpeg':
          mimeType = 'image/jpeg';
          break;
        case 'png':
          mimeType = 'image/png';
          break;
        default:
          mimeType = originalBlob.type || 'video/webm'; // Default para grabaciones
      }
    }
    
        
    return new Blob([originalBlob], { type: mimeType });
  };

  const handleCameraClick = () => {
    if (!canUpload) {
      if (uploadRestriction?.reason === 'pending_story') {
        notifications.storyPending();
      } else if (uploadRestriction?.reason === 'active_story') {
        notifications.warning(uploadRestriction.message);
      }
      return;
    }
    
    setShowCamera(true);
    setFile(null);
    setPreviewUrl(null);
    setVideoDuration(null); // 🆕 Limpiar duración del video
  };

  const deleteRecording = () => {
    notifications.confirmDeleteContent(
      () => {
        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current);
          recordingIntervalRef.current = null;
        }
        
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
        
        setPreviewUrl(null);
        setFile(null);
        setVideoBlob(null);
        mediaRecorderRef.current = null;
        setRecording(false);
        setRecordingTime(0);
        recordingTimeRef.current = 0; // 🆕 Resetear la referencia también
        setShowCamera(false);
        
        notifications.fileRemoved();
      },
      () => {
        notifications.info("Operación cancelada");
      }
    );
  };

  const handleSubmit = async () => {
    if (!file) {
      notifications.error('No hay archivo seleccionado');
      return;
    }
    
    if (!canUpload) {
      if (uploadRestriction?.reason === 'pending_story') {
        notifications.storyPending();
      } else if (uploadRestriction?.reason === 'active_story') {
        notifications.warning(uploadRestriction.message);
      }
      return;
    }

        
    // Validación final de tipo de archivo - solo fotos o videos
    const typeValidation = validateFileType(file);
    if (!typeValidation.valid) {
      notifications.error(typeValidation.error || 'Solo se permiten archivos de imagen (JPG, PNG) o video (MP4, WEBM).');
      return;
    }

    // Validación final (sin límite de peso)
    const finalValidation = validateFileForBackend(file);
    if (!finalValidation.valid) {
      notifications.error(`Error final: ${finalValidation.error}`);
      return;
    }

    // Validar duración del video si es un video (máximo 15 segundos)
    if (typeValidation.mediaType === 'video') {
      // 🆕 Si es un video grabado (tiene "recording_" en el nombre), usar la duración guardada
      const isRecordedVideo = file.name.includes('recording_') || file.name.includes('recorded-video');
      
      if (isRecordedVideo && videoDuration !== null && isFinite(videoDuration) && videoDuration > 0) {
        // Para videos grabados, usar la duración que ya tenemos (del contador de grabación)
        if (videoDuration > 15) {
          notifications.error(`El video no puede durar más de 15 segundos. Duración actual: ${videoDuration.toFixed(1)}s`);
          return;
        }
        // La duración es válida, continuar sin intentar leer del blob
      } else if (videoDuration !== null && isFinite(videoDuration) && videoDuration > 0) {
        // Si ya tenemos la duración guardada (de la validación inicial de archivo subido), usarla
        if (videoDuration > 15) {
          notifications.error(`El video no puede durar más de 15 segundos. Duración actual: ${videoDuration.toFixed(1)}s`);
          return;
        }
        // La duración es válida, continuar
      } else {
        // Si no tenemos la duración guardada, intentar leerla del archivo
        const video = document.createElement("video");
        video.preload = "metadata";
        video.muted = true; // Necesario para algunos navegadores
        
        const checkDuration = () => {
          return new Promise((resolve, reject) => {
            const objectUrl = URL.createObjectURL(file);
            let timeoutId;
            
            const cleanup = () => {
              if (timeoutId) clearTimeout(timeoutId);
              URL.revokeObjectURL(objectUrl);
            };
            
            // Timeout de 10 segundos para cargar metadatos
            timeoutId = setTimeout(() => {
              cleanup();
              reject(new Error('El video tardó demasiado en cargar. Intenta con otro archivo.'));
            }, 10000);
            
            video.onloadedmetadata = () => {
              cleanup();
              const duration = video.duration;
              
              // Primero verificar si la duración es válida y finita
              if (!isFinite(duration) || isNaN(duration) || duration <= 0) {
                // Si es un video grabado y no podemos leer la duración, usar una duración estimada
                // basada en el tamaño del archivo o permitir la subida (el backend lo validará)
                if (isRecordedVideo) {
                  console.warn('No se pudo leer la duración del video grabado, pero continuaremos (el backend lo validará)');
                  resolve(); // Permitir continuar, el backend validará
                  return;
                }
                reject(new Error('No se pudo determinar la duración del video. Intenta con otro archivo.'));
                return;
              }
              
              // Luego verificar si excede el límite de 15 segundos
              if (duration > 15) {
                reject(new Error(`El video no puede durar más de 15 segundos. Duración actual: ${duration.toFixed(1)}s`));
                return;
              }
              
              // 🆕 Guardar la duración para futuras validaciones
              setVideoDuration(duration);
              resolve();
            };
            
            video.onerror = (error) => {
              cleanup();
              console.error('Error al cargar video:', error);
              // Si es un video grabado, permitir continuar (el backend lo validará)
              if (isRecordedVideo) {
                console.warn('Error al leer metadatos del video grabado, pero continuaremos (el backend lo validará)');
                resolve();
                return;
              }
              reject(new Error('Error al procesar el video. Asegúrate de que el archivo sea un video válido.'));
            };
            
            video.src = objectUrl;
          });
        };

        try {
          await checkDuration();
        } catch (error) {
          notifications.error(error.message);
          return;
        }
      }
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("source_type", file.name.includes('recording_') ? "record" : "upload");

    // Debug del FormData
        for (let [key, value] of formData.entries()) {
      if (value instanceof File) {
              } else {
              }
    }

    try {
      setLoading(true);
      
      // 🆕 Verificar tamaño del archivo - si es muy grande, usar chunks
      const fileSizeMB = file.size / (1024 * 1024);
      
      // Para archivos menores a 2MB, subir normalmente (más rápido)
      // Si es mayor, intentar normal primero, y si falla por tamaño, usar chunks
      const config = {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        withCredentials: false,
        timeout: 120000, // Aumentar timeout a 2 minutos para archivos grandes
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const progress = (progressEvent.loaded / progressEvent.total) * 100;
            // Mostrar progreso si es archivo grande
            if (fileSizeMB > 5) {
              console.log(`Progreso de subida: ${Math.round(progress)}%`);
            }
          }
        }
      };
      
            // En handleSubmit(), cambiar:
      const res = await axios.post("api/stories", formData, config);
      
            notifications.storyUploaded();
      
      await checkExistingStory();
      await checkCanUpload();
      
      setFile(null);
      setPreviewUrl(null);
      setVideoBlob(null);
      
    } catch (error) {
      console.error('Error completo al subir historia:', error);
      console.error('Error response:', error.response);
      console.error('Error data:', error.response?.data);
      
      if (error.response) {
        // El servidor respondió con un código de error
        const status = error.response.status;
        const data = error.response.data;
        
        if (status === 422) {
          // Errores de validación
          if (data.errors?.file) {
            const fileError = data.errors.file[0];
            notifications.error(`Error de validación: ${fileError}`);
          } else if (data.error_type === 'pending_story') {
            notifications.storyPending();
          } else if (data.error_type === 'active_story') {
            notifications.warning(data.message);
          } else if (data.message) {
            notifications.error(`Error: ${data.message}`);
          } else {
            notifications.error('Error de validación. Verifica que el archivo sea válido (imagen JPG/PNG o video MP4/WEBM/MOV de máximo 15 segundos).');
          }
        } else if (status === 403) {
          if (data.error === 'No autenticado' || data.message === 'No autorizado') {
            notifications.error('Error de autenticación. Por favor, inicia sesión nuevamente.');
          } else {
            notifications.error('No tienes permiso para subir historias. Solo los modelos pueden subir historias.');
          }
        } else if (status === 413) {
          notifications.error('El archivo es demasiado grande. Por favor, intenta con un archivo más pequeño.');
        } else if (status === 500) {
          notifications.error('Error interno del servidor. Por favor, intenta nuevamente más tarde.');
        } else if (data.message) {
          notifications.error(`Error (${status}): ${data.message}`);
        } else {
          notifications.error(`Error al subir la historia (${status}). Intenta nuevamente.`);
        }
      } else if (error.request) {
        // La petición se hizo pero no hubo respuesta
        if (error.code === 'ECONNABORTED') {
          notifications.error('La subida está tardando demasiado. Verifica tu conexión a internet e intenta nuevamente.');
        } else {
          notifications.error('No se pudo conectar con el servidor. Verifica tu conexión a internet.');
        }
      } else {
        // Error al configurar la petición
        notifications.error('Error al preparar la subida. Por favor, intenta nuevamente.');
      }
      
    } finally {
      setLoading(false);
    }
  };

  const testCurrentFile = async () => {
    if (file) {
      await testFileBeforeSend(file);
    } else {
          }
  };

  const viewStory = () => {
    if (existingStory?.file_url) {
      window.open(existingStory.file_url, '_blank');
    }
  };

  const deleteStory = async () => {
    notifications.confirmDelete(
      async () => {
        try {
          await axios.delete(`/api/stories/${existingStory.id}`, {
            withCredentials: false,
          });
          notifications.storyDeleted();
          setExistingStory(null);
          await checkCanUpload();
        } catch (error) {
          notifications.deleteError();
        }
      },
      () => {
        notifications.info("Operación cancelada");
      }
    );
  };

  // 🆕 Componente de restricción de tiempo
  const TimeRestrictionCard = () => {
    if (!uploadRestriction || canUpload) return null;

    return (
      <div className="bg-[#1f2125] rounded-2xl p-6 shadow-xl max-w-xl w-full mx-auto mb-6">
        <div className="bg-[#2b2d31] border border-yellow-400/40 rounded-xl p-4 text-center">
          <AlertTriangle className="w-10 h-10 text-yellow-400 mx-auto mb-3" />
          
          {uploadRestriction.reason === 'pending_story' ? (
            <>
              <h3 className="text-lg font-bold text-yellow-400 mb-2">
                Historia Pendiente de Aprobación
              </h3>
              <p className="text-white/80 text-sm mb-4">
                Tu historia está siendo revisada por nuestro equipo. Debes esperar a que sea procesada antes de subir otra.
              </p>
            </>
          ) : (
            <>
              <h3 className="text-lg font-bold text-yellow-400 mb-2">
                Historia Activa - Tiempo de Espera
              </h3>
              <p className="text-white/80 text-sm mb-4">
                Ya tienes una historia activa. Podrás subir una nueva cuando expire la actual.
              </p>
              
              {timeRemaining && (
                <div className="bg-[#1f2125] rounded-lg p-3 mb-4">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Clock className="w-5 h-5 text-[#ff007a]" />
                    <span className="text-white font-bold text-lg">
                      {timeRemaining.hours.toString().padStart(2, '0')}:
                      {timeRemaining.minutes.toString().padStart(2, '0')}:
                      {timeRemaining.seconds.toString().padStart(2, '0')}
                    </span>
                  </div>
                  <p className="text-white/60 text-xs">
                    Tiempo restante para subir nueva historia
                  </p>
                </div>
              )}
            </>
          )}
          
          <button
            onClick={() => navigate('/mensajes')}
            className="bg-[#ff007a] hover:bg-[#e6006e] text-white px-4 py-2 rounded-lg font-semibold transition-colors"
          >
            Ir a Mensajes
          </button>
        </div>
      </div>
    );
  };

  // Loading component
  if (loadingStory) {
    return (
      <div className="min-h-screen bg-ligand-mix-dark text-white flex items-center justify-center p-6">
        <div className="bg-[#1f2125] rounded-2xl p-8 shadow-xl max-w-sm w-full mx-auto">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#ff007a] mx-auto mb-4"></div>
            <p className="text-white/70">Cargando...</p>
          </div>
        </div>
      </div>
    );
  }

  // Si ya existe una historia
  if (existingStory) {
    const isApproved = existingStory.status === 'approved';
    const isPending = existingStory.status === 'pending';
    const isRejected = existingStory.status === 'rejected';

    return (
      <div className="min-h-screen bg-ligand-mix-dark text-white p-6">
        <Header />
        
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)]">
          <div className="bg-[#1f2125] rounded-2xl p-6 shadow-xl max-w-sm w-full mx-auto">
            {/* Estado de la historia */}
            <div className="bg-[#2b2d31] border border-yellow-500/30 rounded-xl p-4 text-center mb-6">
              {isPending && (
                <>
                  <Clock className="w-10 h-10 text-yellow-500 mx-auto mb-2" />
                  <h2 className="text-lg font-bold text-yellow-500 mb-1">
                    Esperando Aprobación
                  </h2>
                  <p className="text-white/70 text-sm">
                    Tu historia está siendo revisada. Te notificaremos cuando sea aprobada.
                  </p>
                </>
              )}

              {isApproved && (
                <>
                  <CheckCircle className="w-10 h-10 text-[#ff007a] mx-auto mb-2" />
                  <h2 className="text-lg font-bold text-[#ff007a] mb-1">
                    ¡Historia Aprobada!
                  </h2>
                  <p className="text-white/70 text-sm mb-2">
                    Tu historia ha sido aprobada y está visible para otros usuarios.
                  </p>
                  {existingStory.views_count > 0 && (
                    <p className="text-[#ff007a] font-semibold text-sm">
                      👁️ {existingStory.views_count} visualizaciones
                    </p>
                  )}
                  
                  {/* Mostrar tiempo restante si está disponible */}
                  {timeRemaining && (
                    <div className="mt-3 p-2 bg-[#ff007a]/10 border border-[#ff007a]/30 rounded-lg">
                      <p className="text-xs text-white/80">
                        ⏰ Expira en {timeRemaining.hours}h {timeRemaining.minutes}m
                      </p>
                    </div>
                  )}
                </>
              )}

              {isRejected && (
                <>
                  <XCircle className="w-10 h-10 text-red-500 mx-auto mb-2" />
                  <h2 className="text-lg font-bold text-red-500 mb-1">
                    Historia Rechazada
                  </h2>
                  <p className="text-white/70 text-sm mb-2">
                    {existingStory.rejection_reason || "Tu historia no cumplió con nuestras políticas."}
                  </p>
                </>
              )}
            </div>

            {/* Vista previa de la historia */}
            {(existingStory?.file_url || existingStory?.file_url_asset || existingStory?.file_url_manual || existingStory?.file_path) && (
              <div className="bg-[#2b2d31] rounded-2xl overflow-hidden mb-6">
                {(() => {
                  // Determinar la URL a usar (con fallbacks en orden de preferencia)
                  let mediaUrl = existingStory.file_url_manual ||  // Preferir manual (URL completa)
                                existingStory.file_url_asset ||     // Luego asset
                                existingStory.file_url;             // Luego storage URL
                  
                  // Si tenemos file_path pero no URL, construirla
                  if (!mediaUrl && existingStory.file_path) {
                    const apiBase = import.meta.env.VITE_API_BASE_URL || 'https://ligandome.com';
                    // Remover /api si está presente para obtener la base URL
                    const baseUrl = apiBase.replace('/api', '').replace(/\/$/, '');
                    // Construir la ruta completa
                    mediaUrl = `${baseUrl}/storage/${existingStory.file_path}`;
                  }
                  
                  // Si aún no tenemos URL, mostrar placeholder
                  if (!mediaUrl) {
                    return (
                      <div className="w-full h-[300px] bg-[#1f2125] flex items-center justify-center">
                        <div className="text-center text-white/60">
                          <Video className="w-12 h-12 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Previsualización no disponible</p>
                        </div>
                      </div>
                    );
                  }
                  
                  // Asegurar que la URL sea absoluta
                  if (!mediaUrl.startsWith('http')) {
                    const apiBase = import.meta.env.VITE_API_BASE_URL || 'https://ligandome.com';
                    const baseUrl = apiBase.replace('/api', '').replace(/\/$/, '');
                    mediaUrl = mediaUrl.startsWith('/') 
                      ? `${baseUrl}${mediaUrl}` 
                      : `${baseUrl}/${mediaUrl}`;
                  }
                  
                  // Determinar si es video o imagen
                  const isVideo = existingStory.mime_type?.startsWith('video/') ||
                                 existingStory.file_path?.includes('.mp4') ||
                                 existingStory.file_path?.includes('.webm') ||
                                 existingStory.file_url?.includes('.mp4') ||
                                 existingStory.file_url?.includes('.webm') ||
                                 mediaUrl.includes('.mp4') ||
                                 mediaUrl.includes('.webm');
                  
                  console.log('🔍 [Story Preview]', {
                    file_path: existingStory.file_path,
                    mime_type: existingStory.mime_type,
                    file_url: existingStory.file_url,
                    file_url_asset: existingStory.file_url_asset,
                    file_url_manual: existingStory.file_url_manual,
                    final_mediaUrl: mediaUrl,
                    isVideo: isVideo
                  });
                  
                  return isVideo ? (
                    <video 
                      key={mediaUrl} // Forzar re-render si cambia la URL
                      src={mediaUrl}
                      className="w-full h-[300px] object-cover"
                      controls={isApproved || isPending}
                      preload="metadata"
                      onError={(e) => {
                        console.error('❌ Error cargando video:', {
                          url: mediaUrl,
                          error: e,
                          file_path: existingStory.file_path
                        });
                        // Ocultar el video y mostrar mensaje de error
                        const videoElement = e.target;
                        videoElement.style.display = 'none';
                        
                        // Verificar si ya existe un mensaje de error
                        if (!videoElement.parentNode.querySelector('.error-message')) {
                          const errorDiv = document.createElement('div');
                          errorDiv.className = 'error-message w-full h-[300px] bg-[#1f2125] flex items-center justify-center text-white/60';
                          errorDiv.innerHTML = `
                            <div class="text-center">
                              <Video className="w-12 h-12 mx-auto mb-2 opacity-50" />
                              <p class="text-sm">Error al cargar el video</p>
                              <p class="text-xs mt-1 text-white/40">URL: ${mediaUrl.substring(0, 50)}...</p>
                            </div>
                          `;
                          videoElement.parentNode.appendChild(errorDiv);
                        }
                      }}
                      onLoadStart={() => {
                        console.log('▶️ Iniciando carga del video:', mediaUrl);
                      }}
                      onLoadedData={() => {
                        console.log('✅ Video cargado exitosamente');
                      }}
                    />
                  ) : (
                    <img 
                      key={mediaUrl} // Forzar re-render si cambia la URL
                      src={mediaUrl}
                      alt="Historia" 
                      className="w-full h-[300px] object-cover"
                      onError={(e) => {
                        console.error('❌ Error cargando imagen:', {
                          url: mediaUrl,
                          error: e,
                          file_path: existingStory.file_path
                        });
                        // Ocultar la imagen y mostrar mensaje de error
                        const imgElement = e.target;
                        imgElement.style.display = 'none';
                        
                        // Verificar si ya existe un mensaje de error
                        if (!imgElement.parentNode.querySelector('.error-message')) {
                          const errorDiv = document.createElement('div');
                          errorDiv.className = 'error-message w-full h-[300px] bg-[#1f2125] flex items-center justify-center text-white/60';
                          errorDiv.innerHTML = `
                            <div class="text-center">
                              <Video className="w-12 h-12 mx-auto mb-2 opacity-50" />
                              <p class="text-sm">Error al cargar la imagen</p>
                              <p class="text-xs mt-1 text-white/40">URL: ${mediaUrl.substring(0, 50)}...</p>
                            </div>
                          `;
                          imgElement.parentNode.appendChild(errorDiv);
                        }
                      }}
                      onLoad={() => {
                        console.log('✅ Imagen cargada exitosamente');
                      }}
                    />
                  );
                })()}
              </div>
            )}
            
            {/* Mostrar placeholder si no hay file_url ni file_path */}
            {!existingStory?.file_url && 
             !existingStory?.file_url_asset && 
             !existingStory?.file_url_manual && 
             !existingStory?.file_path && (
              <div className="bg-[#2b2d31] rounded-2xl overflow-hidden mb-6">
                <div className="w-full h-[300px] bg-[#1f2125] flex items-center justify-center">
                  <div className="text-center text-white/60">
                    <Video className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Previsualización no disponible</p>
                    <p className="text-xs mt-1 text-white/40">
                      La historia está siendo procesada
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Botones de acción */}
            <div className="flex gap-4 justify-center">
              {isApproved && (
                <button
                  onClick={viewStory}
                  className="bg-[#ff007a] hover:bg-[#e6006e] text-white px-6 py-3 rounded-full font-bold flex items-center gap-2 transition-colors"
                >
                  <Eye size={18} />
                  {t("subirHistoria.verHistoria")}
                </button>
              )}

              {isRejected && (
                <button
                  onClick={deleteStory}
                  className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-full font-bold flex items-center gap-2 transition-colors"
                >
                  <Trash size={18} />
                  {t("subirHistoria.eliminarYCrearNueva")}
                </button>
              )}

              {(isPending || isApproved) && (
                <button
                  onClick={deleteStory}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-3 rounded-full font-bold flex items-center gap-2 transition-colors"
                >
                  <Trash size={16} />
                  {t("subirHistoria.eliminar")}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Vista principal para subir historia
  return (
    <div className="min-h-screen bg-ligand-mix-dark text-white p-6">
      <Header />
      
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)]">
        {/* Mostrar restricción de tiempo si aplica */}
        <TimeRestrictionCard />
        
        {/* Contenedor principal único */}
        <div className="bg-[#1f2125] rounded-2xl p-8 shadow-xl max-w-xl w-full mx-auto">
          {file && process.env.NODE_ENV === 'development' && (
            <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-blue-400 text-sm mb-2">🧪 Debug Info:</p>
              <div className="text-xs text-white/70 space-y-1">
                <p>Nombre: {file.name}</p>
                <p>Tipo: {file.type}</p>
                <p>Tamaño: {(file.size / 1024 / 1024).toFixed(2)} MB</p>
                <p>Extensión: {file.name.split('.').pop()}</p>
              </div>
            </div>
          )}
          {/* Título */}
          <div className="flex items-center gap-3 justify-center mb-8">
            <Sparkles className="w-8 h-8 text-[#ff007a]" />
            <h2 className="text-2xl font-bold text-[#ff007a]">
              {canUpload ? t("subirHistoria.titulo") : t("subirHistoria.tituloNoDisponible")}
            </h2>
          </div>
          
          {/* Contenido dinámico según el estado */}
          {showCamera && canUpload && (
            <>
              {/* Selector de cámara */}
              {devices.length > 1 && (
                <div className="bg-[#2b2d31] rounded-xl p-3 mb-3 border border-[#ff007a]/30">
                  <label className="block text-xs font-semibold text-white/70 mb-2 flex items-center gap-2">
                    <Camera className="w-3 h-3 text-[#ff007a]" />
                    {t("subirHistoria.seleccionaCamara")}
                  </label>
                  <select
                    value={selectedDeviceId || ""}
                    onChange={e => setSelectedDeviceId(e.target.value)}
                    className="w-full p-2 bg-[#1f2125] border border-[#ff007a]/40 rounded-lg text-white text-sm focus:border-[#ff007a] focus:outline-none transition-colors"
                  >
                    {devices.map(device => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Cámara ${device.deviceId}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Área de video */}
              <div className="relative w-full h-80 bg-[#2b2d31] rounded-2xl overflow-hidden mb-4">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  muted 
                  className={`w-full h-full object-cover ${isFlipped ? 'scale-x-[-1]' : ''}`}
                />
                
                {/* Overlay de grabación */}
                {recording && (
                  <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
                    <div className="flex items-center gap-2 bg-red-500/90 backdrop-blur-sm text-white px-3 py-2 rounded-full">
                      <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                      <span className="text-sm font-semibold">REC</span>
                    </div>
                    <div className="bg-black/50 backdrop-blur-sm text-white px-3 py-2 rounded-full">
                      <span className="text-sm font-mono">{formatTime(recordingTime)}</span>
                    </div>
                  </div>
                )}

                {/* Botón cambiar cámara */}
                {devices.length > 1 && (
                  <button
                    onClick={switchCamera}
                    className="absolute top-4 right-4 w-10 h-10 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-black/70 transition-colors z-10"
                    disabled={recording}
                  >
                    <RotateCcw className="w-5 h-5 text-white" />
                  </button>
                )}

                {/* Controles de grabación */}
                <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center justify-center gap-4 z-10">
                  {!recording && (
                    <button
                      onClick={startRecording}
                      className="w-16 h-16 bg-[#ff007a] hover:bg-[#e6006e] rounded-full flex items-center justify-center shadow-lg hover:scale-105 transform transition-all duration-200"
                    >
                      <Video className="w-7 h-7 text-white" />
                    </button>
                  )}

                  {recording && (
                    <button
                      onClick={stopRecording}
                      className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center shadow-lg hover:scale-105 transform transition-all duration-200"
                    >
                      <Square className="w-6 h-6 text-white fill-white" />
                    </button>
                  )}
                </div>
              </div>

              {/* Botón cancelar */}
              <button
                onClick={() => setShowCamera(false)}
                className="w-full bg-[#2b2d31] hover:bg-[#373a3f] text-white px-4 py-2 rounded-xl border border-[#ff007a]/40 transition-colors text-sm"
              >
                Cancelar
              </button>
            </>
          )}
          
          {previewUrl && !showCamera && canUpload && (
            <>
              {/* Vista previa del archivo */}
              <div className="relative w-full mb-4">
                <div className="w-full h-80 bg-[#2b2d31] rounded-2xl overflow-hidden">
                  {file && file.type && file.type.startsWith("video/") ? (
                    <video src={previewUrl} controls className="w-full h-full object-cover" />
                  ) : (
                    <img src={previewUrl} alt="preview" className="w-full h-full object-cover" />
                  )}
                </div>
                <button
                  onClick={deleteRecording}
                  className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm p-2 rounded-full hover:bg-black/70 transition-colors z-10"
                >
                  <Trash size={18} className="text-white" />
                </button>
              </div>
              
              {/* Botón de publicar */}
              <button
                onClick={handleSubmit}
                disabled={loading || !canUpload}
                className="w-full bg-[#ff007a] hover:bg-[#e6006e] text-white px-8 py-3 rounded-xl font-bold disabled:opacity-50 transition-colors mb-4"
              >
                {loading
                  ? t("subirHistoria.subiendo")
                  : t("subirHistoria.publicar")}
              </button>
            </>
          )}
          
          {!previewUrl && !showCamera && (
            <>
              {/* Botones de acción principal */}
              <div className="flex flex-col gap-3 mb-6">
                <button
                  onClick={handleCameraClick}
                  disabled={!canUpload}
                  className={`w-full px-6 py-3 rounded-xl flex items-center justify-center gap-3 font-semibold transition-colors ${
                    canUpload 
                      ? 'bg-[#ff007a] hover:bg-[#e6006e] text-white' 
                      : 'bg-gray-500/20 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Camera size={20} />
                  {canUpload ? t("subirHistoria.grabar") : t("subirHistoria.noDisponible")}
                </button>

                <button
                  onClick={() => canUpload && fileInputRef.current.click()}
                  disabled={!canUpload}
                  className={`w-full px-6 py-3 rounded-xl flex items-center justify-center gap-3 border transition-colors ${
                    canUpload 
                      ? 'bg-[#2b2d31] hover:bg-[#373a3f] text-white border-[#ff007a]/40' 
                      : 'bg-gray-500/20 text-gray-400 border-gray-500/20 cursor-not-allowed'
                  }`}
                >
                  <UploadCloud size={20} />
                  {canUpload ? t("subirHistoria.subir") : t("subirHistoria.noDisponible")}
                </button>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/jpeg,image/jpg,image/png,video/mp4,video/webm"
                  className="hidden"
                  onChange={handleVideoUpload}
                />
              </div>
            </>
          )}
          
          {/* Consejo - siempre visible */}
          <div className="bg-[#2b2d31] border border-[#ff007a]/30 rounded-xl p-4 text-center">
            <p className="text-white text-sm mb-2 font-semibold flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4 text-[#ff007a]" />
              📱 {canUpload ? t("subirHistoria.consejo") : t("subirHistoria.informacion")}
            </p>
            <p className="text-white/70 text-sm">
              {canUpload 
                ? t("subirHistoria.consejoAprobacion")
                : t("subirHistoria.informacionRestriccion")
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}