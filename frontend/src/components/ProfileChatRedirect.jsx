import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getUser } from '../utils/auth';

export default function ProfileChatRedirect() {
  const { slug } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const redirectToChat = async () => {
      try {
        // Verificar si el usuario está autenticado
        const user = await getUser(false);
        
        // Si no está autenticado, redirigir a /home
        if (!user) {
          console.log('🔒 Usuario no autenticado, redirigiendo a /home');
          navigate('/home', { replace: true });
          return;
        }

        console.log('👤 Usuario autenticado:', { id: user.id, rol: user.rol });

        // Solo clientes pueden usar este link
        if (user.rol !== 'cliente') {
          console.log('❌ Usuario no es cliente, redirigiendo a /home');
          navigate('/home', { replace: true });
          return;
        }

        // Obtener el ID del modelo desde el backend usando el slug
        try {
          const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
          const token = localStorage.getItem("token");
          
          console.log('🔍 Obteniendo información del modelo con slug:', slug);
          
          const response = await fetch(`${API_BASE_URL}/api/model/by-slug/${slug}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            const data = await response.json();
            console.log('✅ Respuesta del backend:', data);
            
            if (data.success && data.model_id) {
              // Redirigir directamente al chat con el ID del modelo
              console.log('✅ Redirigiendo al chat con modelo ID:', data.model_id);
              navigate(`/mensajes?modelo=${data.model_id}`, { replace: true });
              return;
            } else {
              console.error('❌ No se pudo obtener el ID del modelo:', data);
            }
          } else {
            const errorData = await response.json().catch(() => ({}));
            console.error('❌ Error en la respuesta del backend:', response.status, errorData);
          }
        } catch (err) {
          console.error('❌ Error obteniendo modelo:', err);
        }

        // Fallback: si algo falla, redirigir a /home
        console.log('⚠️ Fallback: redirigiendo a /home');
        navigate('/home', { replace: true });
      } catch (error) {
        console.error('❌ Error en redirección:', error);
        navigate('/home', { replace: true });
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

