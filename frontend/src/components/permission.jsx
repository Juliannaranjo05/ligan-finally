import React from 'react';
import { X, Camera, Mic, AlertTriangle } from 'lucide-react';

const PermissionModal = ({ isOpen, onClose, onRetry, error }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1f2125] rounded-2xl p-6 max-w-md w-full shadow-2xl border border-red-500/30">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-red-400" size={24} />
            <h3 className="text-xl font-bold text-white">Permisos Necesarios</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Iconos de dispositivos */}
        <div className="flex justify-center gap-6 mb-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-2">
              <Camera className="text-red-400" size={32} />
            </div>
            <p className="text-sm text-gray-400">Cámara</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-2">
              <Mic className="text-red-400" size={32} />
            </div>
            <p className="text-sm text-gray-400">Micrófono</p>
          </div>
        </div>

        {/* Mensaje de error */}
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
          <p className="text-red-300 text-sm text-center">
            {error || 'Necesitas permitir el acceso a cámara y micrófono para continuar con la videollamada.'}
          </p>
        </div>

        {/* Instrucciones */}
        <div className="mb-6">
          <h4 className="text-white font-semibold mb-2">¿Cómo permitir el acceso?</h4>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>• Haz clic en "Intentar de nuevo"</li>
            <li>• Cuando aparezca el diálogo del navegador, selecciona "Permitir"</li>
            <li>• Si no aparece, revisa el ícono de la barra de direcciones</li>
          </ul>
        </div>

        {/* Botones */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-3 rounded-full font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onRetry}
            className="flex-1 bg-[#ff007a] hover:bg-[#e6006e] text-white px-4 py-3 rounded-full font-medium transition-colors"
          >
            Intentar de nuevo
          </button>
        </div>

        {/* Nota adicional */}
        <p className="text-xs text-gray-500 text-center mt-4">
          Los permisos son necesarios para que otros usuarios puedan verte y escucharte durante la videollamada.
        </p>
      </div>
    </div>
  );
};

export default PermissionModal;