import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CreditCard,
  Trash2,
  Plus,
  Star,
  Loader2,
  AlertCircle,
  X
} from 'lucide-react';
import { paymentApiService } from '../../services/paymentApiService';

export default function PaymentMethodsSettings({ onClose }) {
  const { t } = useTranslation();
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [historyMethods, setHistoryMethods] = useState([]);

  // Formulario para agregar método (solo tarjetas)
  const [formData, setFormData] = useState({
    payment_type: 'card',
    last_four_digits: '',
    is_default: false
  });

  useEffect(() => {
    loadMethods();
    loadHistoryMethods();
  }, []);

  const loadMethods = async () => {
    try {
      setLoading(true);
      const response = await paymentApiService.getSavedPaymentMethods();
      if (response.success) {
        setMethods(response.methods || []);
      }
    } catch (err) {
      setError(t('settings.paymentMethods.errors.loadFailed') || 'Error al cargar métodos de pago');
    } finally {
      setLoading(false);
    }
  };

  const loadHistoryMethods = async () => {
    try {
      const response = await paymentApiService.getPaymentMethodsFromHistory();
      if (response.success) {
        setHistoryMethods(response.methods || []);
      }
    } catch (err) {
    }
  };

  const handleAddMethod = async () => {
    if (!formData.last_four_digits || formData.last_four_digits.length !== 4) {
      setError(t('settings.paymentMethods.errors.invalidDigits') || 'Ingresa los últimos 4 dígitos de tu tarjeta');
      return;
    }

    try {
      setProcessing(true);
      setError(null);

      // Solo enviamos datos de tarjeta
      const dataToSend = {
        payment_type: 'card',
        last_four_digits: formData.last_four_digits,
        is_default: formData.is_default
      };

      const response = await paymentApiService.addPaymentMethod(dataToSend);
      
      if (response.success) {
        await loadMethods();
        setShowAddModal(false);
        setFormData({
          payment_type: 'card',
          last_four_digits: '',
          is_default: false
        });
      }
    } catch (err) {
      setError(err.response?.data?.error || t('settings.paymentMethods.errors.addFailed') || 'Error al agregar método');
    } finally {
      setProcessing(false);
    }
  };

  const handleSetDefault = async (id) => {
    try {
      setProcessing(true);
      const response = await paymentApiService.updateSavedPaymentMethod(id, { is_default: true });
      if (response.success) {
        await loadMethods();
      }
    } catch (err) {
      setError(err.response?.data?.error || t('settings.paymentMethods.errors.updateFailed') || 'Error al actualizar método');
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      setProcessing(true);
      const response = await paymentApiService.deletePaymentMethod(id);
      if (response.success) {
        await loadMethods();
        setShowDeleteConfirm(null);
      }
    } catch (err) {
      setError(err.response?.data?.error || t('settings.paymentMethods.errors.deleteFailed') || 'Error al eliminar método');
    } finally {
      setProcessing(false);
    }
  };

  const getPaymentIcon = (type) => {
    // Solo mostramos tarjetas, pero mantenemos compatibilidad con métodos antiguos
    if (type === 'card') {
      return <CreditCard size={20} className="text-blue-400" />;
    }
    // Para métodos antiguos (PSE, Nequi, etc.) que ya no se pueden crear
    return <CreditCard size={20} className="text-gray-400" />;
  };

  const getPaymentTypeLabel = (type) => {
    // Solo tarjetas son válidas ahora, pero mantenemos compatibilidad con métodos antiguos
    if (type === 'card') {
      return t('settings.paymentMethods.card') || 'Tarjeta';
    }
    // Para métodos antiguos que ya no se pueden crear
    return type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-[#ff007a]" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-[#ff007a]">
          {t('settings.paymentMethods.title') || 'Métodos de Pago'}
        </h3>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#ff007a] hover:bg-[#e6006e] text-white rounded-lg transition-colors text-sm"
        >
          <Plus size={16} />
          {t('settings.paymentMethods.addMethod') || 'Agregar Método'}
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Información sobre métodos guardados */}
      <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <p className="text-sm text-blue-400">
          {t('settings.paymentMethods.info') || 'Estos métodos son solo para referencia. Los pagos se procesan directamente a través de Wompi.'}
        </p>
      </div>

      {/* Lista de métodos guardados */}
      {methods.length === 0 ? (
        <div className="text-center py-12 text-white/60">
          <CreditCard size={48} className="mx-auto mb-4 text-white/30" />
          <p>{t('settings.paymentMethods.noMethods') || 'No tienes tarjetas guardadas'}</p>
          <p className="text-sm mt-2">
            {t('settings.paymentMethods.addFirst') || 'Agrega una tarjeta como referencia'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {methods.map((method) => (
            <div
              key={method.id}
              className="flex items-center justify-between p-4 bg-[#131418] rounded-lg border border-white/10 hover:border-[#ff007a]/30 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1">
                {getPaymentIcon(method.payment_type)}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{method.display_name}</span>
                    {method.is_default && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-[#ff007a]/20 text-[#ff007a] rounded text-xs">
                        <Star size={12} fill="currentColor" />
                        {t('settings.paymentMethods.default') || 'Predeterminado'}
                      </span>
                    )}
                  </div>
                  {method.last_used_at && (
                    <p className="text-xs text-white/50 mt-1">
                      {t('settings.paymentMethods.lastUsed') || 'Último uso'}: {method.formatted_last_used}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!method.is_default && (
                  <button
                    onClick={() => handleSetDefault(method.id)}
                    disabled={processing}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    title={t('settings.paymentMethods.setDefault') || 'Marcar como predeterminado'}
                  >
                    <Star size={18} className="text-white/50 hover:text-yellow-400" />
                  </button>
                )}
                <button
                  onClick={() => setShowDeleteConfirm(method.id)}
                  disabled={processing}
                  className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                  title={t('settings.paymentMethods.deleteMethod') || 'Eliminar'}
                >
                  <Trash2 size={18} className="text-red-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sugerencias del historial (solo tarjetas) */}
      {historyMethods.filter(m => m.payment_type === 'card').length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-semibold text-white/70 mb-3">
            {t('settings.paymentMethods.suggestions') || 'Tarjetas usadas anteriormente'}
          </h4>
          <div className="space-y-2">
            {historyMethods.filter(m => m.payment_type === 'card').slice(0, 3).map((method, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-[#0a0d10] rounded-lg border border-white/5"
              >
                <div className="flex items-center gap-2">
                  {getPaymentIcon(method.payment_type)}
                  <span className="text-white/70 text-sm">{getPaymentTypeLabel(method.payment_type)}</span>
                  {method.last_four_digits && (
                    <span className="text-white/50 text-xs">•••• {method.last_four_digits}</span>
                  )}
                </div>
                <button
                  onClick={() => {
                    setFormData({
                      payment_type: 'card',
                      last_four_digits: method.last_four_digits || '',
                      is_default: false
                    });
                    setShowAddModal(true);
                  }}
                  className="text-xs text-[#ff007a] hover:text-[#e6006e]"
                >
                  {t('settings.paymentMethods.add') || 'Agregar'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal para agregar método */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div
            className="bg-[#1f2125] rounded-xl p-6 w-full max-w-md border border-[#ff007a] relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                setShowAddModal(false);
                setError(null);
                setFormData({
                  payment_type: 'card',
                  last_four_digits: '',
                  is_default: false
                });
              }}
              className="absolute top-3 right-3 text-white/50 hover:text-white"
            >
              <X size={20} />
            </button>

            <h3 className="text-lg font-bold text-[#ff007a] mb-4">
              {t('settings.paymentMethods.addCard') || 'Agregar Tarjeta'}
            </h3>

            <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-xs text-blue-400">
                {t('settings.paymentMethods.cardInfo') || 'Esta información es solo para referencia. Los pagos se procesan directamente a través de Wompi.'}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-white/70 mb-2">
                  {t('settings.paymentMethods.lastFourDigits') || 'Últimos 4 dígitos'} <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  maxLength={4}
                  value={formData.last_four_digits}
                  onChange={(e) => setFormData({ ...formData, last_four_digits: e.target.value.replace(/\D/g, '') })}
                  placeholder="1234"
                  className="w-full bg-[#131418] border border-white/10 rounded-lg px-3 py-2 text-white"
                  required
                />
                <p className="text-xs text-white/50 mt-1">
                  {t('settings.paymentMethods.lastFourDigitsHint') || 'Ingresa los últimos 4 dígitos de tu tarjeta como referencia'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_default"
                  checked={formData.is_default}
                  onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                  className="w-4 h-4 text-[#ff007a] bg-[#131418] border-white/10 rounded"
                />
                <label htmlFor="is_default" className="text-sm text-white/70">
                  {t('settings.paymentMethods.setAsDefault') || 'Marcar como predeterminado'}
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleAddMethod}
                  disabled={processing}
                  className="flex-1 bg-[#ff007a] hover:bg-[#e6006e] text-white py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
                >
                  {processing ? (
                    <Loader2 className="animate-spin mx-auto" size={16} />
                  ) : (
                    t('settings.paymentMethods.save') || 'Guardar'
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setError(null);
                    setFormData({
                      payment_type: 'card',
                      last_four_digits: '',
                      is_default: false
                    });
                  }}
                  className="px-4 py-2 bg-[#131418] hover:bg-[#1c1f25] text-white rounded-lg transition-colors"
                >
                  {t('settings.paymentMethods.cancel') || 'Cancelar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación para eliminar */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div
            className="bg-[#1f2125] rounded-xl p-6 w-full max-w-md border border-red-500/50 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-red-400 mb-4">
              {t('settings.paymentMethods.confirmDelete') || 'Confirmar eliminación'}
            </h3>
            <p className="text-white/70 mb-6">
              {t('settings.paymentMethods.deleteMessage') || '¿Estás seguro de que quieres eliminar este método de pago?'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                disabled={processing}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
              >
                {processing ? (
                  <Loader2 className="animate-spin mx-auto" size={16} />
                ) : (
                  t('settings.paymentMethods.delete') || 'Eliminar'
                )}
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(null);
                  setError(null);
                }}
                disabled={processing}
                className="px-4 py-2 bg-[#131418] hover:bg-[#1c1f25] text-white rounded-lg transition-colors"
              >
                {t('settings.paymentMethods.cancel') || 'Cancelar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

