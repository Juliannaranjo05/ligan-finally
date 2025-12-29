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
import ModalDocumentacion from "../verificacion/register/ModalDocumentacion";
import TransactionHistory from "./TransactionHistory";
import NotificationSettings from "./NotificationSettings";
import PrivacySettings from "./PrivacySettings";
import FavoriteModelsSettings from "./FavoriteModelsSettings";
import PaymentMethodsSettings from "./PaymentMethodsSettings";
import { useSessionValidation } from '../hooks/useSessionValidation';

export default function ClienteConfiguracion() {
  // 🔥 VALIDACIÓN DE SESIÓN: Solo clientes pueden acceder
  useSessionValidation('cliente');

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
          <ProfileSettings />
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
            texto={t("settings.transactionHistory")} 
            onClick={() => abrirModal("transactionHistory")} 
          />
        </Seccion>

        {/* Privacidad y Notificaciones */}
        <Seccion titulo={t("settings.privacyNotifications")}>
          <ConfigBoton 
            icon={<Bell size={18} />} 
            texto={t("settings.notifications")} 
            onClick={() => abrirModal("notifications")} 
          />
          <ConfigBoton 
            icon={<Eye size={18} />} 
            texto={t("settings.privacy")} 
            onClick={() => abrirModal("privacy")} 
          />
          <ConfigBoton 
            icon={<Star size={18} />} 
            texto={t("settings.favoriteModels")} 
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

      {/* Modal de historial de transacciones - más grande */}
      {modalActivo === "transactionHistory" && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4 py-8"
          onClick={cerrarModal}
        >
          <div
            className="bg-[#1f2125] rounded-xl p-6 w-full max-w-4xl border border-[#ff007a] relative max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={cerrarModal}
              className="absolute top-3 right-3 text-white/50 hover:text-white z-10"
              title={t("settings.modals.close")}
            >
              <X size={20} />
            </button>

            <div className="mb-4">
              <h3 className="text-lg font-bold text-[#ff007a]">
                📋 {t("settings.modals.transactionHistory.title")}
              </h3>
              <p className="text-sm text-white/60 mt-1">
                {t("settings.modals.transactionHistory.description")}
              </p>
            </div>

            <TransactionHistory />
          </div>
        </div>
      )}

      {/* Modal de notificaciones */}
      {modalActivo === "notifications" && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4 py-8"
          onClick={cerrarModal}
        >
          <div
            className="bg-[#1f2125] rounded-xl p-6 w-full max-w-2xl border border-[#ff007a] relative max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={cerrarModal}
              className="absolute top-3 right-3 text-white/50 hover:text-white z-10"
              title={t("settings.modals.close")}
            >
              <X size={20} />
            </button>

            <div className="mb-4">
              <h3 className="text-lg font-bold text-[#ff007a]">
                🔔 {t("settings.modals.notifications.title")}
              </h3>
              <p className="text-sm text-white/60 mt-1">
                {t("settings.modals.notifications.description")}
              </p>
            </div>

            <NotificationSettings />
          </div>
        </div>
      )}

      {/* Modal de privacidad */}
      {modalActivo === "privacy" && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4 py-8"
          onClick={cerrarModal}
        >
          <div
            className="bg-[#1f2125] rounded-xl p-6 w-full max-w-3xl border border-[#ff007a] relative max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={cerrarModal}
              className="absolute top-3 right-3 text-white/50 hover:text-white z-10"
              title={t("settings.modals.close")}
            >
              <X size={20} />
            </button>

            <div className="mb-4">
              <h3 className="text-lg font-bold text-[#ff007a]">
                👁️ {t("settings.modals.privacy.title")}
              </h3>
              <p className="text-sm text-white/60 mt-1">
                {t("settings.modals.privacy.description")}
              </p>
            </div>

            <PrivacySettings />
          </div>
        </div>
      )}

      {/* Modal de modelos favoritos */}
      {modalActivo === "favorites" && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4 py-8"
          onClick={cerrarModal}
        >
          <div
            className="bg-[#1f2125] rounded-xl p-6 w-full max-w-3xl border border-[#ff007a] relative max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={cerrarModal}
              className="absolute top-3 right-3 text-white/50 hover:text-white z-10"
              title={t("settings.modals.close")}
            >
              <X size={20} />
            </button>

            <div className="mb-4">
              <h3 className="text-lg font-bold text-[#ff007a]">
                ⭐ {t("settings.modals.favorites.title")}
              </h3>
              <p className="text-sm text-white/60 mt-1">
                {t("settings.modals.favorites.description")}
              </p>
            </div>

            <FavoriteModelsSettings />
          </div>
        </div>
      )}

      {/* Modal de métodos de pago */}
      {modalActivo === "paymentMethods" && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4 py-8"
          onClick={cerrarModal}
        >
          <div
            className="bg-[#1f2125] rounded-xl p-6 w-full max-w-2xl border border-[#ff007a] relative max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={cerrarModal}
              className="absolute top-3 right-3 text-white/50 hover:text-white z-10"
              title={t("settings.modals.close")}
            >
              <X size={20} />
            </button>

            <div className="mb-4">
              <h3 className="text-lg font-bold text-[#ff007a]">
                💳 {t("settings.modals.paymentMethods.title")}
              </h3>
              <p className="text-sm text-white/60 mt-1">
                {t("settings.modals.paymentMethods.description")}
              </p>
            </div>

            <PaymentMethodsSettings onClose={cerrarModal} />
          </div>
        </div>
      )}

      {/* Modal genérico (soporte, reportes, etc.) */}
      {modalActivo && modalActivo !== "terms" && modalActivo !== "transactionHistory" && modalActivo !== "notifications" && modalActivo !== "privacy" && modalActivo !== "favorites" && modalActivo !== "paymentMethods" && (
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
              title={t("settings.modals.close")}
            >
              <X size={20} />
            </button>

            <ModalContent modalActivo={modalActivo} t={t} />
          </div>
        </div>
      )}

      {/* Modal específico de Términos y Condiciones: reutiliza ModalDocumentacion grande */}
      {modalActivo === "terms" && (
        <ModalDocumentacion
          isOpen={true}
          onClose={cerrarModal}
        />
      )}
    </div>
  );
}

