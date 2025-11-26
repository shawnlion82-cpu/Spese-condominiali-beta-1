import React, { createContext, useState, useContext, useEffect } from 'react';
import { translations, Language } from './translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('it');

  useEffect(() => {
    try {
      const savedLang = localStorage.getItem('app_language') as Language;
      if (savedLang && translations[savedLang]) {
        setLanguage(savedLang);
      } else {
        // Try to detect browser language
        const browserLang = navigator.language.split('-')[0] as Language;
        if (translations[browserLang]) {
          setLanguage(browserLang);
        }
      }
    } catch (e) {
      console.warn('LocalStorage not available for language');
    }
  }, []);

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    try {
      localStorage.setItem('app_language', lang);
    } catch (e) {
      console.warn('Could not save language preference');
    }
  };

  const t = (path: string) => {
    const keys = path.split('.');
    let current: any = translations[language];
    for (const key of keys) {
      if (current[key] === undefined) return path;
      current = current[key];
    }
    return current;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
  return context;
};