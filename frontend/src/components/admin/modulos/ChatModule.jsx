import React, { useState, useEffect } from "react";
import { 
  MessageCircle, 
  Search,
  Filter,
  Trash2,
  Ban,
  CheckCircle,
  Eye,
  RefreshCw,
  AlertCircle,
  X,
  User,
  Calendar,
  BarChart3
} from "lucide-react";
import { chatAdminApi, adminUtils } from "../../../services/adminApiService";

const ChatModule = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [stats, setStats] = useState(null);
  
  // Filtros
  const [filters, setFilters] = useState({
    status: 'all',
    search: '',
    date_from: '',
    date_to: ''
  });
  
  // Paginación
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    per_page: 20,
    total: 0
  });

  // Modales
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockUserData, setBlockUserData] = useState({ userId: null, userName: '', reason: '' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState(null);

  // Cargar datos al montar
  useEffect(() => {
    cargarDatos();
  }, [filters.status, filters.search]);

  const cargarDatos = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [conversationsData, statsData] = await Promise.all([
        chatAdminApi.getConversations({
          ...filters,
          per_page: pagination.per_page,
          page: pagination.current_page
        }),
        chatAdminApi.getStats()
      ]);

      if (conversationsData.success) {
        setConversations(conversationsData.data || []);
        setPagination(conversationsData.pagination || pagination);
      }

      if (statsData.success) {
        setStats(statsData.data);
      }

    } catch (error) {
      setError(adminUtils.manejarError(error));
    } finally {
      setLoading(false);
    }
  };

  const cargarMensajes = async (roomName) => {
    try {
      const response = await chatAdminApi.getMessages(roomName);
      if (response.success) {
        setMessages(response.messages || []);
        setSelectedConversation(response.conversation);
      }
    } catch (error) {
      alert('Error al cargar mensajes');
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm('¿Estás seguro de eliminar este mensaje? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      const response = await chatAdminApi.deleteMessage(messageId);
      if (response.success) {
        // Eliminar mensaje de la lista local
        setMessages(prev => prev.filter(m => m.id !== messageId));
        alert('✅ Mensaje eliminado correctamente');
      }
    } catch (error) {
      alert('❌ Error al eliminar mensaje');
    }
  };

  const handleBlockUser = async () => {
    if (!blockUserData.userId) return;

    try {
      const response = await chatAdminApi.blockUser(blockUserData.userId, blockUserData.reason);
      if (response.success) {
        alert('✅ Usuario bloqueado correctamente');
        setShowBlockModal(false);
        setBlockUserData({ userId: null, userName: '', reason: '' });
        cargarDatos(); // Recargar conversaciones
      }
    } catch (error) {
      alert('❌ Error al bloquear usuario: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleUnblockUser = async (userId) => {
    if (!window.confirm('¿Estás seguro de desbloquear este usuario?')) {
      return;
    }

    try {
      const response = await chatAdminApi.unblockUser(userId);
      if (response.success) {
        alert('✅ Usuario desbloqueado correctamente');
        cargarDatos();
      }
    } catch (error) {
      alert('❌ Error al desbloquear usuario');
    }
  };

  const handleSearch = async () => {
    if (!filters.search || filters.search.length < 2) {
      alert('Por favor ingresa al menos 2 caracteres para buscar');
      return;
    }

    try {
      const response = await chatAdminApi.searchConversations(filters.search);
      if (response.success) {
        setConversations(response.data || []);
      }
    } catch (error) {
      alert('Error al buscar conversaciones');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-pink-300 flex items-center gap-2">
            <MessageCircle className="w-6 h-6" />
            Gestión de Chat
          </h2>
          <p className="text-gray-400 text-sm mt-1">Modera conversaciones y mensajes de la plataforma</p>
        </div>
        <button
          onClick={cargarDatos}
          className="px-4 py-2 bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 rounded-lg transition flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </button>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/30 text-red-400 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Estadísticas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-800/60 backdrop-blur-sm p-4 rounded-xl border border-blue-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Conversaciones</p>
                <p className="text-2xl font-bold text-blue-300">{stats.total_conversations || 0}</p>
              </div>
              <MessageCircle className="w-8 h-8 text-blue-400" />
            </div>
          </div>
          <div className="bg-gray-800/60 backdrop-blur-sm p-4 rounded-xl border border-green-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Conversaciones Activas</p>
                <p className="text-2xl font-bold text-green-300">{stats.active_conversations || 0}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </div>
          <div className="bg-gray-800/60 backdrop-blur-sm p-4 rounded-xl border border-purple-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Mensajes</p>
                <p className="text-2xl font-bold text-purple-300">{stats.total_messages || 0}</p>
              </div>
              <BarChart3 className="w-8 h-8 text-purple-400" />
            </div>
          </div>
          <div className="bg-gray-800/60 backdrop-blur-sm p-4 rounded-xl border border-red-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Usuarios Bloqueados</p>
                <p className="text-2xl font-bold text-red-300">{stats.blocked_users || 0}</p>
              </div>
              <Ban className="w-8 h-8 text-red-400" />
            </div>
          </div>
        </div>
      )}

      {/* Filtros y búsqueda */}
      <div className="bg-gray-800/60 backdrop-blur-sm p-4 rounded-xl border border-gray-700/50">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Estado</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white"
            >
              <option value="all">Todas</option>
              <option value="active">Activas</option>
              <option value="ended">Finalizadas</option>
              <option value="waiting">En espera</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Fecha desde</label>
            <input
              type="date"
              value={filters.date_from}
              onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
              className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Fecha hasta</label>
            <input
              type="date"
              value={filters.date_to}
              onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
              className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Buscar</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="Usuario, email, room..."
                className="flex-1 px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button
                onClick={handleSearch}
                className="px-4 py-2 bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 rounded-lg transition"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lista de conversaciones */}
        <div className="bg-gray-800/60 backdrop-blur-sm rounded-xl border border-gray-700/50">
          <div className="p-4 border-b border-gray-700/50">
            <h3 className="text-lg font-semibold text-white">Conversaciones ({pagination.total})</h3>
          </div>
          
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>No hay conversaciones</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700/50 max-h-[600px] overflow-y-auto">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => cargarMensajes(conv.room_name)}
                  className={`p-4 cursor-pointer hover:bg-gray-700/30 transition ${
                    selectedConversation?.room_name === conv.room_name ? 'bg-pink-500/10 border-l-4 border-pink-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-2 h-2 rounded-full ${
                          conv.status === 'active' ? 'bg-green-400' : 'bg-gray-400'
                        }`}></div>
                        <span className="text-sm text-gray-400">{conv.status}</span>
                      </div>
                      
                      <div className="space-y-1">
                        {conv.cliente && (
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-blue-400" />
                            <span className="text-white text-sm">
                              Cliente: {conv.cliente.name || conv.cliente.email}
                            </span>
                          </div>
                        )}
                        {conv.modelo && (
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-pink-400" />
                            <span className="text-white text-sm">
                              Modelo: {conv.modelo.name || conv.modelo.email}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {conv.last_message && (
                        <p className="text-gray-400 text-xs mt-2 truncate">
                          {conv.last_message.user_name}: {conv.last_message.message}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>{conv.message_count} mensajes</span>
                        <span>{formatDate(conv.last_message?.created_at || conv.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Paginación */}
          {pagination.last_page > 1 && (
            <div className="p-4 border-t border-gray-700/50 flex items-center justify-between">
              <button
                onClick={() => {
                  setPagination({ ...pagination, current_page: pagination.current_page - 1 });
                  cargarDatos();
                }}
                disabled={pagination.current_page === 1}
                className="px-3 py-1 bg-gray-700/50 disabled:opacity-50 text-white rounded"
              >
                Anterior
              </button>
              <span className="text-gray-400 text-sm">
                Página {pagination.current_page} de {pagination.last_page}
              </span>
              <button
                onClick={() => {
                  setPagination({ ...pagination, current_page: pagination.current_page + 1 });
                  cargarDatos();
                }}
                disabled={pagination.current_page === pagination.last_page}
                className="px-3 py-1 bg-gray-700/50 disabled:opacity-50 text-white rounded"
              >
                Siguiente
              </button>
            </div>
          )}
        </div>

        {/* Mensajes de conversación seleccionada */}
        <div className="bg-gray-800/60 backdrop-blur-sm rounded-xl border border-gray-700/50">
          <div className="p-4 border-b border-gray-700/50">
            {selectedConversation ? (
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">Mensajes</h3>
                  <p className="text-sm text-gray-400">
                    {selectedConversation.cliente?.name} ↔ {selectedConversation.modelo?.name}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedConversation(null);
                    setMessages([]);
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <h3 className="text-lg font-semibold text-gray-400">Selecciona una conversación</h3>
            )}
          </div>

          {selectedConversation && (
            <div className="p-4 max-h-[600px] overflow-y-auto space-y-3">
              {messages.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  <p>No hay mensajes en esta conversación</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-3 rounded-lg ${
                      msg.user_role === 'modelo' 
                        ? 'bg-pink-500/10 border border-pink-500/20' 
                        : 'bg-blue-500/10 border border-blue-500/20'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${
                          msg.user_role === 'modelo' ? 'text-pink-300' : 'text-blue-300'
                        }`}>
                          {msg.user?.name || msg.user_name}
                        </span>
                        <span className="text-xs text-gray-500">({msg.user_role})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDeleteMessage(msg.id)}
                          className="text-red-400 hover:text-red-300 p-1 rounded"
                          title="Eliminar mensaje"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setBlockUserData({
                              userId: msg.user_id,
                              userName: msg.user?.name || msg.user_name,
                              reason: ''
                            });
                            setShowBlockModal(true);
                          }}
                          className="text-orange-400 hover:text-orange-300 p-1 rounded"
                          title="Bloquear usuario"
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <p className="text-white text-sm">{msg.message}</p>
                    <p className="text-xs text-gray-500 mt-1">{formatDate(msg.created_at)}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal para bloquear usuario */}
      {showBlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-pink-500/30">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-pink-300">Bloquear Usuario</h3>
              <button
                onClick={() => setShowBlockModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Usuario</label>
                <p className="text-white">{blockUserData.userName}</p>
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-2">Razón (opcional)</label>
                <textarea
                  value={blockUserData.reason}
                  onChange={(e) => setBlockUserData({ ...blockUserData, reason: e.target.value })}
                  placeholder="Razón del bloqueo..."
                  className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white"
                  rows="3"
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowBlockModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleBlockUser}
                  className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition"
                >
                  Bloquear
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatModule;

