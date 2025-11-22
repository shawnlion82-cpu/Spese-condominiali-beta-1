
import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { BankAccount } from '../types';

interface BankAccountFormProps {
  onAdd: (account: BankAccount) => void;
  onUpdate?: (account: BankAccount) => void;
  onCancel: () => void;
  initialData?: BankAccount;
}

export const BankAccountForm: React.FC<BankAccountFormProps> = ({ onAdd, onUpdate, onCancel, initialData }) => {
  const [name, setName] = useState(initialData?.name || '');
  const [initialBalance, setInitialBalance] = useState(initialData?.initialBalance?.toString() ?? '');
  const [iban, setIban] = useState(initialData?.iban || '');

  const isEditing = !!initialData;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedBalance = parseFloat(initialBalance);
    if (isNaN(parsedBalance)) {
      alert("Il saldo iniziale non è valido.");
      return;
    }
    if (!name.trim()) {
      alert("Il nome del conto è obbligatorio.");
      return;
    }

    const accountData: BankAccount = {
      id: isEditing ? initialData.id : crypto.randomUUID(),
      name,
      initialBalance: parsedBalance,
      iban: iban.toUpperCase(),
    };

    if (isEditing && onUpdate) {
      onUpdate(accountData);
    } else {
      onAdd(accountData);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 max-w-2xl mx-auto overflow-hidden transition-colors duration-200">
      <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
        <h2 className="text-lg font-bold text-slate-800 dark:text-white">
          {isEditing ? 'Modifica Conto Corrente' : 'Nuovo Conto Corrente'}
        </h2>
      </div>
      <div className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Nome Conto</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="Es. Conto Principale"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Saldo Iniziale (€)</label>
              <input
                type="number"
                required
                step="0.01"
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">IBAN (Opzionale)</label>
              <input
                type="text"
                value={iban}
                onChange={(e) => setIban(e.target.value.toUpperCase())}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none uppercase"
                placeholder="IT..."
              />
            </div>
          </div>
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
              className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 font-medium"
            >
              <Check size={18} />
              {isEditing ? 'Aggiorna Conto' : 'Salva Conto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
