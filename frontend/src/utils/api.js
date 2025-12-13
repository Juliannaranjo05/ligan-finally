const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const apiCall = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');
  
  const config = {
    method: 'GET',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      ...options.headers
    }
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    
    // 🔥 NO MANEJAR RATE LIMITS - Backend ya no los tiene
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`❌ API Error ${endpoint}:`, error);
    throw error;
  }
};

// Funciones específicas para videochat:
export const notifyPartnerNext = (roomName) => {
  // 🔥 FIRE-AND-FORGET
  fetch(`${API_BASE_URL}/api/livekit/notify-partner-next`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
    },
    body: JSON.stringify({ roomName })
  }).catch(() => {});
};

export const notifyPartnerStop = (roomName) => {
  // 🔥 FIRE-AND-FORGET
  fetch(`${API_BASE_URL}/api/livekit/notify-partner-stop`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
    },
    body: JSON.stringify({ roomName })
  }).catch(() => {});
};

export const sendHeartbeat = (activityType, room = null) => {
  // 🔥 FIRE-AND-FORGET
  const token = localStorage.getItem('token');
  if (!token) return;
  
  fetch(`${API_BASE_URL}/api/heartbeat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      activity_type: activityType,
      room
    })
  }).catch(() => {});
};