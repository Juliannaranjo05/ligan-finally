import React, { useState, useEffect } from 'react';
import { X, Search, User, Wifi, WifiOff } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const AddSecondModelModal = ({
  isOpen,
  onClose,
  currentModelId,
  callId,
  onInvite,
  userBalance = 0
}) => {
  const [modelos, setModelos] = useState([]);
  const [filteredModelos, setFilteredModelos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);
  const [onlyOnline, setOnlyOnline] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadModelos();
    }
  }, [isOpen, currentModelId]);

  useEffect(() => {
    filterModelos();
  }, [modelos, searchTerm, onlyOnline]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  const loadModelos = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/modelos`, {
        method: 'GET',
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error('Error cargando modelos');
      }

      const data = await response.json();
      
      if (data.success && data.modelos) {
        // Filtrar el modelo actual
        const filtered = data.modelos.filter(m => m.id !== currentModelId);
        setModelos(filtered);
      } else {
        setModelos([]);
      }
    } catch (err) {
      setError('No se pudieron cargar los modelos');
      setModelos([]);
    } finally {
      setLoading(false);
    }
  };

  const filterModelos = () => {
    let filtered = [...modelos];

    // Filtrar por término de búsqueda
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(m => 
        m.name?.toLowerCase().includes(term) ||
        m.display_name?.toLowerCase().includes(term)
      );
    }

    // Filtrar solo online
    if (onlyOnline) {
      filtered = filtered.filter(m => m.is_online === true);
    }

    setFilteredModelos(filtered);
  };

  const handleInvite = async (modeloId) => {
    if (inviting) return; // Prevenir múltiples clicks

    setInviting(modeloId);
    setError(null);

    try {
      await onInvite(callId, modeloId);
      onClose();
    } catch (err) {
      setError(err.message || 'Error al enviar invitación');
    } finally {
      setInviting(null);
    }
  };

  if (!isOpen) return null;

  // Validar saldo mínimo (60 monedas para doble costo)
  const hasEnoughBalance = userBalance >= 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-[#1a1d21] rounded-2xl w-full max-w-md mx-4 max-h-[90vh] flex flex-col border border-gray-800 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-xl font-semibold text-white">Agregar Modelo</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Alerta de saldo insuficiente */}
        {!hasEnoughBalance && (
          <div className="mx-4 mt-4 p-3 bg-amber-500/20 border border-amber-500/30 rounded-lg">
            <p className="text-sm text-amber-300">
              Saldo insuficiente. Necesitas al menos 60 monedas para invitar un segundo modelo.
            </p>
          </div>
        )}

        {/* Búsqueda y filtros */}
        <div className="p-4 border-b border-gray-800">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar modelo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#ff007a]/50"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyOnline}
              onChange={(e) => setOnlyOnline(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-[#ff007a] focus:ring-[#ff007a]"
            />
            Solo modelos online
          </label>
        </div>

        {/* Lista de modelos */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff007a]"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={loadModelos}
                className="px-4 py-2 bg-[#ff007a] text-white rounded-lg hover:bg-[#ff007a]/80"
              >
                Reintentar
              </button>
            </div>
          ) : filteredModelos.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400">No se encontraron modelos</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredModelos.map((modelo) => (
                <div
                  key={modelo.id}
                  className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg hover:bg-gray-900 transition-colors border border-gray-800"
                >
                  {/* Avatar */}
                  <div className="relative">
                    <img
                      src={modelo.avatar_url || modelo.avatar || '/default-avatar.png'}
                      alt={modelo.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                    {modelo.is_online && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-900"></div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">
                      {modelo.display_name || modelo.name}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      {modelo.is_online ? (
                        <>
                          <Wifi className="w-3 h-3 text-green-500" />
                          <span>En línea</span>
                        </>
                      ) : (
                        <>
                          <WifiOff className="w-3 h-3 text-gray-500" />
                          <span>Desconectado</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Botón Invitar */}
                  <button
                    onClick={() => handleInvite(modelo.id)}
                    disabled={inviting === modelo.id || !hasEnoughBalance || !modelo.is_online}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      inviting === modelo.id
                        ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                        : !hasEnoughBalance || !modelo.is_online
                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        : 'bg-[#ff007a] text-white hover:bg-[#ff007a]/80'
                    }`}
                  >
                    {inviting === modelo.id ? 'Enviando...' : 'Invitar'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800">
          <p className="text-xs text-gray-400 text-center">
            El segundo modelo recibirá una invitación para unirse a la llamada
          </p>
        </div>
      </div>
    </div>
  );
};

export default AddSecondModelModal;






