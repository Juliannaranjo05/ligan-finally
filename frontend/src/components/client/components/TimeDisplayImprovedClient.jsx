import React, { useState, useEffect } from 'react';
import { Clock, Wifi, WifiOff, User, Signal, Coins, Timer, Gift, Info, X } from 'lucide-react';
import ClientRemainingMinutes from '../../ClientRemainingMinutes';

const TimeDisplayImprovedClient = ({ 
  connected, 
  otherUser, 
  roomName, 
  t,
  userBalance,      // Balance de COINS (monedas generales)
  giftBalance,      // Balance de GIFTS (para regalos)
  remainingMinutes 
}) => {
  const [currentCoinsBalance, setCurrentCoinsBalance] = useState(userBalance || 0);
  const [currentGiftBalance, setCurrentGiftBalance] = useState(giftBalance || 0);
  const [currentMinutes, setCurrentMinutes] = useState(remainingMinutes || 0);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  
  // 🔥 ESTADOS PARA MODAL DE INFORMACIÓN
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showInitialWarning, setShowInitialWarning] = useState(false);

  // 🔥 MOSTRAR ADVERTENCIA INICIAL AL CONECTAR
  useEffect(() => {
    if (connected && otherUser && !localStorage.getItem('clientBetaWarningShown')) {
      setShowInitialWarning(true);
      localStorage.setItem('clientBetaWarningShown', 'true');
    }
  }, [connected, otherUser]);

  // 🔄 Actualizar ambos balances cada 5 minutos
  useEffect(() => {
    const updateBalances = async () => {
      try {
        const authToken = localStorage.getItem('token');
        if (!authToken) return;

        // 1️⃣ Balance de COINS
        const coinsResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/client-balance/my-balance/quick`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (coinsResponse.ok) {
          const coinsData = await coinsResponse.json();
          if (coinsData.success) {
            setCurrentCoinsBalance(coinsData.total_coins);
            setCurrentMinutes(coinsData.remaining_minutes);
          }
        }

        // 2️⃣ Balance de GIFTS
        const giftsResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/gifts/my-balance`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (giftsResponse.ok) {
          const giftsData = await giftsResponse.json();
          if (giftsData.success) {
            setCurrentGiftBalance(giftsData.gift_balance);
          }
        }

        setLastUpdate(Date.now());
      } catch (error) {
        console.error('Error actualizando balances:', error);
      }
    };

    // Actualizar inmediatamente
    updateBalances();

    // Actualizar cada 5 minutos
    const interval = setInterval(updateBalances, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  // Actualizar cuando cambien las props
  useEffect(() => {
    if (userBalance !== undefined) {
      setCurrentCoinsBalance(userBalance);
    }
  }, [userBalance]);

  useEffect(() => {
    if (giftBalance !== undefined) {
      setCurrentGiftBalance(giftBalance);
    }
  }, [giftBalance]);

  useEffect(() => {
    if (remainingMinutes !== undefined) {
      setCurrentMinutes(remainingMinutes);
    }
  }, [remainingMinutes]);

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
            {/* Saldo de COINS */}
            <div className="balance-section coins-section">
              <div className="balance-icon-wrapper coins-icon">
                <Coins className="balance-icon" />
              </div>
              <div className="balance-info">
                <div className="balance-label">Monedas:</div>
                <div className="balance-value coins-value">{currentCoinsBalance}</div>
              </div>
            </div>

            {/* Saldo de GIFTS */}
            <div className="balance-section gifts-section">
              <div className="balance-icon-wrapper gifts-icon">
                <Gift className="balance-icon" />
              </div>
              <div className="balance-info">
                <div className="balance-label">Regalos:</div>
                <div className="balance-value gifts-value">{currentGiftBalance}</div>
              </div>
            </div>
            
            {/* Estado de conexión CON BOTÓN INFO */}
            <div className="connection-section">
              {connected ? (
                <div className="connection-status connected">
                  <div className="connection-dot"></div>
                  <span className="connection-text">Conectado</span>
                </div>
              ) : (
                <div className="connection-status disconnected">
                  <div className="connection-dot"></div>
                  <span className="connection-text">Desconectado</span>
                </div>
              )}
              
              {/* Botón de información en móvil */}
              <button
                onClick={() => setShowInfoModal(true)}
                className="info-button-mobile"
                title="Información del sistema"
              >
                <Info size={14} />
              </button>
            </div>
          </div>
          
          {/* Info de la chica en móvil */}
          {otherUser && (
            <div className="user-info-mobile">
              <div className="user-avatar-mobile">
                <span className="avatar-text">
                  {otherUser.name?.charAt(0)?.toUpperCase() || '?'}
                </span>
              </div>
              <span className="user-name-mobile">Chica conectada</span>
            </div>
          )}
        </div>

        {/* 🔥 VERSIÓN DESKTOP */}
        <div className="desktop-version">
          
          {/* Panel izquierdo - Balances */}
          <div className="left-panel">
            
            {/* Saldo de COINS */}
            <div className="balance-item coins-item">
              <div className="balance-icon-wrapper coins-icon">
                <Coins className="balance-icon" />
              </div>
              <div className="balance-info">
                <div className="balance-label">Monedas:</div>
                <div className="balance-value coins-value">{currentCoinsBalance}</div>
              </div>
            </div>

            {/* Saldo de GIFTS */}
            <div className="balance-item gifts-item">
              <div className="balance-icon-wrapper gifts-icon">
                <Gift className="balance-icon" />
              </div>
              <div className="balance-info">
                <div className="balance-label">Regalos:</div>
                <div className="balance-value gifts-value">{currentGiftBalance}</div>
              </div>
            </div>
          </div>

          {/* Panel central - Info usuario SIMPLIFICADO */}
          <div className="center-panel">
            {otherUser && (
              <div className="user-info">
                <div className="user-avatar">{otherUser.name?.charAt(0)?.toUpperCase() || 'C'}</div>
                <div className="user-details">
                  <div className="user-name">Chica conectada</div>
                </div>
              </div>
            )}
          </div>

          {/* Panel derecho - Estado CON INFO */}
          <div className="right-panel">
            
            {/* Estado de conexión */}
            <div className="connection-status-desktop">
              {connected ? (
                <div className="status-item connected">
                  <div className="status-icon-wrapper">
                    <Wifi className="status-icon" />
                    <div className="connection-dot"></div>
                  </div>
                  <div className="status-info">
                    <div className="status-title">Conectado</div>
                    <div className="status-subtitle">En línea</div>
                  </div>
                </div>
              ) : (
                <div className="status-item disconnected">
                  <div className="status-icon-wrapper">
                    <WifiOff className="status-icon" />
                    <div className="connection-dot"></div>
                  </div>
                  <div className="status-info">
                    <div className="status-title">Desconectado</div>
                    <div className="status-subtitle">Fuera de línea</div>
                  </div>
                </div>
              )}
            </div>

            {/* Timestamp - Mismo tamaño que conexión e info */}
            <div className="timestamp-section">
              <div className="timestamp-item-large">
                <div className="timestamp-icon-wrapper">
                  <Clock className="timestamp-icon-large" />
                </div>
                <div className="timestamp-details">
                  <div className="timestamp-title">Hora local</div>
                  <div className="timestamp-time">
                    {new Date(lastUpdate).toLocaleTimeString('es-ES', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* 🔥 BOTÓN DE INFORMACIÓN INTEGRADO EN DESKTOP */}
            <div className="info-section-desktop">
              <div className="info-item">
                <button
                  onClick={() => setShowInfoModal(true)}
                  className="info-button-desktop"
                  title="Información del sistema"
                >
                  <Info size={12} className="info-icon" />
                </button>
                <div className="info-details">
                  <div className="info-title">Info</div>
                  <div className="info-subtitle">Sistema</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 🔥 MODAL DE INFORMACIÓN - VERSIÓN CLIENTE */}
      {showInfoModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            {/* Header */}
            <div className="modal-header">
              <div className="modal-header-content">
                <div className="modal-icon-wrapper">
                  <Info size={16} className="modal-icon" />
                </div>
                <h2 className="modal-title">Sistema de Descuentos</h2>
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

              {/* Sistema de descuentos */}
              <div className="system-info">
                <h3 className="section-title">💰 Sistema de Descuentos</h3>
                
                <div className="discount-rules">
                  <div className="rule-item">
                    <span className="rule-bullet">•</span>
                    <p className="rule-text">
                      <span className="rule-highlight">10 monedas por minuto</span> - Costo base por cada minuto de videollamada
                    </p>
                  </div>
                  
                  <div className="rule-item">
                    <span className="rule-bullet">•</span>
                    <p className="rule-text">
                      <span className="rule-highlight">20 monedas después del minuto</span> - Tarifa incrementada tras el primer minuto
                    </p>
                  </div>

                  <div className="rule-item">
                    <span className="rule-bullet">•</span>
                    <p className="rule-text">
                      <span className="rule-highlight">Descuento cada 30 segundos</span> - Se descuentan 5 monedas automáticamente
                    </p>
                  </div>
                </div>
              </div>

              {/* Información de balances */}
              <div className="balance-info-section">
                <h3 className="section-title">💎 Información de Balances</h3>
                
                <div className="balance-rules">
                  <div className="balance-rule">
                    <div className="balance-rule-icon coins-bg">
                      <Coins size={16} className="coins-color" />
                    </div>
                    <div className="balance-rule-content">
                      <h4 className="balance-rule-title">Saldo de Monedas</h4>
                      <p className="balance-rule-text">Se usa para pagar videollamadas y servicios premium</p>
                    </div>
                  </div>

                  <div className="balance-rule">
                    <div className="balance-rule-icon gifts-bg">
                      <Gift size={16} className="gifts-color" />
                    </div>
                    <div className="balance-rule-content">
                      <h4 className="balance-rule-title">Saldo de Regalos</h4>
                      <p className="balance-rule-text">Exclusivo para enviar regalos a las chicas</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recomendaciones */}
              <div className="recommendations">
                <h4 className="recommendations-title">💡 Recomendaciones</h4>
                <ul className="recommendations-list">
                  <li>• Recarga monedas antes de iniciar videollamadas</li>
                  <li>• Los regalos no afectan tu saldo de monedas</li>
                  <li>• Mantén conexión estable para evitar cobros extra</li>
                  <li>• Reporta cualquier descuento incorrecto</li>
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

      {/* 🔥 ADVERTENCIA INICIAL - VERSIÓN CLIENTE */}
      {showInitialWarning && (
        <div className="warning-overlay">
          <div className="warning-container">
            <div className="warning-content">
              <div className="warning-icon-wrapper">
                <Info size={32} className="warning-icon" />
              </div>
              <h3 className="warning-title">¡Importante!</h3>
              <p className="warning-text">
                Conoce el sistema de descuentos antes de comenzar. Haz clic en el botón de información (ℹ️) para más detalles.
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

      {/* 🔥 ESTILOS RESPONSIVOS CONGRUENTES Y PROPORCIONALES */}
      <style jsx>{`
        /* 🚨 OBLIGATORIO - ANTI-OVERFLOW */
        *, *::before, *::after {
          box-sizing: border-box;
        }

        /* 🔥 CONTENEDOR PRINCIPAL */
        .time-display-container {
          width: 100%;
          max-width: 100vw;
          overflow: hidden;
          position: relative;
        }

        /* 🔥 VERSIÓN MÓVIL BASE (0-1023px) - FULL RESPONSIVE */
        .mobile-version {
          display: flex;
          flex-direction: column;
          width: 100%;
          max-width: calc(100vw - 32px);
          margin: 0 16px 16px 16px;
          background: linear-gradient(to bottom, #0a0d10, #131418);
          backdrop-filter: blur(12px);
          border-radius: 12px;
          border: 1px solid rgba(255, 0, 122, 0.2);
          padding: 12px;
          overflow: hidden;
        }

        .mobile-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          min-width: 0;
          gap: 8px;
          margin-bottom: 12px;
        }

        .desktop-version {
          display: none;
        }

        /* Balance sections móvil */
        .balance-section {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
          min-width: 0;
        }

        .balance-icon-wrapper {
          padding: 8px;
          border-radius: 8px;
          flex-shrink: 0;
        }

        .coins-icon {
          background: rgba(245, 158, 11, 0.2);
          border: 1px solid rgba(245, 158, 11, 0.3);
        }

        .gifts-icon {
          background: rgba(255, 0, 122, 0.2);
          border: 1px solid rgba(255, 0, 122, 0.3);
        }

        .balance-icon {
          width: 12px;
          height: 12px;
          color: inherit;
        }

        .coins-icon .balance-icon {
          color: rgb(245, 158, 11);
        }

        .gifts-icon .balance-icon {
          color: rgb(255, 0, 122);
        }

        .balance-info {
          min-width: 0;
          flex-shrink: 1;
        }

        .balance-label {
          font-size: 0.75rem;
          color: rgb(209, 213, 219);
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .balance-value {
          font-size: 0.875rem;
          font-weight: 700;
          font-family: monospace;
          letter-spacing: 0.05em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .coins-value {
          color: rgb(245, 158, 11);
        }

        .gifts-value {
          color: rgb(255, 0, 122);
        }

        /* Connection section móvil CON INFO */
        .connection-section {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .connection-status {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          border-radius: 8px;
          white-space: nowrap;
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
          font-size: 0.75rem;
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
          padding: 8px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .info-button-mobile:hover {
          background: rgba(255, 0, 122, 0.3);
          transform: scale(1.05);
        }

        /* User info móvil */
        .user-info-mobile {
          display: flex;
          align-items: center;
          gap: 8px;
          padding-top: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .user-avatar-mobile {
          width: 24px;
          height: 24px;
          background: linear-gradient(to bottom right, rgb(255, 0, 122), rgba(255, 0, 122, 0.7));
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255, 0, 122, 0.3);
          flex-shrink: 0;
        }

        .avatar-text {
          color: white;
          font-weight: 700;
          font-size: 0.625rem;
        }

        .user-name-mobile {
          color: white;
          font-size: 0.875rem;
          font-weight: 500;
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

          .user-info-mobile {
            gap: 6px;
          }

          .user-avatar-mobile {
            width: 20px;
            height: 20px;
          }

          .avatar-text {
            font-size: 0.5rem;
          }

          .user-name-mobile {
            font-size: 0.75rem;
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

          .user-name-mobile {
            font-size: 0.625rem;
          }
        }

        /* 🔥 DESKTOP BASE (1024px+) - TAMAÑOS REDUCIDOS */
        @media (min-width: 1024px) {
          .mobile-version {
            display: none;
          }

          .desktop-version {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
            max-width: calc(100vw - 24px);
            margin: 0 12px 6px 12px;
            background: linear-gradient(to bottom, #0a0d10, #131418);
            backdrop-filter: blur(12px);
            border-radius: 6px;
            border: 1px solid rgba(255, 0, 122, 0.2);
            padding: 8px 12px;
            min-height: 44px;
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
          }

          .right-panel {
            display: flex;
            align-items: center;
            gap: 12px;
            flex-shrink: 0;
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

          /* User info simplificado */
          .user-info {
            display: flex;
            align-items: center;
            gap: 8px;
            min-width: 0;
          }

          .user-avatar {
            width: 28px;
            height: 28px;
            background: linear-gradient(to bottom right, rgb(255, 0, 122), rgba(255, 0, 122, 0.7));
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 700;
            font-size: 0.625rem;
            border: 1px solid rgba(255, 0, 122, 0.3);
            flex-shrink: 0;
          }

          .user-details {
            min-width: 0;
            flex-shrink: 1;
          }

          .user-name {
            font-size: 0.625rem;
            color: white;
            font-weight: 600;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          /* Status */
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

          /* Timestamp - Mismo tamaño que status e info */
          .timestamp-item-large {
            display: flex;
            align-items: center;
            gap: 6px;
            background: linear-gradient(to bottom right, rgba(75, 85, 99, 0.5), rgba(75, 85, 99, 0.3));
            border-radius: 6px;
            border: 1px solid rgba(107, 114, 128, 0.3);
            padding: 6px 8px;
            white-space: nowrap;
          }

          .timestamp-icon-wrapper {
            padding: 4px;
            background: rgba(156, 163, 175, 0.2);
            border-radius: 4px;
            border: 1px solid rgba(156, 163, 175, 0.3);
            flex-shrink: 0;
          }

          .timestamp-icon-large {
            width: 12px;
            height: 12px;
            color: rgb(156, 163, 175);
            flex-shrink: 0;
          }

          .timestamp-details {
            min-width: 0;
          }

          .timestamp-title {
            font-size: 0.5625rem;
            color: rgb(156, 163, 175);
            font-weight: 600;
            white-space: nowrap;
          }

          .timestamp-time {
            font-size: 0.5rem;
            color: white;
            font-weight: 500;
            font-family: monospace;
            white-space: nowrap;
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

          .info-button-desktop {
            padding: 4px;
            background: rgba(255, 0, 122, 0.2);
            border: 1px solid rgba(255, 0, 122, 0.3);
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s ease;
            flex-shrink: 0;
          }

          .info-button-desktop:hover {
            background: rgba(255, 0, 122, 0.3);
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

          .user-info {
            gap: 6px;
          }

          .user-avatar {
            width: 22px;
            height: 22px;
            font-size: 0.5rem;
          }

          .user-name {
            font-size: 0.5rem;
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

          .timestamp-item-large {
            gap: 5px;
            padding: 5px 6px;
          }

          .timestamp-icon-wrapper {
            padding: 3px;
          }

          .timestamp-icon-large {
            width: 10px;
            height: 10px;
          }

          .timestamp-title {
            font-size: 0.45rem;
          }

          .timestamp-time {
            font-size: 0.4rem;
          }

          .info-item {
            gap: 5px;
            padding: 5px 6px;
          }

          .info-button-desktop {
            padding: 3px;
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

          .user-info {
            gap: 5px;
          }

          .user-avatar {
            width: 17px;
            height: 17px;
            font-size: 0.375rem;
          }

          .user-name {
            font-size: 0.375rem;
            max-width: 80px;
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

          .timestamp-item-large {
            gap: 4px;
            padding: 4px 5px;
          }

          .timestamp-icon-wrapper {
            padding: 2px;
          }

          .timestamp-icon-large {
            width: 7px;
            height: 7px;
          }

          .timestamp-title {
            font-size: 0.34rem;
          }

          .timestamp-time {
            font-size: 0.3rem;
          }

          .info-item {
            gap: 4px;
            padding: 4px 5px;
          }

          .info-button-desktop {
            padding: 2px;
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

        /* 🔥 REDUCCIÓN EXTREMA: < 1100px (Ocultar elementos opcionales) */
        @media (max-width: 1100px) {
          .center-panel {
            display: none;
          }

          .timestamp-section {
            display: none;
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
        }

        .modal-header-content {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .modal-icon-wrapper {
          padding: 8px;
          background: rgba(255, 0, 122, 0.2);
          border-radius: 8px;
          border: 1px solid rgba(255, 0, 122, 0.3);
        }

        .modal-icon {
          color: rgb(255, 0, 122);
        }

        .modal-title {
          font-size: 1.125rem;
          font-weight: 700;
          color: white;
        }

        .modal-close-button {
          padding: 4px;
          border-radius: 8px;
          color: rgb(156, 163, 175);
          background: transparent;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .modal-close-button:hover {
          color: white;
          background: rgba(255, 255, 255, 0.1);
        }

        .modal-content {
          padding: 16px;
          space-y: 16px;
          overflow-y: auto;
          max-height: 60vh;
        }

        .beta-warning {
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.3);
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 16px;
        }

        .beta-warning {
          display: flex;
          align-items: flex-start;
          gap: 8px;
        }

        .beta-icon-wrapper {
          width: 20px;
          height: 20px;
          background: rgb(245, 158, 11);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .beta-icon {
          color: white;
          font-size: 0.75rem;
          font-weight: 700;
        }

        .beta-content {
          flex: 1;
        }

        .beta-title {
          color: rgb(252, 211, 77);
          font-weight: 600;
          font-size: 0.875rem;
          margin-bottom: 4px;
        }

        .beta-text {
          color: rgba(252, 211, 77, 0.8);
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
          border-bottom: 1px solid rgba(255, 255, 255, 0.2);
          padding-bottom: 8px;
          margin-bottom: 12px;
        }

        .discount-rules {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .rule-item {
          display: flex;
          align-items: flex-start;
          gap: 8px;
        }

        .rule-bullet {
          color: rgb(255, 0, 122);
          font-weight: 700;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .rule-text {
          color: rgb(209, 213, 219);
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
          align-items: flex-start;
          gap: 12px;
          padding: 12px;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .balance-rule-icon {
          padding: 8px;
          border-radius: 8px;
          flex-shrink: 0;
        }

        .coins-bg {
          background: rgba(245, 158, 11, 0.2);
          border: 1px solid rgba(245, 158, 11, 0.3);
        }

        .gifts-bg {
          background: rgba(255, 0, 122, 0.2);
          border: 1px solid rgba(255, 0, 122, 0.3);
        }

        .coins-color {
          color: rgb(245, 158, 11);
        }

        .gifts-color {
          color: rgb(255, 0, 122);
        }

        .balance-rule-content {
          flex: 1;
        }

        .balance-rule-title {
          color: white;
          font-weight: 600;
          font-size: 0.875rem;
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

        /* 🔥 ANIMACIÓN */
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
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

export default TimeDisplayImprovedClient;