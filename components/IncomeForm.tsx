
import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { Income, IncomeCategory } from '../types';

interface IncomeFormProps {
  onAdd: (income: Income) => void;
  onUpdate?: (income: Income) => void;
  onCancel: () => void;
  initialData?: Income;
}

export const IncomeForm: React.FC<IncomeFormProps> = ({ onAdd, onUpdate, onCancel, initialData }) => {
  const [mode, setMode] = useState<'single' | 'monthly'>(initialData ? 'single' : 'single');

  // State for Single Income
  const [description, setDescription] = useState(initialData?.description || '');
  const [amount, setAmount] = useState(initialData?.amount.toString() || '');
  const [date, setDate] = useState(() => {
    if (initialData) return initialData.date;
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [category, setCategory] = useState<IncomeCategory>(
    (initialData?.category as IncomeCategory) || IncomeCategory.QUOTE
  );
  
  // State for Monthly Summary
  const [monthYear, setMonthYear] = useState('');
  const [monthlyAmount, setMonthlyAmount] = useState('');

  const isEditing = !!initialData;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isEditing || mode === 'single') {
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        alert("L'importo non è valido.");
        return;
      }
      if (!description.trim()) {
        alert("La descrizione è obbligatoria.");
        return;
      }

      const incomeData: any = {
        id: isEditing ? initialData.id : crypto.randomUUID(),
        description,
        amount: parsedAmount,
        date,
        category,
      };

      if (isEditing && onUpdate) {
        onUpdate(incomeData);
      } else {
        onAdd(incomeData);
      }
    } else { // Monthly Summary Mode
      const parsedMonthlyAmount = parseFloat(monthlyAmount);
      if (!monthYear || isNaN(parsedMonthlyAmount) || parsedMonthlyAmount <= 0) {
        alert("Seleziona un mese e inserisci un importo totale valido.");
        return;
      }

      const [year, month] = monthYear.split('-').map(Number);
      const lastDayOfMonth = new Date(year, month, 0).getDate();
      const incomeDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;
      
      const dateForMonthName = new Date(year, month - 1);
      const monthName = dateForMonthName.toLocaleString('it-IT', { month: 'long' });
      const capitalizedMonthName = monthName.charAt(0).toUpperCase() + monthName.slice(1);

      const incomeData: Income = {
        id: crypto.randomUUID(),
        description: `Riepilogo Incassi - ${capitalizedMonthName} ${year}`,
        amount: parsedMonthlyAmount,
        date: incomeDate,
        category: IncomeCategory.QUOTE,
      };
      
      onAdd(incomeData);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 max-w-2xl mx-auto overflow-hidden transition-colors duration-200">
      <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
        <h2 className="text-lg font-bold text-slate-800 dark:text-white">
          {isEditing ? 'Modifica Incasso' : 'Nuovo Incasso'}
        </h2>
        {!isEditing && (
          <div className="flex gap-2 text-sm">
            <button
              onClick={() => setMode('single')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${mode === 'single' ? 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-white font-medium' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
            >
              Incasso Singolo
            </button>
            <button
              onClick={() => setMode('monthly')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${mode === 'monthly' ? 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-white font-medium' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
            >
              Riepilogo Mensile
            </button>
          </div>
        )}
      </div>

      <div className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {mode === 'single' || isEditing ? (
            // Single Income Form
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Descrizione</label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                  placeholder="Es. Quota condominiale Sig. Rossi"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Importo (€)</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Data Incasso</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Categoria</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as IncomeCategory)}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                >
                  {Object.values(IncomeCategory).map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            // Monthly Summary Form
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Mese e Anno</label>
                <input
                  type="month"
                  required
                  value={monthYear}
                  onChange={(e) => setMonthYear(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Importo Totale Incassato (€)</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0"
                  value={monthlyAmount}
                  onChange={(e) => setMonthlyAmount(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                  placeholder="0.00"
                />
              </div>

              <div className="col-span-2 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 p-4 rounded-xl text-green-700 dark:text-green-400 text-sm">
                Verrà creato un singolo incasso riepilogativo per il mese selezionato, datato all'ultimo giorno del mese.
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 font-medium"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 font-medium"
            >
              <Check size={18} />
              {isEditing ? 'Aggiorna Incasso' : (mode === 'single' ? 'Salva Incasso' : 'Salva Riepilogo')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
