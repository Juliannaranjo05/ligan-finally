import React, { useState, useEffect } from 'react';
import { Star, RefreshCw, AlertCircle, Trash2, MessageSquare, Phone, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function FavoriteModelsSettings() {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [removing, setRemoving] = useState(null);
  const navigate = useNavigate();

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    };
  };

  const fetchFavorites = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${API_BASE_URL}/api/favorites/list`,
        { headers: getAuthHeaders() }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Error al obtener favoritos`);
      }

      const data = await response.json();
      
      if (data.success) {
        setFavorites(data.favorites || []);
      } else {
        throw new Error(data.error || 'Error desconocido');
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFavorites();
  }, []);

  const handleRemoveFavorite = async (favoriteUserId) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este favorito?')) {
      return;
    }

    try {
      setRemoving(favoriteUserId);
      setError(null);

      const response = await fetch(
        `${API_BASE_URL}/api/favorites/remove`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ favorite_user_id: favoriteUserId })
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Error al eliminar favorito`);
      }

      const data = await response.json();
      
      if (data.success) {
        setFavorites(prev => prev.filter(fav => fav.id !== favoriteUserId));
      } else {
        throw new Error(data.error || 'Error desconocido');
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setRemoving(null);
    }
  };

  const handleStartChat = (favoriteUserId) => {
    navigate('/mensajes', { state: { openChatWith: favoriteUserId } });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="animate-spin text-[#ff007a] mr-3" size={24} />
        <span className="text-white/70">Cargando favoritos...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
        <AlertCircle className="text-red-400 mx-auto mb-4" size={48} />
        <h3 className="text-lg font-bold text-red-400 mb-2">Error al cargar favoritos</h3>
        <p className="text-white/70 mb-4">{error}</p>
        <button
          onClick={fetchFavorites}
          className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-4 py-2 rounded-lg transition-colors"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="text-red-400" size={20} />
          <span className="text-red-400 text-sm">{error}</span>
        </div>
      )}

      {favorites.length === 0 ? (
        <div className="text-center py-12 bg-[#1a1c20] rounded-lg border border-white/10">
          <Star className="text-white/30 mx-auto mb-4" size={48} />
          <h3 className="text-lg font-bold text-white/70 mb-2">No tienes favoritos aún</h3>
          <p className="text-white/50">
            Cuando agregues usuarios como favoritos, aparecerán aquí
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {favorites.map((favorite) => (
            <div
              key={favorite.id}
              className="bg-[#1a1c20] rounded-lg border border-white/10 p-4 hover:bg-[#1e2025] transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  {/* Avatar */}
                  <div className="relative">
                    {favorite.avatar_url ? (
                      <img
                        src={favorite.avatar_url}
                        alt={favorite.name}
                        className="w-12 h-12 rounded-full object-cover border-2 border-[#ff007a]"
                        onError={(e) => {
                          // Ocultar la imagen y mostrar el fallback
                          e.target.style.display = 'none';
                          const fallback = e.target.nextElementSibling;
                          if (fallback) {
                            fallback.style.display = 'flex';
                          }
                        }}
                      />
                    ) : null}
                    <div 
                      className={`w-12 h-12 bg-gradient-to-br from-[#ff007a] to-[#cc0062] rounded-full flex items-center justify-center text-white font-bold border-2 border-[#ff007a] ${favorite.avatar_url ? 'hidden' : ''}`}
                    >
                      {favorite.name ? favorite.name.charAt(0).toUpperCase() : '?'}
                    </div>
                  </div>

                  {/* Información */}
                  <div className="flex-1">
                    <h3 className="text-white font-medium">{favorite.name}</h3>
                    <p className="text-white/60 text-sm">
                      Agregado el {formatDate(favorite.created_at)}
                    </p>
                    {favorite.note && (
                      <p className="text-white/50 text-xs mt-1">{favorite.note}</p>
                    )}
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleStartChat(favorite.id)}
                    className="p-2 bg-[#ff007a]/20 hover:bg-[#ff007a]/30 text-[#ff007a] rounded-lg transition-colors"
                    title="Iniciar chat"
                  >
                    <MessageSquare size={18} />
                  </button>
                  <button
                    onClick={() => handleRemoveFavorite(favorite.id)}
                    disabled={removing === favorite.id}
                    className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors disabled:opacity-50"
                    title="Eliminar de favoritos"
                  >
                    {removing === favorite.id ? (
                      <RefreshCw className="animate-spin" size={18} />
                    ) : (
                      <Trash2 size={18} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="text-xs text-white/50 text-center pt-2">
        {favorites.length} {favorites.length === 1 ? 'favorito' : 'favoritos'}
      </div>
    </div>
  );
}








































