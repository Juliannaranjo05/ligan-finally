import React, { useState, useEffect } from "react";
import { 
  Shield, 
  Eye,
  Download,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  FileText
} from "lucide-react";
import { verificacionesApi, adminUtils } from "../../../services/adminApiService";

const VerificacionesModule = () => {
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(null);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("pendiente");
  
  // Estados para datos
  const [verificaciones, setVerificaciones] = useState([]);
  const [estadisticas, setEstadisticas] = useState({
    total_usuarios: 0,
    modelos_activas: 0,
    verificaciones_pendientes: 0,
    clientes_activos: 0,
    verificaciones_esta_semana: 0,
    modelos_nuevas: 0
  });

  // Modal para ver documentos
  const [modalDocumento, setModalDocumento] = useState({
    isOpen: false,
    url: null,
    tipo: null,
    loading: false
  });

  const [modalObservaciones, setModalObservaciones] = useState({
    isOpen: false,
    loading: false,
    saving: false,
    verificacionId: null,
    userName: '',
    observaciones: ''
  });

  // Cargar datos al montar el componente
  useEffect(() => {
    cargarDatos();
  }, [estadoFilter]);

  const cargarDatos = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Cargar verificaciones pendientes y estadísticas en paralelo
      const [verificacionesData, stats] = await Promise.all([
        verificacionesApi.getPendientes(),
        verificacionesApi.getStats()
      ]);

      if (verificacionesData.success) {
        setVerificaciones(verificacionesData.data || []);
      }

      if (stats.success) {
        setEstadisticas(stats.data);
      }

    } catch (error) {
      setError(adminUtils.manejarError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (verificacionId, userName) => {
    if (!window.confirm(`¿Estás seguro de aprobar la verificación de ${userName}?`)) {
      return;
    }

    setProcesando(verificacionId);
    
    try {
      const response = await verificacionesApi.aprobar(verificacionId);
      
      if (response.success) {
        // Actualizar lista local eliminando la verificación aprobada
        setVerificaciones(prev => 
          prev.filter(v => v.id !== verificacionId)
        );
        
        // Actualizar estadísticas
        setEstadisticas(prev => ({
          ...prev,
          verificaciones_pendientes: Math.max(0, prev.verificaciones_pendientes - 1),
          modelos_activas: prev.modelos_activas + 1
        }));

        alert(`✅ Verificación de ${userName} aprobada correctamente`);
        cargarDatos(); // Recargar para actualizar estadísticas
      }
    } catch (error) {
      alert(`❌ Error al aprobar: ${adminUtils.manejarError(error)}`);
    } finally {
      setProcesando(null);
    }
  };

  const handleReject = async (verificacionId, userName) => {
    if (!window.confirm(`¿Estás seguro de RECHAZAR la verificación de ${userName}? Esta acción eliminará todos los documentos.`)) {
      return;
    }

    setProcesando(verificacionId);
    
    try {
      const response = await verificacionesApi.rechazar(verificacionId);
      
      if (response.success) {
        // Actualizar lista local eliminando la verificación rechazada
        setVerificaciones(prev => 
          prev.filter(v => v.id !== verificacionId)
        );
        
        // Actualizar estadísticas
        setEstadisticas(prev => ({
          ...prev,
          verificaciones_pendientes: Math.max(0, prev.verificaciones_pendientes - 1)
        }));

        alert(`🗑️ Verificación de ${userName} rechazada y eliminada`);
        cargarDatos(); // Recargar para actualizar estadísticas
      }
    } catch (error) {
      alert(`❌ Error al rechazar: ${adminUtils.manejarError(error)}`);
    } finally {
      setProcesando(null);
    }
  };

  const handleViewDocument = async (verificacionId, docType) => {
    setModalDocumento({
      isOpen: true,
      url: null,
      tipo: docType,
      loading: true
    });

    try {
      const response = await verificacionesApi.verDocumento(verificacionId, docType);
      
      if (response.success) {
        setModalDocumento(prev => ({
          ...prev,
          url: response.data.url,
          loading: false
        }));
      }
    } catch (error) {
      setModalDocumento(prev => ({
        ...prev,
        loading: false
      }));
      alert(`❌ Error al cargar documento: ${adminUtils.manejarError(error)}`);
    }
  };

  const cerrarModal = () => {
    setModalDocumento({
      isOpen: false,
      url: null,
      tipo: null,
      loading: false
    });
  };

  const handleAbrirObservaciones = (verificacionId, userName) => {
    setModalObservaciones({
      isOpen: true,
      loading: false,
      saving: false,
      verificacionId,
      userName,
      observaciones: ''
    });
  };

  const handleGuardarObservaciones = async () => {
    if (!modalObservaciones.observaciones.trim()) {
      alert('⚠️ Por favor escribe las observaciones');
      return;
    }

    setModalObservaciones(prev => ({ ...prev, saving: true }));

    try {
      const response = await verificacionesApi.guardarObservaciones(
        modalObservaciones.verificacionId, 
        modalObservaciones.observaciones
      );
      
      if (response.success) {
        alert('✅ Observaciones enviadas correctamente');
        setModalObservaciones(prev => ({ ...prev, isOpen: false }));
      }
    } catch (error) {
      alert('❌ Error al enviar observaciones');
    } finally {
      setModalObservaciones(prev => ({ ...prev, saving: false }));
    }
  };

  // Filtrar verificaciones según búsqueda
  const filteredVerificaciones = verificaciones.filter(verificacion => {
    const matchesSearch = 
      verificacion.user?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      verificacion.user?.email?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
        <span className="ml-3 text-gray-400">Cargando verificaciones...</span>
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
              <p className="text-gray-400 text-sm">Verificaciones Pendientes</p>
              <p className="text-2xl font-bold text-yellow-300">{estadisticas.verificaciones_pendientes}</p>
              <p className="text-red-400 text-xs mt-1">Requiere atención</p>
            </div>
            <div className="p-3 bg-yellow-500/20 rounded-lg">
              <Shield className="w-8 h-8 text-yellow-400" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800/60 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-pink-500/20">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-gray-400 text-sm">Modelos Activas</p>
              <p className="text-2xl font-bold text-pink-300">{estadisticas.modelos_activas}</p>
              <p className="text-green-400 text-xs mt-1">Verificadas</p>
            </div>
            <div className="p-3 bg-pink-500/20 rounded-lg">
              <CheckCircle className="w-8 h-8 text-pink-400" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800/60 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-blue-500/20">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-gray-400 text-sm">Esta Semana</p>
              <p className="text-2xl font-bold text-blue-300">{estadisticas.verificaciones_esta_semana}</p>
              <p className="text-gray-400 text-xs mt-1">Nuevas solicitudes</p>
            </div>
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <FileText className="w-8 h-8 text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800/60 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-green-500/20">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-gray-400 text-sm">Modelos Nuevas</p>
              <p className="text-2xl font-bold text-green-300">{estadisticas.modelos_nuevas}</p>
              <p className="text-green-400 text-xs mt-1">Últimos 7 días</p>
            </div>
            <div className="p-3 bg-green-500/20 rounded-lg">
              <Shield className="w-8 h-8 text-green-400" />
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

      {/* Verificaciones Pendientes */}
      <div className="bg-gray-800/60 backdrop-blur-sm rounded-xl shadow-lg border border-yellow-500/20">
        <div className="p-6 border-b border-gray-700/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h3 className="text-lg font-semibold text-yellow-300 flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Verificaciones Pendientes
              <span className="bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded-full text-sm">
                {filteredVerificaciones.length}
              </span>
            </h3>
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-auto">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
                <input 
                  type="text" 
                  placeholder="Buscar por nombre o email..." 
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
          {filteredVerificaciones.length === 0 ? (
            <div className="text-center py-8">
              <Shield className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <p className="text-gray-400">
                {searchTerm ? 'No se encontraron verificaciones con ese criterio' : 'No hay verificaciones pendientes'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[800px]">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700/50">
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Usuario</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Email</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">País</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Documentos</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Fecha</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVerificaciones.map((verificacion) => (
                      <tr key={verificacion.id} className="border-b border-gray-700/30 hover:bg-gray-700/20">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center">
                              <span className="text-white font-medium text-sm">
                                {verificacion.user?.name?.charAt(0) || '?'}
                              </span>
                            </div>
                            <span className="text-gray-300 font-medium">{verificacion.user?.name || 'Sin nombre'}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-gray-400">{verificacion.user?.email || 'Sin email'}</td>
                        <td className="py-4 px-4 text-gray-300">{verificacion.user?.country || '🌐 No especificado'}</td>
                        <td className="py-4 px-4">
                          <div className="flex gap-1 flex-wrap">
                            <button 
                              onClick={() => handleViewDocument(verificacion.id, 'selfie')}
                              className="text-blue-400 hover:text-blue-300 text-xs hover:underline flex items-center gap-1 bg-blue-500/10 px-2 py-1 rounded"
                            >
                              <Eye className="w-3 h-3" />
                              📸 Selfie
                            </button>
                            <button 
                              onClick={() => handleViewDocument(verificacion.id, 'documento')}
                              className="text-green-400 hover:text-green-300 text-xs hover:underline flex items-center gap-1 bg-green-500/10 px-2 py-1 rounded"
                            >
                              <Eye className="w-3 h-3" />
                              🆔 Doc
                            </button>
                            <button 
                              onClick={() => handleViewDocument(verificacion.id, 'selfie_doc')}
                              className="text-yellow-400 hover:text-yellow-300 text-xs hover:underline flex items-center gap-1 bg-yellow-500/10 px-2 py-1 rounded"
                            >
                              <Eye className="w-3 h-3" />
                              🤳 Selfie+Doc
                            </button>
                            <button 
                              onClick={() => handleViewDocument(verificacion.id, 'video')}
                              className="text-purple-400 hover:text-purple-300 text-xs hover:underline flex items-center gap-1 bg-purple-500/10 px-2 py-1 rounded"
                            >
                              <Eye className="w-3 h-3" />
                              🎥 Video
                            </button>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-gray-400">
                          {verificacion.fecha || verificacion.created_at ? 
                            (new Date(verificacion.created_at || verificacion.fecha).toLocaleDateString('es-ES')) : 
                            'N/A'}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex gap-1 flex-wrap">
                            <button 
                              onClick={() => handleApprove(verificacion.id, verificacion.user?.name || 'Usuario')}
                              disabled={procesando === verificacion.id}
                              className="bg-green-500/20 text-green-400 px-3 py-1 rounded-lg text-sm hover:bg-green-500/30 transition-colors disabled:opacity-50 flex items-center gap-1"
                            >
                              {procesando === verificacion.id ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <CheckCircle className="w-3 h-3" />
                              )}
                              Aprobar
                            </button>
                            
                            <button 
                              onClick={() => handleAbrirObservaciones(verificacion.id, verificacion.user?.name || 'Usuario')}
                              className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-lg text-sm hover:bg-blue-500/30 transition-colors flex items-center gap-1"
                            >
                              📝 Observaciones
                            </button>
                            
                            <button 
                              onClick={() => handleReject(verificacion.id, verificacion.user?.name || 'Usuario')}
                              disabled={procesando === verificacion.id}
                              className="bg-red-500/20 text-red-400 px-3 py-1 rounded-lg text-sm hover:bg-red-500/30 transition-colors disabled:opacity-50 flex items-center gap-1"
                            >
                              {procesando === verificacion.id ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <XCircle className="w-3 h-3" />
                              )}
                              Rechazar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal para ver documentos */}
      {modalDocumento.isOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-4xl max-h-[90vh] w-full mx-4 overflow-hidden">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white capitalize flex items-center gap-2">
                {modalDocumento.tipo === 'selfie' && '📸 Selfie del Usuario'}
                {modalDocumento.tipo === 'documento' && '🆔 Documento de Identidad'} 
                {modalDocumento.tipo === 'selfie_doc' && '🤳 Selfie con Documento'}
                {modalDocumento.tipo === 'video' && '🎥 Video de Verificación'}
                <span className="text-gray-400 text-sm">- Verificación</span>
              </h3>
              <button
                onClick={cerrarModal}
                className="text-gray-400 hover:text-white"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4">
              {modalDocumento.loading ? (
                <div className="flex items-center justify-center h-64">
                  <RefreshCw className="w-8 h-8 animate-spin text-pink-500" />
                  <span className="ml-3 text-gray-400">Cargando documento...</span>
                </div>
              ) : modalDocumento.url ? (
                <div className="text-center">
                  {modalDocumento.tipo === 'video' ? (
                    <video 
                      src={modalDocumento.url} 
                      controls 
                      className="max-w-full max-h-[70vh] mx-auto"
                    />
                  ) : (
                    <img 
                      src={modalDocumento.url} 
                      alt={`${modalDocumento.tipo} de verificación`}
                      className="max-w-full max-h-[70vh] mx-auto object-contain"
                    />
                  )}
                  <div className="mt-4">
                    <a 
                      href={modalDocumento.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-blue-500/20 text-blue-400 px-4 py-2 rounded-lg hover:bg-blue-500/30 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Abrir en nueva pestaña
                    </a>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                  <p className="text-red-400">Error al cargar el documento</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de observaciones */}
      {modalObservaciones.isOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-lg w-full mx-4">
            <div className="p-6 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                📝 Observaciones para {modalObservaciones.userName}
              </h3>
            </div>
            <div className="p-6">
              <textarea
                value={modalObservaciones.observaciones}
                onChange={(e) => setModalObservaciones(prev => ({...prev, observaciones: e.target.value}))}
                className="w-full h-24 sm:h-32 bg-gray-700/50 text-gray-300 px-3 py-2 rounded-lg border border-gray-600/50 focus:border-blue-500/50 focus:outline-none resize-none text-sm"
                placeholder="Escribe las observaciones específicas sobre los documentos..."
              />
            </div>
            <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setModalObservaciones(prev => ({...prev, isOpen: false}))}
                className="px-4 py-2 text-gray-400 hover:text-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardarObservaciones}
                disabled={modalObservaciones.saving}
                className="bg-blue-500/20 text-blue-400 px-6 py-2 rounded-lg hover:bg-blue-500/30 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {modalObservaciones.saving ? '📤 Enviando...' : '📤 Enviar Observaciones'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VerificacionesModule;
