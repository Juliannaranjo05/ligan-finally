import React, { useState, useEffect } from "react";
import {
  Settings,
  Save,
  AlertCircle,
  RefreshCw,
  DollarSign,
  Gift,
  BookOpen,
  CreditCard,
  Trash2,
  Key,
  Loader2
} from "lucide-react";
import { settingsAdminApi, adminUtils } from "../../../services/adminApiService";

const SettingsModule = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [settings, setSettings] = useState({});
  const [settingsData, setSettingsData] = useState([]);

  // Cargar configuraciones al montar
  useEffect(() => {
    cargarConfiguraciones();
  }, []);

  const cargarConfiguraciones = async () => {
    setLoading(true);
    setError(null);
    setMessage({ type: "", text: "" });

    try {
      const response = await settingsAdminApi.getSettings();
      if (response.success) {
        // Convertir array a objeto para fácil acceso
        const settingsObj = {};
        response.settings.forEach(setting => {
          settingsObj[setting.key] = setting.value;
        });
        setSettings(settingsObj);
        setSettingsData(response.settings);
      }
    } catch (error) {
      setError(adminUtils.manejarError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage({ type: "", text: "" });
    setError(null);

    try {
      const response = await settingsAdminApi.updateSettings(settings);
      if (response.success) {
        setMessage({ type: "success", text: response.message || "Configuración guardada exitosamente" });
        // Recargar configuraciones para obtener valores actualizados
        await cargarConfiguraciones();
      } else {
        setMessage({ type: "error", text: response.error || "Error al guardar la configuración" });
      }
    } catch (error) {
      setMessage({ type: "error", text: adminUtils.manejarError(error) });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleCleanupStories = async () => {
    if (!window.confirm('¿Estás seguro de eliminar todas las historias expiradas?')) {
      return;
    }

    try {
      const response = await settingsAdminApi.cleanupExpiredStories();
      if (response.success) {
        alert('✅ ' + response.message);
      }
    } catch (error) {
      alert('❌ Error al limpiar historias');
    }
  };

  const handleClearCache = async () => {
    if (!window.confirm('¿Estás seguro de limpiar el caché de configuraciones?')) {
      return;
    }

    try {
      const response = await settingsAdminApi.clearCache();
      if (response.success) {
        alert('✅ ' + response.message);
        await cargarConfiguraciones();
      }
    } catch (error) {
      alert('❌ Error al limpiar caché');
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'earnings':
        return <DollarSign className="w-5 h-5" />;
      case 'gifts':
        return <Gift className="w-5 h-5" />;
      case 'stories':
        return <BookOpen className="w-5 h-5" />;
      case 'payments':
        return <CreditCard className="w-5 h-5" />;
      default:
        return <Settings className="w-5 h-5" />;
    }
  };

  const getCategoryLabel = (category) => {
    const labels = {
      'earnings': 'Ganancias',
      'gifts': 'Regalos',
      'stories': 'Historias',
      'payments': 'Pagos',
      'system': 'Sistema'
    };
    return labels[category] || category;
  };

  // Agrupar configuraciones por categoría
  const groupedSettings = settingsData.reduce((acc, setting) => {
    if (!acc[setting.category]) {
      acc[setting.category] = [];
    }
    acc[setting.category].push(setting);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
        <span className="ml-3 text-gray-400">Cargando configuraciones...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-purple-300 flex items-center gap-2">
            <Settings className="w-6 h-6" />
            Configuración
          </h2>
          <p className="text-gray-400 text-sm mt-1">Gestiona las configuraciones de la plataforma</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleClearCache}
            className="px-4 py-2 bg-gray-700/50 hover:bg-gray-700 text-gray-300 rounded-lg transition flex items-center gap-2"
            title="Limpiar caché"
          >
            <RefreshCw className="w-4 h-4" />
            Limpiar Caché
          </button>
          <button
            onClick={cargarConfiguraciones}
            className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg transition flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </button>
        </div>
      </div>

      {/* Mensajes */}
      {message.text && (
        <div className={`p-4 rounded-lg flex items-center gap-2 ${
          message.type === "success"
            ? "bg-green-500/20 text-green-300 border border-green-500/30"
            : "bg-red-500/20 text-red-300 border border-red-500/30"
        }`}>
          <AlertCircle className="w-5 h-5" />
          <span>{message.text}</span>
        </div>
      )}

      {error && (
        <div className="bg-red-500/20 border border-red-500/30 text-red-400 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Configuraciones agrupadas por categoría */}
      <div className="space-y-6">
        {Object.keys(groupedSettings).map(category => (
          <div key={category} className="bg-gray-800/60 backdrop-blur-sm rounded-xl shadow-lg border border-purple-500/20">
            <div className="p-6 border-b border-gray-700/50">
              <div className="flex items-center gap-3">
                {getCategoryIcon(category)}
                <h3 className="text-lg font-semibold text-purple-300">
                  {getCategoryLabel(category)}
                </h3>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {groupedSettings[category].map(setting => (
                <div key={setting.id} className="bg-gray-900/50 p-4 rounded-lg border border-gray-700/50">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <label className="block text-white font-medium mb-1">
                        {setting.key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </label>
                      {setting.description && (
                        <p className="text-gray-400 text-xs mb-2">{setting.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-2">
                    {setting.type === 'boolean' ? (
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings[setting.key] || false}
                          onChange={(e) => handleChange(setting.key, e.target.checked)}
                          className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-gray-300 text-sm">
                          {settings[setting.key] ? 'Activado' : 'Desactivado'}
                        </span>
                      </label>
                    ) : setting.type === 'integer' ? (
                      <input
                        type="number"
                        value={settings[setting.key] || 0}
                        onChange={(e) => handleChange(setting.key, parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-gray-700/50 text-white rounded-lg border border-gray-600/50 focus:border-purple-500/50 focus:outline-none"
                        min="0"
                      />
                    ) : setting.type === 'decimal' ? (
                      <input
                        type="number"
                        step="0.01"
                        value={settings[setting.key] || 0}
                        onChange={(e) => handleChange(setting.key, parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-gray-700/50 text-white rounded-lg border border-gray-600/50 focus:border-purple-500/50 focus:outline-none"
                        min="0"
                      />
                    ) : (
                      <input
                        type="text"
                        value={settings[setting.key] || ''}
                        onChange={(e) => handleChange(setting.key, e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700/50 text-white rounded-lg border border-gray-600/50 focus:border-purple-500/50 focus:outline-none"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Acciones adicionales */}
      <div className="bg-gray-800/60 backdrop-blur-sm rounded-xl shadow-lg border border-purple-500/20">
        <div className="p-6 border-b border-gray-700/50">
          <h3 className="text-lg font-semibold text-purple-300 flex items-center gap-2">
            <Trash2 className="w-5 h-5" />
            Acciones de Mantenimiento
          </h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">Limpiar Historias Expiradas</p>
              <p className="text-gray-400 text-sm">Elimina todas las historias que han expirado</p>
            </div>
            <button
              onClick={handleCleanupStories}
              className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Limpiar
            </button>
          </div>
        </div>
      </div>

      {/* Botón guardar */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Guardar Configuración
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default SettingsModule;





























