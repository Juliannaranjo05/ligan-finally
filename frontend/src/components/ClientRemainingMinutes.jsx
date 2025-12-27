import React, { useState, useEffect, useRef } from 'react';
import { Coins } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const ClientRemainingMinutes = ({ roomName, clientUserId, connected }) => {
  const [remainingMinutes, setRemainingMinutes] = useState(null);
  const [balanceStatus, setBalanceStatus] = useState('normal');
  const intervalRef = useRef(null);

  const fetchRemainingTime = async () => {
    try {
      if (!roomName || !clientUserId || !connected) return;
      
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/api/client-balance/get`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          room_name: roomName,
          client_user_id: clientUserId
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setRemainingMinutes(data.client_balance.remaining_minutes);
          setBalanceStatus(data.client_balance.balance_status);
        }
      }
    } catch (err) {
    }
  };

  useEffect(() => {
    if (!connected || !clientUserId || !roomName) return;

    // Cargar inmediatamente
    fetchRemainingTime();

    // Actualizar cada 15 segundos
    intervalRef.current = setInterval(fetchRemainingTime, 15000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [connected, clientUserId, roomName]);

  // No mostrar nada si no hay datos
  if (remainingMinutes === null || !connected) return null;

  // Determinar color según el estado
  const getColor = () => {
    switch (balanceStatus) {
      case 'critical': return 'text-red-400';
      case 'warning': return 'text-orange-400'; 
      case 'low': return 'text-yellow-400';
      default: return 'text-green-400';
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Coins size={14} className={getColor()} />
      <span>Chico: </span>
      <span className={`font-bold ${getColor()}`}>
        {remainingMinutes}min
      </span>
      {balanceStatus === 'critical' && (
        <span className="text-red-400 animate-pulse">⚠️</span>
      )}
    </div>
  );
};

export default ClientRemainingMinutes;