import React, { useState, useEffect } from "react";
import { 
  Users, 
  Shield, 
  Heart,
  Eye,
  Download,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Info,
  Search,
  Filter
} from "lucide-react";
import { verificacionesApi, usuariosApi, adminUtils } from "../../../services/adminApiService";

const UsersModule = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);
  const [procesando, setProcesando] = useState(null); // ID de verificación siendo procesada
  const [error, setError] = useState(null);
  const [showDebug, setShowDebug] = useState(false);
  
  // Estados para datos reales
  const [verificacionesPendientes, setVerificacionesPendientes] = useState([]);
  const [usuariosRegistrados, setUsuariosRegistrados] = useState([]); // ✅ NUEVO
  const [paginacion, setPaginacion] = useState(null); // ✅ NUEVO
  const [estadisticas, setEstadisticas] = useState({
    total_usuarios: 0,
    modelos_activas: 0,
    verificaciones_pendientes: 0,
    clientes_activos: 0,
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

  // ✅ NUEVO: Modal para editar modelo
  const [modalEditar, setModalEditar] = useState({
    isOpen: false,
    loading: false,
    saving: false,
    usuario: null,
    form: {
      name: '',
      email: '',
      country: '',
      country_name: '',
      city: '',
      minimum_payout: '',
      payment_method: '',
      account_details: '',
      account_holder_name: ''
    }
  });
  const registeredUsers = [
    { id: 1, name: "María Fernanda", email: "maria@email.com", role: "modelo", status: "online", verified: true, registered: "15 Feb", lastAccess: "Ahora" },
    { id: 2, name: "Carlos Mendoza", email: "carlos@email.com", role: "cliente", status: "offline", verified: true, registered: "14 Feb", lastAccess: "2 horas" },
    { id: 3, name: "Laura Sánchez", email: "laura@email.com", role: "modelo", status: "online", verified: true, registered: "13 Feb", lastAccess: "5 min" },
    { id: 4, name: "David Rodriguez", email: "david@email.com", role: "cliente", status: "online", verified: true, registered: "12 Feb", lastAccess: "Ahora" },
    { id: 5, name: "Andrea Morales", email: "andrea@email.com", role: "modelo", status: "offline", verified: false, registered: "11 Feb", lastAccess: "1 día" }
  ];

  // Cargar datos al montar el componente
  useEffect(() => {
    cargarDatos();
    cargarUsuarios();
  }, []);

  // Cargar usuarios cuando cambien los filtros
  useEffect(() => {
    cargarUsuarios();
  }, [searchTerm, roleFilter]);

  const cargarDatos = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Cargar verificaciones pendientes y estadísticas en paralelo
      const [verificaciones, stats] = await Promise.all([
        verificacionesApi.getPendientes(),
        verificacionesApi.getStats()
      ]);

      if (verificaciones.success) {
        setVerificacionesPendientes(verificaciones.data);
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

  // ✅ NUEVA FUNCIÓN: Cargar usuarios registrados
  const cargarUsuarios = async () => {
    setLoadingUsuarios(true);
    
    try {
      const filtros = {
        rol: roleFilter,
        search: searchTerm,
        page: 1
      };

      const response = await usuariosApi.getAll(filtros);
      
      if (response.success) {
        setUsuariosRegistrados(response.data);
        setPaginacion(response.pagination);
      }

    } catch (error) {
    } finally {
      setLoadingUsuarios(false);
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
        setVerificacionesPendientes(prev => 
          prev.filter(v => v.id !== verificacionId)
        );
        
        // Actualizar estadísticas
        setEstadisticas(prev => ({
          ...prev,
          verificaciones_pendientes: prev.verificaciones_pendientes - 1,
          modelos_activas: prev.modelos_activas + 1
        }));

        alert(`✅ Verificación de ${userName} aprobada correctamente`);
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
        setVerificacionesPendientes(prev => 
          prev.filter(v => v.id !== verificacionId)
        );
        
        // Actualizar estadísticas
        setEstadisticas(prev => ({
          ...prev,
          verificaciones_pendientes: prev.verificaciones_pendientes - 1
        }));

        alert(`🗑️ Verificación de ${userName} rechazada y eliminada`);
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

  // ✅ NUEVAS FUNCIONES para usuarios
  const handleEditarUsuario = async (userId, userRole) => {
    if (userRole !== 'modelo') {
      alert('⚠️ Solo se pueden editar usuarios con rol de modelo por protección de datos');
      return;
    }

    // Abrir modal de edición
    setModalEditar({
      isOpen: true,
      loading: true,
      saving: false,
      usuario: null,
      form: {
        name: '',
        email: '',
        country: '',
        country_name: '',
        city: '',
        minimum_payout: '',
        payment_method: '',
        account_details: '',
        account_holder_name: ''
      }
    });

    try {
      // Obtener datos del usuario
      const response = await usuariosApi.getDetalle(userId);
      if (response.success) {
        const usuario = response.data;
        setModalEditar(prev => ({
          ...prev,
          loading: false,
          usuario: usuario,
          form: {
            name: usuario.name || '',
            email: usuario.email || '',
            country: usuario.country || '',
            country_name: usuario.country_name || '',
            city: usuario.city || '',
            minimum_payout: usuario.minimum_payout || '40.00',
            payment_method: usuario.payment_method || '',
            account_details: usuario.account_details || '',
            account_holder_name: usuario.account_holder_name || ''
          }
        }));
      }
    } catch (error) {
      setModalEditar(prev => ({ ...prev, loading: false }));
      alert('❌ Error al cargar datos del usuario');
    }
  };

  const handleGuardarEdicion = async () => {
    // Validar email antes de enviar
    if (modalEditar.form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(modalEditar.form.email)) {
      alert('❌ Por favor ingresa un email válido (ejemplo: usuario@dominio.com)');
      return;
    }

    setModalEditar(prev => ({ ...prev, saving: true }));

    try {
      const response = await usuariosApi.actualizar(modalEditar.usuario.id, modalEditar.form);
      if (response.success) {
        alert('✅ Usuario actualizado correctamente');
        cerrarModalEditar();
        cargarUsuarios(); // Recargar lista
      } else {
        alert(`❌ Error: ${response.message}`);
      }
    } catch (error) {
      
      // Manejo específico de errores de validación
      if (error.response?.status === 422) {
        const errors = error.response.data.errors;
        let errorMessage = '❌ Errores de validación:\n\n';
        
        for (const [field, messages] of Object.entries(errors)) {
          errorMessage += `• ${field}: ${messages.join(', ')}\n`;
        }
        
        alert(errorMessage);
      } else {
        alert(`❌ Error al actualizar: ${adminUtils.manejarError(error)}`);
      }
    } finally {
      setModalEditar(prev => ({ ...prev, saving: false }));
    }
  };

  const cerrarModalEditar = () => {
    setModalEditar({
      isOpen: false,
      loading: false,
      saving: false,
      usuario: null,
      form: {
        name: '',
        email: '',
        country: '',
        country_name: '',
        city: '',
        minimum_payout: '',
        payment_method: '',
        account_details: '',
        account_holder_name: ''
      }
    });
  };

  const actualizarFormulario = (campo, valor) => {
    setModalEditar(prev => ({
      ...prev,
      form: {
        ...prev.form,
        [campo]: valor
      }
    }));
  };

  const handleEliminarUsuario = async (userId, userName) => {
    if (!window.confirm(`⚠️ ¿Estás seguro de ELIMINAR permanentemente a ${userName}?\n\nEsta acción NO se puede deshacer y eliminará:\n- El usuario de la base de datos\n- Todas sus verificaciones\n- Todo su historial\n\n¿Continuar?`)) {
      return;
    }

    const confirmar = window.confirm(`🚨 CONFIRMACIÓN FINAL:\n\nVas a eliminar PERMANENTEMENTE a:\n${userName}\n\n¿Estás 100% seguro?`);
    if (!confirmar) return;

    try {
      const response = await usuariosApi.eliminar(userId);
      if (response.success) {
        alert(`✅ Usuario ${userName} eliminado permanentemente`);
        cargarUsuarios(); // Recargar lista
        cargarDatos(); // Recargar estadísticas
      }
    } catch (error) {
      alert(`❌ Error al eliminar usuario: ${adminUtils.manejarError(error)}`);
    }
  };

  // Filtrar usuarios según búsqueda y rol
  const filteredUsers = registeredUsers.filter(user => {
    const matchesSearch = (user.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (user.email || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
        <span className="ml-3 text-gray-400">Cargando datos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Panel de Debug - Siempre visible para testing */}
      <div className="bg-yellow-500/10 backdrop-blur-sm p-4 rounded-lg border border-yellow-500/30">
        <h4 className="text-yellow-300 font-medium mb-3 flex items-center gap-2">
          <Info className="w-5 h-5" />
          🔍 Información de Debug
        </h4>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <p className="text-gray-300">
              <span className="text-yellow-300 font-medium">🔑 Token disponible:</span> {adminUtils.tieneToken() ? '✅ SÍ' : '❌ NO'}
            </p>
            {adminUtils.getTokenInfo() ? (
              <p className="text-gray-300">
                <span className="text-yellow-300 font-medium">📍 Token encontrado en:</span> {adminUtils.getTokenInfo().storage} ({adminUtils.getTokenInfo().key})
              </p>
            ) : (
              <p className="text-red-400">❌ No se encontró token en ninguna ubicación</p>
            )}
            <p className="text-gray-300">
              <span className="text-yellow-300 font-medium">🌐 API URL:</span> {import.meta.env.VITE_API_URL || 'https://ligandome.com/api'}
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-gray-300">
              <span className="text-yellow-300 font-medium">📊 Datos actuales:</span> {verificacionesPendientes.length > 0 ? 'Datos mock' : 'Ninguno'}
            </p>
            <p className="text-gray-300">
              <span className="text-yellow-300 font-medium">🔄 Estado carga:</span> {loading ? 'Cargando...' : 'Completado'}
            </p>
            <p className="text-gray-300">
              <span className="text-yellow-300 font-medium">⚠️ Último error:</span> {error || 'Ninguno'}
            </p>
          </div>
        </div>
        
        {/* Botones de debug */}
        <div className="mt-4 flex gap-2 flex-wrap text-xs sm:text-sm">
          <button 
            onClick={() => {
              console.log('localStorage tokens:', {
                admin_token: localStorage.getItem('admin_token'),
                auth_token: localStorage.getItem('auth_token'),
                token: localStorage.getItem('token')
              });
              console.log('sessionStorage tokens:', {
                admin_token: sessionStorage.getItem('admin_token'),
                auth_token: sessionStorage.getItem('auth_token'),
                token: sessionStorage.getItem('token')
              });
            }}
            className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded text-xs hover:bg-blue-500/30"
          >
            🔍 Ver tokens en consola
          </button>
          
          <button 
            onClick={cargarDatos}
            className="px-3 py-1 bg-green-500/20 text-green-300 rounded text-xs hover:bg-green-500/30"
          >
            🔄 Recargar verificaciones
          </button>
          
          <button 
            onClick={cargarUsuarios}
            className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded text-xs hover:bg-blue-500/30"
          >
            🔄 Recargar usuarios
          </button>
          
          <button 
            onClick={() => {
              const tokenInfo = adminUtils.getTokenInfo();
              if (tokenInfo && tokenInfo.fullToken) {
                // Mover el token real al lugar correcto
                localStorage.setItem('admin_token', tokenInfo.fullToken);
                alert('✅ Token real copiado a localStorage. Probando conexión...');
                cargarDatos();
              } else {
                alert('❌ No se encontró token para copiar');
              }
            }}
            className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded text-xs hover:bg-purple-500/30"
          >
            🔄 Usar token real
          </button>
          
          <button 
            onClick={() => {
              const tokenInfo = adminUtils.getTokenInfo();
              if (tokenInfo) {
                alert(`Token encontrado:\n- Storage: ${tokenInfo.storage}\n- Key: ${tokenInfo.key}\n- Token: ${tokenInfo.token}`);
              } else {
                alert('❌ No se encontró ningún token');
              }
            }}
            className="px-3 py-1 bg-orange-500/20 text-orange-300 rounded text-xs hover:bg-orange-500/30"
          >
            📋 Info completa del token
          </button>
        </div>
      </div>

      {/* Header con estadísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-gray-800/60 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-blue-500/20">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-gray-400 text-sm">Total Usuarios</p>
              <p className="text-2xl font-bold text-blue-300">{estadisticas.total_usuarios.toLocaleString()}</p>
              <p className="text-green-400 text-xs mt-1">Sistema activo</p>
            </div>
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <Users className="w-8 h-8 text-blue-400" />
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
              <Heart className="w-8 h-8 text-pink-400" />
            </div>
          </div>
        </div>

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

        <div className="bg-gray-800/60 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-green-500/20">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-gray-400 text-sm">Clientes Activos</p>
              <p className="text-2xl font-bold text-green-300">{estadisticas.clientes_activos}</p>
              <p className="text-green-400 text-xs mt-1">En plataforma</p>
            </div>
            <div className="p-3 bg-green-500/20 rounded-lg">
              <Users className="w-8 h-8 text-green-400" />
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
                {verificacionesPendientes.length}
              </span>
            </h3>
            <div className="flex items-center gap-2">
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
          {verificacionesPendientes.length === 0 ? (
            <div className="text-center py-8">
              <Shield className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <p className="text-gray-400">No hay verificaciones pendientes</p>
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
                    {verificacionesPendientes.map((verificacion) => (
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
                        <td className="py-4 px-4 text-gray-400">{verificacion.fecha}</td>
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
                                
                                {/* ✅ NUEVO BOTÓN */}
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

      {/* Lista de Usuarios Registrados */}
      <div className="bg-gray-800/60 backdrop-blur-sm rounded-xl shadow-lg border border-purple-500/20">
        <div className="p-6 border-b border-gray-700/50">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-purple-300 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Usuarios Registrados
              {paginacion && (
                <span className="bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full text-sm">
                  {paginacion.total} total
                </span>
              )}
            </h3>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative w-full sm:w-auto">
                <Filter className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
                <select 
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="w-full sm:w-auto bg-gray-700/50 text-gray-300 pl-10 pr-4 py-2 rounded-lg border border-gray-600/50 focus:border-purple-500/50 focus:outline-none text-sm"
                >
                  <option value="all">Todos los roles</option>
                  <option value="modelo">Modelos</option>
                  <option value="cliente">Clientes</option>
                </select>
              </div>
              <div className="relative w-full sm:w-auto">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
                <input 
                    type="text" 
                    placeholder="Buscar..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full sm:w-auto bg-gray-700/50 text-gray-300 pl-10 pr-4 py-2 rounded-lg border border-gray-600/50 placeholder-gray-500 focus:border-purple-500/50 focus:outline-none text-sm"
                />
              </div>
              {loadingUsuarios && (
                <div className="flex items-center text-purple-400">
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  <span className="text-sm">Cargando...</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="overflow-x-auto">
              <div className="min-w-[900px]"> {/* Wrapper para scroll horizontal */}
                <table className="w-full">
                <thead>
                    <tr className="border-b border-gray-700/50">
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Usuario</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Rol</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">País</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Estado</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Registro</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Último acceso</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {usuariosRegistrados.map((user) => (
                    <tr key={user.id} className="border-b border-gray-700/30 hover:bg-gray-700/20">
                        <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            user.role === 'modelo' ? 'bg-gradient-to-r from-pink-500 to-purple-600' : 'bg-gradient-to-r from-blue-500 to-cyan-600'
                            }`}>
                            <span className="text-white font-medium text-sm">{user.name?.charAt(0) || '?'}</span>
                            </div>
                            <div>
                            <div className="flex items-center gap-2">
                                <span className="text-gray-300 font-medium">{user.name || 'Sin nombre'}</span>
                                {user.verified && (
                                <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center" title="Cuenta verificada">
                                    <span className="text-white text-xs">✓</span>
                                </div>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-gray-500 text-sm">{user.email || 'Sin email'}</span>
                                {user.email_verified ? (
                                <span className="text-green-400 text-xs bg-green-500/20 px-2 py-0.5 rounded" title="Email verificado">
                                    📧 ✓
                                </span>
                                ) : (
                                <span className="text-orange-400 text-xs bg-orange-500/20 px-2 py-0.5 rounded" title="Email no verificado">
                                    📧 ⚠️
                                </span>
                                )}
                            </div>
                            </div>
                        </div>
                        </td>
                        <td className="py-4 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs capitalize ${
                            user.role === 'modelo' 
                            ? 'bg-pink-500/20 text-pink-300' 
                            : user.role === 'cliente'
                            ? 'bg-blue-500/20 text-blue-300'
                            : 'bg-gray-500/20 text-gray-300'
                        }`}>
                            {user.role || 'sin_rol'}
                        </span>
                        </td>
                        <td className="py-4 px-4 text-gray-300">{user.country || '🌐 No especificado'}</td>
                        <td className="py-4 px-4">
                        <span className={`flex items-center gap-2 ${
                            user.status === 'online' ? 'text-green-400' : 'text-gray-500'
                        }`}>
                            <div className={`w-2 h-2 rounded-full ${
                            user.status === 'online' ? 'bg-green-400' : 'bg-gray-500'
                            }`}></div>
                            {user.status}
                        </span>
                        </td>
                        <td className="py-4 px-4 text-gray-400">{user.registered}</td>
                        <td className="py-4 px-4 text-gray-400">{user.lastAccess}</td>
                        <td className="py-4 px-4">
                        <div className="flex gap-2">
                            {/* Solo mostrar editar para modelos */}
                            {user.role === 'modelo' && (
                            <button 
                                onClick={() => handleEditarUsuario(user.id, user.role)}
                                className="text-yellow-400 hover:text-yellow-300 text-sm hover:underline flex items-center gap-1"
                                title="Editar modelo"
                            >
                                ✏️ Editar
                            </button>
                            )}
                            
                            {/* Botón eliminar para todos */}
                            <button 
                            onClick={() => handleEliminarUsuario(user.id, user.name || 'Usuario')}
                            className="text-red-400 hover:text-red-300 text-sm hover:underline flex items-center gap-1"
                            title="Eliminar usuario permanentemente"
                            >
                            🗑️ Eliminar
                            </button>
                            
                            {/* Indicador de protección para clientes */}
                            {user.role === 'cliente' && (
                            <span className="text-gray-500 text-xs italic" title="Datos protegidos - solo eliminación disponible">
                                🔒 Protegido
                            </span>
                            )}
                        </div>
                        </td>
                    </tr>
                    ))}
                </tbody>
                </table>
              </div>
            </div>
          
          {/* Información de paginación y resultados */}
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="text-sm text-gray-400">
              {usuariosRegistrados.length === 0 ? (
                <span>No se encontraron usuarios con los filtros aplicados</span>
              ) : (
                <span>
                  Mostrando {usuariosRegistrados.length} usuarios
                  {paginacion && ` de ${paginacion.total} total`}
                  {(searchTerm || roleFilter !== 'all') && (
                    <span className="text-purple-400">
                      {' '}(filtrado{searchTerm && ` por "${searchTerm}"`}{roleFilter !== 'all' && ` - rol: ${roleFilter}`})
                    </span>
                  )}
                </span>
              )}
            </div>
            
            {/* Indicador si son datos mock */}
            {usuariosRegistrados.length > 0 && (
              <div className="text-xs text-gray-500">
                {paginacion ? '🔗 Datos reales' : '🧪 Datos de prueba'}
              </div>
            )}
          </div>
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
      {/* Modal para editar modelo */}
      {modalEditar.isOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                ✏️ Editar Modelo
                {modalEditar.usuario && (
                  <span className="text-pink-300">- {modalEditar.usuario.name}</span>
                )}
              </h3>
              <button 
                onClick={cerrarModalEditar}
                disabled={modalEditar.saving}
                className="text-gray-400 hover:text-white disabled:opacity-50"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              {modalEditar.loading ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCw className="w-8 h-8 animate-spin text-pink-500" />
                  <span className="ml-3 text-gray-400">Cargando datos...</span>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Información personal */}
                  <div className="space-y-4">
                    <h4 className="text-pink-300 font-medium border-b border-gray-700 pb-2">📋 Información Personal</h4>
                    
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-gray-400 text-sm font-medium mb-2">Nombre</label>
                        <input
                          type="text"
                          value={modalEditar.form.name}
                          onChange={(e) => actualizarFormulario('name', e.target.value)}
                          className="w-full bg-gray-700/50 text-gray-300 px-3 py-2 rounded-lg border border-gray-600/50 focus:border-pink-500/50 focus:outline-none"
                          placeholder="Nombre completo"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-gray-400 text-sm font-medium mb-2">Email</label>
                        <input
                          type="email"
                          value={modalEditar.form.email}
                          onChange={(e) => actualizarFormulario('email', e.target.value)}
                          className="w-full bg-gray-700/50 text-gray-300 px-3 py-2 rounded-lg border border-gray-600/50 focus:border-pink-500/50 focus:outline-none"
                          placeholder="email@ejemplo.com"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Ubicación */}
                  <div className="space-y-4">
                    <h4 className="text-purple-300 font-medium border-b border-gray-700 pb-2">🌍 Ubicación</h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-gray-400 text-sm font-medium mb-2">País (Código)</label>
                        <input
                          type="text"
                          value={modalEditar.form.country}
                          onChange={(e) => actualizarFormulario('country', e.target.value.toUpperCase())}
                          maxLength="2"
                          className="w-full bg-gray-700/50 text-gray-300 px-3 py-2 rounded-lg border border-gray-600/50 focus:border-purple-500/50 focus:outline-none"
                          placeholder="CO, MX, US..."
                        />
                      </div>
                      
                      <div>
                        <label className="block text-gray-400 text-sm font-medium mb-2">País (Nombre)</label>
                        <input
                          type="text"
                          value={modalEditar.form.country_name}
                          onChange={(e) => actualizarFormulario('country_name', e.target.value)}
                          className="w-full bg-gray-700/50 text-gray-300 px-3 py-2 rounded-lg border border-gray-600/50 focus:border-purple-500/50 focus:outline-none"
                          placeholder="Colombia, México..."
                        />
                      </div>
                      
                      <div>
                        <label className="block text-gray-400 text-sm font-medium mb-2">Ciudad</label>
                        <input
                          type="text"
                          value={modalEditar.form.city}
                          onChange={(e) => actualizarFormulario('city', e.target.value)}
                          className="w-full bg-gray-700/50 text-gray-300 px-3 py-2 rounded-lg border border-gray-600/50 focus:border-purple-500/50 focus:outline-none"
                          placeholder="Bogotá, CDMX..."
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Botones */}
            <div className="p-4 sm:p-6 border-t border-gray-700 flex flex-col sm:flex-row justify-end gap-3">
              <button
                onClick={cerrarModalEditar}
                disabled={modalEditar.saving}
                className="px-4 py-2 text-gray-400 hover:text-gray-300 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardarEdicion}
                disabled={modalEditar.loading || modalEditar.saving}
                className="bg-pink-500/20 text-pink-400 px-6 py-2 rounded-lg hover:bg-pink-500/30 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {modalEditar.saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    💾 Guardar Cambios
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ✅ NUEVO: Modal de observaciones */}
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

export default UsersModule;