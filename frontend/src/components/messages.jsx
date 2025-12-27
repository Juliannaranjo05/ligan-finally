import React, { useState, useEffect, useRef } from 'react';
import { getUser } from '../utils/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

class ChatCacheManager {
  constructor() {
    this.participantsCache = new Map();
    this.messagesCache = new Map();
    this.pendingRequests = new Map();
    this.PARTICIPANTS_CACHE_DURATION = 5000;
    this.MESSAGES_CACHE_DURATION = 0;
    this.RATE_LIMIT_BACKOFF = 3000;
  }

  async fetchWithCache(endpoint, cacheMap, cacheDuration, fetchFunction) {
    if (cacheDuration === 0 && endpoint.startsWith('messages_')) {
      try {
        const result = await fetchFunction();
        cacheMap.set(endpoint, { data: result, timestamp: Date.now() });
        return result;
      } catch (err) {
        const cached = cacheMap.get(endpoint);
        if (cached) return cached.data;
        throw err;
      }
    }

    const cached = cacheMap.get(endpoint);
    if (cached && (Date.now() - cached.timestamp) < cacheDuration) return cached.data;

    if (this.pendingRequests.has(endpoint) && !endpoint.startsWith('messages_')) return await this.pendingRequests.get(endpoint);

    const p = this.makeRequestWithRetry(endpoint, fetchFunction);
    if (!endpoint.startsWith('messages_')) this.pendingRequests.set(endpoint, p);
    try {
      const res = await p;
      cacheMap.set(endpoint, { data: res, timestamp: Date.now() });
      return res;
    } finally {
      if (!endpoint.startsWith('messages_')) this.pendingRequests.delete(endpoint);
    }
  }

  async makeRequestWithRetry(endpoint, fetchFunction, retry = 0) {
    try { return await fetchFunction(); } catch (err) {
      if (err?.response?.status === 429 && retry < 2) {
        await new Promise(r => setTimeout(r, this.RATE_LIMIT_BACKOFF * (retry + 1)));
        return this.makeRequestWithRetry(endpoint, fetchFunction, retry + 1);
      }
      throw err;
    }
  }

  invalidateCache(endpoint) { this.participantsCache.delete(endpoint); this.messagesCache.delete(endpoint); }
  clearCache() { this.participantsCache.clear(); this.messagesCache.clear(); this.pendingRequests.clear(); }
}

const chatCache = new ChatCacheManager();

