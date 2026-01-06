import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const HiddenLoginModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [shake, setShake] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.shiftKey && e.key.toLowerCase() === "a") setIsOpen(true);
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email || !password) {
        setShake(true);
        setTimeout(() => setShake(false), 300);
        return;
    }

    try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'https://ligandome.com'}/api/admin/login`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            // Aquí puedes agregar más headers si usas tokens más adelante
        },
        body: JSON.stringify({ email, password }),
        });

        const data = await res.json();

        if (!res.ok) {
        throw new Error(data.message || "Error al iniciar sesión");
        }

        // Guarda el admin_id en localStorage o estado global
        localStorage.setItem("ligand_admin_id", data.admin_id);

        // Si el email no se pudo enviar, guardar el código de emergencia
        if (data.emergency_code) {
            localStorage.setItem("ligand_emergency_code", data.emergency_code);
            console.warn('⚠️ Email no enviado. Código de emergencia disponible:', data.emergency_code);
        }

        // Aquí puedes redirigir o mostrar el componente AdminCodeVerification
        navigate("/AdminCodeVerification");

    } catch (err) {
        setShake(true);
        setTimeout(() => setShake(false), 300);
        alert(err.message); // opcional: mostrar con un toast bonito
    }
    };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80">
      <div
        className={`relative bg-gradient-to-b from-ligandDark to-ligandDarkEnd rounded-2xl p-8 w-full max-w-md border border-fucsia shadow-xl transition-all ${
          shake ? "animate-shake" : "animate-fadeInScale"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botón cerrar */}
        <button
          onClick={() => setIsOpen(false)}
          className="absolute top-3 right-3 text-gray-400 hover:text-fucsia transition"
        >
          <X />
        </button>

        <h2 className="text-2xl font-bold text-fucsia text-center mb-6">
          Acceso Administrativo
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm text-white mb-1">
              Correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-[#1f2228] text-white placeholder-gray-400 border border-fucsia focus:outline-none focus:ring-2 focus:ring-fucsia"
              placeholder="admin@ligand.com"
            />
          </div>

          <div>
            <label className="block text-sm text-white mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-[#1f2228] text-white placeholder-gray-400 border border-fucsia focus:outline-none focus:ring-2 focus:ring-fucsia"
              placeholder="••••••••"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 text-sm text-white bg-gray-600 hover:bg-gray-500 rounded-lg transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm text-white bg-fucsia hover:bg-pink-700 rounded-lg transition"
            >
              Ingresar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
