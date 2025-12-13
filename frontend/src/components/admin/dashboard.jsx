import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { 
  Users, 
  Shield, 
  Coins, 
  MessageCircle, 
  Video, 
  BookOpen, 
  CreditCard, 
  BarChart3,
  Settings,
  LogOut,
  Heart
} from "lucide-react";

// Importar el módulo de usuarios
import UsersModule from "../admin/modulos/UsersModule";

const AdminDashboardLayout = () => {
  const navigate = useNavigate();
  const { section } = useParams();
  const [activeSection, setActiveSection] = useState(section || "dashboard");

  // Efecto para sincronizar la URL con el estado
  useEffect(() => {
    if (section && section !== activeSection) {
      setActiveSection(section);
    }
  }, [section]);

  // Función para cambiar sección y actualizar URL
  const handleSectionChange = (sectionId) => {
    setActiveSection(sectionId);
    navigate(`/admin/dashboard/${sectionId}`);
  };

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "users", label: "Usuarios", icon: Users },
    { id: "verificaciones", label: "Verificaciones", icon: Shield },
    { id: "coins", label: "Monedas", icon: Coins },
    { id: "sesiones", label: "Sesiones", icon: Video },
    { id: "chat", label: "Chat", icon: MessageCircle },
    { id: "historias", label: "Historias", icon: BookOpen },
    { id: "pagos", label: "Pagos", icon: CreditCard },
    { id: "settings", label: "Configuración", icon: Settings }
  ];

  const renderContent = () => {
    switch(activeSection) {
      case "dashboard":
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-gray-800/60 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-pink-500/20 hover:border-pink-400/40 transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">Usuarios Activos</p>
                    <p className="text-2xl font-bold text-pink-300">1,234</p>
                    <p className="text-green-400 text-xs mt-1">+12% vs ayer</p>
                  </div>
                  <div className="p-3 bg-pink-500/20 rounded-lg">
                    <Users className="w-8 h-8 text-pink-400" />
                  </div>
                </div>
              </div>
              <div className="bg-gray-800/60 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-purple-500/20 hover:border-purple-400/40 transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">Sesiones Hoy</p>
                    <p className="text-2xl font-bold text-purple-300">89</p>
                    <p className="text-green-400 text-xs mt-1">+5% vs ayer</p>
                  </div>
                  <div className="p-3 bg-purple-500/20 rounded-lg">
                    <Video className="w-8 h-8 text-purple-400" />
                  </div>
                </div>
              </div>
              <div className="bg-gray-800/60 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-yellow-500/20 hover:border-yellow-400/40 transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">Ingresos</p>
                    <p className="text-2xl font-bold text-yellow-300">$2,456</p>
                    <p className="text-green-400 text-xs mt-1">+18% vs ayer</p>
                  </div>
                  <div className="p-3 bg-yellow-500/20 rounded-lg">
                    <Coins className="w-8 h-8 text-yellow-400" />
                  </div>
                </div>
              </div>
              <div className="bg-gray-800/60 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-blue-500/20 hover:border-blue-400/40 transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">Chats Activos</p>
                    <p className="text-2xl font-bold text-blue-300">156</p>
                    <p className="text-green-400 text-xs mt-1">+8% vs ayer</p>
                  </div>
                  <div className="p-3 bg-blue-500/20 rounded-lg">
                    <MessageCircle className="w-8 h-8 text-blue-400" />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gray-800/60 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-pink-500/20">
                <h3 className="text-lg font-semibold text-pink-300 mb-4">Actividad Reciente</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-gray-700/50">
                    <span className="text-gray-300">Nueva usuaria registrada</span>
                    <span className="text-green-400 text-sm">Hace 5 min</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-700/50">
                    <span className="text-gray-300">Sesión de video iniciada</span>
                    <span className="text-blue-400 text-sm">Hace 12 min</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-gray-300">Pago procesado</span>
                    <span className="text-yellow-400 text-sm">Hace 18 min</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800/60 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-purple-500/20">
                <h3 className="text-lg font-semibold text-purple-300 mb-4">Estado del Sistema</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">Servidor Principal</span>
                    <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">Online</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">Base de Datos</span>
                    <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">Online</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">Servidor de Video</span>
                    <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">Online</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">Sistema de Pagos</span>
                    <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm">Lento</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case "users":
        return <UsersModule />;

      default:
        return (
          <div className="bg-gray-800/60 backdrop-blur-sm rounded-xl shadow-lg border border-purple-500/20">
            <div className="p-6 border-b border-gray-700/50">
              <h3 className="text-lg font-semibold text-purple-300 capitalize">{activeSection}</h3>
            </div>
            <div className="p-6">
              <p className="text-gray-400">Contenido de {activeSection} próximamente.</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex min-h-screen h-screen bg-gray-900 overflow-hidden">
      <aside className="w-64 bg-gradient-to-b from-pink-500 to-purple-600 shadow-xl flex flex-col min-h-screen">
        <div className="p-6 border-b border-pink-400/20">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-black/20 rounded-lg flex items-center justify-center backdrop-blur-sm border border-pink-400/30">
              <Heart className="w-6 h-6 text-pink-300" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Ligand Admin</h1>
              <p className="text-pink-200/80 text-sm">Panel de Control</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleSectionChange(item.id)}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-300 group w-full text-left transform hover:scale-105 ${
                  activeSection === item.id
                    ? 'bg-black/30 text-pink-300 shadow-lg border border-pink-400/30 backdrop-blur-sm font-medium'
                    : 'text-pink-100/90 hover:bg-black/20 hover:text-pink-200 hover:border hover:border-pink-400/20'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-pink-400/20">
          <button className="flex items-center space-x-3 px-4 py-3 rounded-lg text-pink-200/90 hover:bg-black/20 hover:text-pink-200 transition-all duration-300 w-full hover:border hover:border-pink-400/20">
            <LogOut className="w-5 h-5" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden bg-gray-900 min-h-screen">
        <header className="bg-gray-800/50 backdrop-blur-sm shadow-lg border-b border-pink-500/20 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-pink-300">Panel de Administración</h2>
              <p className="text-gray-400 text-sm">Gestiona tu plataforma Ligand</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="bg-gradient-to-r from-green-400 to-green-500 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg">
                Sistema Activo
              </div>
              <div className="w-10 h-10 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-white font-medium">A</span>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-y-auto bg-gray-900">
          <div className="max-w-7xl mx-auto">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboardLayout;