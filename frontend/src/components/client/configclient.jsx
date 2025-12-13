import React, { useState } from "react";
import Header from "./headercliente";
import {
  Lock,
  LogOut,
  Trash2,
  ShieldCheck,
  Camera,
  X,
  User,
  Globe,
  CreditCard,
  Receipt,
  HelpCircle,
  FileText,
  AlertTriangle,
  Bell,
  Eye,
  Star,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import ProfileSettings from "../ProfileSettings";
import SecuritySettings from "../SecuritySettings";

export default function ClienteConfiguracion() {
  const [modalActivo, setModalActivo] = useState(null);
  const { t } = useTranslation();
  const [userId, setUserId] = useState(1);

  // ✅ Funciones del componente
  const abrirModal = (id) => setModalActivo(id);
  const cerrarModal = () => setModalActivo(null);

  // 🎨 Render principal
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0d10] to-[#131418] text-white p-6">
      <Header />

      <div className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-semibold mb-8 border-b border-[#ff007a] pb-2">
          ⚙️ {t("settings.title")}
        </h1>

        {/* Cuenta y seguridad */}
        <Seccion titulo={t("settings.accountSecurity")}>
          <SecuritySettings t={t} />
        </Seccion>

        {/* Perfil */}
        <Seccion titulo={t("settings.profile")}>
          <ProfileSettings t={t} />
        </Seccion>

        {/* Pagos y Historial (para clientes) */}
        <Seccion titulo={t("settings.payments")}>
          <ConfigBoton 
            icon={<CreditCard size={18} />} 
            texto={t("settings.managePaymentMethod")} 
            onClick={() => abrirModal("paymentMethods")} 
          />
          <ConfigBoton 
            icon={<Receipt size={18} />} 
            texto="Historial de Transacciones" 
            onClick={() => abrirModal("transactionHistory")} 
          />
        </Seccion>

        {/* Privacidad y Notificaciones */}
        <Seccion titulo="🔔 Privacidad y Notificaciones">
          <ConfigBoton 
            icon={<Bell size={18} />} 
            texto="Notificaciones" 
            onClick={() => abrirModal("notifications")} 
          />
          <ConfigBoton 
            icon={<Eye size={18} />} 
            texto="Privacidad" 
            onClick={() => abrirModal("privacy")} 
          />
          <ConfigBoton 
            icon={<Star size={18} />} 
            texto="Modelos Favoritos" 
            onClick={() => abrirModal("favorites")} 
          />
        </Seccion>

        {/* Otros */}
        <Seccion titulo={t("settings.others")}>
          <ConfigBoton 
            icon={<HelpCircle size={18} />} 
            texto={t("settings.support")} 
            onClick={() => abrirModal("support")} 
          />
          <ConfigBoton 
            icon={<FileText size={18} />} 
            texto={t("settings.terms")} 
            onClick={() => abrirModal("terms")} 
          />
          <ConfigBoton 
            icon={<AlertTriangle size={18} />} 
            texto={t("settings.report")} 
            onClick={() => abrirModal("report")} 
          />
        </Seccion>
      </div>

      {/* Modal genérico */}
      {modalActivo && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4"
          onClick={cerrarModal}
        >
          <div
            className="bg-[#1f2125] rounded-xl p-6 w-full max-w-md border border-[#ff007a] relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={cerrarModal}
              className="absolute top-3 right-3 text-white/50 hover:text-white"
              title="Cerrar"
            >
              <X size={20} />
            </button>

            <ModalContent modalActivo={modalActivo} t={t} />
          </div>
        </div>
      )}
    </div>
  );
}

// Componente para el contenido de cada modal
function ModalContent({ modalActivo, t }) {
  const contenidoModales = {
    paymentMethods: {
      titulo: "💳 " + t("settings.managePaymentMethod"),
      contenido: "Aquí puedes administrar tus tarjetas y métodos de pago para realizar compras en la plataforma."
    },
    transactionHistory: {
      titulo: "📋 Historial de Transacciones",
      contenido: "Revisa todas tus compras, recargas de créditos y transacciones realizadas."
    },
    notifications: {
      titulo: "🔔 Configuración de Notificaciones",
      contenido: "Personaliza qué notificaciones quieres recibir: mensajes nuevos, modelos en línea, ofertas especiales, etc."
    },
    privacy: {
      titulo: "👁️ Configuración de Privacidad",
      contenido: "Controla quién puede verte en línea, enviar mensajes privados y ver tu perfil."
    },
    favorites: {
      titulo: "⭐ Modelos Favoritos",
      contenido: "Administra tu lista de modelos favoritos y recibe notificaciones cuando estén en línea."
    },
    support: {
      titulo: "🆘 " + t("settings.support"),
      contenido: "¿Necesitas ayuda? Contacta a nuestro equipo de soporte para resolver cualquier duda."
    },
    terms: {
      titulo: "📜 " + t("settings.terms"),
      contenido: "Revisa nuestros términos de servicio y políticas de la plataforma."
    },
    report: {
      titulo: "⚠️ " + t("settings.report"),
      contenido: "Reporta contenido inapropiado, problemas técnicos o comportamiento inadecuado."
    }
  };

  const modal = contenidoModales[modalActivo] || { 
    titulo: "Configuración", 
    contenido: t("settings.modalInstruction").replace("{{item}}", modalActivo || "esta función")
  };

  return (
    <>
      <h3 className="text-lg font-bold text-[#ff007a] mb-4">
        {modal.titulo}
      </h3>
      <p className="text-sm text-white/80 leading-relaxed">
        {modal.contenido}
      </p>
      
      {/* Botón de acción si es necesario */}
      {(modalActivo === 'support' || modalActivo === 'report') && (
        <button className="mt-4 w-full bg-[#ff007a] hover:bg-[#e6006e] text-white py-2 px-4 rounded-lg transition-colors">
          {modalActivo === 'support' ? 'Contactar Soporte' : 'Hacer Reporte'}
        </button>
      )}
    </>
  );
}

function Seccion({ titulo, children }) {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-[#ff007a] mb-4">{titulo}</h2>
      <div className="grid gap-3">{children}</div>
    </div>
  );
}

function ConfigBoton({ icon, texto, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 bg-[#131418] hover:bg-[#1c1f25] transition px-4 py-2 rounded-lg text-left border border-white/10"
    >
      <span className="text-[#ff007a]">{icon}</span>
      <span className="text-sm">{texto}</span>
    </button>
  );
}