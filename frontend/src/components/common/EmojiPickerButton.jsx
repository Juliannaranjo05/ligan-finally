import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Smile, X } from 'lucide-react';

const EMOJI_API_URL = 'https://emojihub.yurace.pro/api/all';
const CACHE_KEY = 'emoji_api_cache_v1';
const CACHE_TTL_MS = 1000 * 60 * 60 * 24;
const MAX_EMOJIS = 240;

const parseHtmlCodes = (codes = []) => {
  const chars = codes
    .map((code) => {
      const hexMatch = code.match(/&#x([0-9A-Fa-f]+);/);
      const decMatch = code.match(/&#([0-9]+);/);
      const value = hexMatch
        ? parseInt(hexMatch[1], 16)
        : decMatch
          ? parseInt(decMatch[1], 10)
          : null;
      return Number.isFinite(value) ? String.fromCodePoint(value) : '';
    })
    .join('');
  return chars || '';
};

const mapEmojiItem = (item) => {
  const charFromHtml = parseHtmlCodes(item?.htmlCode);
  const unicode = Array.isArray(item?.unicode) ? item.unicode[0] : '';
  const charFromUnicode = unicode
    ? String.fromCodePoint(parseInt(unicode.replace('U+', ''), 16))
    : '';

  return {
    char: charFromHtml || charFromUnicode || '',
    name: item?.name || '',
    category: item?.category || '',
    group: item?.group || ''
  };
};

const loadEmojiCache = () => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    if (!parsed?.timestamp || !Array.isArray(parsed?.data)) return null;
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
};

const saveEmojiCache = (data) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data }));
  } catch {
    // Ignore cache failures
  }
};

const EmojiPickerButton = ({
  onSelect,
  disabled = false,
  buttonClassName = '',
  popoverClassName = '',
  buttonSize = 16
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [emojiList, setEmojiList] = useState([]);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const onClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || emojiList.length > 0 || isLoading) return;
    const cached = loadEmojiCache();
    if (cached?.length) {
      setEmojiList(cached);
      return;
    }

    const fetchEmojis = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(EMOJI_API_URL, { method: 'GET' });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        const mapped = Array.isArray(data)
          ? data.map(mapEmojiItem).filter((item) => item.char)
          : [];
        const trimmed = mapped.slice(0, MAX_EMOJIS);
        setEmojiList(trimmed);
        saveEmojiCache(trimmed);
      } catch (err) {
        setError(err?.message || 'Error cargando emojis');
      } finally {
        setIsLoading(false);
      }
    };

    fetchEmojis();
  }, [isOpen, emojiList.length, isLoading]);

  const filteredEmojis = useMemo(() => {
    if (!query.trim()) return emojiList;
    const term = query.trim().toLowerCase();
    return emojiList.filter((item) =>
      item.name.toLowerCase().includes(term) ||
      item.category.toLowerCase().includes(term) ||
      item.group.toLowerCase().includes(term)
    );
  }, [emojiList, query]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex-shrink-0 input-button rounded-lg transition-all duration-300 hover:scale-110 bg-[#ff007a]/20 text-[#ff007a] hover:bg-[#ff007a]/30 border border-[#ff007a]/30 ${buttonClassName}`}
        aria-label="Abrir selector de emojis"
      >
        <Smile size={buttonSize} />
      </button>

      {isOpen && (
        <div
          className={`absolute bottom-12 right-0 z-50 w-72 max-h-80 overflow-hidden rounded-xl border border-[#ff007a]/30 bg-[#0f1116] shadow-xl ${popoverClassName}`}
        >
          <div className="flex items-center gap-2 p-2 border-b border-[#ff007a]/20">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar emoji..."
              className="flex-1 rounded-lg bg-[#1a1c20] px-3 py-2 text-sm text-white placeholder-white/50 outline-none focus:ring-2 focus:ring-[#ff007a]/40"
            />
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1 text-white/70 hover:text-white hover:bg-white/10"
              aria-label="Cerrar selector de emojis"
            >
              <X size={14} />
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto p-2">
            {isLoading && (
              <div className="py-6 text-center text-sm text-white/60">Cargando emojis...</div>
            )}
            {!isLoading && error && (
              <div className="py-6 text-center text-sm text-red-400">
                Error al cargar emojis
              </div>
            )}
            {!isLoading && !error && filteredEmojis.length === 0 && (
              <div className="py-6 text-center text-sm text-white/60">Sin resultados</div>
            )}

            {!isLoading && !error && filteredEmojis.length > 0 && (
              <div className="grid grid-cols-8 gap-1">
                {filteredEmojis.map((emoji, index) => (
                  <button
                    key={`${emoji.char}_${index}`}
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-lg transition hover:bg-[#ff007a]/20"
                    onClick={() => {
                      if (typeof onSelect === 'function') {
                        onSelect(emoji.char);
                      }
                      setIsOpen(false);
                    }}
                    title={emoji.name}
                  >
                    {emoji.char}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmojiPickerButton;
