import React, { useState, useEffect, memo } from 'react';
import { Lightbulb } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * TipOfTheDay - Componente para mostrar un consejo aleatorio del día
 * Muestra un consejo diferente cada vez que se recarga la página
 */
const TipOfTheDay = ({ className = '' }) => {
  const { t } = useTranslation();
  const [selectedTip, setSelectedTip] = useState('');

  // Lista de 40 consejos motivacionales e inspiradores
  const tips = [
    'Asegúrate de tener buena conexión a internet para una mejor experiencia',
    'Respeta siempre a las modelos durante las videollamadas',
    'Puedes comprar más minutos en cualquier momento desde tu perfil',
    'Las llamadas se cobran por minuto, así que aprovecha cada segundo',
    'Cada conversación es una oportunidad única de conexión auténtica',
    'La confianza se construye con respeto mutuo y comunicación honesta',
    'Déjate sorprender por las historias que cada modelo tiene para compartir',
    'Un momento de conexión puede cambiar completamente tu día',
    'La autenticidad siempre es más atractiva que la perfección',
    'Cada llamada es una nueva oportunidad de conocerte mejor',
    'El respeto y la cortesía abren puertas a experiencias increíbles',
    'A veces, la mejor conversación es la que no tenías planeada',
    'Invierte en momentos que realmente importan y te hacen sentir vivo',
    'La conexión humana es el mejor regalo que puedes darte hoy',
    'Permítete disfrutar del momento presente sin distracciones',
    'Cada modelo tiene algo especial que ofrecer, descúbrelo',
    'La confianza se gana con pequeños gestos de respeto y consideración',
    'No hay mejor inversión que en experiencias que te hacen feliz',
    'Déjate llevar por la conversación y disfruta el viaje',
    'La autenticidad crea conexiones más profundas y significativas',
    'Cada interacción es una oportunidad de aprender algo nuevo',
    'El tiempo que inviertes en ti mismo nunca es tiempo perdido',
    'Las mejores conversaciones surgen cuando eres tú mismo',
    'Permítete explorar y descubrir nuevas formas de conexión',
    'La confianza y el respeto son la base de cualquier relación',
    'Cada momento es único, así que hazlo contar',
    'La conexión humana es lo que realmente importa en la vida',
    'Déjate sorprender por la magia de una conversación auténtica',
    'Invierte en experiencias que te hagan sentir vivo y presente',
    'El respeto mutuo crea el ambiente perfecto para la conexión',
    'Cada llamada es una nueva aventura esperando ser descubierta',
    'La autenticidad atrae autenticidad, sé tú mismo',
    'Permítete disfrutar sin juicios, este es tu momento',
    'Las mejores conexiones surgen cuando dejas de intentar impresionar',
    'Cada modelo tiene una historia única, tómate el tiempo de escucharla',
    'La confianza se construye con pequeños momentos de honestidad',
    'Déjate llevar por la emoción del momento presente',
    'Invierte en ti mismo, mereces experiencias que te hagan feliz',
    'La conexión real va más allá de las palabras, se siente',
    'El respeto es la clave que abre todas las puertas'
  ];

  // Seleccionar un consejo aleatorio al montar el componente
  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * tips.length);
    setSelectedTip(tips[randomIndex]);
  }, []); // Solo se ejecuta una vez al montar

  return (
    <div className={`w-full bg-gradient-to-br from-[#2b2d31] to-[#1f2125] border border-[#ff007a]/30 rounded-xl p-3 sm:p-4 lg:p-2 text-center transition-all duration-500 ${className}`}>
      <div className="flex items-center justify-center gap-2 mb-2 sm:mb-2.5 lg:mb-1.5">
        <Lightbulb className="w-4 h-4 sm:w-5 sm:h-5 lg:w-3.5 text-[#ff007a]" />
        <p className="text-white text-xs sm:text-sm lg:text-[10px] font-semibold">
          {t('clientInterface.tipOfTheDay')?.replace(/💡\s*/g, '').trim() || 'Consejo del día'}
        </p>
      </div>
      {selectedTip ? (
        <p className="text-white/80 text-xs sm:text-sm lg:text-[10px] italic leading-relaxed animate-fadeIn px-1 line-clamp-2">
          {selectedTip}
        </p>
      ) : (
        <p className="text-white/60 text-xs sm:text-sm lg:text-[10px] italic leading-relaxed">
          Cargando consejo...
        </p>
      )}
    </div>
  );
};

export default memo(TipOfTheDay);
