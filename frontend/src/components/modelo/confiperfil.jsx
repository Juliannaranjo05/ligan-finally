import React, { useState } from "react";
import Header from "./header";
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
  Banknote,
  HelpCircle,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import PaymentManager from "./payments/PaymentManager";
import MinimumPayoutManager from "./payments/MinimumPayoutManager";
import ProfileSettings from "../ProfileSettings";
import SecuritySettings from "../SecuritySettings";

export default function ModeloConfiguracion() {
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

        {/* 🔥 PERFIL - AHORA USANDO EL COMPONENTE ProfileSettings */}
        <Seccion titulo={t("settings.profile")}>
          <ProfileSettings t={t} />
        </Seccion>

        {/* Pagos */}
        <Seccion titulo={t("settings.payments")}>
          <ConfigBoton 
            icon={<CreditCard size={18} />} 
            texto={t("settings.managePaymentMethod")} 
            onClick={() => abrirModal("managePaymentMethod")} 
          />
          <ConfigBoton 
            icon={<Banknote size={18} />} 
            texto={t("settings.minimumPayout")} 
            onClick={() => abrirModal("minimumPayout")} 
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

      {/* Modal para las otras configuraciones (que no sean perfil) */}
      {modalActivo === "managePaymentMethod" ? (
        <PaymentManager 
          onClose={cerrarModal}
        />
      ) : modalActivo === "minimumPayout" ? (
        <MinimumPayoutManager 
          onClose={cerrarModal}
        />
      ) : modalActivo && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4"
          onClick={cerrarModal}
        >
          <div
            className="bg-[#1f2125] rounded-xl p-6 w-full max-w-sm border border-[#ff007a] relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={cerrarModal}
              className="absolute top-3 right-3 text-white/50 hover:text-white"
              title="Cerrar"
            >
              <X size={20} />
            </button>

            <h3 className="text-lg font-bold text-[#ff007a] mb-4">
              {t(`settings.${modalActivo}`)?.toUpperCase() || modalActivo}
            </h3>
            <p className="text-sm text-white/80">
              {t("settings.modalInstruction", { 
                item: t(`settings.${modalActivo}`) || modalActivo 
              })}
            </p>
          </div>
        </div>
      )}
    </div>
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