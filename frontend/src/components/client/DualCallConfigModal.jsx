import React, { useState, useEffect } from 'react';
import { X, Users, AlertCircle } from 'lucide-react';

const DualCallConfigModal = ({
  isOpen,
  onClose,
  availableModelos = [],
  onConfirm,
  userBalance = 0
}) => {
  const [selectedModelo1, setSelectedModelo1] = useState(null);
  const [selectedModelo2, setSelectedModelo2] = useState(null);
  const [error, setError] = useState('');

  // Limpiar selección cuando se cierra el modal
  useEffect(() => {
    if (!isOpen) {
      setSelectedModelo1(null);
      setSelectedModelo2(null);
      setError('');
    }
  }, [isOpen]);

  const handleModelo1Change = (e) => {
    const modeloId = e.target.value ? parseInt(e.target.value) : null;
    setSelectedModelo1(modeloId);
    
    // Validar que no sea el mismo que modelo 2
    if (modeloId && modeloId === selectedModelo2) {
      setError('Los modelos deben ser diferentes');
      setSelectedModelo1(null);
    } else {
      setError('');
    }
  };

  const handleModelo2Change = (e) => {
    const modeloId = e.target.value ? parseInt(e.target.value) : null;
    setSelectedModelo2(modeloId);
    
    // Validar que no sea el mismo que modelo 1
    if (modeloId && modeloId === selectedModelo1) {
      setError('Los modelos deben ser diferentes');
      setSelectedModelo2(null);
    } else {
      setError('');
    }
  };

  const handleConfirm = () => {
    if (!selectedModelo1 || !selectedModelo2) {
      setError('Debes seleccionar ambos modelos');
      return;
    }

    if (selectedModelo1 === selectedModelo2) {
      setError('Los modelos deben ser diferentes');
      return;
    }

    // Validar saldo (60 monedas mínimo para 2vs1)
    if (userBalance < 60) {
      setError('Necesitas al menos 60 monedas para una llamada 2vs1');
      return;
    }

    onConfirm([selectedModelo1, selectedModelo2]);
    onClose();
  };

  // Debug: verificar datos recibidos
  useEffect(() => {
    if (isOpen) {
      // Verificar que hay modelos disponibles
      if (availableModelos.length === 0) {
        // No hay modelos disponibles
      }
    }
  }, [isOpen, availableModelos]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] rounded-3xl p-6 sm:p-8 max-w-md w-full mx-4 border border-[#ff007a]/30 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-[#ff007a]/20 to-[#ff007a]/10 border-2 border-[#ff007a]/30">
              <Users className="w-6 h-6 text-[#ff007a]" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              Configurar Llamada 2vs1
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* Contenido */}
        <div className="space-y-4">
          <p className="text-gray-400 text-sm">
            Selecciona 2 modelos para la llamada. Esta llamada tendrá costo doble (20 monedas/minuto).
          </p>

          {/* Selector Modelo 1 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Modelo 1:
            </label>
            <select
              value={selectedModelo1 || ''}
              onChange={handleModelo1Change}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-[#ff007a] transition-colors"
            >
              <option value="">Seleccionar modelo...</option>
              {availableModelos && availableModelos.length > 0 ? (
                availableModelos.map((modelo) => (
                  <option key={modelo.id} value={modelo.id} disabled={modelo.id === selectedModelo2}>
                    {modelo.name || `Modelo ${modelo.id}`} {modelo.id === selectedModelo2 ? '(ya seleccionado)' : ''}
                  </option>
                ))
              ) : (
                <option value="" disabled>No hay modelos disponibles</option>
              )}
            </select>
          </div>

          {/* Selector Modelo 2 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Modelo 2:
            </label>
            <select
              value={selectedModelo2 || ''}
              onChange={handleModelo2Change}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-[#ff007a] transition-colors"
            >
              <option value="">Seleccionar modelo...</option>
              {availableModelos && availableModelos.length > 0 ? (
                availableModelos.map((modelo) => (
                  <option key={modelo.id} value={modelo.id} disabled={modelo.id === selectedModelo1}>
                    {modelo.name || `Modelo ${modelo.id}`} {modelo.id === selectedModelo1 ? '(ya seleccionado)' : ''}
                  </option>
                ))
              ) : (
                <option value="" disabled>No hay modelos disponibles</option>
              )}
            </select>
          </div>

          {/* Información de costo */}
          {selectedModelo1 && selectedModelo2 && (
            <div className="p-3 bg-amber-500/20 border border-amber-500/30 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-amber-300">
                  <p className="font-semibold mb-1">Costo doble activado</p>
                  <p className="text-amber-200/80">
                    Esta llamada consumirá 20 monedas por minuto (10 por cada modelo).
                  </p>
                  <p className="text-amber-200/80 mt-1">
                    Saldo actual: <span className="font-semibold">{userBalance} monedas</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedModelo1 || !selectedModelo2 || error !== ''}
              className="flex-1 bg-gradient-to-r from-[#ff007a] to-[#cc0062] hover:from-[#ff3399] hover:to-[#e6006e] text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DualCallConfigModal;