// Componente para el contenido de cada modal
function ModalContent({ modalActivo, t }) {
  const contenidoModales = {
    transactionHistory: {
      titulo: "📋 " + t("settings.modals.transactionHistory.title"),
      contenido: t("settings.modals.transactionHistory.description")
    },
    notifications: {
      titulo: "🔔 " + t("settings.modals.notificationsFull.title"),
      contenido: t("settings.modals.notificationsFull.description")
    },
    privacy: {
      titulo: "👁️ " + t("settings.modals.privacyFull.title"),
      contenido: t("settings.modals.privacyFull.description")
    },
    favorites: {
      titulo: "⭐ " + t("settings.modals.favoritesFull.title"),
      contenido: t("settings.modals.favoritesFull.description")
    },
    support: {
      titulo: "🆘 " + t("settings.modals.support.title"),
      contenido: t("settings.modals.support.description")
    },
    report: {
      titulo: "⚠️ " + t("settings.modals.report.title"),
      contenido: t("settings.modals.report.description")
    },
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
      <p className="text-sm text-white/80 leading-relaxed whitespace-pre-line">
        {modal.contenido}
      </p>
      
      {/* Acciones específicas para soporte y reportes */}
      {modalActivo === "support" && (
        <a
          href="mailto:support@ligandome.com?subject=Soporte%20Ligando&body=Cu%C3%A9ntanos%20en%20detalle%20tu%20duda%20o%20problema.%0A%0A-%20Correo%20con%20el%20que%20ingresas%3A%0A-%20Dispositivo%20(navegador%2C%20m%C3%B3vil%2C%20PC)%3A%0A-%20Captura%20de%20pantalla%20(si%20es%20posible)%3A%0A"
          className="mt-4 w-full inline-flex items-center justify-center bg-[#ff007a] hover:bg-[#e6006e] text-white py-2 px-4 rounded-lg transition-colors text-sm"
        >
          {t("settings.modals.support.contactButton")}
        </a>
      )}

      {modalActivo === "report" && (
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const tipo = form.tipo.value;
            const descripcion = form.descripcion.value;
            const mailto = `mailto:support@ligandome.com?subject=Reporte%20${encodeURIComponent(
              tipo
            )}&body=${encodeURIComponent(descripcion)}`;
            window.location.href = mailto;
          }}
        >
          <label className="block text-xs text-white/70 mb-1">
            {t("settings.modals.report.problemType")}
          </label>
          <select
            name="tipo"
            className="w-full bg-[#131418] border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option>{t("settings.modals.report.problemTechnical")}</option>
            <option>{t("settings.modals.report.problemPayment")}</option>
            <option>{t("settings.modals.report.problemInappropriate")}</option>
            <option>{t("settings.modals.report.problemOther")}</option>
          </select>

          <label className="block text-xs text-white/70 mb-1 mt-2">
            {t("settings.modals.report.describeProblem")}
          </label>
          <textarea
            name="descripcion"
            required
            rows={4}
            className="w-full bg-[#131418] border border-white/10 rounded-lg px-3 py-2 text-sm text-white resize-none"
            placeholder={t("settings.modals.report.describePlaceholder")}
          />

          <button
            type="submit"
            className="w-full bg-[#ff007a] hover:bg-[#e6006e] text-white py-2 px-4 rounded-lg transition-colors text-sm"
          >
            {t("settings.modals.report.sendReport")}
        </button>
        </form>
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