// components/StoryModal.jsx
import React, { useState, useEffect } from 'react';
import { X, Eye, Heart, Share2, Download, Trash2, Clock } from 'lucide-react';
import { useAppNotifications } from '../contexts/NotificationContext';

const StoryModal = ({ isOpen, onClose, story, onDelete }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [mediaError, setMediaError] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const notifications = useAppNotifications();

  // Calcular tiempo restante de la historia (24 horas típicamente)
  useEffect(() => {
    if (!story?.created_at) return;

    const calculateTimeRemaining = () => {
      const createdAt = new Date(story.created_at);
      const expiresAt = new Date(createdAt.getTime() + (24 * 60 * 60 * 1000)); // 24 horas
      const now = new Date();
      const remaining = Math.max(0, expiresAt.getTime() - now.getTime());
      
      setTimeRemaining(Math.floor(remaining / 1000));
    };

    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [story?.created_at]);

  // Formatear tiempo restante
  const formatTimeRemaining = (seconds) => {
    if (seconds <= 0) return "Expirada";
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m restantes`;
    }
    return `${minutes}m restantes`;
  };

  // Manejar carga del medio
  const handleMediaLoad = () => {
    setIsLoading(false);
    setMediaError(false);
  };

  const handleMediaError = () => {
    setIsLoading(false);
    setMediaError(true);
    notifications.error("Error al cargar el contenido de la historia");
  };

  // Manejar descarga
  const handleDownload = async () => {
    try {
      const response = await fetch(story.file_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `historia_${story.id}.${getFileExtension(story.file_url)}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      notifications.success("Historia descargada correctamente");
    } catch (error) {
      notifications.error("Error al descargar la historia");
    }
  };

  // Obtener extensión del archivo
  const getFileExtension = (url) => {
    if (url.includes('.mp4')) return 'mp4';
    if (url.includes('.webm')) return 'webm';
    if (url.includes('.jpg') || url.includes('.jpeg')) return 'jpg';
    if (url.includes('.png')) return 'png';
    return 'file';
  };

  // Compartir historia
  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Mi Historia',
          text: 'Mira mi historia en la plataforma',
          url: window.location.href
        });
      } else {
        // Fallback: copiar al portapapeles
        await navigator.clipboard.writeText(window.location.href);
        notifications.success("Enlace copiado al portapapeles");
      }
    } catch (error) {
      notifications.warning("No se pudo compartir la historia");
    }
  };

  // Confirmar eliminación
  const handleDeleteConfirm = () => {
    notifications.confirmDelete(
      () => {
        onDelete();
        onClose();
      },
      () => {
        notifications.info("Eliminación cancelada");
      }
    );
  };

  if (!isOpen || !story) return null;

  const isVideo = story.file_url?.includes('.mp4') || story.file_url?.includes('.webm');
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
  const fullMediaUrl = story.file_url?.startsWith('http') 
    ? story.file_url 
    : `${API_BASE_URL}${story.file_url}`;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      {/* Contenedor principal del modal */}
      <div className="bg-[#1f2125] rounded-2xl max-w-md w-full max-h-[90vh] overflow-hidden shadow-2xl border border-[#ff007a]/20">
        
        {/* Header del modal */}
        <div className="relative bg-[#2b2d31] p-4 border-b border-[#ff007a]/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#ff007a] rounded-full flex items-center justify-center">
                <Eye className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Tu Historia</h3>
                <div className="flex items-center gap-2 text-sm text-white/70">
                  <Clock className="w-4 h-4" />
                  <span>{formatTimeRemaining(timeRemaining)}</span>
                </div>
              </div>
            </div>
            
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-white/70 hover:text-white" />
            </button>
          </div>

          {/* Estadísticas */}
          <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/10">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <Eye className="w-4 h-4 text-blue-400" />
                <span className="text-white/80">{story.views_count || 0}</span>
              </div>
              <div className="flex items-center gap-1">
                <Heart className="w-4 h-4 text-red-400" />
                <span className="text-white/80">{story.likes_count || 0}</span>
              </div>
            </div>
            
            <div className="text-xs text-white/50">
              {story.source_type === 'record' ? '📹 Grabado' : '📁 Subido'}
            </div>
          </div>
        </div>

        {/* Contenido de la historia */}
        <div className="relative bg-black">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#2b2d31]">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff007a] mx-auto mb-2"></div>
                <p className="text-white/70 text-sm">Cargando historia...</p>
              </div>
            </div>
          )}

          {mediaError ? (
            <div className="flex items-center justify-center h-96 bg-[#2b2d31]">
              <div className="text-center">
                <X className="w-12 h-12 text-red-400 mx-auto mb-2" />
                <p className="text-white/70">Error al cargar la historia</p>
              </div>
            </div>
          ) : (
            <>
              {isVideo ? (
                <video
                  src={fullMediaUrl}
                  className="w-full h-96 object-cover"
                  controls
                  onLoadedData={handleMediaLoad}
                  onError={handleMediaError}
                  poster={story.thumbnail_url}
                >
                  Tu navegador no soporta videos.
                </video>
              ) : (
                <img
                  src={fullMediaUrl}
                  alt="Historia"
                  className="w-full h-96 object-cover"
                  onLoad={handleMediaLoad}
                  onError={handleMediaError}
                />
              )}
            </>
          )}
        </div>

        {/* Footer con acciones */}
        <div className="bg-[#2b2d31] p-4 border-t border-[#ff007a]/20">
          <div className="flex justify-between items-center">
            {/* Botones de acción */}
            <div className="flex gap-2">
              <button
                onClick={handleShare}
                className="p-2 bg-[#1f2125] hover:bg-[#25282c] rounded-lg border border-[#ff007a]/30 transition-colors"
                title="Compartir"
              >
                <Share2 className="w-4 h-4 text-[#ff007a]" />
              </button>
              
              <button
                onClick={handleDownload}
                className="p-2 bg-[#1f2125] hover:bg-[#25282c] rounded-lg border border-[#ff007a]/30 transition-colors"
                title="Descargar"
              >
                <Download className="w-4 h-4 text-[#ff007a]" />
              </button>
            </div>

            {/* Información adicional */}
            <div className="text-xs text-white/50 text-center">
              <div>Publicada: {new Date(story.created_at).toLocaleDateString()}</div>
              {story.updated_at !== story.created_at && (
                <div>Actualizada: {new Date(story.updated_at).toLocaleDateString()}</div>
              )}
            </div>

            {/* Botón eliminar */}
            <button
              onClick={handleDeleteConfirm}
              className="p-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg border border-red-500/30 transition-colors"
              title="Eliminar historia"
            >
              <Trash2 className="w-4 h-4 text-red-400" />
            </button>
          </div>

          {/* Información de expiración */}
          {timeRemaining > 0 ? (
            <div className="mt-3 p-2 bg-[#ff007a]/10 border border-[#ff007a]/30 rounded-lg">
              <p className="text-xs text-center text-white/80">
                ⏰ Esta historia expirará en {formatTimeRemaining(timeRemaining)}
              </p>
            </div>
          ) : (
            <div className="mt-3 p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-xs text-center text-red-300">
                ⚠️ Esta historia ha expirado y ya no es visible para otros usuarios
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StoryModal;