import React, { useState, useEffect } from "react";
import {
  BookOpen,
  CheckCircle,
  XCircle,
  Eye,
  AlertCircle,
  RefreshCw,
  Search,
  Image,
  Video,
  User,
  Clock
} from "lucide-react";
import { storiesAdminApi, adminUtils } from "../../../services/adminApiService";

const StoriesModule = () => {
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(null);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Estados para datos
  const [pendingStories, setPendingStories] = useState([]);
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0
  });

  // Modal para ver historia
  const [modalStory, setModalStory] = useState({
    isOpen: false,
    story: null
  });

  // Modal para rechazar
  const [modalReject, setModalReject] = useState({
    isOpen: false,
    story: null,
    reason: '',
    saving: false
  });

  // Cargar datos al montar el componente
  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('📖 [StoriesModule] Cargando datos de historias pendientes...');
      const response = await storiesAdminApi.getPending();
      
      console.log('📖 [StoriesModule] Respuesta recibida:', response);

      if (response.success) {
        const stories = response.data || [];
        console.log(`📖 [StoriesModule] ${stories.length} historias pendientes encontradas`, stories);
        setPendingStories(stories);
        setStats(prev => ({
          ...prev,
          pending: stories.length
        }));
        
        if (stories.length === 0) {
          console.log('⚠️ [StoriesModule] No se encontraron historias pendientes. Verificar base de datos.');
        }
      } else {
        console.error('❌ [StoriesModule] La respuesta no fue exitosa:', response);
        setError(response.error || 'Error al cargar historias pendientes');
        setPendingStories([]);
      }

    } catch (error) {
      console.error('❌ [StoriesModule] Error al cargar datos:', error);
      setError(adminUtils.manejarError(error));
      setPendingStories([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (storyId, userName) => {
    if (!window.confirm(`¿Estás seguro de aprobar la historia de ${userName}?`)) {
      return;
    }

    setProcesando(storyId);
    
    try {
      const response = await storiesAdminApi.approve(storyId);
      
      if (response.message || response.success) {
        // Actualizar lista local eliminando la historia aprobada
        setPendingStories(prev => 
          prev.filter(s => s.id !== storyId)
        );
        
        // Actualizar estadísticas
        setStats(prev => ({
          ...prev,
          pending: Math.max(0, prev.pending - 1),
          approved: prev.approved + 1
        }));

        alert(`✅ Historia de ${userName} aprobada correctamente`);
        cargarDatos(); // Recargar para actualizar
      }
    } catch (error) {
      alert(`❌ Error al aprobar: ${adminUtils.manejarError(error)}`);
    } finally {
      setProcesando(null);
    }
  };

  const handleReject = (story) => {
    setModalReject({
      isOpen: true,
      story: story,
      reason: '',
      saving: false
    });
  };

  const handleSaveReject = async () => {
    if (!modalReject.reason.trim()) {
      alert('⚠️ Por favor ingresa la razón del rechazo');
      return;
    }

    setModalReject(prev => ({ ...prev, saving: true }));

    try {
      const response = await storiesAdminApi.reject(modalReject.story.id, modalReject.reason);

      if (response.message || response.success) {
        // Actualizar lista local eliminando la historia rechazada
        setPendingStories(prev => 
          prev.filter(s => s.id !== modalReject.story.id)
        );
        
        // Actualizar estadísticas
        setStats(prev => ({
          ...prev,
          pending: Math.max(0, prev.pending - 1),
          rejected: prev.rejected + 1
        }));

        alert(`🗑️ Historia rechazada correctamente`);
        setModalReject({ isOpen: false, story: null, reason: '', saving: false });
        cargarDatos(); // Recargar para actualizar
      }
    } catch (error) {
      alert(`❌ Error al rechazar: ${adminUtils.manejarError(error)}`);
    } finally {
      setModalReject(prev => ({ ...prev, saving: false }));
    }
  };

  const handleViewStory = (story) => {
    setModalStory({
      isOpen: true,
      story: story
    });
  };

  const getFileType = (mimeType) => {
    if (!mimeType) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    return 'image';
  };

  const getFileUrl = (story) => {
    if (story.file_url) {
      if (story.file_url.startsWith('http')) {
        return story.file_url;
      }
      return `${import.meta.env.VITE_API_BASE_URL || 'https://ligandome.com'}${story.file_url}`;
    }
    return null;
  };

  // Filtrar historias según búsqueda
  const filteredStories = pendingStories.filter(story => {
    const matchesSearch = 
      story.user?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      story.user?.email?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
        <span className="ml-3 text-gray-400">Cargando historias...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con estadísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-gray-800/60 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-yellow-500/20">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-gray-400 text-sm">Historias Pendientes</p>
              <p className="text-2xl font-bold text-yellow-300">{stats.pending}</p>
              <p className="text-red-400 text-xs mt-1">Requiere atención</p>
            </div>
            <div className="p-3 bg-yellow-500/20 rounded-lg">
              <BookOpen className="w-8 h-8 text-yellow-400" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800/60 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-green-500/20">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-gray-400 text-sm">Aprobadas</p>
              <p className="text-2xl font-bold text-green-300">{stats.approved}</p>
              <p className="text-green-400 text-xs mt-1">Total</p>
            </div>
            <div className="p-3 bg-green-500/20 rounded-lg">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800/60 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-red-500/20">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-gray-400 text-sm">Rechazadas</p>
              <p className="text-2xl font-bold text-red-300">{stats.rejected}</p>
              <p className="text-gray-400 text-xs mt-1">Total</p>
            </div>
            <div className="p-3 bg-red-500/20 rounded-lg">
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800/60 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-blue-500/20">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-gray-400 text-sm">Total</p>
              <p className="text-2xl font-bold text-blue-300">{stats.total}</p>
              <p className="text-gray-400 text-xs mt-1">Todas las historias</p>
            </div>
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <BookOpen className="w-8 h-8 text-blue-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/30 text-red-400 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
          <button 
            onClick={cargarDatos}
            className="ml-auto text-red-300 hover:text-red-200"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Historias Pendientes */}
      <div className="bg-gray-800/60 backdrop-blur-sm rounded-xl shadow-lg border border-yellow-500/20">
        <div className="p-6 border-b border-gray-700/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h3 className="text-lg font-semibold text-yellow-300 flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Historias Pendientes
              <span className="bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded-full text-sm">
                {filteredStories.length}
              </span>
            </h3>
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-auto">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
                <input 
                  type="text" 
                  placeholder="Buscar por modelo..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full sm:w-auto bg-gray-700/50 text-gray-300 pl-10 pr-4 py-2 rounded-lg border border-gray-600/50 placeholder-gray-500 focus:border-yellow-500/50 focus:outline-none text-sm"
                />
              </div>
              <button 
                onClick={cargarDatos}
                className="text-yellow-400 hover:text-yellow-300 p-2 rounded-lg hover:bg-yellow-500/10"
                title="Actualizar"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        <div className="p-6">
          {filteredStories.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <p className="text-gray-400">
                {searchTerm ? 'No se encontraron historias con ese criterio' : 'No hay historias pendientes'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredStories.map((story) => {
                const fileType = getFileType(story.mime_type);
                const fileUrl = getFileUrl(story);
                
                return (
                  <div key={story.id} className="bg-gray-700/30 rounded-xl overflow-hidden border border-gray-600/50 hover:border-yellow-500/50 transition-all">
                    {/* Preview de la historia */}
                    <div className="relative aspect-[9/16] bg-gray-800">
                      {fileUrl ? (
                        fileType === 'video' ? (
                          <video 
                            src={fileUrl}
                            className="w-full h-full object-cover"
                            muted
                            playsInline
                          />
                        ) : (
                          <img 
                            src={fileUrl}
                            alt={`Historia de ${story.user?.name}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.src = 'https://via.placeholder.com/400x600/333/fff?text=Error+loading';
                            }}
                          />
                        )
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Image className="w-12 h-12 text-gray-500" />
                        </div>
                      )}
                      <div className="absolute top-2 right-2">
                        {fileType === 'video' ? (
                          <span className="bg-purple-500/80 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                            <Video className="w-3 h-3" />
                            Video
                          </span>
                        ) : (
                          <span className="bg-blue-500/80 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                            <Image className="w-3 h-3" />
                            Imagen
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Información */}
                    <div className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center">
                          <span className="text-white font-medium text-xs">
                            {story.user?.name?.charAt(0) || '?'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-gray-300 font-medium truncate">{story.user?.name || 'Sin nombre'}</div>
                          <div className="text-gray-500 text-xs truncate">{story.user?.email || 'Sin email'}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-gray-400 mb-3">
                        <div className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {story.views_count || 0}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {story.created_at ? new Date(story.created_at).toLocaleDateString('es-ES') : 'N/A'}
                        </div>
                      </div>

                      {/* Acciones */}
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleViewStory(story)}
                          className="flex-1 bg-blue-500/20 text-blue-400 px-3 py-2 rounded-lg text-sm hover:bg-blue-500/30 transition-colors flex items-center justify-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          Ver
                        </button>
                        <button 
                          onClick={() => handleApprove(story.id, story.user?.name || 'Usuario')}
                          disabled={procesando === story.id}
                          className="flex-1 bg-green-500/20 text-green-400 px-3 py-2 rounded-lg text-sm hover:bg-green-500/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                          {procesando === story.id ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <CheckCircle className="w-3 h-3" />
                          )}
                          Aprobar
                        </button>
                        <button 
                          onClick={() => handleReject(story)}
                          disabled={procesando === story.id}
                          className="flex-1 bg-red-500/20 text-red-400 px-3 py-2 rounded-lg text-sm hover:bg-red-500/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                          <XCircle className="w-3 h-3" />
                          Rechazar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal para ver historia */}
      {modalStory.isOpen && modalStory.story && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-2xl max-h-[90vh] w-full mx-4 overflow-hidden">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Historia de {modalStory.story.user?.name || 'Usuario'}
              </h3>
              <button
                onClick={() => setModalStory({ isOpen: false, story: null })}
                className="text-gray-400 hover:text-white"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4">
              <div className="relative bg-gray-900 rounded-lg overflow-hidden">
                {getFileType(modalStory.story.mime_type) === 'video' ? (
                  <video 
                    src={getFileUrl(modalStory.story)}
                    controls 
                    className="w-full max-h-[70vh] object-contain"
                  />
                ) : (
                  <img 
                    src={getFileUrl(modalStory.story)}
                    alt={`Historia de ${modalStory.story.user?.name}`}
                    className="w-full max-h-[70vh] object-contain mx-auto"
                    onError={(e) => {
                      e.target.src = 'https://via.placeholder.com/400x600/333/fff?text=Error+loading';
                    }}
                  />
                )}
              </div>
              <div className="mt-4 text-sm text-gray-400">
                <p><span className="text-gray-300 font-medium">Modelo:</span> {modalStory.story.user?.name || 'N/A'}</p>
                <p><span className="text-gray-300 font-medium">Email:</span> {modalStory.story.user?.email || 'N/A'}</p>
                <p><span className="text-gray-300 font-medium">Fecha:</span> {modalStory.story.created_at ? new Date(modalStory.story.created_at).toLocaleString('es-ES') : 'N/A'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal para rechazar */}
      {modalReject.isOpen && modalReject.story && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-lg w-full mx-4">
            <div className="p-6 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-400" />
                Rechazar Historia
              </h3>
              <p className="text-gray-400 text-sm mt-2">
                Modelo: <span className="text-pink-300">{modalReject.story.user?.name}</span>
              </p>
            </div>
            <div className="p-6">
              <label className="block text-gray-400 text-sm font-medium mb-2">
                Razón del rechazo <span className="text-red-400">*</span>
              </label>
              <textarea
                value={modalReject.reason}
                onChange={(e) => setModalReject(prev => ({...prev, reason: e.target.value}))}
                className="w-full h-24 sm:h-32 bg-gray-700/50 text-gray-300 px-3 py-2 rounded-lg border border-gray-600/50 focus:border-red-500/50 focus:outline-none resize-none text-sm"
                placeholder="Escribe la razón por la cual rechazas esta historia..."
              />
            </div>
            <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setModalReject({ isOpen: false, story: null, reason: '', saving: false })}
                disabled={modalReject.saving}
                className="px-4 py-2 text-gray-400 hover:text-gray-300 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveReject}
                disabled={modalReject.saving || !modalReject.reason.trim()}
                className="bg-red-500/20 text-red-400 px-6 py-2 rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {modalReject.saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Rechazando...
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4" />
                    Rechazar Historia
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoriesModule;
