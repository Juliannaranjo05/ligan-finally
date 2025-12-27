import React, { useState, useEffect } from 'react';
import { Link2, Copy, Check, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function ProfileLinkButton() {
  const { t } = useTranslation();
  const [profileLink, setProfileLink] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      'X-Requested-With': 'XMLHttpRequest'
    };
  };

  const fetchProfileLink = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/profile/link`, {
        method: 'GET',
        headers: getAuthHeaders()
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setProfileLink(data.profile_link);
      } else {
        setError(data.error || 'Error al obtener el link del perfil');
      }
    } catch (err) {
      setError('Error de conexión');
      console.error('Error obteniendo link:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileLink();
  }, []);

  const copyToClipboard = async () => {
    if (!profileLink) return;

    try {
      await navigator.clipboard.writeText(profileLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback para navegadores antiguos
      const textArea = document.createElement('textarea');
      textArea.value = profileLink;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (e) {
        setError('No se pudo copiar el link');
      }
      document.body.removeChild(textArea);
    }
  };

  if (error && !profileLink) {
    return (
      <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
        <AlertCircle size={18} className="text-red-500" />
        <span className="text-sm text-red-400">{error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        onClick={copyToClipboard}
        disabled={loading || !profileLink}
        className="w-full flex items-center gap-3 bg-[#131418] hover:bg-[#1c1f25] transition px-4 py-3 rounded-lg text-left border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="text-[#ff007a]">
          {loading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#ff007a]"></div>
          ) : copied ? (
            <Check size={18} className="text-green-500" />
          ) : (
            <Link2 size={18} />
          )}
        </span>
        <div className="flex-1">
          <span className="text-sm font-medium">
            {copied 
              ? (t('profileLink.copied') || '¡Link copiado!') 
              : (t('profileLink.copyLink') || 'Copiar link de mi perfil')
            }
          </span>
          {profileLink && (
            <p className="text-xs text-gray-400 mt-1 truncate">
              {profileLink}
            </p>
          )}
        </div>
        {!loading && profileLink && !copied && (
          <Copy size={16} className="text-gray-400" />
        )}
      </button>
      
      {profileLink && (
        <p className="text-xs text-gray-500 px-1">
          {t('profileLink.description') || 'Comparte este link para que los usuarios puedan chatear contigo directamente'}
        </p>
      )}
    </div>
  );
}



