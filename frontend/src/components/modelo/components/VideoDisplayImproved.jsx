import React from 'react';
import { useParticipants, VideoTrack, useTracks } from "@livekit/components-react";
import { Track } from "livekit-client";
import { Camera, CameraOff, Loader2, Users, Eye } from "lucide-react";

const VideoDisplayImproved = ({ 
  onCameraSwitch, 
  mainCamera, 
  connected, 
  hadRemoteParticipant, 
  otherUser,
  isDetectingUser,
  t 
}) => {
  const participants = useParticipants();
  const localParticipant = participants.find(p => p.isLocal);
  const remoteParticipant = participants.find(p => !p.isLocal);
  
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
  ], { onlySubscribed: false });

  const isRemoteCameraOff = remoteParticipant && tracks.every(
    track => track.participant.sid !== remoteParticipant.sid || 
    !track.publication?.isEnabled ||
    !track.publication?.isSubscribed
  );

  const getMainVideo = () => {
    try {
      // Por defecto mostrar modelo en grande, pero si mainCamera es "remote" mostrar cliente
      if ((mainCamera === "local" || !mainCamera) && localParticipant) {
        const localVideoTrack = tracks.find(
          trackRef => trackRef.participant.sid === localParticipant.sid && 
          trackRef.source === Track.Source.Camera
        );
        
        if (localVideoTrack) {
          return (
            <div className="relative w-full h-full flex items-center justify-center bg-gradient-to-b from-[#0a0d10] to-[#131418]">
              {/* Contenedor responsivo para el video */}
              <div className="relative w-full h-full max-w-4xl max-h-[80vh] flex items-center justify-center">
                <VideoTrack
                  trackRef={localVideoTrack}
                  className="w-full h-full object-contain rounded-2xl"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                  }}
                />
                {/* Overlay sutil para video local */}
                <div className="absolute bottom-4 left-4">
                  <div className="bg-gradient-to-r from-[#0a0d10] to-[#131418] backdrop-blur-sm px-3 py-1 rounded-lg border border-[#ff007a]/30">
                    <span className="text-[#ff007a] text-xs font-medium">Tu cámara</span>
                  </div>
                </div>
              </div>
            </div>
          );
        }
      } else if (mainCamera === "remote" && remoteParticipant) {
        const remoteVideoTrack = tracks.find(
          trackRef => trackRef.participant.sid === remoteParticipant.sid && 
          trackRef.source === Track.Source.Camera
        );
        
        if (remoteVideoTrack && !isRemoteCameraOff) {
          return (
            <div className="relative w-full h-full flex items-center justify-center bg-gradient-to-b from-[#0a0d10] to-[#131418]">
              {/* Contenedor responsivo para el video */}
              <div className="relative w-full h-full max-w-4xl max-h-[80vh] flex items-center justify-center">
                <VideoTrack
                  trackRef={remoteVideoTrack}
                  className="w-full h-full object-contain rounded-2xl"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                  }}
                />
                {/* Overlay para video remoto */}
                <div className="absolute bottom-4 left-4">
                  <div className="bg-gradient-to-r from-[#0a0d10] to-[#131418] backdrop-blur-sm px-3 py-1 rounded-lg border border-green-400/30">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-[#00ff66] rounded-full animate-pulse"></div>
                      <span className="text-[#00ff66] text-xs font-medium">
                        {otherUser?.name || 'Chico'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        }
      }
    } catch (error) {
          }

    // Estados de espera con diseño Ligand para Modelo
    const getConnectionStatus = () => {
      if (remoteParticipant && isRemoteCameraOff) {
        return {
          icon: <CameraOff size={48} className="text-gray-400" />,
          title: 'Cámara del chico apagada',
          subtitle: 'Esperando que active su cámara...',
          bgColor: 'from-amber-500/10 to-orange-500/10',
          borderColor: 'border-amber-400/20'
        };
      }

      if (participants.length === 1 && localParticipant && !remoteParticipant && !hadRemoteParticipant) {
        return {
          icon: <Users size={48} className="text-[#ff007a]" />,
          title: 'Esperando chico',
          subtitle: 'Sala lista para conectar',
          bgColor: 'from-[#ff007a]/10 to-[#ff007a]/5',
          borderColor: 'border-[#ff007a]/20'
        };
      }

      return {
        icon: <Loader2 size={48} className="text-[#ff007a] animate-spin" />,
        title: 'Conectando...',
        subtitle: 'Verificando conexión en tiempo real',
        bgColor: 'from-[#ff007a]/10 to-[#ff007a]/5',
        borderColor: 'border-[#ff007a]/20'
      };
    };

    const status = getConnectionStatus();

    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-[#0a0d10] to-[#131418] relative overflow-hidden rounded-2xl">
        {/* Fondo sutil */}
        <div className="absolute inset-0 opacity-30">
          <div className={`absolute inset-0 bg-gradient-to-br ${status.bgColor}`}></div>
          <div className="absolute top-10 left-10 w-2 h-2 bg-white/10 rounded-full animate-ping"></div>
          <div className="absolute top-20 right-20 w-1 h-1 bg-[#ff007a]/20 rounded-full animate-pulse"></div>
          <div className="absolute bottom-20 left-20 w-1.5 h-1.5 bg-white/15 rounded-full animate-bounce"></div>
        </div>
        
        <div className="text-center max-w-md mx-auto relative z-10 p-8">
          {/* Contenedor del icono */}
          <div className={`
            bg-gradient-to-br ${status.bgColor} backdrop-blur-xl 
            border ${status.borderColor} rounded-2xl p-12 mb-8 
            shadow-2xl relative overflow-hidden
          `}>
            {/* Icono principal */}
            <div className="relative flex justify-center items-center h-full">
              {status.icon}
            </div>
          </div>
          
          {/* Información de estado */}
          <div className="space-y-4">
            <h3 className="text-2xl font-bold text-white leading-tight">
              {status.title}
            </h3>
            <p className="text-gray-300 text-base leading-relaxed">
              {status.subtitle}
            </p>
            
            {/* Estado adicional para detección de usuario */}
            {isDetectingUser && (
              <div className="mt-6">
                <div className="bg-gradient-to-r from-[#0a0d10] to-[#131418] backdrop-blur-lg border border-[#ff007a]/30 rounded-xl p-4">
                  <div className="flex items-center justify-center gap-3">
                    <Loader2 size={18} className="text-[#ff007a] animate-spin" />
                    <span className="text-[#ff007a] text-sm font-medium">
                      Detectando usuario...
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Indicador de progreso */}
          <div className="mt-8">
            <div className="w-16 h-16 mx-auto relative">
              <div className="absolute inset-0 border-4 border-gray-700/50 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-[#ff007a] border-t-transparent rounded-full animate-spin"></div>
            </div>
          </div>
          
          {/* Información adicional */}
          <div className="mt-8 space-y-3">
            {connected && (
              <div className="bg-[#00ff66]/10 backdrop-blur-sm rounded-xl p-3 border border-[#00ff66]/20 hidden md:block">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-2 h-2 bg-[#00ff66] rounded-full animate-pulse"></div>
                  <span className="text-[#00ff66] text-sm font-medium">
                    Conexión establecida
                  </span>
                </div>
              </div>
            )}

            <div className="bg-gradient-to-r from-[#0a0d10] to-[#131418] backdrop-blur-sm rounded-xl p-3 border border-gray-600/20 hidden md:block">
              <div className="flex items-center justify-center gap-2">
                <Eye size={14} className="text-gray-400" />
                <span className="text-gray-300 text-xs">
                  Tu privacidad está protegida
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const getMiniVideo = () => {
    try {
      // Si modelo está en grande (por defecto), mostrar cliente en mini
      if ((mainCamera === "local" || !mainCamera) && remoteParticipant && !isRemoteCameraOff) {
        const remoteVideoTrack = tracks.find(
          trackRef => trackRef.participant.sid === remoteParticipant.sid && 
          trackRef.source === Track.Source.Camera
        );
        
        if (remoteVideoTrack) {
          return (
            <div className="relative w-full h-full">
              <VideoTrack
                trackRef={remoteVideoTrack}
                className="w-full h-full object-cover rounded-xl"
              />
              {/* Indicador de chico en mini video */}
              <div className="absolute bottom-1 left-1 right-1">
                <div className="bg-gradient-to-r from-[#0a0d10] to-[#131418] backdrop-blur-sm px-2 py-1 rounded-md">
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-[#00ff66] rounded-full animate-pulse"></div>
                    <span className="text-white text-xs font-medium truncate">
                      {otherUser?.name || 'Chico'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        }
      } 
      // Si cliente está en grande, mostrar modelo en mini
      else if (mainCamera === "remote" && localParticipant) {
        const localVideoTrack = tracks.find(
          trackRef => trackRef.participant.sid === localParticipant.sid && 
          trackRef.source === Track.Source.Camera
        );
        
        if (localVideoTrack) {
          return (
            <div className="relative w-full h-full">
              <VideoTrack
                trackRef={localVideoTrack}
                className="w-full h-full object-cover rounded-xl"
              />
              {/* Indicador de modelo en mini video */}
              <div className="absolute bottom-1 left-1 right-1">
                <div className="bg-gradient-to-r from-[#0a0d10] to-[#131418] backdrop-blur-sm px-2 py-1 rounded-md">
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-[#ff007a] rounded-full animate-pulse"></div>
                    <span className="text-white text-xs font-medium truncate">
                      Tu cámara
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        }
      }
    } catch (error) {
          }

    // Estado de mini video sin cámara
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-[#0a0d10] to-[#131418] relative rounded-xl">
        <div className="relative z-10 text-center">
          <CameraOff size={16} className="text-gray-400 mb-1" />
          <div className="text-gray-400 text-xs font-medium">
            {(mainCamera === "local" || !mainCamera) ? "Chico" : "Tu cámara"}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Video principal */}
      <div className="w-full h-full relative rounded-2xl overflow-hidden">
        {getMainVideo()}
      </div>
      
      {/* Mini video con borde fucsia - Tamaños responsivos mejorados */}
      <div 
        className="absolute bottom-4 left-4 
                   w-16 h-20 
                   sm:w-20 sm:h-24 
                   md:w-24 md:h-28 
                   lg:w-28 lg:h-32 
                   xl:w-32 xl:h-36
                   rounded-xl overflow-hidden border-2 border-[#ff007a]/50 shadow-2xl cursor-pointer transition-all duration-300 hover:scale-105 hover:border-[#ff007a] group backdrop-blur-sm"
        onClick={onCameraSwitch}
      >
        {getMiniVideo()}
        
        {/* Overlay de intercambio */}
        <div className="absolute inset-0 bg-[#ff007a]/20 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center rounded-xl">
          <div className="bg-white/20 backdrop-blur-sm rounded-lg p-2">
            <Camera size={14} className="text-white" />
          </div>
        </div>
      </div>
      <style jsx>
        {
        `
        .video-main-container {
          height: clamp(120px, 70vh, 500px);
          /* 
          Mínimo: 120px (móviles)
          Ideal: 40% de la pantalla
          Máximo: 400px (pantallas grandes)
          */
        }
        `
        }
      </style>

    </>
  );
};

export default VideoDisplayImproved;