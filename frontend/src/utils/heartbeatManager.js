// heartbeatManager.js
const HEARTBEAT_CHANNEL = 'heartbeat-channel';
const MASTER_PING_INTERVAL = 10000; // 10s
const MASTER_TIMEOUT = 15000; // 15s

let isMaster = false;
let lastMasterPing = Date.now();
let heartbeatInterval = null;

const channel = new BroadcastChannel(HEARTBEAT_CHANNEL);

// Función para enviar heartbeat real al servidor
async function sendHeartbeatToServer(activityType, roomName) {
  try {
    const payload = {
      activity_type: activityType,
      current_room: roomName,
    };

    const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/heartbeat`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    return res.ok;
  } catch (err) {
        return false;
  }
}

// Función para convertirse en master
function becomeMaster(activityType, roomName, interval = 25000) {
  if (isMaster) return;
  
  isMaster = true;
  heartbeatInterval = setInterval(() => {
    sendHeartbeatToServer(activityType, roomName);
    channel.postMessage({ type: 'heartbeat-ping', time: Date.now() });
  }, interval);
}

// Listener para mensajes de otras pestañas
channel.onmessage = (event) => {
  const { type, time } = event.data || {};
  if (type === 'heartbeat-ping') {
    lastMasterPing = time;
  }
};

// Monitor para detectar si el master desapareció
setInterval(() => {
  const now = Date.now();
  if (!isMaster && now - lastMasterPing > MASTER_TIMEOUT) {
    becomeMaster(currentActivityType, currentRoomName);
  }
}, 3000);

let currentActivityType = null;
let currentRoomName = null;

export function initHeartbeatSync(activityType, roomName, interval = 25000) {
  currentActivityType = activityType;
  currentRoomName = roomName;

  const now = Date.now();
  if (now - lastMasterPing > MASTER_TIMEOUT) {
    becomeMaster(activityType, roomName, interval);
  }
}
