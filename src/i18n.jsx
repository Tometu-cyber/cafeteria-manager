import { createContext, useContext, useEffect, useMemo, useState } from 'react';

// English text is the key; French lives in fr.js. Missing entries fall back to English.
import fr from './fr.js';

const Ctx = createContext(null);

const read = () => {
  try {
    const saved = localStorage.getItem('lang');
    if (saved === 'fr' || saved === 'en') return saved;
  } catch { /* storage unavailable */ }
  return (navigator.language || '').toLowerCase().startsWith('fr') ? 'fr' : 'en';
};

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(read);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo(() => {
    const t = (text, vars) => {
      let out = lang === 'fr' ? (fr[text] ?? text) : text;
      if (vars) out = out.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
      return out;
    };
    const setLang = (l) => {
      setLangState(l);
      try { localStorage.setItem('lang', l); } catch { /* ignore */ }
    };
    const fmtDate = (iso) =>
      iso ? new Date(iso).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' }) : t('never');
    return { t, lang, setLang, fmtDate };
  }, [lang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useT = () => useContext(Ctx);

export function LangSwitch() {
  const { lang, setLang } = useT();
  return (
    <div className="seg" role="group" aria-label="Language">
      {['fr', 'en'].map((l) => (
        <button
          key={l}
          type="button"
          className="lang-opt"
          aria-pressed={lang === l}
          onClick={() => setLang(l)}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
