import React, { useMemo, useState } from 'react';
import { Expense, Income, BankAccount } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { TrendingUp, TrendingDown, AlertCircle, CalendarRange, ChevronDown, Download, Database, FileSpreadsheet, FileJson, FileText, CheckCircle2, Wallet, AlertTriangle, Clock } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { utils, writeFile } from 'xlsx';

interface DashboardProps {
  expenses: Expense[];
  incomes: Income[];
  bankAccounts: BankAccount[];
  condoName: string;
}

// Mappatura colori specifici per categoria per il grafico
const CHART_COLORS: Record<string, string> = {
  'Manutenzione': '#f97316', // Orange
  'Utenze': '#3b82f6', // Blue
  'Pulizia': '#14b8a6', // Teal
  'Pulizia Scale': '#10b981', // Emerald
  'Amministrazione': '#d946ef', // Fuchsia (Requested)
  'Compenso Amministratore': '#a855f7', // Purple
  'Assicurazione': '#f43f5e', // Rose
  'Spese Bancarie': '#eab308', // Yellow (Requested)
  'Bollettino Postale': '#f59e0b', // Amber
  'Lettura Acqua': '#06b6d4', // Cyan
  'Varie': '#64748b', // Slate
};

const DEFAULT_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

export const Dashboard: React.FC<DashboardProps> = ({ expenses, incomes, bankAccounts, condoName }) => {
  const { t, language } = useLanguage();
  
  const allYears = useMemo(() => {
    const expenseYears = expenses.map(e => new Date(e.date).getFullYear());
    const incomeYears = incomes.map(i => new Date(i.date).getFullYear());
    const years = new Set<number>([...expenseYears, ...incomeYears]);
    const currentYear = new Date().getFullYear();
    years.add(currentYear);
    return Array.from(years).sort((a, b) => b - a);
  }, [expenses, incomes]);

  const [selectedYear, setSelectedYear] = useState<number>(allYears[0]);

  const yearlyExpenses = useMemo(() => {
    return expenses.filter(e => new Date(e.date).getFullYear() === selectedYear);
  }, [expenses, selectedYear]);
  
  const yearlyIncomes = useMemo(() => {
    return incomes.filter(i => new Date(i.date).getFullYear() === selectedYear);
  }, [incomes, selectedYear]);

  // Totale Spese (Registrate - Da pagare + Pagate)
  const totalAmount = useMemo(() => {
    return yearlyExpenses.reduce((sum, item) => sum + item.amount, 0);
  }, [yearlyExpenses]);

  // Totale Spese (Solo Pagate) - Mantenuto per statistica ed export
  const totalPaidAmount = useMemo(() => {
    return yearlyExpenses
      .filter(item => item.status === 'paid')
      .reduce((sum, item) => sum + item.amount, 0);
  }, [yearlyExpenses]);

  const totalIncassato = useMemo(() => {
    return yearlyIncomes.reduce((sum, item) => sum + item.amount, 0);
  }, [yearlyIncomes]);

  // Saldo Esercizio = Incassi - Totale Spese (Richiesta utente: differenza tra incassato e totale da pagare)
  const currentBalance = totalIncassato - totalAmount;

  // Spese Scadute (Globali, non solo anno selezionato)
  const overdueExpenses = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return expenses
      .filter(e => e.status === 'unpaid' && e.date < today)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Ordina per data (più vecchie prima)
  }, [expenses]);

  const getDaysOverdue = (dateString: string) => {
    const today = new Date();
    const expenseDate = new Date(dateString);
    const diffTime = Math.abs(today.getTime() - expenseDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    return diffDays;
  };

  const categoryData = useMemo(() => {
    const map = new Map<string, number>();
    yearlyExpenses.forEach(e => {
      map.set(e.category, (map.get(e.category) || 0) + e.amount);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [yearlyExpenses]);

  const monthlyData = useMemo(() => {
    const expensesMap = new Map<number, number>();
    const incomesMap = new Map<number, number>();
    
    // Initialize
    for (let i = 0; i < 12; i++) {
        expensesMap.set(i, 0);
        incomesMap.set(i, 0);
    }

    // Fill Expenses
    yearlyExpenses.forEach(e => {
      const month = new Date(e.date).getMonth();
      expensesMap.set(month, (expensesMap.get(month) || 0) + e.amount);
    });

    // Fill Incomes
    yearlyIncomes.forEach(i => {
      const month = new Date(i.date).getMonth();
      incomesMap.set(month, (incomesMap.get(month) || 0) + i.amount);
    });

    return Array.from(expensesMap.keys())
      .sort((a, b) => a - b)
      .map((monthIndex) => {
        const dateObj = new Date(selectedYear, monthIndex);
        const locale = language === 'en' ? 'en-US' : (language === 'it' ? 'it-IT' : language);
        const label = dateObj.toLocaleDateString(locale, { month: 'short' });
        return {
          name: label.charAt(0).toUpperCase() + label.slice(1),
          monthIndex,
          expense: expensesMap.get(monthIndex) || 0,
          income: incomesMap.get(monthIndex) || 0
        };
      });
  }, [yearlyExpenses, yearlyIncomes, selectedYear, language]);

  const formatCurrency = (val: number) => {
    const locale = language === 'en' ? 'en-US' : (language === 'it' ? 'it-IT' : language);
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(val);
  };

  const paidPercentage = totalAmount > 0 ? Math.round((totalPaidAmount / totalAmount) * 100) : 0;

  const handleExportBackup = () => {
    const backupData = {
      condoName,
      exportDate: new Date().toISOString(),
      expenses,
      incomes,
      bankAccounts,
      version: '1.0'
    };
    
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_${condoName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportExcel = () => {
    // 1. Prepare Data for Worksheets
    
    // Summary Sheet
    const summaryData = [
        { Chiave: "Nome Condominio", Valore: condoName },
        { Chiave: "Data Esportazione", Valore: new Date().toLocaleDateString() },
        { Chiave: "Totale Spese", Valore: totalAmount },
        { Chiave: "Totale Spese Pagate", Valore: totalPaidAmount },
        { Chiave: "Totale Entrate", Valore: totalIncassato },
        { Chiave: "Saldo Esercizio", Valore: currentBalance }
    ];

    // Expenses Sheet
    const expensesData = expenses.map(e => ({
        ID: e.id,
        Data: e.date,
        Descrizione: e.description,
        Categoria: e.category,
        Importo: e.amount,
        Stato: e.status,
        Conto_ID: e.bankAccountId || '',
        Conto_Nome: bankAccounts.find(b => b.id === e.bankAccountId)?.name || ''
    }));

    // Incomes Sheet
    const incomesData = incomes.map(i => ({
        ID: i.id,
        Data: i.date,
        Descrizione: i.description,
        Categoria: i.category,
        Importo: i.amount,
        Conto_ID: i.bankAccountId || '',
        Conto_Nome: bankAccounts.find(b => b.id === i.bankAccountId)?.name || ''
    }));

    // Accounts Sheet
    const accountsData = bankAccounts.map(a => ({
        ID: a.id,
        Nome: a.name,
        IBAN: a.iban,
        Saldo_Iniziale: a.initialBalance
    }));

    // 2. Create Workbook
    const wb = utils.book_new();

    // 3. Create Worksheets
    const wsSummary = utils.json_to_sheet(summaryData);
    const wsExpenses = utils.json_to_sheet(expensesData);
    const wsIncomes = utils.json_to_sheet(incomesData);
    const wsAccounts = utils.json_to_sheet(accountsData);

    // 4. Append Worksheets to Workbook
    utils.book_append_sheet(wb, wsSummary, "Riepilogo");
    utils.book_append_sheet(wb, wsExpenses, "Spese");
    utils.book_append_sheet(wb, wsIncomes, "Incassi");
    utils.book_append_sheet(wb, wsAccounts, "Conti");

    // 5. Download File
    writeFile(wb, `condominio_export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const locale = language === 'en' ? 'en-US' : (language === 'it' ? 'it-IT' : language);
    const dateStr = new Date().toLocaleDateString(locale);

    // Header
    doc.setFontSize(22);
    doc.setTextColor(79, 70, 229); // Indigo
    doc.text(condoName, 14, 20);
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Report Completo - ${dateStr}`, 14, 28);

    let finalY = 35;

    // --- SUMMARY SECTION ---
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text(t('dashboard.overview'), 14, finalY);
    finalY += 10;

    const totExp = expenses.reduce((a, b) => a + b.amount, 0);
    const totPaid = expenses.filter(e => e.status === 'paid').reduce((a, b) => a + b.amount, 0);
    const totInc = incomes.reduce((a, b) => a + b.amount, 0);
    const balance = totInc - totExp; // Changed to match dashboard logic

    const summaryData = [
        [t('dashboard.totalExpenses'), new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(totExp)],
        [t('dashboard.totalIncome'), new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(totInc)],
        [t('dashboard.balance'), new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(balance)],
    ];

    (doc as any).autoTable({
        startY: finalY,
        head: [['Voce', 'Valore']],
        body: summaryData,
        theme: 'striped',
        headStyles: { fillColor: [100, 116, 139] },
    });

    finalY = (doc as any).lastAutoTable.finalY + 15;

    // --- EXPENSES SECTION ---
    doc.text(t('nav.expenses'), 14, finalY);
    
    const expensesRows = expenses.map(e => [
        e.date,
        e.description,
        e.category,
        e.status === 'paid' ? 'Pagato' : 'Da Pagare',
        new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(e.amount)
    ]);

    (doc as any).autoTable({
        startY: finalY + 5,
        head: [['Data', 'Descrizione', 'Categoria', 'Stato', 'Importo']],
        body: expensesRows,
        theme: 'grid',
        headStyles: { fillColor: [239, 68, 68] }, // Red for expenses
    });

    finalY = (doc as any).lastAutoTable.finalY + 15;

    // --- INCOMES SECTION ---
    // Check if we need a new page
    if (finalY > 250) {
        doc.addPage();
        finalY = 20;
    }

    doc.text(t('nav.incomes'), 14, finalY);

    const incomesRows = incomes.map(i => [
        i.date,
        i.description,
        i.category,
        new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(i.amount)
    ]);

    (doc as any).autoTable({
        startY: finalY + 5,
        head: [['Data', 'Descrizione', 'Categoria', 'Importo']],
        body: incomesRows,
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129] }, // Green for incomes
    });

    const fileName = `report_completo_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-slate-800 dark:text-white">{t('dashboard.overview')}</h2>
        
        <div className="relative">
          <CalendarRange className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4" />
          <select 
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="pl-9 pr-8 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-green-500 outline-none appearance-none cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            {allYears.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4 pointer-events-none" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Expenses */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium">{t('dashboard.totalExpenses')}</h3>
            <div className="p-2 bg-red-50 dark:bg-red-900/30 rounded-lg">
              <TrendingDown className="w-5 h-5 text-red-500 dark:text-red-400" />
            </div>
          </div>
          <p className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white">{formatCurrency(totalAmount)}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            {yearlyExpenses.length} {t('dashboard.movements')}
          </p>
        </div>

        {/* Paid Expenses */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium">{t('dashboard.totalPaidExpenses')}</h3>
            <div className="p-2 bg-violet-50 dark:bg-violet-900/30 rounded-lg">
              <Wallet className="w-5 h-5 text-violet-500 dark:text-violet-400" />
            </div>
          </div>
          <p className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white">{formatCurrency(totalPaidAmount)}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
             {t('dashboard.paidPercentage').replace('{percent}', paidPercentage.toString())}
          </p>
        </div>

        {/* Total Income */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium">{t('dashboard.totalIncome')}</h3>
            <div className="p-2 bg-green-50 dark:bg-green-900/30 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-500 dark:text-green-400" />
            </div>
          </div>
          <p className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white">{formatCurrency(totalIncassato)}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
             {yearlyIncomes.length} {t('dashboard.incomesRecorded')}
          </p>
        </div>

        {/* Balance */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium">{t('dashboard.balance')}</h3>
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
              <AlertCircle className="w-5 h-5 text-blue-500 dark:text-blue-400" />
            </div>
          </div>
          <p className={`text-2xl lg:text-3xl font-bold ${currentBalance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {formatCurrency(currentBalance)}
          </p>
          <div className="flex items-center gap-1 mt-1 text-xs text-slate-400 dark:text-slate-500">
            <CheckCircle2 className="w-3 h-3" />
            <span>Incassi - Tot. Spese</span>
          </div>
        </div>
      </div>

      {/* OVERDUE EXPENSES ALERT */}
      {overdueExpenses.length > 0 && (
        <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 rounded-xl p-4 sm:p-6 animate-fade-in">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/40 rounded-lg shrink-0">
              <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="flex-1">
               <h3 className="text-lg font-bold text-orange-800 dark:text-orange-200">
                 {t('dashboard.overdueTitle')}
               </h3>
               <p className="text-sm text-orange-700 dark:text-orange-300/80 mt-1 mb-4">
                 {t('dashboard.overdueSubtitle').replace('{count}', overdueExpenses.length.toString())}
               </p>
               
               <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {overdueExpenses.map(expense => (
                     <div key={expense.id} className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-orange-100 dark:border-slate-700 shadow-sm flex items-center justify-between">
                        <div>
                           <p className="font-medium text-slate-800 dark:text-white truncate max-w-[150px]">{expense.description}</p>
                           <p className="text-xs text-slate-500 dark:text-slate-400">{expense.date}</p>
                        </div>
                        <div className="text-right">
                           <p className="font-bold text-red-600 dark:text-red-400">{formatCurrency(expense.amount)}</p>
                           <p className="text-[10px] flex items-center justify-end gap-1 text-orange-600 dark:text-orange-400 font-medium">
                              <Clock size={10} />
                              {t('dashboard.daysOverdue').replace('{days}', getDaysOverdue(expense.date).toString())}
                           </p>
                        </div>
                     </div>
                  ))}
               </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">{t('dashboard.breakdown')} {selectedYear}</h2>
          <div className="h-64">
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={CHART_COLORS[entry.name] || DEFAULT_COLORS[index % DEFAULT_COLORS.length]} 
                        stroke="rgba(255,255,255,0.1)" 
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)} 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: '#1e293b', color: '#fff' }}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
                {t('dashboard.noExpenses')}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">{t('dashboard.monthlyTrend')} {selectedYear}</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.3} />
                <XAxis 
                  dataKey="name" 
                  tick={{fontSize: 12, fill: '#64748b'}} 
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  tick={{fontSize: 12, fill: '#64748b'}} 
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `€${value}`}
                />
                <Tooltip 
                  cursor={{fill: '#f1f5f9', opacity: 0.1}} 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: '#1e293b', color: '#fff' }}
                />
                <Legend />
                <Bar dataKey="income" name={t('dashboard.totalIncome')} fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="expense" name={t('dashboard.totalExpenses')} fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-indigo-500" />
              {t('dashboard.dataManagement')}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {t('dashboard.backupDesc')}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
             {/* JSON Backup */}
             <button 
              onClick={handleExportBackup}
              className="flex items-center justify-center gap-3 px-4 py-4 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors border border-slate-200 dark:border-slate-600 group"
            >
              <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm group-hover:scale-110 transition-transform">
                 <FileJson className="w-6 h-6 text-orange-500" />
              </div>
              <div className="text-left">
                <span className="block font-medium text-sm">{t('dashboard.exportBackup')}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">JSON Completo</span>
              </div>
            </button>

             {/* Excel Export */}
            <button 
              onClick={handleExportExcel}
              className="flex items-center justify-center gap-3 px-4 py-4 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 rounded-xl hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors border border-green-200 dark:border-green-800 group"
            >
              <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm group-hover:scale-110 transition-transform">
                 <FileSpreadsheet className="w-6 h-6 text-green-600" />
              </div>
              <div className="text-left">
                <span className="block font-medium text-sm">{t('dashboard.exportExcel')}</span>
                <span className="block text-xs text-green-600/70 dark:text-green-400/70">.xlsx (Multi-foglio)</span>
              </div>
            </button>

             {/* PDF Report */}
            <button 
              onClick={handleExportPDF}
              className="flex items-center justify-center gap-3 px-4 py-4 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors border border-red-200 dark:border-red-800 group"
            >
              <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm group-hover:scale-110 transition-transform">
                 <FileText className="w-6 h-6 text-red-600" />
              </div>
              <div className="text-left">
                <span className="block font-medium text-sm">{t('dashboard.exportPDF')}</span>
                <span className="block text-xs text-red-600/70 dark:text-red-400/70">Report Stampabile</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};