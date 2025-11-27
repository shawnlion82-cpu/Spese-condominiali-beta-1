
import React, { useMemo, useState } from 'react';
import { Expense } from '../types';
import { CalendarRange, Layers, Calendar, ChevronDown, PieChart } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

interface ReportViewProps {
  expenses: Expense[];
  condoName: string;
}

type GroupMode = 'month' | 'category';

interface GroupedData {
  key: string;
  label: string;
  total: number;
  items: {
    label: string;
    amount: number;
    count: number;
  }[];
}

export const ReportView: React.FC<ReportViewProps> = ({ expenses, condoName }) => {
  const { t, language } = useLanguage();
  
  const allYears = useMemo(() => {
    const expenseYears = expenses.map(e => new Date(e.date).getFullYear());
    const years = new Set<number>([...expenseYears]);
    const currentYear = new Date().getFullYear();
    years.add(currentYear);
    return Array.from(years).sort((a, b) => b - a);
  }, [expenses]);

  const [selectedYear, setSelectedYear] = useState<number>(allYears[0]);
  const [groupMode, setGroupMode] = useState<GroupMode>('month');

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => new Date(e.date).getFullYear() === selectedYear);
  }, [expenses, selectedYear]);

  const groupedData = useMemo<GroupedData[]>(() => {
    const data: GroupedData[] = [];
    const locale = language === 'en' ? 'en-US' : (language === 'it' ? 'it-IT' : language);

    if (groupMode === 'month') {
      // Initialize all months
      const monthsMap = new Map<number, { total: number, subs: Map<string, number>, subCounts: Map<string, number> }>();
      
      filteredExpenses.forEach(e => {
        const month = new Date(e.date).getMonth();
        const cat = e.category;
        
        if (!monthsMap.has(month)) {
          monthsMap.set(month, { total: 0, subs: new Map(), subCounts: new Map() });
        }
        
        const monthData = monthsMap.get(month)!;
        monthData.total += e.amount;
        monthData.subs.set(cat, (monthData.subs.get(cat) || 0) + e.amount);
        monthData.subCounts.set(cat, (monthData.subCounts.get(cat) || 0) + 1);
      });

      // Sort by month index descending (latest first)
      const sortedMonths = Array.from(monthsMap.keys()).sort((a, b) => b - a);
      
      sortedMonths.forEach(monthIdx => {
        const d = monthsMap.get(monthIdx)!;
        const date = new Date(selectedYear, monthIdx);
        const monthName = date.toLocaleDateString(locale, { month: 'long' });
        
        const items = Array.from(d.subs.entries()).map(([cat, amount]) => ({
          label: cat,
          amount,
          count: d.subCounts.get(cat) || 0
        })).sort((a, b) => b.amount - a.amount);

        data.push({
          key: monthIdx.toString(),
          label: monthName.charAt(0).toUpperCase() + monthName.slice(1),
          total: d.total,
          items
        });
      });

    } else {
      // Group by Category
      const catMap = new Map<string, { total: number, subs: Map<number, number>, subCounts: Map<number, number> }>();

      filteredExpenses.forEach(e => {
        const cat = e.category;
        const month = new Date(e.date).getMonth();

        if (!catMap.has(cat)) {
          catMap.set(cat, { total: 0, subs: new Map(), subCounts: new Map() });
        }

        const catData = catMap.get(cat)!;
        catData.total += e.amount;
        catData.subs.set(month, (catData.subs.get(month) || 0) + e.amount);
        catData.subCounts.set(month, (catData.subCounts.get(month) || 0) + 1);
      });

      const sortedCats = Array.from(catMap.keys()).sort();

      sortedCats.forEach(cat => {
        const d = catMap.get(cat)!;
        
        const items = Array.from(d.subs.entries()).map(([monthIdx, amount]) => {
          const date = new Date(selectedYear, monthIdx);
          const monthName = date.toLocaleDateString(locale, { month: 'long' });
          return {
            label: monthName.charAt(0).toUpperCase() + monthName.slice(1),
            amount,
            count: d.subCounts.get(monthIdx) || 0,
            monthIdx // Used for sorting
          };
        }).sort((a, b) => a.monthIdx - b.monthIdx); // Chronological order inside category

        data.push({
          key: cat,
          label: cat,
          total: d.total,
          items
        });
      });
    }

    return data;
  }, [filteredExpenses, groupMode, language, selectedYear]);

  const formatCurrency = (val: number) => {
    const locale = language === 'en' ? 'en-US' : (language === 'it' ? 'it-IT' : language);
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(val);
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-colors duration-200">
      <div className="p-6 border-b border-slate-200 dark:border-slate-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <PieChart className="w-5 h-5 text-indigo-500" />
              {t('reports.title')}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('reports.subtitle')}</p>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="relative">
                <CalendarRange className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4" />
                <select 
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="pl-9 pr-8 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer"
                >
                  {allYears.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4 pointer-events-none" />
             </div>
          </div>
        </div>

        <div className="flex gap-2 mt-6 p-1 bg-slate-100 dark:bg-slate-700/50 rounded-lg w-fit">
          <button
            onClick={() => setGroupMode('month')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              groupMode === 'month' 
                ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-300 shadow-sm' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <Calendar size={16} />
            {t('reports.groupByMonth')}
          </button>
          <button
            onClick={() => setGroupMode('category')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              groupMode === 'category' 
                ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-300 shadow-sm' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <Layers size={16} />
            {t('reports.groupByCategory')}
          </button>
        </div>
      </div>

      <div className="p-6 bg-slate-50/50 dark:bg-slate-900/20 min-h-[300px]">
        {groupedData.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groupedData.map((group) => (
              <div key={group.key} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 bg-slate-50 dark:bg-slate-700/30 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 dark:text-slate-200">{group.label}</h3>
                  <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 px-2 py-1 rounded text-xs font-bold">
                    {formatCurrency(group.total)}
                  </span>
                </div>
                <div className="p-2 flex-1">
                   <table className="w-full text-sm">
                      <tbody>
                        {group.items.map((item, idx) => (
                          <tr key={idx} className="border-b border-slate-50 dark:border-slate-700/50 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                            <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                               {item.label} 
                               <span className="text-xs text-slate-400 dark:text-slate-500 ml-1">({item.count})</span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-medium text-slate-800 dark:text-slate-200">
                               {formatCurrency(item.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                   </table>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-12 text-slate-400 dark:text-slate-500">
            <PieChart className="w-12 h-12 mb-3 opacity-20" />
            <p>{t('reports.empty')}</p>
          </div>
        )}
      </div>
    </div>
  );
};
