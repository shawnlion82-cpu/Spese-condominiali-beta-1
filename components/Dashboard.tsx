
import React, { useMemo, useState } from 'react';
import { Expense, Income, BankAccount } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { TrendingUp, TrendingDown, AlertCircle, CalendarRange, ChevronDown } from 'lucide-react';

interface DashboardProps {
  expenses: Expense[];
  incomes: Income[];
  bankAccounts: BankAccount[];
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

export const Dashboard: React.FC<DashboardProps> = ({ expenses, incomes }) => {
  
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

  const totalAmount = useMemo(() => {
    return yearlyExpenses.reduce((sum, item) => sum + item.amount, 0);
  }, [yearlyExpenses]);

  const totalIncassato = useMemo(() => {
    return yearlyIncomes.reduce((sum, item) => sum + item.amount, 0);
  }, [yearlyIncomes]);

  const categoryData = useMemo(() => {
    const map = new Map<string, number>();
    yearlyExpenses.forEach(e => {
      map.set(e.category, (map.get(e.category) || 0) + e.amount);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [yearlyExpenses]);

  const monthlyData = useMemo(() => {
    const monthsMap = new Map<number, number>();
    for (let i = 0; i < 12; i++) monthsMap.set(i, 0);

    yearlyExpenses.forEach(e => {
      const month = new Date(e.date).getMonth();
      monthsMap.set(month, (monthsMap.get(month) || 0) + e.amount);
    });

    return Array.from(monthsMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([monthIndex, value]) => {
        const dateObj = new Date(selectedYear, monthIndex);
        const label = dateObj.toLocaleDateString('it-IT', { month: 'short' });
        return {
          name: label.charAt(0).toUpperCase() + label.slice(1),
          monthIndex,
          value: value
        };
      });
  }, [yearlyExpenses, selectedYear]);

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-slate-800 dark:text-white">Panoramica Esercizio</h2>
        
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium">Totale Spese {selectedYear}</h3>
            <div className="p-2 bg-red-50 dark:bg-red-900/30 rounded-lg">
              <TrendingDown className="w-5 h-5 text-red-500 dark:text-red-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{formatCurrency(totalAmount)}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            {yearlyExpenses.length} movimenti registrati
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium">Totale Incassato {selectedYear}</h3>
            <div className="p-2 bg-green-50 dark:bg-green-900/30 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-500 dark:text-green-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{formatCurrency(totalIncassato)}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
             {yearlyIncomes.length} incassi registrati
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium">Saldo Esercizio</h3>
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
              <AlertCircle className="w-5 h-5 text-blue-500 dark:text-blue-400" />
            </div>
          </div>
          <p className={`text-3xl font-bold ${totalIncassato - totalAmount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {formatCurrency(totalIncassato - totalAmount)}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Differenza tra incassi e spese</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Ripartizione Spese {selectedYear}</h2>
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
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(255,255,255,0.1)" />
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
                Nessuna spesa per l'anno selezionato
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Andamento Spese Mensili {selectedYear}</h2>
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
                <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
