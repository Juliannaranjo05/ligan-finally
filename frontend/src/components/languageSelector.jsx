import { useState, useEffect, useRef } from "react";
import i18n from "../i18n";

const languages = [
  { code: "es", label: "Español", flag: "/flags/es.png" },
  { code: "en", label: "English", flag: "/flags/en.png" },
  { code: "pt", label: "Português", flag: "/flags/pt.png" },
  { code: "fr", label: "Français", flag: "/flags/fr.png" },
  { code: "de", label: "Deutsch", flag: "/flags/de.png" },
  { code: "ru", label: "Русский", flag: "/flags/ru.png" },
  { code: "tr", label: "Türkçe", flag: "/flags/tr.png" },
  { code: "hi", label: "हिन्दी", flag: "/flags/hi.png" },
  { code: "it", label: "italian", flag: "/flags/it.png" },
];

export default function LanguageSelector() {
  const [showLangMenu, setShowLangMenu] = useState(false);
  const selectorRef = useRef(null);
  const selectedLang =
    languages.find((l) => l.code === i18n.language) || languages[0];

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        selectorRef.current &&
        !selectorRef.current.contains(event.target)
      ) {
        setShowLangMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={selectorRef} className="relative z-50 flex items-center">
      <button
        onClick={() => setShowLangMenu(!showLangMenu)}
        className="w-10 h-7 bg-no-repeat bg-center bg-contain rounded-none"
        style={{ backgroundImage: `url(${selectedLang.flag})` }}
        aria-label="Cambiar idioma"
      />

      {showLangMenu && (
        <div className="absolute top-10 left-0 bg-gradient-to-b from-[#0a0d10] to-[#131418] rounded-lg shadow-xl p-2 min-w-[160px]">
          {languages.map(({ code, label, flag }) => (
            <button
              key={code}
              onClick={() => {
                i18n.changeLanguage(code);
                localStorage.setItem("lang", code);
                setShowLangMenu(false);
              }}
              className={`flex items-center gap-3 w-full px-2 py-2 text-white text-[15px] rounded-md hover:bg-[#ff007a]/30 ${
                i18n.language === code ? "bg-[#ff007a]/20" : ""
              }`}
            >
              <img
                src={flag}
                alt={label}
                className="w-6 h-4 object-cover rounded-sm"
              />
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
