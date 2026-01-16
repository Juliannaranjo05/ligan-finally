import React, { useEffect, useState, memo } from 'react';
import { Lightbulb } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * ProfessionalTip - Componente para mostrar consejos profesionales aleatorios para modelos
 * Muestra un consejo diferente cada vez que se recarga la página
 */
const ProfessionalTip = ({ className = '' }) => {
  const { t } = useTranslation();
  const [selectedTip, setSelectedTip] = useState('');

  // Lista de 40 consejos profesionales para modelos
  const tips = [
    'Mantén tu perfil actualizado y responde rápidamente a los mensajes para aumentar tus oportunidades',
    'La autenticidad y el respeto son la base de conexiones duraderas con tus clientes',
    'Cada conversación es una oportunidad de crear una experiencia memorable',
    'La confianza se construye con pequeños gestos de atención y profesionalismo',
    'Invierte tiempo en conocer a tus clientes, cada uno tiene una historia única',
    'La puntualidad y la preparación muestran tu compromiso con la excelencia',
    'Cada llamada es una nueva oportunidad de brillar y destacar',
    'La comunicación clara y honesta crea relaciones más sólidas',
    'Mantén un ambiente profesional pero cálido en todas tus interacciones',
    'Tu actitud positiva puede transformar completamente la experiencia de un cliente',
    'La escucha activa es tan importante como hablar, presta atención a los detalles',
    'Cada cliente busca algo diferente, adapta tu enfoque según sus necesidades',
    'La consistencia en tu servicio construye una reputación sólida',
    'Invierte en tu bienestar personal, eso se refleja en tu trabajo',
    'Las pequeñas atenciones marcan la diferencia entre una buena y una excelente experiencia',
    'Mantén límites claros y respétalos, eso te ayuda a mantener el equilibrio',
    'Cada interacción es una oportunidad de aprender y crecer profesionalmente',
    'La confianza se gana con el tiempo, sé paciente y constante',
    'Tu energía y entusiasmo son contagiosos, úsalos para crear conexiones positivas',
    'La preparación previa te ayuda a estar más presente durante las llamadas',
    'Cada cliente merece tu atención completa, dales el mejor de ti',
    'La flexibilidad y adaptabilidad son habilidades valiosas en este trabajo',
    'Mantén un espacio de trabajo cómodo y profesional para tus videollamadas',
    'La honestidad sobre tus límites y disponibilidad genera más respeto',
    'Cada día es una nueva oportunidad de mejorar y superarte',
    'La paciencia y comprensión crean un ambiente seguro para tus clientes',
    'Tu presencia y atención son regalos valiosos, compártelos con generosidad',
    'La comunicación proactiva muestra tu profesionalismo y consideración',
    'Cada llamada es única, trata cada una como especial',
    'Mantén un equilibrio entre ser profesional y ser auténticamente tú',
    'La gratitud y el reconocimiento fortalecen las relaciones con tus clientes',
    'Tu bienestar emocional es fundamental para ofrecer el mejor servicio',
    'Cada cliente que conecta contigo es una oportunidad de hacer la diferencia',
    'La preparación mental es tan importante como la técnica',
    'Mantén tu espacio de trabajo organizado, eso refleja tu profesionalismo',
    'La empatía te ayuda a entender mejor las necesidades de tus clientes',
    'Cada interacción es una oportunidad de crear una conexión significativa',
    'La consistencia en tu presencia y disponibilidad genera confianza',
    'Tu actitud profesional y positiva es tu mejor herramienta de marketing',
    'Recuerda que cada cliente es una persona única con sus propias necesidades'
  ];

  // Seleccionar un consejo aleatorio al montar el componente
  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * tips.length);
    setSelectedTip(tips[randomIndex]);
  }, []); // Solo se ejecuta una vez al montar

  return (
    <div className={`w-full bg-gradient-to-br from-[#2b2d31] to-[#1f2125] border border-[#ff007a]/30 rounded-xl p-4 sm:p-5 lg:p-4 text-center transition-all duration-500 flex-shrink-0 shadow-lg ${className}`}>
      <div className="flex items-center justify-center gap-2 sm:gap-2.5 mb-2 sm:mb-2.5">
        <Lightbulb className="w-4 h-4 sm:w-5 sm:h-5 lg:w-4 lg:sm:w-5 text-[#ff007a]" />
        <p className="text-white text-xs sm:text-sm lg:text-xs lg:sm:text-sm font-semibold">
          {t("client.restrictions.professionalTip")?.replace(/🌟\s*/g, '').trim() || "Consejo Profesional"}
        </p>
      </div>
      {selectedTip ? (
        <p className="text-white/80 text-xs sm:text-sm lg:text-xs lg:sm:text-sm italic leading-relaxed animate-fadeIn px-2">
          {selectedTip}
        </p>
      ) : (
        <p className="text-white/60 text-xs sm:text-sm lg:text-xs lg:sm:text-sm italic leading-relaxed">
          Cargando consejo...
        </p>
      )}
    </div>
  );
};

export default memo(ProfessionalTip);
