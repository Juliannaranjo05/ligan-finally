import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Send, 
  Gift, 
  X, 
  Globe
} from 'lucide-react';

// 🔥 Hook para detectar videollamada
export const useVideocallChat = () => {
  const [isInCall, setIsInCall] = useState(false);
  const [callData, setCallData] = useState(null);

  useEffect(() => {
    const checkCallStatus = () => {
      try {
        const inCall = localStorage.getItem('inCall');
        const videochatActive = localStorage.getItem('videochatActive');
        const roomName = localStorage.getItem('roomName');
        const userName = localStorage.getItem('userName');
        
                
        const isInCallBool = inCall === 'true';
        const isVideochatActiveBool = videochatActive === 'true';
        
        if ((isInCallBool || isVideochatActiveBool) && roomName) {
          setIsInCall(true);
          setCallData({
            roomName,
            userName,
            isActive: true
          });
        } else {
          setIsInCall(false);
          setCallData(null);
        }
      } catch (error) {
              }
    };

    checkCallStatus();
    const interval = setInterval(checkCallStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  return { isInCall, callData };
};

// 🔥 Modal de chat que usa tu lógica existente
const MiniChatVideocall = ({ 
  isOpen, 
  onClose, 
  conversaciones = [],
  conversacionActiva,
  setConversacionActiva,
  mensajes = [],
  nuevoMensaje,
  setNuevoMensaje,
  enviarMensaje,
  enviarRegalo,
  renderMensaje,
  formatearTiempo,
  abrirConversacion,
  getDisplayName,
  onlineUsers = new Set(),
  getInitial,
  translationSettings
}) => {
  const mensajesRef = useRef(null);

  // Auto scroll al final
  useEffect(() => {
    if (mensajesRef.current && isOpen) {
      mensajesRef.current.scrollTop = mensajesRef.current.scrollHeight;
    }
  }, [mensajes, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-gradient-to-b from-[#0a0d10] to-[#131418] border border-[#ff007a]/30 rounded-xl shadow-2xl w-full max-w-5xl h-[600px] flex animate-modalIn">
        
        {/* Lista de conversaciones - izquierda */}
        <div className="w-1/3 bg-[#2b2d31] p-4 rounded-l-xl border-r border-[#ff007a]/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">Conversaciones</h3>
            <div className="flex items-center gap-2">
              {translationSettings?.enabled && (
                <div className="flex items-center gap-1 bg-[#ff007a]/20 px-2 py-1 rounded-full">
                  <Globe size={12} className="text-[#ff007a]" />
                  <span className="text-[#ff007a] text-xs">ON</span>
                </div>
              )}
              <button
                onClick={onClose}
                className="text-white/60 hover:text-white p-1 hover:bg-[#3a3d44] rounded"
              >
                <X size={16} />
              </button>
            </div>
          </div>
          
          {/* Lista de conversaciones */}
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {conversaciones.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare size={32} className="text-white/30 mx-auto mb-2" />
                <p className="text-sm text-white/60">No hay conversaciones</p>
              </div>
            ) : (
              conversaciones.map((conv) => {
                const isOnline = onlineUsers.has(conv.other_user_id);
                
                return (
                  <div
                    key={conv.id}
                    onClick={() => abrirConversacion(conv)}
                    className={`p-3 hover:bg-[#3a3d44] rounded-lg cursor-pointer transition-colors border ${
                      conversacionActiva === conv.room_name 
                        ? 'bg-[#ff007a]/20 border-[#ff007a]' 
                        : 'border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-8 h-8 bg-gradient-to-br from-[#ff007a] to-[#cc0062] rounded-full flex items-center justify-center text-white font-bold text-xs">
                          {getInitial(conv.other_user_name)}
                        </div>
                        <div className={`absolute -bottom-1 -right-1 w-2 h-2 rounded-full border border-[#2b2d31] ${
                          isOnline ? 'bg-green-500' : 'bg-gray-500'
                        }`} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate text-white">
                          {getDisplayName(conv.other_user_id, conv.other_user_name)}
                        </p>
                        <div className="text-xs text-white/60 truncate">
                          {conv.last_message}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Chat activo - derecha */}
        <div className="w-2/3 flex flex-col">
          {!conversacionActiva ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare size={48} className="text-white/30 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2 text-white">Selecciona una conversación</h3>
                <p className="text-white/60">Elige una conversación para chatear durante tu videollamada</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header del chat activo */}
              <div className="bg-[#2b2d31] px-4 py-3 border-b border-[#ff007a]/20 rounded-tr-xl">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <h3 className="font-semibold text-white">
                    Chat con {getDisplayName(
                      conversaciones.find(c => c.room_name === conversacionActiva)?.other_user_id,
                      conversaciones.find(c => c.room_name === conversacionActiva)?.other_user_name
                    )}
                  </h3>
                </div>
              </div>

              {/* Mensajes */}
              <div 
                ref={mensajesRef}
                className="flex-1 overflow-y-auto p-4 space-y-3"
                style={{ scrollbarWidth: 'thin', scrollbarColor: '#ff007a #2b2d31' }}
              >
                {mensajes.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-white/60">No hay mensajes aún</p>
                  </div>
                ) : (
                  mensajes.map((mensaje) => {
                    const esUsuarioActual = mensaje.user_id === JSON.parse(localStorage.getItem('user') || '{}').id;
                    
                    return (
                      <div key={mensaje.id} className={`flex ${esUsuarioActual ? "justify-end" : "justify-start"}`}>
                        <div className="max-w-[75%]">
                          <div
                            className={`px-4 py-3 rounded-2xl text-sm ${
                              esUsuarioActual
                                ? "bg-[#ff007a] text-white rounded-br-md shadow-lg"
                                : mensaje.type === 'gift' 
                                  ? "bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-bl-md shadow-lg"
                                  : "bg-[#2b2d31] text-white/80 rounded-bl-md shadow-lg"
                            }`}
                          >
                            {renderMensaje(mensaje)}
                            <div className="text-xs opacity-70 mt-1">
                              {formatearTiempo(mensaje.created_at)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Regalos rápidos */}
              <div className="px-4 py-2 border-t border-[#ff007a]/10">
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => enviarRegalo('🌹 Rosa')}
                    className="px-3 py-2 bg-gradient-to-r from-pink-500 to-red-500 rounded-full text-sm hover:scale-105 transition-transform"
                  >
                    🌹 Rosa
                  </button>
                  <button
                    onClick={() => enviarRegalo('💎 Diamante')}
                    className="px-3 py-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full text-sm hover:scale-105 transition-transform"
                  >
                    💎 Diamante
                  </button>
                  <button
                    onClick={() => enviarRegalo('👑 Corona')}
                    className="px-3 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full text-sm hover:scale-105 transition-transform"
                  >
                    👑 Corona
                  </button>
                </div>
              </div>

              {/* Input mensaje */}
              <div className="p-4 border-t border-[#ff007a]/20 rounded-br-xl">
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="Escribe un mensaje..."
                    className="flex-1 px-4 py-3 rounded-full bg-[#1a1c20] text-white placeholder-white/60 outline-none focus:ring-2 focus:ring-[#ff007a]/50"
                    value={nuevoMensaje}
                    onChange={(e) => setNuevoMensaje(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && enviarMensaje()}
                  />
                  <button
                    onClick={enviarMensaje}
                    disabled={!nuevoMensaje.trim()}
                    className={`px-4 py-3 rounded-full transition-colors flex items-center gap-2 ${
                      !nuevoMensaje.trim()
                        ? 'bg-gray-600 cursor-not-allowed text-gray-400'
                        : 'bg-[#ff007a] hover:bg-[#e6006e] text-white'
                    }`}
                  >
                    <Send size={16} />
                    Enviar
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Estilos */}
      <style jsx>{`
        @keyframes modalIn {
          from { 
            opacity: 0; 
            transform: scale(0.95) translateY(-20px); 
          }
          to { 
            opacity: 1; 
            transform: scale(1) translateY(0); 
          }
        }
        
        .animate-modalIn {
          animation: modalIn 0.3s ease-out;
        }
        
        div::-webkit-scrollbar {
          width: 6px;
        }
        div::-webkit-scrollbar-track {
          background: #2b2d31;
          border-radius: 3px;
        }
        div::-webkit-scrollbar-thumb {
          background: #ff007a;
          border-radius: 3px;
        }
      `}</style>
    </div>
  );
};

export default MiniChatVideocall;