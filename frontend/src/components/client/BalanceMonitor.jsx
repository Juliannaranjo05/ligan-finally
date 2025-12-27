// 🔥 BalanceMonitor.jsx - COMPONENTE INDEPENDIENTE PARA VIDEOCHAT
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// 🔥 HOOK INDEPENDIENTE SOLO PARA MONITOREO DE SALDO
export const useBalanceMonitor = () => {
  const [remainingMinutes, setRemainingMinutes] = useState(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isCheckingBalance, setIsCheckingBalance] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();

  // 🔥 FUNCIÓN INDEPENDIENTE PARA FINALIZAR CHAT
  const finalizarPorSaldo = useCallback(async () => {
        
    try {
      const authToken = localStorage.getItem('token');
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
      const roomName = localStorage.getItem('roomName');
      
      // 🔥 NOTIFICAR AL SERVIDOR
      if (roomName && authToken) {
                
        try {
          await fetch(`${API_BASE_URL}/api/livekit/end-coin-session`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({ 
              roomName, 
              reason: 'balance_exhausted',
              ended_by: 'balance_monitor'
            })
          });
        } catch (error) {
        }

        // 🔥 NOTIFICAR AL PARTNER
        try {
          await fetch(`${API_BASE_URL}/api/livekit/notify-partner-stop`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({ 
              roomName,
              reason: 'client_balance_exhausted'
            })
          });
        } catch (error) {
        }

        // 🔥 ACTUALIZAR HEARTBEAT
        try {
          await fetch(`${API_BASE_URL}/api/heartbeat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({
              activity_type: 'browsing',
              room: null
            })
          });
        } catch (error) {
        }
      }

      // 🔥 LIMPIAR SESIÓN
            const itemsToRemove = [
        'roomName', 'userName', 'currentRoom', 'inCall', 
        'callToken', 'videochatActive'
      ];
      itemsToRemove.forEach(item => localStorage.removeItem(item));

      // 🔥 NAVEGAR A HOME
            navigate('/homecliente', { 
        replace: true,
        state: { 
          message: t('balanceMonitor.messages.sessionEnded'),
          type: 'warning'
        }
      });

    } catch (error) {
            
      // 🔥 FALLBACK
      localStorage.removeItem('roomName');
      localStorage.removeItem('userName');
      localStorage.removeItem('inCall');
      localStorage.removeItem('videochatActive');
      navigate('/homecliente', { replace: true });
    }
  }, [navigate]);

  // 🔥 VERIFICAR SALDO
  const verificarSaldo = useCallback(async () => {
    if (isCheckingBalance) return false;
    setIsCheckingBalance(true);

    try {
      const authToken = localStorage.getItem('token');
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
      const roomName = localStorage.getItem('roomName');
      
      if (!authToken || !roomName || !API_BASE_URL) {
        return false;
      }
      
      // 🔥 OBTENER USER ID
      let clientUserId = null;
      try {
        const userString = localStorage.getItem('user');
        if (userString) {
          const userData = JSON.parse(userString);
          clientUserId = userData.id;
        }

        if (!clientUserId) {
          const userResponse = await fetch(`${API_BASE_URL}/api/user/profile`, {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (userResponse.ok) {
            const userData = await userResponse.json();
            clientUserId = userData.id;
          }
        }
      } catch (error) {
                return false;
      }
      
      if (!clientUserId) {
        return false;
      }
      
            
      const response = await fetch(`${API_BASE_URL}/api/client-balance/get`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          room_name: roomName,
          client_user_id: clientUserId
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.success && data.client_balance) {
          const minutes = data.client_balance.remaining_minutes;
          setRemainingMinutes(minutes);
          
                    
          // 🔥 FINALIZAR SI QUEDAN 2 MINUTOS O MENOS
          if (minutes <= 2) {
                        setTimeout(() => finalizarPorSaldo(), 1000);
            return true;
          }
          
          if (minutes <= 5 && minutes > 2) {
                      }
          
          return false;
        }
      } else {
      }
      
      return false;
      
    } catch (error) {
            return false;
    } finally {
      setIsCheckingBalance(false);
    }
  }, [isCheckingBalance, finalizarPorSaldo]);

  // 🔥 INICIAR/DETENER MONITOREO
  const startMonitoring = useCallback(() => {
    if (isMonitoring) return;
    
        setIsMonitoring(true);
    
    // Verificación inicial
    verificarSaldo();
    
    // Verificar cada 10 segundos
    const interval = setInterval(async () => {
      const roomName = localStorage.getItem('roomName');
      const inCall = localStorage.getItem('inCall') === 'true';
      const videochatActive = localStorage.getItem('videochatActive') === 'true';
      
      if ((inCall || videochatActive) && roomName) {
                await verificarSaldo();
      } else {
              }
    }, 10000);
    
    // Guardar referencia para limpiar
    window.balanceMonitorInterval = interval;
    
  }, [isMonitoring, verificarSaldo]);

  const stopMonitoring = useCallback(() => {
        setIsMonitoring(false);
    setRemainingMinutes(null);
    
    if (window.balanceMonitorInterval) {
      clearInterval(window.balanceMonitorInterval);
      delete window.balanceMonitorInterval;
    }
  }, []);

  return {
    remainingMinutes,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    verificarSaldoManual: verificarSaldo
  };
};

// 🔥 COMPONENTE DE NOTIFICACIÓN DE SALDO BAJO
const BalanceWarning = ({ remainingMinutes, onClose, className = "" }) => {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (remainingMinutes > 5) {
      setDismissed(false);
    }
  }, [remainingMinutes]);

  if (!remainingMinutes || remainingMinutes > 5 || dismissed) return null;

  const handleClose = () => {
    setDismissed(true);
    if (onClose) onClose();
  };

  return (
    <div className={`fixed bottom-4 left-4 z-[10000] animate-bounce ${className}`}>
      <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-4 rounded-xl shadow-lg border border-red-300 max-w-sm">
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-sm mb-1">{t('balanceMonitor.warnings.limitedTime')}</h4>
            <p className="text-xs leading-relaxed">
              {t('balanceMonitor.warnings.remainingMinutes', { minutes: remainingMinutes })}
            </p>
            {remainingMinutes <= 2 && (
              <p className="text-xs mt-2 font-bold text-yellow-200">
                {t('balanceMonitor.warnings.sessionEndingSoon')}
              </p>
            )}
          </div>
          <button 
            onClick={handleClose}
            className="text-white/80 hover:text-white flex-shrink-0 p-1 hover:bg-white/10 rounded"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

// 🔥 COMPONENTE PRINCIPAL - MONITOR DE SALDO
const BalanceMonitor = ({ 
  isActive = false, 
  showNotification = true,
  className = "",
  onBalanceUpdate = null 
}) => {
  const { 
    remainingMinutes, 
    isMonitoring, 
    startMonitoring, 
    stopMonitoring,
    verificarSaldoManual 
  } = useBalanceMonitor();

  // 🔥 INICIAR/DETENER MONITOREO BASADO EN isActive
  useEffect(() => {
    if (isActive) {
      startMonitoring();
    } else {
      stopMonitoring();
    }

    return () => {
      stopMonitoring();
    };
  }, [isActive, startMonitoring, stopMonitoring]);

  // 🔥 CALLBACK CUANDO CAMBIA EL SALDO
  useEffect(() => {
    if (onBalanceUpdate && remainingMinutes !== null) {
      onBalanceUpdate(remainingMinutes);
    }
  }, [remainingMinutes, onBalanceUpdate]);

  // 🔥 DEBUG: Exponer función manual
  useEffect(() => {
    window.debugBalanceMonitor = verificarSaldoManual;
    window.balanceMonitorState = {
      remainingMinutes,
      isMonitoring,
      isActive
    };

    return () => {
      delete window.debugBalanceMonitor;
      delete window.balanceMonitorState;
    };
  }, [verificarSaldoManual, remainingMinutes, isMonitoring, isActive]);

  return (
    <>
      {/* 🔥 INDICADOR DE ESTADO (OPCIONAL) */}
      {isMonitoring && remainingMinutes !== null && (
        <div className={`fixed top-4 right-4 z-[9998] ${className}`}>
          <div className={`flex items-center gap-2 px-3 py-2 rounded-full text-xs shadow-lg ${
            remainingMinutes <= 2 ? 'bg-red-500/90 text-white' :
            remainingMinutes <= 5 ? 'bg-orange-500/90 text-white' :
            'bg-green-500/90 text-white'
          }`}>
            <Clock size={12} />
            <span className="font-medium">{remainingMinutes} {t('balanceMonitor.minutes')}</span>
          </div>
        </div>
      )}

      {/* 🔥 NOTIFICACIÓN DE SALDO BAJO */}
      {showNotification && (
        <BalanceWarning 
          remainingMinutes={remainingMinutes}
          className={className}
        />
      )}
    </>
  );
};

export default BalanceMonitor;