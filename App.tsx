

import React, { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, Plus, LogOut, Building2, TrendingUp, List, DollarSign, Banknote, Moon, Sun, Globe, Loader2, PieChart } from 'lucide-react';
import { LoginScreen } from './components/LoginScreen';
import { Dashboard } from './components/Dashboard';
import { ExpenseForm } from './components/ExpenseForm';
import { ExpenseList } from './components/ExpenseList';
import { IncomeForm } from './components/IncomeForm';
import { IncomeList } from './components/IncomeList';
import { BankAccountList } from './components/BankAccountList';
import { BankAccountForm } from './components/BankAccountForm';
import { ReportView } from './components/ReportView';
import { Expense, Income, BankAccount } from './types';
import { generateId } from './utils';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';
import { Language } from './i18n/translations';
import { get, set } from 'idb-keyval';

// Default data is now empty to prevent example data on restart
const defaultExpenses: Expense[] = [];
const defaultIncomes: Income[] = [];
const defaultBankAccounts: BankAccount[] = [];

const getStorageKey = (type: 'expenses' | 'incomes' | 'bankAccounts', name: string) => `condo_${type}_${name.replace(/\s/g, '_')}`;

type View = 'dashboard' | 'add' | 'list' | 'addIncome' | 'listIncome' | 'listBankAccounts' | 'addBankAccount' | 'reports';

interface NavButtonProps {
  active?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  variant?: 'primary' | 'secondary';
}

const NavButton: React.FC<NavButtonProps> = ({ active, onClick, icon, label, variant }) => {
  const baseClasses = "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors justify-center group relative";
  let variantClasses = "";
  let activeClasses = "";

  if (variant === 'primary') {
    variantClasses = "bg-green-600 text-white hover:bg-green-700 shadow-sm dark:bg-green-700 dark:hover:bg-green-600";
  } else if (variant === 'secondary') {
    variantClasses = "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm dark:bg-indigo-700 dark:hover:bg-indigo-600";
  } else {
    variantClasses = "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white";
    activeClasses = active ? "bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-white" : "";
  }

  return (
    <button onClick={onClick} className={`${baseClasses} ${variantClasses} ${activeClasses}`} title={label}>
      {icon}
      <span className={`${variant ? 'hidden sm:inline' : 'hidden md:inline'}`}>{label}</span>
      {/* Tooltip for mobile */}
      <span className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20 sm:hidden dark:bg-slate-700">
        {label}
      </span>
    </button>
  );
};

