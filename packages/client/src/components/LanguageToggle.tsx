import { useLanguage } from '../contexts/LanguageContext.js';

export default function LanguageToggle() {
  const { lang, setLang } = useLanguage();

  return (
    <button
      onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
      className="px-4 py-2 bg-surface-container-highest text-on-surface-variant hover:text-primary border border-outline-variant/30 hover:border-primary/50 font-label text-[10px] uppercase tracking-[0.15em] transition-all step-easing"
      style={{ borderRadius: 0 }}
    >
      {lang === 'en' ? '中文' : 'EN'}
    </button>
  );
}
