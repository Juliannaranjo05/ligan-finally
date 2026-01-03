import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getUser } from '../utils/auth';

export default function ProfileChatRedirect() {
  const { slug } = useParams();
  const navigate = useNavigate();


  useEffect(() => {
    const redirectToChat = async () => {
      let logSteps = [];
      try {
        // Establecer flag para suspender polling/heartbeats temporales y evitar race conditions
        try { localStorage.setItem('suspendBackgroundTasks', 'true'); logSteps.push('Set suspendBackgroundTasks'); } catch (e) { logSteps.push('Error set suspendBackgroundTasks'); }
        // Comunicar la suspensión a otras pestañas inmediatamente vía BroadcastChannel para minimizar races
        try {
          const bc = new BroadcastChannel('ligando_bg');
          bc.postMessage({ type: 'suspendBackgroundTasks', value: true });
          bc.close();
          logSteps.push('BroadcastChannel suspendBackgroundTasks');
        } catch (e) { logSteps.push('BroadcastChannel not supported'); }

        // Obtener el ID del modelo desde el backend usando el slug (esto puede hacerse sin token)
        try {
          const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
          logSteps.push(`Obteniendo modelo slug: ${slug}`);
          const response = await fetch(`${API_BASE_URL}/api/public/model/by-slug/${slug}`, {
            headers: {
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            const data = await response.json();
            logSteps.push(`Respuesta backend: success=${data.success}, model_id=${data.model_id}`);
            if (data.success && data.model_id) {
              logSteps.push(`Redirigiendo a /mensajes?modelo=${data.model_id}`);
              await fetch(`${API_BASE_URL}/api/log/frontend`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({logSteps,context:'ProfileChatRedirect',slug})});
              navigate(`/mensajes?modelo=${data.model_id}`, { replace: true });
              return;
            } else {
              logSteps.push(`No se pudo obtener el ID del modelo: ${JSON.stringify(data)}`);
            }
          } else {
            const errorData = await response.json().catch(() => ({}));
            logSteps.push(`Error backend: status=${response.status}, data=${JSON.stringify(errorData)}`);
          }
        } catch (err) {
          logSteps.push(`Error obteniendo modelo: ${(err?.message || 'error')}`);
        }

        // Fallback: si algo falla, redirigir al chat público del slug
        logSteps.push(`Fallback: redirigiendo a /visit/${slug}`);
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
        await fetch(`${API_BASE_URL}/api/log/frontend`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({logSteps,context:'ProfileChatRedirect',slug,token:!!token})});
        navigate(`/visit/${slug}`, { replace: true });
      } catch (err) {
        logSteps.push(`Error en redirección: ${(err?.message || 'error')}`);
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
        await fetch(`${API_BASE_URL}/api/log/frontend`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({logSteps,context:'ProfileChatRedirect',slug})});
        navigate('/home', { replace: true });
      } finally {
        // Limpiar flag de suspensión para que polling/heartbeats puedan reanudar
        try { localStorage.removeItem('suspendBackgroundTasks'); logSteps.push('Removed suspendBackgroundTasks'); } catch (e) { logSteps.push('Error remove suspendBackgroundTasks'); }
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
        await fetch(`${API_BASE_URL}/api/log/frontend`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({logSteps,context:'ProfileChatRedirect',slug})});
      }
    };
    redirectToChat();
  }, [slug, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0d10] to-[#131418] flex items-center justify-center">
      <div className="text-center text-white">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-pink-500 mx-auto mb-4"></div>
        <p>Redirigiendo al chat...</p>
      </div>
    </div>
  );
}