const InnerApp: React.FC = () => {
  const { t, language, setLanguage } = useLanguage();
  const [condoName, setCondoName] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [darkMode, setDarkMode] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);
  
  // Expenses State
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Incomes State
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);

  // Bank Accounts State
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [editingBankAccount, setEditingBankAccount] = useState<BankAccount | null>(null);

  // Click outside listener for lang menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setShowLangMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Initialize Theme
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        setDarkMode(true);
        document.documentElement.classList.add('dark');
      } else {
        setDarkMode(false);
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {
      console.warn('Could not access localStorage for theme');
    }
  }, []);

  const toggleTheme = () => {
    setDarkMode(prev => {
      const newMode = !prev;
      try {
        if (newMode) {
          document.documentElement.classList.add('dark');
          localStorage.setItem('theme', 'dark');
        } else {
          document.documentElement.classList.remove('dark');
          localStorage.setItem('theme', 'light');
        }
      } catch (e) {
        console.warn('Could not save theme preference');
      }
      return newMode;
    });
  };

  // Load condo name on initial mount
  useEffect(() => {
    try {
      const savedName = localStorage.getItem('condo_name');
      if (savedName) setCondoName(savedName);
    } catch (e) {
      console.warn('Could not access localStorage for condo_name');
    }
  }, []);

  // Load data from IndexedDB when condoName changes
  useEffect(() => {
    const loadData = async () => {
      if (!condoName) {
        setExpenses([]);
        setIncomes([]);
        setBankAccounts([]);
        return;
      }

      setIsLoading(true);
      try {
        // Load Expenses
        const expKey = getStorageKey('expenses', condoName);
        let loadedExpenses = await get(expKey);
        
        // Migration from LocalStorage if IndexedDB is empty
        if (!loadedExpenses) {
          const local = localStorage.getItem(expKey);
          if (local) {
            try {
              loadedExpenses = JSON.parse(local);
              await set(expKey, loadedExpenses); // Save to IndexedDB
            } catch (e) {
              console.error("Migration error expenses", e);
            }
          }
        }
        setExpenses(loadedExpenses || []);

        // Load Incomes
        const incKey = getStorageKey('incomes', condoName);
        let loadedIncomes = await get(incKey);
        if (!loadedIncomes) {
          const local = localStorage.getItem(incKey);
          if (local) {
             try {
               loadedIncomes = JSON.parse(local);
               await set(incKey, loadedIncomes);
             } catch (e) {}
          }
        }
        setIncomes(loadedIncomes || []);

        // Load Bank Accounts
        const bankKey = getStorageKey('bankAccounts', condoName);
        let loadedAccounts = await get(bankKey);
        if (!loadedAccounts) {
           const local = localStorage.getItem(bankKey);
           if (local) {
              try {
                loadedAccounts = JSON.parse(local);
                await set(bankKey, loadedAccounts);
              } catch (e) {}
           }
        }
        setBankAccounts(loadedAccounts || []);

      } catch (e) {
        console.error("Error loading data", e);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [condoName]);

  // Save data to IndexedDB whenever it changes
  useEffect(() => {
    if (condoName) {
      set(getStorageKey('expenses', condoName), expenses).catch(e => console.error("Error saving expenses", e));
    }
  }, [expenses, condoName]);

  useEffect(() => {
    if (condoName) {
      set(getStorageKey('incomes', condoName), incomes).catch(e => console.error("Error saving incomes", e));
    }
  }, [incomes, condoName]);

  useEffect(() => {
    if (condoName) {
      set(getStorageKey('bankAccounts', condoName), bankAccounts).catch(e => console.error("Error saving bank accounts", e));
    }
  }, [bankAccounts, condoName]);

  const handleLogin = (name: string) => {
    setCondoName(name);
    try {
      localStorage.setItem('condo_name', name);
    } catch (e) {
      console.warn('Could not save condo_name');
    }
  };

  const handleLogout = () => {
    setCondoName(null);
    try {
      localStorage.removeItem('condo_name');
    } catch (e) {}
    setCurrentView('dashboard');
    setEditingExpense(null);
    setEditingIncome(null);
    setEditingBankAccount(null);
  };

  // Expense Handlers
  const handleAddExpense = (expense: Expense) => {
    setExpenses(prev => [expense, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    if(currentView !== 'list') setCurrentView('list');
  };
  const handleStartEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setCurrentView('add');
  };
  const handleUpdateExpense = (updated: Expense) => {
    setExpenses(prev => prev.map(e => e.id === updated.id ? updated : e).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setEditingExpense(null);
    setCurrentView('list');
  };
  const handleDeleteExpense = (id: string) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
  };
  const handleClearAllExpenses = () => {
    setExpenses([]);
  };
  
  const handleStartDuplicateExpense = (expense: Expense) => {
     const duplicatedExpense: Expense = {
      ...expense,
      id: generateId(),
      description: `${expense.description} (Copia)`,
      date: new Date().toISOString().split('T')[0],
      attachments: [] // Do not copy attachments to save space, user can add new ones
     };
     setEditingExpense(duplicatedExpense);
     setCurrentView('add');
  };


  // Income Handlers
  const handleAddIncome = (income: Income) => {
    setIncomes(prev => [income, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    if(currentView !== 'listIncome') setCurrentView('listIncome');
  };
  const handleStartEditIncome = (income: Income) => {
    setEditingIncome(income);
    setCurrentView('addIncome');
  };
  const handleUpdateIncome = (updated: Income) => {
    setIncomes(prev => prev.map(i => i.id === updated.id ? updated : i).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setEditingIncome(null);
    setCurrentView('listIncome');
  };
  const handleDeleteIncome = (id: string) => {
    setIncomes(prev => prev.filter(i => i.id !== id));
  };
  const handleClearAllIncomes = () => {
    setIncomes([]);
  };

  // Bank Account Handlers
  const handleAddBankAccount = (account: BankAccount) => {
    setBankAccounts(prev => [account, ...prev]);
    setCurrentView('listBankAccounts');
  };
  const handleStartEditBankAccount = (account: BankAccount) => {
    setEditingBankAccount(account);
    setCurrentView('addBankAccount');
  };
  const handleUpdateBankAccount = (updated: BankAccount) => {
    setBankAccounts(prev => prev.map(a => a.id === updated.id ? updated : a));
    setEditingBankAccount(null);
    setCurrentView('listBankAccounts');
  };
  const handleDeleteBankAccount = (id: string) => {
    setBankAccounts(prev => prev.filter(a => a.id !== id));
  };

  const handleNavClick = (view: View) => {
    if (view === 'add') setEditingExpense(null);
    if (view === 'addIncome') setEditingIncome(null);
    if (view === 'addBankAccount') setEditingBankAccount(null);
    setCurrentView(view);
  };

  const languages: { code: Language, label: string, flag: string }[] = [
    { code: 'it', label: 'Italiano', flag: '🇮🇹' },
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'es', label: 'Español', flag: '🇪🇸' },
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
    { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  ];

  if (!condoName) {
    return (
      <div className="relative">
        <div className="absolute top-4 right-4 z-50" ref={langMenuRef}>
           <button 
              onClick={() => setShowLangMenu(!showLangMenu)}
              className="p-2 text-slate-400 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors bg-white dark:bg-slate-800 rounded-full shadow-sm" 
              title="Lingua / Language"
            >
              <Globe className="w-5 h-5" />
            </button>
            {showLangMenu && (
              <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 py-1 overflow-hidden">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => { setLanguage(lang.code); setShowLangMenu(false); }}
                    className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${language === lang.code ? 'text-indigo-600 dark:text-indigo-400 font-medium' : 'text-slate-700 dark:text-slate-300'}`}
                  >
                    <span>{lang.flag}</span>
                    <span>{lang.label}</span>
                  </button>
                ))}
              </div>
            )}
        </div>
        <LoginScreen onLogin={handleLogin} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
          <p className="text-slate-600 dark:text-slate-400">Caricamento dati in corso...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
      <header className="bg-white dark:bg-slate-800 shadow-sm sticky top-0 z-10 transition-colors duration-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-full shadow-sm">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-white hidden sm:block">{t('login.title')}</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 py-1.5 px-3 rounded-full border border-slate-200 dark:border-slate-600">
              <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="font-medium truncate max-w-[150px] sm:max-w-xs" title={condoName}>{condoName}</span>
            </div>
            
            {/* Language Selector */}
            <div className="relative" ref={langMenuRef}>
              <button 
                onClick={() => setShowLangMenu(!showLangMenu)}
                className="p-2 text-slate-400 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors" 
                title="Lingua / Language"
              >
                <Globe className="w-5 h-5" />
              </button>
              {showLangMenu && (
                <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 py-1 overflow-hidden animate-fade-in z-50">
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => { setLanguage(lang.code); setShowLangMenu(false); }}
                      className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${language === lang.code ? 'text-indigo-600 dark:text-indigo-400 font-medium' : 'text-slate-700 dark:text-slate-300'}`}
                    >
                      <span>{lang.flag}</span>
                      <span>{lang.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button 
              onClick={toggleTheme} 
              className="p-2 text-slate-400 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors" 
              title={darkMode ? t('nav.themeLight') : t('nav.themeDark')}
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 transition-colors" title={t('nav.logout')}>
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>
      
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 transition-colors duration-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-16">
          <div className="flex gap-1 md:gap-2">
            <NavButton active={currentView === 'dashboard'} onClick={() => handleNavClick('dashboard')} icon={<LayoutDashboard size={20} />} label={t('nav.dashboard')} />
            <NavButton active={currentView === 'list'} onClick={() => handleNavClick('list')} icon={<List size={20} />} label={t('nav.expenses')} />
            <NavButton active={currentView === 'listIncome'} onClick={() => handleNavClick('listIncome')} icon={<TrendingUp size={20} />} label={t('nav.incomes')} />
            <NavButton active={currentView === 'listBankAccounts'} onClick={() => handleNavClick('listBankAccounts')} icon={<Banknote size={20} />} label={t('nav.accounts')} />
            <NavButton active={currentView === 'reports'} onClick={() => handleNavClick('reports')} icon={<PieChart size={20} />} label={t('nav.reports')} />
          </div>
          <div className="flex gap-2 md:gap-3">
            <NavButton onClick={() => handleNavClick('add')} icon={<Plus size={20} />} label={t('nav.newExpense')} variant="primary" />
            <NavButton onClick={() => handleNavClick('addIncome')} icon={<DollarSign size={20} />} label={t('nav.newIncome')} variant="secondary" />
          </div>
        </div>
      </div>

      <main className="flex-1 w-full max-w-5xl mx-auto p-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-fade-in">
          {currentView === 'dashboard' && <Dashboard expenses={expenses} incomes={incomes} bankAccounts={bankAccounts} condoName={condoName} />}
          {currentView === 'list' && <ExpenseList expenses={expenses} onDelete={handleDeleteExpense} onEdit={handleStartEditExpense} condoName={condoName} bankAccounts={bankAccounts} onDuplicate={handleStartDuplicateExpense} onAdd={handleAddExpense} onClearAll={handleClearAllExpenses} />}
          {currentView === 'add' && <ExpenseForm key={editingExpense ? editingExpense.id : 'new'} onAdd={handleAddExpense} onUpdate={handleUpdateExpense} existingExpenses={expenses} initialData={editingExpense || undefined} onCancel={() => { setEditingExpense(null); setCurrentView('list'); }} bankAccounts={bankAccounts} />}
          {currentView === 'listIncome' && <IncomeList incomes={incomes} onDelete={handleDeleteIncome} onEdit={handleStartEditIncome} condoName={condoName} bankAccounts={bankAccounts} onAdd={handleAddIncome} onClearAll={handleClearAllIncomes} />}
          {currentView === 'addIncome' && <IncomeForm key={editingIncome ? editingIncome.id : 'new'} onAdd={handleAddIncome} onUpdate={handleUpdateIncome} initialData={editingIncome || undefined} onCancel={() => { setEditingIncome(null); setCurrentView('listIncome'); }} />}
          {currentView === 'listBankAccounts' && <BankAccountList bankAccounts={bankAccounts} onDelete={handleDeleteBankAccount} onEdit={handleStartEditBankAccount} expenses={expenses} incomes={incomes} />}
          {currentView === 'addBankAccount' && <BankAccountForm key={editingBankAccount ? editingBankAccount.id : 'new'} onAdd={handleAddBankAccount} onUpdate={handleUpdateBankAccount} initialData={editingBankAccount || undefined} onCancel={() => { setEditingBankAccount(null); setCurrentView('listBankAccounts'); }} />}
          {currentView === 'reports' && <ReportView expenses={expenses} incomes={incomes} condoName={condoName} />}
        </div>
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <LanguageProvider>
      <InnerApp />
    </LanguageProvider>
  );
};
