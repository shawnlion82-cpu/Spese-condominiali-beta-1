
import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Plus, LogOut, Building2, TrendingUp, List, DollarSign, Banknote, Moon, Sun } from 'lucide-react';
import { LoginScreen } from './components/LoginScreen';
import { Dashboard } from './components/Dashboard';
import { ExpenseForm } from './components/ExpenseForm';
import { ExpenseList } from './components/ExpenseList';
import { IncomeForm } from './components/IncomeForm';
import { IncomeList } from './components/IncomeList';
import { BankAccountList } from './components/BankAccountList';
import { BankAccountForm } from './components/BankAccountForm';
import { Expense, Income, BankAccount } from './types';
import { generateId } from './utils';

const defaultExpenses: Expense[] = [
  { id: '1', description: 'Manutenzione Ascensore', amount: 450.00, date: '2023-10-15', category: 'Manutenzione', bankAccountId: 'acc1', status: 'paid' },
  { id: '2', description: 'Bolletta Luce Scale', amount: 125.50, date: '2023-10-20', category: 'Utenze', bankAccountId: 'acc1', status: 'paid' },
  { id: '3', description: 'Pulizia Parti Comuni', amount: 300.00, date: '2023-11-01', category: 'Pulizia', bankAccountId: 'acc1', status: 'unpaid' },
  { id: '4', description: 'Sostituzione Lampadine', amount: 45.90, date: '2023-11-05', category: 'Manutenzione', bankAccountId: 'acc2', status: 'paid' },
  { id: '5', description: 'Spese Annuali', amount: 500.00, date: '2023-11-15', category: 'Amministrazione', bankAccountId: 'acc1', status: 'unpaid' },
];

const defaultIncomes: Income[] = [
  { id: 'inc1', description: 'Quota Condominiale - Rossi', amount: 550.00, date: '2023-10-05', category: 'Quote Condominiali', bankAccountId: 'acc1' },
  { id: 'inc2', description: 'Quota Condominiale - Bianchi', amount: 550.00, date: '2023-10-05', category: 'Quote Condominiali', bankAccountId: 'acc1' },
  { id: 'inc3', description: 'Affitto Lastrico Solare', amount: 1200.00, date: '2023-11-10', category: 'Altro', bankAccountId: 'acc2' },
];

const defaultBankAccounts: BankAccount[] = [
  { id: 'acc1', name: 'Conto Principale', initialBalance: 5000, iban: 'IT60X0542811101000000123456' },
  { id: 'acc2', name: 'Conto Risparmio', initialBalance: 10000, iban: 'IT12A0306909606100000063157' },
];

const getStorageKey = (type: 'expenses' | 'incomes' | 'bankAccounts', name: string) => `condo_${type}_${name.replace(/\s/g, '_')}`;

type View = 'dashboard' | 'add' | 'list' | 'addIncome' | 'listIncome' | 'listBankAccounts' | 'addBankAccount';

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

