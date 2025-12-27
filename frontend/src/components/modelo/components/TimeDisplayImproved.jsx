import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Clock, Info, X, Mic, MicOff, PhoneOff, Settings, Volume2, VolumeX, SkipForward, Gift, Timer } from 'lucide-react';

const TimeDisplayImproved = ({ 
 tiempo = 0,  // 🔥 TIEMPO DE SESIÓN EN SEGUNDOS (igual que en cliente)
 connected, 
 otherUser, 
 roomName, 
 t,
 userBalance,
 remainingMinutes,
 giftBalance = 0,  // 🔥 SALDO DE REGALOS
 // 🔥 NUEVAS PROPS PARA CONTROLES
 micEnabled = true,
 setMicEnabled = () => {},
 cameraEnabled = false,
 setCameraEnabled = () => {},
 volumeEnabled = true,
 setVolumeEnabled = () => {},
 siguientePersona = () => {},
 finalizarChat = () => {},
 showMainSettings = false,
 setShowMainSettings = () => {},
 loading = false,
 userData = {}
}) => {
  // 🔥 FUNCIÓN PARA FORMATEAR TIEMPO - MEMOIZADA PARA EVITAR RECÁLCULOS
  const formatoTiempo = useMemo(() => {
    const minutos = Math.floor(tiempo / 60).toString().padStart(2, "0");
    const segundos = (tiempo % 60).toString().padStart(2, "0");
    const formatted = `${minutos}:${segundos}`;
    return formatted;
  }, [tiempo]);

  // 🔥 ESTADOS PARA MODAL DE INFORMACIÓN
 const [showInfoModal, setShowInfoModal] = useState(false);
 const [showInitialWarning, setShowInitialWarning] = useState(false);

 // 🔥 MOSTRAR ADVERTENCIA INICIAL AL CONECTAR
 useEffect(() => {
    if (connected && otherUser && !localStorage.getItem('modeloBetaWarningShown')) {
     setShowInitialWarning(true);
      localStorage.setItem('modeloBetaWarningShown', 'true');
   }
 }, [connected, otherUser]);

  // 🔥 FUNCIÓN PARA TRUNCAR NOMBRES
 function truncateName(name, maxLength = 8) {
  if (!name) return '';
  return name.length > maxLength ? name.substring(0, maxLength) + '…' : name;
}

  return (
    <>
      {/* 🔥 CONTENEDOR PRINCIPAL CON ANTI-OVERFLOW */}
      <div className="time-display-container">
        
        {/* 🔥 VERSIÓN MÓVIL - FULL RESPONSIVE */}
        <div className="mobile-version">
          <div className="mobile-content">
            {/* 🔥 TIEMPO DE LLAMADA */}
            <div className="balance-section tiempo-section">
              <div className="balance-icon-wrapper tiempo-icon">
                <Clock className="balance-icon" />
              </div>
              <div className="balance-info">
                <div className="balance-label">Tiempo:</div>
                <div className="balance-value tiempo-value">{formatoTiempo}</div>
              </div>
            </div>
            
            {/* 🔥 MINUTOS RESTANTES */}
            <div className="balance-section minutes-section">
              <div className="balance-icon-wrapper minutes-icon">
                <Timer className="balance-icon" />
                </div>
              <div className="balance-info">
                <div className="balance-label">Minutos:</div>
                <div className="balance-value minutes-value">{remainingMinutes !== undefined && remainingMinutes !== null ? remainingMinutes : 0}</div>
                </div>
              </div>
              
            {/* 🔥 SALDO DE REGALOS */}
            <div className="balance-section gifts-section">
              <div className="balance-icon-wrapper gifts-icon">
                <Gift className="balance-icon" />
                </div>
              <div className="balance-info">
                <div className="balance-label">Regalos:</div>
                <div className="balance-value gifts-value">{giftBalance !== undefined && giftBalance !== null ? giftBalance : 0}</div>
              </div>
            </div>
            
            {/* Solo botón de información en móvil */}
            <div className="connection-section">
              <button
                onClick={() => setShowInfoModal(true)}
                className="info-button-mobile"
                title="Información del sistema"
              >
                <Info size={12} />
              </button>
            </div>
          </div>
          
          {/* 🔥 CONTROLES ARRIBA EN MÓVIL - Entre stats y video (ESTILO CLIENTE) */}
          <div className="mobile-controls-section">
            <div className="mobile-controls-row">
              {/* 🎤 MICRÓFONO */}
              <button
                onClick={() => setMicEnabled(!micEnabled)}
                disabled={loading}
                className={`mobile-control-button ${micEnabled ? 'mobile-control-active' : 'mobile-control-inactive'} ${loading ? 'mobile-control-disabled' : ''}`}
                title={micEnabled ? 'Silenciar micrófono' : 'Activar micrófono'}
              >
                {micEnabled ? <Mic size={16} /> : <MicOff size={16} />}
                <div className={`mobile-control-indicator ${micEnabled ? 'indicator-active' : 'indicator-inactive'}`}></div>
              </button>

              {/* 🔊 VOLUMEN */}
              <button
                onClick={() => setVolumeEnabled(!volumeEnabled)}
                disabled={loading}
                className={`mobile-control-button ${volumeEnabled ? 'mobile-control-volume-active' : 'mobile-control-inactive'} ${loading ? 'mobile-control-disabled' : ''}`}
                title={volumeEnabled ? 'Silenciar audio' : 'Activar audio'}
              >
                {volumeEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>

              {/* ⚙️ CONFIGURACIÓN */}
              <button
                onClick={() => {
                  if (typeof setShowMainSettings === 'function') {
                    setShowMainSettings(true);
                  }
                  window.dispatchEvent(new CustomEvent('openCameraAudioSettings'));
                }}
                disabled={loading}
                className={`mobile-control-button mobile-control-settings ${showMainSettings ? 'mobile-control-settings-active' : ''} ${loading ? 'mobile-control-disabled' : ''}`}
                title="Configuración"
              >
                <Settings size={16} />
              </button>

              {/* ⏭️ SIGUIENTE PERSONA */}
              <button
                onClick={siguientePersona}
                disabled={loading}
                className={`mobile-control-button mobile-control-skip ${loading ? 'mobile-control-disabled' : ''}`}
                title="Buscar siguiente persona"
              >
                <SkipForward size={16} />
              </button>

              {/* ☎️ COLGAR */}
              <button
                onClick={finalizarChat}
                disabled={loading}
                className={`mobile-control-button mobile-control-hangup ${loading ? 'mobile-control-disabled' : ''}`}
                title="Finalizar chat"
              >
                <PhoneOff size={18} />
              </button>
                  </div>
              </div>
        </div>

        {/* 🔥 VERSIÓN DESKTOP */}
        <div className="desktop-version">
          
          {/* Panel izquierdo - Balances */}
          <div className="left-panel">
            
            {/* 🔥 TIEMPO DE LLAMADA */}
            <div className="balance-item tiempo-item">
              <div className="balance-icon-wrapper tiempo-icon">
                <Clock className="balance-icon" />
              </div>
              <div className="balance-info">
                <div className="balance-label">Tiempo:</div>
                <div className="balance-value tiempo-value">{formatoTiempo}</div>
              </div>
            </div>
            
            {/* 🔥 MINUTOS RESTANTES */}
            <div className="balance-item minutes-item">
              <div className="balance-icon-wrapper minutes-icon">
                <Timer className="balance-icon" />
              </div>
              <div className="balance-info">
                <div className="balance-label">Minutos:</div>
                <div className="balance-value minutes-value">{remainingMinutes !== undefined && remainingMinutes !== null ? remainingMinutes : 0}</div>
              </div>
            </div>
            
            {/* 🔥 SALDO DE REGALOS */}
            <div className="balance-item gifts-item">
              <div className="balance-icon-wrapper gifts-icon">
                <Gift className="balance-icon" />
              </div>
              <div className="balance-info">
                <div className="balance-label">Regalos:</div>
                <div className="balance-value gifts-value">{giftBalance !== undefined && giftBalance !== null ? giftBalance : 0}</div>
              </div>
            </div>
          </div>
          
          {/* Panel central - CONTROLES CENTRADOS */}
          <div className="center-panel">
            {/* 🔥 CONTROLES DE VIDEOLLAMADA INTEGRADOS Y CENTRADOS */}
            <div className="controls-section-desktop">
              {/* 🎤 MICRÓFONO */}
              <button
                onClick={() => setMicEnabled(!micEnabled)}
                disabled={loading}
                className={`control-button ${micEnabled ? 'control-button-active' : 'control-button-inactive'} ${loading ? 'control-button-disabled' : ''}`}
                title={micEnabled ? 'Silenciar micrófono' : 'Activar micrófono'}
              >
                {micEnabled ? <Mic size={18} /> : <MicOff size={18} />}
                <div className={`control-button-indicator ${micEnabled ? 'indicator-active' : 'indicator-inactive'}`}></div>
              </button>

              {/* 🔊 VOLUMEN */}
              <button
                onClick={() => setVolumeEnabled(!volumeEnabled)}
                disabled={loading}
                className={`control-button ${volumeEnabled ? 'control-button-volume-active' : 'control-button-inactive'} ${loading ? 'control-button-disabled' : ''}`}
                title={volumeEnabled ? 'Silenciar audio' : 'Activar audio'}
              >
                {volumeEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
              </button>

              {/* 🔥 SEPARADOR */}
              <div className="controls-separator-small"></div>

              {/* ⏭️ SIGUIENTE PERSONA */}
              <button
                onClick={siguientePersona}
                disabled={loading}
                className={`control-button control-button-skip ${loading ? 'control-button-disabled' : ''}`}
                title="Buscar siguiente persona"
              >
                <SkipForward size={18} />
              </button>

              {/* ☎️ COLGAR */}
              <button
                onClick={finalizarChat}
                disabled={loading}
                className={`control-button control-button-hangup ${loading ? 'control-button-disabled' : ''}`}
                title="Finalizar chat"
              >
                <PhoneOff size={26} />
              </button>

              {/* 🔥 SEPARADOR */}
              <div className="controls-separator-small"></div>

              {/* ⚙️ CONFIGURACIÓN */}
              <button
                onClick={() => {
                  if (typeof setShowMainSettings === 'function') {
                    setShowMainSettings(true);
                  }
                  window.dispatchEvent(new CustomEvent('openCameraAudioSettings'));
                }}
                disabled={loading}
                className={`control-button ${showMainSettings ? 'control-button-settings-active' : 'control-button-settings'} ${loading ? 'control-button-disabled' : ''}`}
                title="Configuración"
              >
                <Settings size={18} className={showMainSettings ? 'settings-icon-active' : ''} />
              </button>
            </div>
          </div>
          
          {/* Panel derecho - Solo INFO */}
          <div className="right-panel">
            {/* 🔥 BOTÓN DE INFORMACIÓN INTEGRADO EN DESKTOP */}
            <div className="info-section-desktop">
              <div className="info-item">
                <div className="info-icon-wrapper">
                  <button
                    onClick={() => setShowInfoModal(true)}
                    className="info-button-desktop"
                    title="Información del sistema"
                  >
                    <Info size={12} className="info-icon" />
                  </button>
                </div>
                <div className="info-details">
                  <div className="info-title">Info</div>
                  <div className="info-subtitle">Sistema</div>
                  </div>
              </div>
                  </div>
                </div>
              </div>
            </div>
            
      {/* 🔥 MODAL DE INFORMACIÓN - VERSIÓN MODELO */}
      {showInfoModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            {/* Header */}
            <div className="modal-header">
              <div className="modal-header-content">
                <div className="modal-icon-wrapper">
                  <Info size={16} className="modal-icon" />
                  </div>
                <h2 className="modal-title">Sistema de Ganancias</h2>
                      </div>
              <button
                onClick={() => setShowInfoModal(false)}
                className="modal-close-button"
              >
                <X size={20} />
              </button>
                    </div>

            {/* Contenido */}
            <div className="modal-content">
              {/* Advertencia BETA */}
              <div className="beta-warning">
                <div className="beta-icon-wrapper">
                  <span className="beta-icon">β</span>
                  </div>
                <div className="beta-content">
                  <h4 className="beta-title">FASE BETA</h4>
                  <p className="beta-text">
                    Esta función está en pruebas y puede tener errores. Reporta cualquier problema.
                  </p>
                </div>
              </div>

              {/* Sistema de ganancias */}
              <div className="system-info">
                <h3 className="section-title">💰 Sistema de Ganancias</h3>
                
                <div className="discount-rules">
                  <div className="rule-item">
                    <span className="rule-bullet">•</span>
                    <p className="rule-text">
                      <span className="rule-highlight">$0.25 por minuto</span> - Pago fijo por cada minuto de videollamada
                    </p>
                </div>
                  
                  <div className="rule-item">
                    <span className="rule-bullet">•</span>
                    <p className="rule-text">
                      <span className="rule-highlight">60% de regalos</span> - Comisión de cada regalo recibido
                    </p>
                  </div>
                </div>
              </div>

              {/* Consideraciones importantes */}
              <div className="balance-info-section">
                <h3 className="section-title">⚠️ Consideraciones Importantes</h3>
                
                <div className="balance-rules">
                  <div className="balance-rule">
                    <div className="balance-rule-icon coins-bg" style={{background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.3)'}}>
                      <span style={{color: 'rgb(239, 68, 68)'}}>1</span>
                    </div>
                    <div className="balance-rule-content">
                      <h4 className="balance-rule-title">Chico con menos de 2 minutos</h4>
                      <p className="balance-rule-text">Finalizar la sala porque ya no cuenta con saldo y el tiempo transcurrido no se reflejará</p>
              </div>
            </div>

                  <div className="balance-rule">
                    <div className="balance-rule-icon gifts-bg" style={{background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.3)'}}>
                      <span style={{color: 'rgb(239, 68, 68)'}}>2</span>
                    </div>
                    <div className="balance-rule-content">
                      <h4 className="balance-rule-title">Tiempo no inicia en 0</h4>
                      <p className="balance-rule-text">Si al iniciar el tiempo no está en 00:00, finalizar y volver a iniciar otra sala</p>
                    </div>
                  </div>

                  <div className="balance-rule">
                    <div className="balance-rule-icon gifts-bg" style={{background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.3)'}}>
                      <span style={{color: 'rgb(239, 68, 68)'}}>3</span>
                    </div>
                    <div className="balance-rule-content">
                      <h4 className="balance-rule-title">Chico se desconecta durante la llamada</h4>
                      <p className="balance-rule-text">Si sale conectado y no regresa después de 1 minuto, finalizar la sala. Si no lo haces, no se reflejará nada en el saldo</p>
                    </div>
                  </div>

                  <div className="balance-rule">
                    <div className="balance-rule-icon gifts-bg" style={{background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.3)'}}>
                      <span style={{color: 'rgb(239, 68, 68)'}}>4</span>
                    </div>
                    <div className="balance-rule-content">
                      <h4 className="balance-rule-title">Aparece "Conectando" en pantalla</h4>
                      <p className="balance-rule-text">Si sale conectando después de 1 minuto, finalizar la sala. Si no lo haces, no se reflejará nada en el saldo</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recomendaciones */}
              <div className="recommendations">
                <h4 className="recommendations-title">💡 Consejos</h4>
                <ul className="recommendations-list">
                  <li>• Mantén conversaciones interesantes</li>
                  <li>• Anima a los usuarios a enviar regalos</li>
                  <li>• No cierres las salas muy rápido</li>
                  <li>• Reporta errores para mejorar el sistema</li>
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="modal-footer">
                <button
                onClick={() => setShowInfoModal(false)}
                className="modal-confirm-button"
                >
                Entendido
                </button>
                </div>
              </div>
            </div>
      )}

      {/* 🔥 ADVERTENCIA INICIAL - VERSIÓN MODELO */}
      {showInitialWarning && (
        <div className="warning-overlay">
          <div className="warning-container">
            <div className="warning-content">
              <div className="warning-icon-wrapper">
                <Info size={32} className="warning-icon" />
          </div>
              <h3 className="warning-title">¡Importante!</h3>
              <p className="warning-text">
                Lee las reglas de ganancias antes de comenzar. Haz clic en el botón de información (ℹ️) para más detalles.
              </p>
              <button
                onClick={() => setShowInitialWarning(false)}
                className="warning-button"
              >
                Entendido
              </button>
        </div>
          </div>
        </div>
      )}

      {/* 🔥 ESTILOS RESPONSIVOS CONGRUENTES Y PROPORCIONALES - IGUAL QUE CLIENTE */}
      <style jsx>{`
        /* 🚨 OBLIGATORIO - ANTI-OVERFLOW */
        *, *::before, *::after {
          box-sizing: border-box;
        }

        /* 🔥 CONTENEDOR PRINCIPAL */
        .time-display-container {
          width: 100%;
          max-width: 100%;
          overflow: visible;
          position: relative;
        }

        /* 🔥 VERSIÓN MÓVIL BASE (0-1023px) - FULL RESPONSIVE */
    .mobile-version {
          display: flex;
          flex-direction: column;
          width: calc(100vw - 32px) !important;
      max-width: calc(100vw - 32px) !important;
          margin: 0 auto;
          background: transparent;
          backdrop-filter: blur(12px);
          border-radius: 12px;
          border: none;
          padding: 8px;
      overflow: hidden !important;
          box-sizing: border-box;
        }

        .mobile-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0;
          gap: 4px;
          margin-bottom: 8px;
          overflow: hidden;
          box-sizing: border-box;
    }

    .desktop-version {
          display: none;
        }

        /* Balance sections móvil */
        .balance-section {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 1;
          min-width: 0;
          max-width: 28% !important;
          overflow: hidden;
        }

        .balance-icon-wrapper {
          padding: 6px;
          border-radius: 6px;
          flex-shrink: 0;
        }

        .tiempo-icon {
          background: rgba(255, 46, 87, 0.2);
          border: 1px solid rgba(255, 46, 87, 0.3);
        }

        .tiempo-icon .balance-icon {
          color: rgb(255, 46, 87);
        }

        .gifts-icon {
          background: rgba(255, 0, 122, 0.2);
          border: 1px solid rgba(255, 0, 122, 0.3);
        }

        .minutes-icon {
          background: rgba(59, 130, 246, 0.2);
          border: 1px solid rgba(59, 130, 246, 0.3);
        }

        .minutes-icon .balance-icon {
          color: rgb(59, 130, 246);
        }

        .balance-icon {
          width: 10px;
          height: 10px;
          color: inherit;
        }

        .gifts-icon .balance-icon {
          color: rgb(255, 0, 122);
        }

        .balance-info {
          min-width: 0;
          flex-shrink: 1;
        }

        .balance-label {
          font-size: 0.7rem;
          color: rgb(209, 213, 219);
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .balance-value {
          font-size: 0.8rem;
          font-weight: 700;
          font-family: monospace;
          letter-spacing: 0.05em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .tiempo-value {
          color: rgb(255, 46, 87);
          font-weight: 600;
        }

        .minutes-value {
          color: rgb(59, 130, 246);
        }

        .gifts-value {
          color: rgb(255, 0, 122);
        }

        /* Connection section móvil CON INFO */
        .connection-section {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 1;
          min-width: 0;
          max-width: 30% !important;
          overflow: hidden;
        }

        .connection-status {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 6px;
          border-radius: 6px;
          white-space: nowrap;
          flex-shrink: 1;
          min-width: 0;
        }

        .connection-status.connected {
          background: rgba(0, 255, 102, 0.2);
          border: 1px solid rgba(0, 255, 102, 0.3);
        }

        .connection-status.disconnected {
          background: rgba(239, 68, 68, 0.2);
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .connection-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .connected .connection-dot {
          background: rgb(0, 255, 102);
          animation: pulse 2s infinite;
        }

        .disconnected .connection-dot {
          background: rgb(239, 68, 68);
        }

        .connection-text {
          font-size: 0.7rem;
          font-weight: 500;
          white-space: nowrap;
        }

        .connected .connection-text {
          color: rgb(0, 255, 102);
        }

        .disconnected .connection-text {
          color: rgb(252, 165, 165);
        }

        /* Botón info móvil */
        .info-button-mobile {
          background: rgba(255, 0, 122, 0.2);
          border: 1px solid rgba(255, 0, 122, 0.4);
          color: rgb(255, 0, 122);
          padding: 6px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .info-button-mobile:hover {
          background: rgba(255, 0, 122, 0.3);
          transform: scale(1.05);
        }

        /* 🔥 CONTROLES MÓVILES - Debajo del botón de info */
        .mobile-controls-section {
          width: 100%;
          padding-top: 10px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .mobile-controls-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          flex-wrap: wrap;
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0;
          overflow: hidden;
          box-sizing: border-box;
        }

        .mobile-control-button {
          position: relative;
          padding: 8px 10px;
          border-radius: 8px;
          transition: all 0.2s ease;
          cursor: pointer;
          border: 1px solid transparent;
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 36px;
          min-height: 36px;
          flex-shrink: 1;
        }

        .mobile-control-button:hover:not(.mobile-control-disabled) {
          transform: scale(1.1);
        }

        .mobile-control-disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .mobile-control-active {
          background: rgba(0, 255, 102, 0.2);
          border-color: rgba(0, 255, 102, 0.3);
          color: rgb(0, 255, 102);
        }

        .mobile-control-volume-active {
          background: rgba(168, 85, 247, 0.2);
          border-color: rgba(168, 85, 247, 0.3);
          color: rgb(168, 85, 247);
        }

        .mobile-control-inactive {
          background: rgba(239, 68, 68, 0.2);
          border-color: rgba(239, 68, 68, 0.3);
          color: rgb(239, 68, 68);
        }

        .mobile-control-skip {
          background: rgba(255, 0, 122, 0.2);
          border-color: rgba(255, 0, 122, 0.3);
          color: rgb(255, 0, 122);
        }

        .mobile-control-hangup {
          background: rgba(239, 68, 68, 0.2);
          border-color: rgba(239, 68, 68, 0.3);
          color: rgb(239, 68, 68);
        }

        .mobile-control-settings {
          background: rgba(107, 114, 128, 0.2);
          border-color: rgba(107, 114, 128, 0.3);
          color: rgb(156, 163, 175);
        }

        .mobile-control-settings-active {
          background: rgba(255, 0, 122, 0.2);
          border-color: rgba(255, 0, 122, 0.3);
          color: rgb(255, 0, 122);
        }

        .mobile-control-indicator {
          position: absolute;
          top: 4px;
          right: 4px;
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }

        .indicator-active {
          background: rgb(0, 255, 102);
          animation: pulse-indicator 2s infinite;
        }

        .indicator-inactive {
          background: rgb(239, 68, 68);
        }

        /* 🔥 RESPONSIVE MÓVIL - Adaptaciones para pantallas pequeñas */
        @media (max-width: 480px) {
          .mobile-version {
            max-width: calc(100vw - 16px);
            margin: 0 8px 8px 8px;
            padding: 8px;
          }

          .mobile-content {
            gap: 6px;
          }

          .balance-section {
            gap: 6px;
            max-width: 25% !important;
          }

          .balance-icon-wrapper {
            padding: 6px;
          }

          .balance-icon {
            width: 10px;
            height: 10px;
          }

          .balance-label {
            font-size: 0.625rem;
          }

          .balance-value {
            font-size: 0.75rem;
          }

          .connection-section {
            gap: 6px;
            max-width: 25% !important;
          }

          .connection-status {
            padding: 4px 6px;
          }

          .connection-text {
            font-size: 0.625rem;
          }

          .info-button-mobile {
            padding: 6px;
          }
        }

        @media (max-width: 360px) {
          .mobile-version {
            padding: 6px;
          }

          .balance-label {
            font-size: 0.5rem;
          }

          .balance-value {
            font-size: 0.625rem;
          }

          .connection-text {
            font-size: 0.5rem;
          }
        }

        /* 🔥 DESKTOP BASE (1024px+) - TAMAÑOS REDUCIDOS */
  @media (min-width: 1024px) {
    .mobile-version {
      display: none !important;
    }

    .desktop-version {
      display: flex !important;
            justify-content: space-between;
            align-items: center;
            width: 100%;
            max-width: calc(100vw - 24px);
            margin: 0 12px 6px 12px;
            background: transparent;
            border-radius: 6px;
            border: none;
            padding: 12px 14px;
            min-height: 70px;
            overflow: hidden;
          }

          /* Panels */
          .left-panel {
            display: flex;
            align-items: center;
            gap: 16px;
            flex-shrink: 0;
          }

          .center-panel {
            display: flex;
            align-items: center;
            flex-grow: 1;
            justify-content: center;
            min-width: 0;
            overflow: hidden;
            flex: 1;
          }

          .right-panel {
            display: flex;
            align-items: center;
            justify-content: flex-start;
            gap: 12px;
            flex-shrink: 0;
            width: 320px;
          }

          /* Balance items */
          .balance-item {
            display: flex;
            align-items: center;
            gap: 6px;
            flex-shrink: 0;
          }

          .balance-icon-wrapper {
            padding: 6px;
          }

          .balance-icon {
            width: 12px;
            height: 12px;
          }

          .balance-label {
            font-size: 0.625rem;
          }

          .balance-value {
            font-size: 0.8rem;
          }

          /* Status */
          .connection-status-desktop {
            display: flex;
            align-items: center;
          }

          .status-item {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 8px;
            border-radius: 6px;
            white-space: nowrap;
          }

          .status-item.connected {
            background: rgba(0, 255, 102, 0.2);
            border: 1px solid rgba(0, 255, 102, 0.3);
          }

          .status-item.disconnected {
            background: rgba(239, 68, 68, 0.2);
            border: 1px solid rgba(239, 68, 68, 0.3);
          }

          .status-icon-wrapper {
            display: flex;
            align-items: center;
            gap: 3px;
            flex-shrink: 0;
          }

          .status-icon {
            width: 12px;
            height: 12px;
            flex-shrink: 0;
          }

          .connected .status-icon {
            color: rgb(0, 255, 102);
          }

          .disconnected .status-icon {
            color: rgb(239, 68, 68);
          }

          .status-info {
            min-width: 0;
          }

          .status-title {
            font-size: 0.5625rem;
            font-weight: 600;
            white-space: nowrap;
          }

          .connected .status-title {
            color: rgb(0, 255, 102);
          }

          .disconnected .status-title {
            color: rgb(252, 165, 165);
          }

          .status-subtitle {
            font-size: 0.5rem;
            white-space: nowrap;
          }

          .connected .status-subtitle {
            color: rgba(0, 255, 102, 0.7);
          }

          .disconnected .status-subtitle {
            color: rgba(252, 165, 165, 0.7);
          }

          /* Info section desktop */
          .info-section-desktop {
            display: flex;
            align-items: center;
          }

          .info-item {
            display: flex;
            align-items: center;
            gap: 6px;
            background: linear-gradient(to bottom right, rgba(255, 0, 122, 0.1), rgba(255, 0, 122, 0.05));
            border: 1px solid rgba(255, 0, 122, 0.3);
            border-radius: 6px;
            padding: 6px 8px;
            white-space: nowrap;
          }

          .info-icon-wrapper {
            display: flex;
            align-items: center;
          }

          .info-button-desktop {
            padding: 4px;
            background: rgba(255, 0, 122, 0.2);
            border: 1px solid rgba(255, 0, 122, 0.3);
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s ease;
            flex-shrink: 0;
          }

          .info-icon-wrapper:hover {
            background: rgba(255, 0, 122, 0.3);
          }

          .info-button-desktop:hover {
            transform: scale(1.05);
          }

          .info-icon {
            color: rgb(255, 0, 122);
          }

          .info-details {
            min-width: 0;
          }

          .info-title {
            font-size: 0.5625rem;
            color: rgb(255, 0, 122);
            font-weight: 600;
            white-space: nowrap;
          }

          .info-subtitle {
            font-size: 0.5rem;
            color: rgba(255, 0, 122, 0.7);
            white-space: nowrap;
          }
        }

        /* 🔥 REDUCCIÓN PROPORCIONAL 1: 1200px-1439px (Reducir 20% más) */
        @media (min-width: 1200px) and (max-width: 1439px) {
    .desktop-version {
            max-width: calc(100vw - 19px);
            padding: 6px 10px;
            min-height: 35px;
            margin: 0 10px 5px 10px;
          }

          .left-panel {
            gap: 13px;
          }

          .right-panel {
            gap: 10px;
            flex-wrap: wrap;
            width: 300px;
          }

          .controls-section-desktop {
            display: flex !important;
            align-items: center;
            gap: 3px;
          }

          .control-button {
            padding: 6px 8px;
            min-width: 28px;
            min-height: 30px;
          }

          .balance-item {
            gap: 5px;
          }

          .balance-icon-wrapper {
            padding: 5px;
          }

          .balance-icon {
            width: 10px;
            height: 10px;
          }

          .balance-label {
            font-size: 0.5rem;
          }

          .balance-value {
            font-size: 0.64rem;
          }

          .status-item {
            gap: 5px;
            padding: 5px 6px;
          }

          .status-icon-wrapper {
            gap: 2px;
          }

          .status-icon {
            width: 10px;
            height: 10px;
          }

          .status-title {
            font-size: 0.45rem;
          }

          .status-subtitle {
            font-size: 0.4rem;
          }

          .info-item {
            gap: 5px;
            padding: 5px 6px;
          }

          .info-icon-wrapper {
            padding: 3px;
          }

          .info-button-desktop {
            padding: 0;
          }

          .info-icon {
            width: 10px;
            height: 10px;
          }

          .info-title {
            font-size: 0.45rem;
          }

          .info-subtitle {
            font-size: 0.4rem;
          }
        }

        /* 🔥 REDUCCIÓN PROPORCIONAL 2: 1024px-1199px (Reducir 40% más) */
        @media (min-width: 1024px) and (max-width: 1199px) {
    .desktop-version {
            max-width: calc(100vw - 14px);
            padding: 5px 7px;
            min-height: 26px;
            margin: 0 7px 4px 7px;
          }

          .left-panel {
            gap: 10px;
          }

          .right-panel {
            gap: 7px;
            width: 280px;
          }

          .balance-item {
            gap: 4px;
          }

          .balance-icon-wrapper {
            padding: 4px;
          }

          .balance-icon {
            width: 7px;
            height: 7px;
          }

          .balance-label {
            font-size: 0.375rem;
          }

          .balance-value {
            font-size: 0.48rem;
          }

          .status-item {
            gap: 4px;
            padding: 4px 5px;
          }

          .status-icon-wrapper {
            gap: 2px;
          }

          .status-icon {
            width: 7px;
            height: 7px;
          }

          .status-title {
            font-size: 0.34rem;
          }

          .status-subtitle {
            display: none;
          }

          .info-item {
            gap: 4px;
            padding: 4px 5px;
          }

          .info-icon-wrapper {
            padding: 2px;
          }

          .info-button-desktop {
            padding: 0;
          }

          .info-icon {
            width: 7px;
            height: 7px;
          }

          .info-title {
            font-size: 0.34rem;
          }

          .info-subtitle {
            display: none;
          }
        }

        /* 🔥 CONTROLES DE VIDEOLLAMADA INTEGRADOS */
  .controls-section-desktop {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .control-button {
    position: relative;
    padding: 13px 14px;
    border-radius: 6px;
    transition: all 0.2s ease;
    cursor: pointer;
    border: 1px solid transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 39px;
    height: 53px;
    min-height: 53px;
  }

  .control-button:hover:not(.control-button-disabled) {
    transform: scale(1.1);
  }

  .control-button-disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .control-button-active {
    background: rgba(0, 255, 102, 0.2);
    border-color: rgba(0, 255, 102, 0.3);
    color: rgb(0, 255, 102);
  }

  .control-button-volume-active {
    background: rgba(168, 85, 247, 0.2);
    border-color: rgba(168, 85, 247, 0.3);
    color: rgb(168, 85, 247);
  }

  .control-button-inactive {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.3);
    color: rgb(239, 68, 68);
  }

  .control-button-skip {
    background: rgba(255, 0, 122, 0.2);
    border-color: rgba(255, 0, 122, 0.3);
    color: rgb(255, 0, 122);
  }

  .control-button-skip:hover:not(.control-button-disabled) {
    background: rgba(255, 0, 122, 0.3);
  }

  .control-button-hangup {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.3);
    color: rgb(239, 68, 68);
  }

  .control-button-hangup:hover:not(.control-button-disabled) {
    background: rgba(239, 68, 68, 0.3);
  }

  .control-button-settings {
    background: rgba(107, 114, 128, 0.2);
    border-color: rgba(107, 114, 128, 0.3);
    color: rgb(156, 163, 175);
  }

  .control-button-settings:hover:not(.control-button-disabled) {
    background: rgba(107, 114, 128, 0.3);
    color: white;
  }

  .control-button-settings-active {
    background: rgba(255, 0, 122, 0.2);
    border-color: rgba(255, 0, 122, 0.3);
    color: rgb(255, 0, 122);
  }

  .control-button-indicator {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }

  .indicator-active {
    background: rgb(0, 255, 102);
    animation: pulse-indicator 2s infinite;
  }

  .indicator-inactive {
    background: rgb(239, 68, 68);
  }

  .controls-separator-small {
    width: 1px;
    height: 45px;
    background: rgba(107, 114, 128, 0.3);
    margin: 0 4px;
    flex-shrink: 0;
  }

  .settings-icon-active {
    animation: rotate-settings 0.3s ease;
  }

  @keyframes pulse-indicator {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  @keyframes rotate-settings {
    from { transform: rotate(0deg); }
    to { transform: rotate(90deg); }
  }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        /* 🔥 REDUCCIÓN EXTREMA: < 1100px (Ocultar elementos opcionales) */
  @media (max-width: 1100px) {
    .center-panel {
      display: flex !important;
      flex: 1;
      justify-content: center;
    }

    .controls-section-desktop {
      display: flex !important;
      align-items: center;
      gap: 3px;
    }

    .control-button {
      padding: 4px 6px;
      min-width: 22px;
      min-height: 24px;
    }

    .control-button-indicator {
      width: 4px;
      height: 4px;
    }

          .desktop-version {
            justify-content: space-between;
          }
        }

        /* 🔥 MODAL STYLES - RESPONSIVE */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }

        .modal-container {
          background: linear-gradient(to bottom, #0a0d10, #131418);
          border-radius: 12px;
          border: 1px solid rgba(255, 0, 122, 0.3);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          width: 100%;
          max-width: 500px;
          max-height: 85vh;
          overflow: hidden;
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(0, 0, 0, 0.2);
        }

        .modal-header-content {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .modal-icon-wrapper {
          padding: 6px;
          background: rgba(255, 0, 122, 0.2);
          border-radius: 6px;
          border: 1px solid rgba(255, 0, 122, 0.3);
        }

        .modal-icon {
          color: rgb(255, 0, 122);
        }

        .modal-title {
          color: white;
          font-weight: 700;
          font-size: 1rem;
        }

        .modal-close-button {
          background: transparent;
          border: none;
          color: rgb(156, 163, 175);
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          transition: all 0.2s ease;
        }

        .modal-close-button:hover {
          background: rgba(255, 255, 255, 0.1);
          color: white;
        }

        .modal-content {
          padding: 16px;
          overflow-y: auto;
          max-height: calc(85vh - 140px);
        }

        .beta-warning {
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.3);
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 16px;
          display: flex;
          gap: 12px;
        }

        .beta-icon-wrapper {
          width: 32px;
          height: 32px;
          background: rgba(245, 158, 11, 0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .beta-icon {
          color: rgb(245, 158, 11);
          font-weight: 700;
          font-size: 1.125rem;
        }

        .beta-content {
          flex: 1;
        }

        .beta-title {
          color: rgb(245, 158, 11);
          font-weight: 600;
          font-size: 0.75rem;
          margin-bottom: 4px;
        }

        .beta-text {
          color: rgba(245, 158, 11, 0.8);
          font-size: 0.75rem;
          line-height: 1.4;
        }

        .system-info {
          margin-bottom: 16px;
        }

        .section-title {
          color: white;
          font-weight: 600;
          font-size: 0.875rem;
          margin-bottom: 12px;
        }

        .discount-rules {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .rule-item {
          display: flex;
          gap: 8px;
          align-items: flex-start;
        }

        .rule-bullet {
          color: rgb(255, 0, 122);
          font-weight: 700;
          flex-shrink: 0;
        }

        .rule-text {
          color: rgb(156, 163, 175);
          font-size: 0.75rem;
          line-height: 1.4;
        }

        .rule-highlight {
          color: white;
          font-weight: 600;
        }

        .balance-info-section {
          margin-bottom: 16px;
        }

        .balance-rules {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .balance-rule {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }

        .balance-rule-icon {
          width: 32px;
          height: 32px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-weight: 700;
          font-size: 0.875rem;
        }

        .balance-rule-content {
          flex: 1;
        }

        .balance-rule-title {
          color: white;
          font-weight: 600;
          font-size: 0.75rem;
          margin-bottom: 4px;
        }

        .balance-rule-text {
          color: rgb(156, 163, 175);
          font-size: 0.75rem;
          line-height: 1.4;
        }

        .recommendations {
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 8px;
          padding: 12px;
        }

        .recommendations-title {
          color: rgb(147, 197, 253);
          font-weight: 600;
          font-size: 0.75rem;
          margin-bottom: 8px;
        }

        .recommendations-list {
          color: rgba(147, 197, 253, 0.8);
          font-size: 0.75rem;
          line-height: 1.4;
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .recommendations-list li {
          margin-bottom: 4px;
        }

        .modal-footer {
          padding: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(0, 0, 0, 0.2);
        }

        .modal-confirm-button {
          width: 100%;
          background: rgb(255, 0, 122);
          color: white;
          font-size: 0.875rem;
          font-weight: 500;
          border-radius: 8px;
          padding: 12px;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .modal-confirm-button:hover {
          background: rgba(255, 0, 122, 0.9);
        }

        /* Warning inicial */
        .warning-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(4px);
          z-index: 10001;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }

        .warning-container {
          background: linear-gradient(to bottom, #0a0d10, #131418);
          border-radius: 12px;
          border: 1px solid rgba(255, 0, 122, 0.3);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          width: 100%;
          max-width: 320px;
        }

        .warning-content {
          padding: 24px;
          text-align: center;
        }

        .warning-icon-wrapper {
          width: 64px;
          height: 64px;
          background: rgba(255, 0, 122, 0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px auto;
          border: 1px solid rgba(255, 0, 122, 0.3);
        }

        .warning-icon {
          color: rgb(255, 0, 122);
        }

        .warning-title {
          color: white;
          font-weight: 700;
          font-size: 1.125rem;
          margin-bottom: 12px;
        }

        .warning-text {
          color: rgb(209, 213, 219);
          font-size: 0.875rem;
          line-height: 1.5;
          margin-bottom: 24px;
        }

        .warning-button {
          width: 100%;
          background: rgb(255, 0, 122);
          color: white;
          font-weight: 500;
          border-radius: 8px;
          padding: 12px;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .warning-button:hover {
          background: rgba(255, 0, 122, 0.9);
        }

        /* 🔥 RESPONSIVE MODAL */
        @media (max-width: 640px) {
          .modal-container {
            max-width: calc(100vw - 32px);
            margin: 16px;
          }

          .modal-title {
            font-size: 1rem;
          }

          .modal-content {
            padding: 12px;
          }

          .beta-warning {
            padding: 8px;
          }

          .beta-title {
            font-size: 0.75rem;
          }

          .beta-text {
            font-size: 0.6875rem;
          }

          .section-title {
            font-size: 0.75rem;
          }

          .rule-text {
            font-size: 0.6875rem;
          }

          .balance-rule-title {
            font-size: 0.75rem;
          }

          .balance-rule-text {
            font-size: 0.6875rem;
          }

          .recommendations-title {
            font-size: 0.6875rem;
          }

          .recommendations-list {
            font-size: 0.6875rem;
          }
        }

        /* 🔥 PROTECCIÓN FINAL ANTI-OVERFLOW */
        .time-display-container * {
          max-width: 100%;
          word-break: break-word;
        }
      `}</style>
    </>
  );
};

export default TimeDisplayImproved;
