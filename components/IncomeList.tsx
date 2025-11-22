
import React, { useState } from 'react';
import { Income, IncomeCategory, BankAccount } from '../types';
import { Search, Filter, X, Calendar, ChevronDown, Trash2, AlertTriangle, Pencil, FileDown } from 'lucide-react';

interface IncomeListProps {
  incomes: Income[];
  onDelete: (id: string) => void;
  onEdit: (income: Income) => void;
  condoName: string;
  bankAccounts: BankAccount[];
}

const categoryColors: Record<IncomeCategory, string> = {
  [IncomeCategory.QUOTE]: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  [IncomeCategory.PULIZIA_GIARDINO]: 'bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-300',
  [IncomeCategory.QUOTA_AQP]: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  [IncomeCategory.ALTRO]: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
};

export const IncomeList: React.FC<IncomeListProps> = ({ incomes, onDelete, onEdit, condoName }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  
  const [incomeToDelete, setIncomeToDelete] = useState<string | null>(null);

  const activeFiltersCount = (startDate ? 1 : 0) + (endDate ? 1 : 0) + (selectedCategory ? 1 : 0);

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedCategory('');
    setSearchTerm('');
  };

  const confirmDelete = (id: string) => {
    setIncomeToDelete(id);
  };

  const executeDelete = () => {
    if (incomeToDelete) {
      onDelete(incomeToDelete);
      setIncomeToDelete(null);
    }
  };

  const filteredIncomes = incomes.filter(i => {
    const matchesSearch = i.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStartDate = startDate ? i.date >= startDate : true;
    const matchesEndDate = endDate ? i.date <= endDate : true;
    const matchesCategory = selectedCategory ? i.category === selectedCategory : true;
    return matchesSearch && matchesStartDate && matchesEndDate && matchesCategory;
  });

  const filteredTotal = filteredIncomes.reduce((sum, i) => sum + i.amount, 0);

  const handleExportCSV = () => {
    if (filteredIncomes.length === 0) return;

    const escapeCSV = (str: string) => `"${str.replace(/"/g, '""')}"`;

    const headers = ['ID', 'Data', 'Descrizione', 'Categoria', 'Importo'];
    
    const rows = filteredIncomes.map(i => [
      i.id,
      i.date,
      escapeCSV(i.description),
      i.category,
      i.amount.toString().replace('.', ',')
    ].join(';'));

    const csvContent = [headers.join(';'), ...rows].join('\n');
    
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    const fileName = `incassi_${condoName.replace(/\s/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-colors duration-200">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">Storico Incassi</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Visualizzati {filteredIncomes.length} movimenti per un totale di 
                <span className="font-bold text-slate-700 dark:text-slate-200 ml-1">
                  {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(filteredTotal)}
                </span>
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="relative flex-grow sm:flex-grow-0">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Cerca..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none w-full sm:w-48"
                />
              </div>
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`px-3 py-2 border rounded-lg transition-colors flex items-center gap-2 ${showFilters || activeFiltersCount > 0 ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700 text-green-600 dark:text-green-400' : 'border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
                title="Filtri avanzati"
              >
                <Filter size={16} />
                {activeFiltersCount > 0 && <span className="bg-green-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{activeFiltersCount}</span>}
              </button>
              <button
                onClick={handleExportCSV}
                className="px-3 py-2 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
                title="Esporta CSV"
              >
                <FileDown size={16} />
                <span className="hidden sm:inline">CSV</span>
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Dal</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full py-2 px-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Al</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full py-2 px-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Categoria</label>
                <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="w-full py-2 px-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none appearance-none">
                  <option value="">Tutte le categorie</option>
                  {Object.values(IncomeCategory).map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <button onClick={clearFilters} className="w-full py-2 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg text-sm font-medium"><X size={16} className="inline-block mr-1" />Resetta</button>
              </div>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-300 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-medium">Data</th>
                <th className="px-6 py-4 font-medium">Descrizione</th>
                <th className="px-6 py-4 font-medium">Categoria</th>
                <th className="px-6 py-4 font-medium text-right">Importo</th>
                <th className="px-6 py-4 font-medium text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {filteredIncomes.length > 0 ? (
                filteredIncomes.map((income) => (
                  <tr key={income.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {new Date(income.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4 text-slate-900 dark:text-white font-medium">{income.description}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${categoryColors[income.category as IncomeCategory] || 'bg-slate-100 text-slate-600'}`}>
                        {income.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-green-600 dark:text-green-400">
                      {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(income.amount)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => onEdit(income)} className="text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 p-2 rounded-lg" title="Modifica"><Pencil size={18} /></button>
                        <button onClick={() => confirmDelete(income.id)} className="text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg" title="Elimina"><Trash2 size={18} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                    Nessun incasso trovato.
                  </td>
                </tr>
              )}
            </tbody>
            {filteredIncomes.length > 0 && (
              <tfoot className="bg-slate-50 dark:bg-slate-700 border-t-2 border-slate-100 dark:border-slate-600">
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-right font-bold text-slate-600 dark:text-slate-300">TOTALE</td>
                  <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-white text-lg">
                    {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(filteredTotal)}
                  </td>
                  <td className="px-6 py-4"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {incomeToDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-sm w-full p-6 border border-slate-200 dark:border-slate-700">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mt-3">Elimina Incasso</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Sei sicuro? L'operazione è irreversibile.</p>
            </div>
            <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
              <button onClick={executeDelete} type="button" className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700">Elimina</button>
              <button onClick={() => setIncomeToDelete(null)} type="button" className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-slate-600 shadow-sm px-4 py-2 bg-white dark:bg-slate-700 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-600 sm:mt-0">Annulla</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
