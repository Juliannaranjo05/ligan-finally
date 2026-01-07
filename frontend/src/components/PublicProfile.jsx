import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function PublicProfile() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [model, setModel] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchModel = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`${API_BASE_URL}/api/public/model/by-slug/${slug}`, {
          headers: { 'Content-Type': 'application/json' }
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(`Status ${res.status} - ${data.message || JSON.stringify(data)}`);
        }

        const data = await res.json();
        if (data.success && data.model_id) {
          setModel(data);
        } else {
          throw new Error('Modelo no encontrada');
        }
      } catch (err) {
        setError(err.message || 'Error obteniendo perfil');
      } finally {
        setLoading(false);
      }
    };

    fetchModel();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p>Cargando perfil...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white p-4">
        <div className="text-center">
          <p className="mb-4">No se pudo cargar el perfil: {error}</p>
          <button className="btn btn-primary" onClick={() => navigate('/home')}>Volver al inicio</button>
        </div>
      </div>
    );
  }

  const handleEnter = () => {
    // Si el usuario está autenticado y es cliente, lo enviamos a /mensajes
    const token = localStorage.getItem('token');
    if (token) {
      // Navegar a mensajes con modelo
      navigate(`/mensajes?modelo=${model.model_id}`);
    } else {
      // Llevar al usuario a login e indicar redirección
      navigate(`/login?next=/mensajes?modelo=${model.model_id}`);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white p-6">
      <div className="max-w-xl w-full bg-[#131418] rounded-lg p-6 border border-white/5">
        <h3 className="text-xl font-semibold mb-2">{model.model_name || 'Modelo'}</h3>
        <p className="text-sm text-gray-400 mb-4">Visita pública del perfil.</p>

        {/* Información mínima */}
        <div className="space-y-3">
          <div className="text-sm text-gray-300">Estado: {model.is_active ? 'Activa' : 'Offline'}</div>
          <div className="text-sm text-gray-300">ID: {model.model_id}</div>
        </div>

        <div className="mt-6 flex gap-3">
          <button className="btn btn-primary" onClick={handleEnter}>Iniciar chat / Entrar</button>
          <button className="btn btn-secondary" onClick={() => navigate('/home')}>Volver</button>
        </div>
      </div>
    </div>
  );
}
