import React, { useState } from 'react';
import { MapPin, Check, X, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const COUNTRIES = [
  // Países con EUR
  { code: 'ES', name: 'España', currency: 'EUR', pricePerHour: 33, flag: '🇪🇸' },
  { code: 'FR', name: 'Francia', currency: 'EUR', pricePerHour: 33, flag: '🇫🇷' },
  { code: 'DE', name: 'Alemania', currency: 'EUR', pricePerHour: 33, flag: '🇩🇪' },
  { code: 'IT', name: 'Italia', currency: 'EUR', pricePerHour: 33, flag: '🇮🇹' },
  { code: 'PT', name: 'Portugal', currency: 'EUR', pricePerHour: 33, flag: '🇵🇹' },
  { code: 'NL', name: 'Países Bajos', currency: 'EUR', pricePerHour: 33, flag: '🇳🇱' },
  { code: 'BE', name: 'Bélgica', currency: 'EUR', pricePerHour: 33, flag: '🇧🇪' },
  { code: 'AT', name: 'Austria', currency: 'EUR', pricePerHour: 33, flag: '🇦🇹' },
  { code: 'CH', name: 'Suiza', currency: 'EUR', pricePerHour: 33, flag: '🇨🇭' },
  { code: 'IE', name: 'Irlanda', currency: 'EUR', pricePerHour: 33, flag: '🇮🇪' },
  { code: 'GR', name: 'Grecia', currency: 'EUR', pricePerHour: 33, flag: '🇬🇷' },
  { code: 'FI', name: 'Finlandia', currency: 'EUR', pricePerHour: 33, flag: '🇫🇮' },
  { code: 'SE', name: 'Suecia', currency: 'EUR', pricePerHour: 33, flag: '🇸🇪' },
  { code: 'NO', name: 'Noruega', currency: 'EUR', pricePerHour: 33, flag: '🇳🇴' },
  { code: 'DK', name: 'Dinamarca', currency: 'EUR', pricePerHour: 33, flag: '🇩🇰' },
  
  // Países con USD
  { code: 'US', name: 'Estados Unidos', currency: 'USD', pricePerHour: 33, flag: '🇺🇸' },
  { code: 'CA', name: 'Canadá', currency: 'USD', pricePerHour: 33, flag: '🇨🇦' },
  { code: 'AU', name: 'Australia', currency: 'USD', pricePerHour: 33, flag: '🇦🇺' },
  { code: 'NZ', name: 'Nueva Zelanda', currency: 'USD', pricePerHour: 33, flag: '🇳🇿' },
  { code: 'GB', name: 'Reino Unido', currency: 'USD', pricePerHour: 33, flag: '🇬🇧' },
  { code: 'SG', name: 'Singapur', currency: 'USD', pricePerHour: 33, flag: '🇸🇬' },
  { code: 'HK', name: 'Hong Kong', currency: 'USD', pricePerHour: 33, flag: '🇭🇰' },
  { code: 'JP', name: 'Japón', currency: 'USD', pricePerHour: 33, flag: '🇯🇵' },
  { code: 'KR', name: 'Corea del Sur', currency: 'USD', pricePerHour: 33, flag: '🇰🇷' },
  
  // Países LATAM y otros (precio $30/hora)
  { code: 'CO', name: 'Colombia', currency: 'COP', pricePerHour: 30, flag: '🇨🇴' },
  { code: 'MX', name: 'México', currency: 'MXN', pricePerHour: 30, flag: '🇲🇽' },
  { code: 'AR', name: 'Argentina', currency: 'ARS', pricePerHour: 30, flag: '🇦🇷' },
  { code: 'CL', name: 'Chile', currency: 'CLP', pricePerHour: 30, flag: '🇨🇱' },
  { code: 'PE', name: 'Perú', currency: 'PEN', pricePerHour: 30, flag: '🇵🇪' },
  { code: 'EC', name: 'Ecuador', currency: 'USD', pricePerHour: 30, flag: '🇪🇨' },
  { code: 'VE', name: 'Venezuela', currency: 'USD', pricePerHour: 30, flag: '🇻🇪' },
  { code: 'BO', name: 'Bolivia', currency: 'BOB', pricePerHour: 30, flag: '🇧🇴' },
  { code: 'PY', name: 'Paraguay', currency: 'PYG', pricePerHour: 30, flag: '🇵🇾' },
  { code: 'UY', name: 'Uruguay', currency: 'UYU', pricePerHour: 30, flag: '🇺🇾' },
  { code: 'CR', name: 'Costa Rica', currency: 'CRC', pricePerHour: 30, flag: '🇨🇷' },
  { code: 'PA', name: 'Panamá', currency: 'USD', pricePerHour: 30, flag: '🇵🇦' },
  { code: 'DO', name: 'República Dominicana', currency: 'DOP', pricePerHour: 30, flag: '🇩🇴' },
  { code: 'GT', name: 'Guatemala', currency: 'GTQ', pricePerHour: 30, flag: '🇬🇹' },
  { code: 'HN', name: 'Honduras', currency: 'HNL', pricePerHour: 30, flag: '🇭🇳' },
  { code: 'SV', name: 'El Salvador', currency: 'USD', pricePerHour: 30, flag: '🇸🇻' },
  { code: 'NI', name: 'Nicaragua', currency: 'NIO', pricePerHour: 30, flag: '🇳🇮' },
  { code: 'BR', name: 'Brasil', currency: 'BRL', pricePerHour: 30, flag: '🇧🇷' },
  { code: 'CU', name: 'Cuba', currency: 'CUP', pricePerHour: 30, flag: '🇨🇺' },
  { code: 'PR', name: 'Puerto Rico', currency: 'USD', pricePerHour: 30, flag: '🇵🇷' },
];

export default function CountrySelector({ onSelect, onClose }) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredCountries = COUNTRIES.filter(country => {
    const matchesSearch = country.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         country.code.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const handleSelect = (country) => {
    // Guardar en localStorage
    localStorage.setItem('selected_country', JSON.stringify({
      code: country.code,
      name: country.name,
      currency: country.currency,
      pricePerHour: country.pricePerHour
    }));
    onSelect(country);
  };

  return (
    <div className="p-4">
      {/* Búsqueda */}
      <div className="relative mb-3">
        <input
          type="text"
          placeholder="Buscar país..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 pl-9 bg-[#2b2d31] border border-gray-600 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#ff007a]/50 text-sm"
        />
        <MapPin className="absolute left-2.5 top-2.5 text-white/50" size={16} />
      </div>

      {/* Lista de países */}
      <div className="max-h-[400px] overflow-y-auto space-y-1.5">
        {filteredCountries.length === 0 ? (
          <div className="text-center py-6 text-white/60 text-sm">
            No se encontraron países
          </div>
        ) : (
          filteredCountries.map((country) => (
            <button
              key={country.code}
              onClick={() => handleSelect(country)}
              className="w-full p-2.5 bg-[#2b2d31] hover:bg-[#3a3d44] rounded-lg border border-gray-600 hover:border-[#ff007a]/50 transition-all text-left group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">{country.flag}</span>
                  <div className="text-white font-medium text-sm">{country.name}</div>
                </div>
                <ArrowRight className="text-white/30 group-hover:text-[#ff007a] transition-colors" size={16} />
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

