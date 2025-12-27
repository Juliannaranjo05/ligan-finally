import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, CheckCircle, AlertCircle, RefreshCw, Save } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function NotificationSettings() {
  const { t } = useTranslation();
  const [preferences, setPreferences] = useState({
    message_notifications: true,
    call_notifications: true,
    gift_notifications: true,
    favorite_online_notifications: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    };
  };

  const fetchPreferences = async () => {
    try {
      setLoading(true);
      setError(null);

      // Cargar desde localStorage (más simple y funcional)
      const savedPrefs = localStorage.getItem('notification_preferences');
      if (savedPrefs) {
        try {
          const parsed = JSON.parse(savedPrefs);
          setPreferences(prev => ({ ...prev, ...parsed }));
        } catch (e) {
          // Si hay error, usar valores por defecto
        }
      }
    } catch (error) {
      setError(null); // No mostrar error, usar valores por defecto
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPreferences();
  }, []);

  const handleToggle = (key) => {
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      // Guardar en localStorage (simple y funcional)
      localStorage.setItem('notification_preferences', JSON.stringify(preferences));
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      setError(t('settings.modals.notifications.errors.saveFailed', { defaultValue: 'Error al guardar preferencias' }));
    } finally {
      setSaving(false);
    }
  };

  const notificationOptions = [
    {
      key: 'message_notifications',
      labelKey: 'settings.modals.notifications.options.messages.label',
      descriptionKey: 'settings.modals.notifications.options.messages.description'
    },
    {
      key: 'call_notifications',
      labelKey: 'settings.modals.notifications.options.calls.label',
      descriptionKey: 'settings.modals.notifications.options.calls.description'
    },
    {
      key: 'gift_notifications',
      labelKey: 'settings.modals.notifications.options.gifts.label',
      descriptionKey: 'settings.modals.notifications.options.gifts.description'
    },
    {
      key: 'favorite_online_notifications',
      labelKey: 'settings.modals.notifications.options.favorites.label',
      descriptionKey: 'settings.modals.notifications.options.favorites.description'
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="animate-spin text-[#ff007a] mr-3" size={24} />
        <span className="text-white/70">{t('settings.modals.notifications.loading', { defaultValue: 'Cargando preferencias...' })}</span>
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

      {success && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 flex items-center gap-2">
          <CheckCircle className="text-green-400" size={20} />
          <span className="text-green-400 text-sm">{t('settings.modals.notifications.success', { defaultValue: 'Preferencias guardadas exitosamente' })}</span>
        </div>
      )}

      <div className="space-y-4">
        {notificationOptions.map((option) => (
          <div
            key={option.key}
            className="bg-[#1a1c20] rounded-lg border border-white/10 p-4 flex items-center justify-between"
          >
            <div className="flex-1">
              <h3 className="text-white font-medium mb-1">
                {(() => {
                  const translated = t(option.labelKey);
                  // Si la traducción devuelve la misma clave, usar el defaultValue
                  return translated === option.labelKey ? option.key : translated;
                })()}
              </h3>
              <p className="text-white/60 text-sm">
                {(() => {
                  const translated = t(option.descriptionKey);
                  // Si la traducción devuelve la misma clave, usar el defaultValue
                  return translated === option.descriptionKey ? '' : translated;
                })()}
              </p>
            </div>
            <button
              onClick={() => handleToggle(option.key)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                preferences[option.key] ? 'bg-[#ff007a]' : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  preferences[option.key] ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-[#ff007a] hover:bg-[#e6006e] text-white py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {saving ? (
          <>
            <RefreshCw className="animate-spin" size={20} />
            {t('settings.modals.notifications.saving', { defaultValue: 'Guardando...' })}
          </>
        ) : (
          <>
            <Save size={20} />
            {t('settings.modals.notifications.save', { defaultValue: 'Guardar Preferencias' })}
          </>
        )}
      </button>
    </div>
  );
}

