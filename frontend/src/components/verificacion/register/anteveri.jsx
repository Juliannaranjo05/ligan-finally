import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from 'react-i18next';
import logoproncipal from "../../imagenes/logoprincipal.png";
import { ProtectedPage } from '../../hooks/usePageAccess';
import ModalDocumentacion from "./ModalDocumentacion"; // importa el nuevo modal

export default function InicioVerificacion() {
  const [mostrarModal, setMostrarModal] = useState(false);
  const [aceptaCompania, setAceptaCompania] = useState(false);
  const [errorCheckbox, setErrorCheckbox] = useState(false);
  const [mostrarModalDocs, setMostrarModalDocs] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Función para abrir documentación en nueva ventana
  const abrirDocumentacion = () => {
    // Cambia esta URL por la de tu documentación
    window.open('https://tu-documentacion.com/terminos', '_blank', 'noopener,noreferrer');
  };

  // Función para leer más detalles (puedes dirigir a otra página o modal)
  const leerMasDetalles = () => {
    // Implementa según tus necesidades
    window.open('https://tu-documentacion.com/detalles-completos', '_blank', 'noopener,noreferrer');
  };

  const aceptarTerminos = () => {
    if (!aceptaCompania) {
      setErrorCheckbox(true);
      return;
    }
    
    // Aquí puedes agregar lógica adicional para marcar al usuario como miembro de la compañía
    // Por ejemplo, una llamada a la API para actualizar el estado del usuario
    
    setMostrarModal(false);
    navigate("/verificacion");
  };

  const manejarCambioCheckbox = (e) => {
    setAceptaCompania(e.target.checked);
    if (e.target.checked) {
      setErrorCheckbox(false);
    }
  };

  return (
    <ProtectedPage requiredConditions={{
      emailVerified: true,
      profileComplete: true,
      role: "modelo",
      blockIfInCall: true
    }}>
      <div className="min-h-screen bg-ligand-mix-dark flex flex-col items-center justify-center px-4 py-10">
        {/* Logo y título */}
        <div className="flex items-center justify-center gap-1 mb-6 mt-[-25px]">
          <img src={logoproncipal} alt="Logo" className="w-16 h-16" />
          <span className="text-2xl font-pacifico text-zorrofucsia ml-[-10px]">Ligand</span>
        </div>

        <h1 className="text-white text-3xl font-bold mb-4 text-center">
          {t('stopverification.title')}
        </h1>
        
        <p className="text-white/70 mb-8 text-center max-w-md">
          {t('stopverification.description')}
        </p>

        {/* Botones principales */}
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <button
            onClick={() => setMostrarModalDocs(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition transform hover:scale-105 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            {t('stopverification.readDocsButton')}
          </button>

          <button
            onClick={() => setMostrarModal(true)}
            className="bg-[#ff007a] hover:bg-[#e6006e] text-white font-bold py-3 px-6 rounded-xl transition transform hover:scale-105 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {t('stopverification.startButton')}
          </button>
        </div>

        {/* Información adicional */}
        <div className="text-center text-white/50 text-sm max-w-lg">
          <p className="mb-2">💡 Recomendamos leer la documentación antes de continuar</p>
          <p>🔒 Tu información está segura y protegida</p>
        </div>

        <ModalDocumentacion 
          isOpen={mostrarModalDocs} 
          onClose={() => setMostrarModalDocs(false)} 
        />

        {/* Modal mejorado */}
        {mostrarModal && (
          <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
            <div
              className="bg-[#1a1c20] rounded-2xl p-8 max-w-lg w-full relative shadow-2xl border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header del modal */}
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-white text-2xl font-bold mb-1">
                    {t('stopverification.modal.title')}
                  </h2>
                  <p className="text-[#ff007a] font-semibold">
                    {t('stopverification.modal.subtitle')}
                  </p>
                </div>
                <button
                  onClick={() => setMostrarModal(false)}
                  className="text-white/50 hover:text-white p-1"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Contenido del modal */}
              <div className="text-white/80 text-sm mb-6 max-h-64 overflow-y-auto space-y-3 custom-scrollbar">
                <p>{t('stopverification.modal.paragraph1')}</p>
                <p>{t('stopverification.modal.paragraph2')}</p>
                <div className="bg-[#ff007a]/10 border border-[#ff007a]/30 rounded-lg p-4">
                  <p className="text-[#ff007a] font-semibold">
                    {t('stopverification.modal.paragraph3')}
                  </p>
                </div>
              </div>

              {/* Checkbox de aceptación */}
              <div className="mb-6">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={aceptaCompania}
                      onChange={manejarCambioCheckbox}
                      className="sr-only"
                    />
                    <div className={`w-5 h-5 border-2 rounded transition-all ${
                      aceptaCompania 
                        ? 'bg-[#ff007a] border-[#ff007a]' 
                        : `border-white/30 ${errorCheckbox ? 'border-red-500' : ''}`
                    }`}>
                      {aceptaCompania && (
                        <svg className="w-3 h-3 text-white absolute top-0.5 left-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <span className={`text-sm transition-colors ${
                    errorCheckbox ? 'text-red-400' : 'text-white/80 group-hover:text-white'
                  }`}>
                    {t('stopverification.modal.checkboxLabel')}
                  </span>
                </label>
                
                {errorCheckbox && (
                  <p className="text-red-400 text-xs mt-2 ml-8 animate-pulse">
                    {t('stopverification.modal.checkboxRequired')}
                  </p>
                )}
              </div>

              {/* Botón para leer más */}
              <div className="mb-6">
                <button
                  onClick={leerMasDetalles}
                  className="text-[#ff007a] hover:text-[#ff007a]/80 text-sm underline flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  {t('stopverification.modal.readMoreButton')}
                </button>
              </div>

              {/* Botones de acción */}
              <div className="flex justify-end gap-4">
                <button
                  onClick={() => {
                    setMostrarModal(false);
                    setAceptaCompania(false);
                    setErrorCheckbox(false);
                  }}
                  className="text-white bg-gray-600 hover:bg-gray-700 px-6 py-2 rounded-lg transition"
                >
                  {t('stopverification.modal.cancelButton')}
                </button>
                <button
                  onClick={aceptarTerminos}
                  disabled={!aceptaCompania}
                  className={`px-6 py-2 rounded-lg font-semibold transition transform ${
                    aceptaCompania
                      ? 'bg-[#ff007a] hover:bg-[#e6006e] text-white hover:scale-105'
                      : 'bg-gray-500 text-gray-300 cursor-not-allowed'
                  }`}
                >
                  {t('stopverification.modal.acceptButton')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedPage>
  );
}