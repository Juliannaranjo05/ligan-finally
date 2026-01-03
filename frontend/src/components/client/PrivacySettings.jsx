import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, RefreshCw, AlertCircle, Unlock, Users, Ban } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function PrivacySettings() {
  const { t } = useTranslation();
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [blockedByUsers, setBlockedByUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [unblocking, setUnblocking] = useState(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    };
  };

  const fetchBlockStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${API_BASE_URL}/api/blocks/block-status`,
        { headers: getAuthHeaders() }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${t('settings.privacy.errors.loadFailed') || 'Error al obtener estado de bloqueos'}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setBlockedUsers(data.my_blocked_users || []);
        setBlockedByUsers(data.blocked_by_users || []);
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
    fetchBlockStatus();
  }, []);

  const handleUnblock = async (blockedUserId) => {
    if (!confirm(t('settings.privacy.confirmUnblock') || '¿Estás seguro de que quieres desbloquear a este usuario?')) {
      return;
    }

    try {
      setUnblocking(blockedUserId);
      setError(null);

      const response = await fetch(
        `${API_BASE_URL}/api/blocks/unblock-user`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ blocked_user_id: blockedUserId })
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${t('settings.privacy.errors.unblockFailed') || 'Error al desbloquear usuario'}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setBlockedUsers(prev => prev.filter(user => user.id !== blockedUserId));
      } else {
        throw new Error(data.error || 'Error desconocido');
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setUnblocking(null);
    }
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
        <span className="text-white/70">{t('settings.privacy.loading', { defaultValue: 'Cargando información de privacidad...' })}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="text-red-400" size={20} />
          <span className="text-red-400 text-sm">{error}</span>
        </div>
      )}

      {/* Usuarios que he bloqueado */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Ban className="text-[#ff007a]" size={20} />
          <h3 className="text-lg font-semibold text-white">
            {t('settings.privacy.blockedUsers.title', { defaultValue: 'Usuarios Bloqueados' })} ({blockedUsers.length})
          </h3>
        </div>

        {blockedUsers.length === 0 ? (
          <div className="bg-[#1a1c20] rounded-lg border border-white/10 p-6 text-center">
            <Ban className="text-white/30 mx-auto mb-4" size={48} />
            <p className="text-white/70">{t('settings.privacy.blockedUsers.empty', { defaultValue: 'No has bloqueado a ningún usuario' })}</p>
            <p className="text-white/50 text-sm mt-2">
              {t('settings.privacy.blockedUsers.emptyDesc', { defaultValue: 'Los usuarios que bloquees no podrán enviarte mensajes ni contactarte' })}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {blockedUsers.map((user) => (
              <div
                key={user.id}
                className="bg-[#1a1c20] rounded-lg border border-white/10 p-4 hover:bg-[#1e2025] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-10 h-10 bg-gradient-to-br from-[#ff007a] to-[#cc0062] rounded-full flex items-center justify-center text-white font-bold">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <h4 className="text-white font-medium">{user.name}</h4>
                      <p className="text-white/60 text-sm">
                        {t('settings.privacy.blockedUsers.blockedOn', { defaultValue: 'Bloqueado el' })} {formatDate(user.created_at)}
                      </p>
                      {user.reason && (
                        <p className="text-white/50 text-xs mt-1">{t('settings.privacy.blockedUsers.reason', { defaultValue: 'Motivo' })}: {user.reason}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleUnblock(user.id)}
                    disabled={unblocking === user.id}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {unblocking === user.id ? (
                      <>
                        <RefreshCw className="animate-spin" size={16} />
                        {t('settings.privacy.blockedUsers.unblocking', { defaultValue: 'Desbloqueando...' })}
                      </>
                    ) : (
                      <>
                        <Unlock size={16} />
                        {t('settings.privacy.blockedUsers.unblock', { defaultValue: 'Desbloquear' })}
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Usuarios que me han bloqueado */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Users className="text-[#ff007a]" size={20} />
          <h3 className="text-lg font-semibold text-white">
            {t('settings.privacy.blockedByUsers.title', { defaultValue: 'Usuarios que te han Bloqueado' })} ({blockedByUsers.length})
          </h3>
        </div>

        {blockedByUsers.length === 0 ? (
          <div className="bg-[#1a1c20] rounded-lg border border-white/10 p-6 text-center">
            <Shield className="text-white/30 mx-auto mb-4" size={48} />
            <p className="text-white/70">{t('settings.privacy.blockedByUsers.empty', { defaultValue: 'Nadie te ha bloqueado' })}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {blockedByUsers.map((user) => (
              <div
                key={user.id}
                className="bg-[#1a1c20] rounded-lg border border-white/10 p-4"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-gray-600 to-gray-800 rounded-full flex items-center justify-center text-white font-bold">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-white font-medium">{user.name}</h4>
                    <p className="text-white/60 text-sm">
                      {t('settings.privacy.blockedByUsers.blockedOn', { defaultValue: 'Te bloqueó el' })} {formatDate(user.blocked_at)}
                    </p>
                    <p className="text-white/50 text-xs mt-1">
                      {t('settings.privacy.blockedByUsers.cannotContact', { defaultValue: 'No puedes contactar a este usuario' })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Información de privacidad */}
      <div className="bg-[#1a1c20] rounded-lg border border-white/10 p-4">
        <div className="flex items-start gap-3">
          <Shield className="text-[#ff007a] mt-1" size={20} />
          <div>
            <h4 className="text-white font-medium mb-2">{t('settings.privacy.info.title', { defaultValue: 'Información de Privacidad' })}</h4>
            <ul className="text-white/70 text-sm space-y-1">
              <li>• {t('settings.privacy.info.point1', { defaultValue: 'Los usuarios bloqueados no pueden enviarte mensajes ni llamarte' })}</li>
              <li>• {t('settings.privacy.info.point2', { defaultValue: 'Puedes desbloquear usuarios en cualquier momento' })}</li>
              <li>• {t('settings.privacy.info.point3', { defaultValue: 'Si alguien te bloquea, no podrás contactarlo' })}</li>
              <li>• {t('settings.privacy.info.point4', { defaultValue: 'Los bloqueos son privados y el otro usuario no será notificado' })}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}


