export const App: React.FC = () => {
  const [condoName, setCondoName] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [darkMode, setDarkMode] = useState(false);
  
  // Expenses State
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Incomes State
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);

  // Bank Accounts State
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [editingBankAccount, setEditingBankAccount] = useState<BankAccount | null>(null);

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

  // Load data when condoName changes
  useEffect(() => {
    if (condoName) {
      // Load Expenses
      try {
        setExpenses(JSON.parse(localStorage.getItem(getStorageKey('expenses', condoName)) || JSON.stringify(defaultExpenses)));
      } catch (e) { console.error(e); setExpenses([]); }
      
      // Load Incomes
      try {
        setIncomes(JSON.parse(localStorage.getItem(getStorageKey('incomes', condoName)) || JSON.stringify(defaultIncomes)));
      } catch (e) { console.error(e); setIncomes([]); }

      // Load Bank Accounts
      try {
        setBankAccounts(JSON.parse(localStorage.getItem(getStorageKey('bankAccounts', condoName)) || JSON.stringify(defaultBankAccounts)));
      } catch (e) { console.error(e); setBankAccounts([]); }
    } else {
      setExpenses([]);
      setIncomes([]);
      setBankAccounts([]);
    }
  }, [condoName]);

  // Save data whenever it changes
  useEffect(() => {
    if (condoName) {
      try {
        localStorage.setItem(getStorageKey('expenses', condoName), JSON.stringify(expenses));
      } catch (e) {
        console.error("Quota exceeded saving expenses", e);
        alert("Attenzione: Spazio di archiviazione pieno. Impossibile salvare le spese. Riduci la dimensione degli allegati.");
      }
    }
  }, [expenses, condoName]);

  useEffect(() => {
    if (condoName) {
      try {
        localStorage.setItem(getStorageKey('incomes', condoName), JSON.stringify(incomes));
      } catch (e) {
        console.error("Quota exceeded saving incomes", e);
      }
    }
  }, [incomes, condoName]);

  useEffect(() => {
    if (condoName) {
      try {
        localStorage.setItem(getStorageKey('bankAccounts', condoName), JSON.stringify(bankAccounts));
      } catch (e) {
        console.error("Quota exceeded saving bank accounts", e);
      }
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
    setCurrentView('list');
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
  
  const handleStartDuplicateExpense = (expense: Expense) => {
     const duplicatedExpense: Expense = {
      ...expense,
      id: generateId(),
      description: `${expense.description} (Copia)`,
      date: new Date().toISOString().split('T')[0],
      attachments: [] // Do not copy attachments to save space
     };
     setEditingExpense(duplicatedExpense);
     setCurrentView('add');
  };


  // Income Handlers
  const handleAddIncome = (income: Income) => {
    setIncomes(prev => [income, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setCurrentView('listIncome');
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

  if (!condoName) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
      <header className="bg-white dark:bg-slate-800 shadow-sm sticky top-0 z-10 transition-colors duration-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-full shadow-sm">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-white hidden sm:block">Spese Condominiali</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 py-1.5 px-3 rounded-full border border-slate-200 dark:border-slate-600">
              <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="font-medium truncate max-w-[150px] sm:max-w-xs" title={condoName}>{condoName}</span>
            </div>
            <button 
              onClick={toggleTheme} 
              className="p-2 text-slate-400 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors" 
              title={darkMode ? "Modalità Chiara" : "Modalità Scura"}
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 transition-colors" title="Cambia Condominio">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>
      
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 transition-colors duration-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-16">
          <div className="flex gap-1 md:gap-2">
            <NavButton active={currentView === 'dashboard'} onClick={() => handleNavClick('dashboard')} icon={<LayoutDashboard size={20} />} label="Dashboard" />
            <NavButton active={currentView === 'list'} onClick={() => handleNavClick('list')} icon={<List size={20} />} label="Lista Spese" />
            <NavButton active={currentView === 'listIncome'} onClick={() => handleNavClick('listIncome')} icon={<TrendingUp size={20} />} label="Lista Incassi" />
            <NavButton active={currentView === 'listBankAccounts'} onClick={() => handleNavClick('listBankAccounts')} icon={<Banknote size={20} />} label="Conti" />
          </div>
          <div className="flex gap-2 md:gap-3">
            <NavButton onClick={() => handleNavClick('add')} icon={<Plus size={20} />} label="Nuova Spesa" variant="primary" />
            <NavButton onClick={() => handleNavClick('addIncome')} icon={<DollarSign size={20} />} label="Nuovo Incasso" variant="secondary" />
          </div>
        </div>
      </div>

      <main className="flex-1 w-full max-w-5xl mx-auto p-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-fade-in">
          {currentView === 'dashboard' && <Dashboard expenses={expenses} incomes={incomes} bankAccounts={bankAccounts} condoName={condoName} />}
          {currentView === 'list' && <ExpenseList expenses={expenses} onDelete={handleDeleteExpense} onEdit={handleStartEditExpense} condoName={condoName} bankAccounts={bankAccounts} onDuplicate={handleStartDuplicateExpense} />}
          {currentView === 'add' && <ExpenseForm key={editingExpense ? editingExpense.id : 'new'} onAdd={handleAddExpense} onUpdate={handleUpdateExpense} existingExpenses={expenses} initialData={editingExpense || undefined} onCancel={() => { setEditingExpense(null); setCurrentView('list'); }} bankAccounts={bankAccounts} />}
          {currentView === 'listIncome' && <IncomeList incomes={incomes} onDelete={handleDeleteIncome} onEdit={handleStartEditIncome} condoName={condoName} bankAccounts={bankAccounts} />}
          {currentView === 'addIncome' && <IncomeForm key={editingIncome ? editingIncome.id : 'new'} onAdd={handleAddIncome} onUpdate={handleUpdateIncome} initialData={editingIncome || undefined} onCancel={() => { setEditingIncome(null); setCurrentView('listIncome'); }} />}
          {currentView === 'listBankAccounts' && <BankAccountList bankAccounts={bankAccounts} onDelete={handleDeleteBankAccount} onEdit={handleStartEditBankAccount} expenses={expenses} incomes={incomes} />}
          {currentView === 'addBankAccount' && <BankAccountForm key={editingBankAccount ? editingBankAccount.id : 'new'} onAdd={handleAddBankAccount} onUpdate={handleUpdateBankAccount} initialData={editingBankAccount || undefined} onCancel={() => { setEditingBankAccount(null); setCurrentView('listBankAccounts'); }} />}
        </div>
      </main>
    </div>
  );
};