const SimpleChat = ({ userName, userRole = 'modelo', roomName, onMessageReceived = null, onGiftReceived = null, onUserLoaded = null, onParticipantsUpdated = null, disabled = false, suppressMessages = false }) => {
  const [participants, setParticipants] = useState([]);
  const [otherParticipant, setOtherParticipant] = useState(null);
  const [isDetecting, setIsDetecting] = useState(true);
  const [isConnected, setIsConnected] = useState(false);

  const persistedUser = useRef(null);
  const lastMessageId = useRef(null);
  const pollingInterval = useRef(null);
  const participantsInterval = useRef(null);
  const processedMessages = useRef(new Set());
  const [localUserName, setLocalUserName] = useState(userName || '');
  const [localUserRole, setLocalUserRole] = useState(userRole || '');
  const partnerLoaded = useRef(false);
  const detectionMethod = useRef(null);
  const isFetchingMessages = useRef(false);

  const fetchParticipants = async () => {
    if (!roomName) return;
    const endpoint = `participants_${roomName}`;
    try {
      const result = await chatCache.fetchWithCache(endpoint, chatCache.participantsCache, chatCache.PARTICIPANTS_CACHE_DURATION, async () => {
        const token = localStorage.getItem('token'); if (!token) throw new Error('No token');
        const res = await fetch(`${API_BASE_URL}/api/chat/participants/${roomName}`, { method: 'GET', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      });

      if (result?.success && result.participants) {
        setParticipants(result.participants);
        const other = result.participants.find(p => !p.is_current_user);
        if (other) detectOtherUser({ name: other.name, role: other.role, id: other.id }, 'participants');
        if (onParticipantsUpdated) onParticipantsUpdated(result.participants);
      }
    } catch (err) {
      if (err.message?.includes('500')) { if (participantsInterval.current) { clearInterval(participantsInterval.current); participantsInterval.current = null; } }
    }
  };

  const fetchMessages = async () => {
    if (isFetchingMessages.current) return; if (disabled || suppressMessages) return; if (!roomName) return;
    isFetchingMessages.current = true;
    const endpoint = `messages_${roomName}`;
    try {
      const result = await chatCache.fetchWithCache(endpoint, chatCache.messagesCache, chatCache.MESSAGES_CACHE_DURATION, async () => {
        const token = localStorage.getItem('token'); if (!token) throw new Error('No token');
        const url = `${API_BASE_URL}/api/chat/messages/${roomName}`;
        const res = await fetch(url, { method: 'GET', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      });

      if (result?.success && result.messages) {
        if (!partnerLoaded.current || detectionMethod.current === null) {
          const otherUserMessage = result.messages.find(m => m.user_name !== userName && m.user_name !== localUserName);
          if (otherUserMessage) detectUserFromMessage(otherUserMessage);
        }

        const newMessages = result.messages.filter(msg => {
          const isNotMine = msg.user_name !== userName && msg.user_name !== localUserName;
          const isNotProcessed = !processedMessages.current.has(msg.id);
          if (!isNotMine) return false; if (!isNotProcessed) return false;
          if (!lastMessageId.current || msg.id > lastMessageId.current) lastMessageId.current = Math.max(lastMessageId.current || 0, msg.id);
          return true;
        });

        newMessages.forEach(msg => { processedMessages.current.add(msg.id); lastMessageId.current = Math.max(lastMessageId.current || 0, msg.id); detectUserFromMessage(msg); if (onMessageReceived) onMessageReceived(msg); });
        setIsConnected(true);
      }
    } catch (err) { setIsConnected(false); }
    finally { isFetchingMessages.current = false; }
  };

  const detectOtherUser = (user, method) => {
    if (persistedUser.current && persistedUser.current.name === user.name) { setOtherParticipant(persistedUser.current); setIsDetecting(false); return true; }
    if (partnerLoaded.current && detectionMethod.current === 'participants' && method === 'messages') return false;
    if (!partnerLoaded.current || method === 'participants') { persistedUser.current = user; setOtherParticipant(user); setIsDetecting(false); detectionMethod.current = method; if (onUserLoaded) { onUserLoaded(user); partnerLoaded.current = true; } return true; }
    return false;
  };

  const detectUserFromMessage = (msg) => {
    if (detectionMethod.current === 'participants') return false;
    const currentUserName = userName || localUserName;
    if (msg.user_name !== currentUserName && msg.user_name !== localUserName && msg.user_name !== userName) return detectOtherUser({ name: msg.user_name, role: msg.user_role, id: msg.user_id }, 'messages');
    return false;
  };

  const sendMessage = async (messageText) => {
    if (!messageText?.trim() || !roomName) return false; const token = localStorage.getItem('token'); if (!token) return false;
    const base = API_BASE_URL || (window?.location ? `${window.location.origin}` : '');
    const payload = { room_name: roomName, message: messageText.trim(), type: 'text' };
    const doFetch = async (url) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(payload) });
    try { let response; try { response = await doFetch(`${base}/api/chat/send-message`); } catch (e) { try { response = await doFetch('/api/chat/send-message'); } catch (e2) { console.error('sendMessage failed', e2); return false; } } if (response && (response.ok || (response.status >= 200 && response.status < 300))) { chatCache.invalidateCache(`messages_${roomName}`); setTimeout(fetchMessages, 300); return true; } let errorMessage = `HTTP ${response?.status || 'unknown'}`; try { const txt = await response.text(); try { const parsed = JSON.parse(txt); errorMessage = parsed.message || parsed.error || txt; } catch { errorMessage = txt || errorMessage; } } catch (_) {} console.error('sendMessage failed', { status: response?.status, statusText: response?.statusText, roomName, errorMessage }); return false; } catch (err) { console.error('sendMessage unexpected', err); return false; } };

  const sendGift = async (gift) => {
    if (!gift || !roomName) return false; const token = localStorage.getItem('token'); if (!token) return false;
    const base = API_BASE_URL || (window?.location ? `${window.location.origin}` : '');
    const payload = { room_name: roomName, message: `Envió ${gift.nombre}`, type: 'gift', extra_data: gift };
    const doFetch = async (url) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(payload) });
    try { let response; try { response = await doFetch(`${base}/api/chat/send-message`); } catch (e) { response = await doFetch('/api/chat/send-message'); } if (response && response.ok) { chatCache.invalidateCache(`messages_${roomName}`); fetchMessages(); return true; } try { const txt = await response.text(); console.warn('sendGift failed', response?.status, txt); } catch (e) { console.warn('sendGift failed', response?.status); } return false; } catch (err) { return false; } };

  const sendEmoji = async (emoji) => {
    if (!emoji || !roomName) return false; const token = localStorage.getItem('token'); if (!token) return false;
    const base = API_BASE_URL || (window?.location ? `${window.location.origin}` : '');
    const payload = { room_name: roomName, message: emoji, type: 'emoji' };
    const doFetch = async (url) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(payload) });
    try { let response; try { response = await doFetch(`${base}/api/chat/send-message`); } catch (e) { response = await doFetch('/api/chat/send-message'); } if (response && response.ok) { chatCache.invalidateCache(`messages_${roomName}`); fetchMessages(); return true; } try { const txt = await response.text(); console.warn('sendEmoji failed', response?.status, txt); } catch (e) { console.warn('sendEmoji failed', response?.status); } return false; } catch (err) { return false; } };

  useEffect(() => {
    if (!roomName) return; fetchParticipants(); fetchMessages(); pollingInterval.current = setInterval(fetchMessages, 3000); participantsInterval.current = setInterval(fetchParticipants, 6000);
    return () => { if (pollingInterval.current) clearInterval(pollingInterval.current); if (participantsInterval.current) clearInterval(participantsInterval.current); const currentRoom = localStorage.getItem('roomName'); if (currentRoom !== roomName) { chatCache.clearCache(); persistedUser.current = null; } };
  }, [roomName, userName]);

  useEffect(() => {
    const chatFunctionsData = { sendMessage, sendGift, sendEmoji, isConnected: isConnected && !!roomName, participants, otherParticipant, isDetecting, getOtherParticipant: () => otherParticipant, getAllParticipants: () => participants, getParticipantsByRole: (r) => participants.filter(p => p.role === r), refreshParticipants: fetchParticipants, forceRefreshMessages: () => { chatCache.invalidateCache(`messages_${roomName}`); fetchMessages(); } };
    if (window.livekitChatFunctions) { if (typeof window.livekitChatFunctions === 'function') window.livekitChatFunctions(chatFunctionsData); else window.livekitChatFunctions = chatFunctionsData; } else { window.livekitChatFunctions = (cb) => { if (typeof cb === 'function') cb(chatFunctionsData); }; setTimeout(() => { if (window.livekitChatFunctions && typeof window.livekitChatFunctions === 'function') window.livekitChatFunctions(chatFunctionsData); }, 1000); }
  }, [roomName, isConnected, participants, otherParticipant, sendMessage, sendGift, sendEmoji]);

  useEffect(() => { const cleanup = setInterval(() => { processedMessages.current.clear(); }, 3 * 60 * 1000); return () => clearInterval(cleanup); }, []);

  useEffect(() => { const fetchProfile = async () => { try { const user = await getUser(false); const name = user.alias || user.name || user.username || ''; const role = user.rol || user.role || 'modelo'; setLocalUserName(name); setLocalUserRole(role); if (onUserLoaded) onUserLoaded({ name, role, id: user.id }); } catch (err) { setLocalUserName(userName || 'Usuario'); setLocalUserRole(userRole || 'modelo'); } }; fetchProfile(); }, []);

  return null;
};

export default SimpleChat;