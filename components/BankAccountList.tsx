
import React, { useState, useMemo } from 'react';
import { BankAccount, Expense, Income } from '../types';
import { Trash2, Pencil, AlertTriangle, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

interface BankAccountListProps {
  bankAccounts: BankAccount[];
  onDelete: (id: string) => void;
  onEdit: (account: BankAccount) => void;
  expenses: Expense[];
  incomes: Income[];
}

export const BankAccountList: React.FC<BankAccountListProps> = ({ bankAccounts, onDelete, onEdit, expenses, incomes }) => {
  const [accountToDelete, setAccountToDelete] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  const accountBalances = useMemo(() => {
    const balances = new Map<string, number>();
    bankAccounts.forEach(acc => {
      const totalExpenses = expenses
        .filter(e => e.bankAccountId === acc.id)
        .reduce((sum, e) => sum + e.amount, 0);
      const totalIncomes = incomes
        .filter(i => i.bankAccountId === acc.id)
        .reduce((sum, i) => sum + i.amount, 0);
      balances.set(acc.id, acc.initialBalance + totalIncomes - totalExpenses);
    });
    return balances;
  }, [bankAccounts, expenses, incomes]);

  const sortedAccounts = useMemo(() => {
    return [...bankAccounts].sort((a, b) => {
      const balanceA = accountBalances.get(a.id) || 0;
      const balanceB = accountBalances.get(b.id) || 0;
      return sortOrder === 'desc' ? balanceB - balanceA : balanceA - balanceB;
    });
  }, [bankAccounts, accountBalances, sortOrder]);

  const toggleSort = () => {
    setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
  };

  const confirmDelete = (id: string) => {
    setAccountToDelete(id);
  };

  const executeDelete = () => {
    if (accountToDelete) {
      onDelete(accountToDelete);
      setAccountToDelete(null);
    }
  };
  
  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val);

  return (
    <>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-colors duration-200">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">Conti Correnti</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Gestisci i conti bancari del condominio.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-300 uppercase tracking-wider text-xs">
              <tr>
                <th className="px-6 py-3 font-medium">Nome Conto</th>
                <th className="px-6 py-3 font-medium">IBAN</th>
                <th className="px-6 py-3 font-medium text-right">Saldo Iniziale</th>
                <th className="px-6 py-3 font-medium text-right cursor-pointer group hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" onClick={toggleSort}>
                  <div className="flex items-center justify-end gap-1">
                    Saldo Attuale
                    {sortOrder === 'desc' ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
                  </div>
                </th>
                <th className="px-6 py-3 font-medium text-center">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {sortedAccounts.length > 0 ? (
                sortedAccounts.map((account) => (
                  <tr key={account.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-6 py-4 text-slate-900 dark:text-white font-medium">{account.name}</td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-mono">{account.iban}</td>
                    <td className="px-6 py-4 text-right text-slate-600 dark:text-slate-300">{formatCurrency(account.initialBalance)}</td>
                    <td className="px-6 py-4 text-right font-bold text-slate-800 dark:text-slate-200">{formatCurrency(accountBalances.get(account.id) || 0)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => onEdit(account)} className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-2 rounded-lg" title="Modifica Conto"><Pencil size={18} /></button>
                        <button onClick={() => confirmDelete(account.id)} className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 p-2 rounded-lg" title="Elimina Conto"><Trash2 size={18} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                    <p>Nessun conto corrente aggiunto.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {accountToDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-sm w-full p-6 border border-slate-200 dark:border-slate-700">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30"><AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" /></div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mt-3">Elimina Conto</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Sei sicuro? Se elimini il conto, le transazioni associate non saranno più collegate. L'operazione è irreversibile.</p>
            </div>
            <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
              <button onClick={executeDelete} type="button" className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700">Elimina</button>
              <button onClick={() => setAccountToDelete(null)} type="button" className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-slate-600 shadow-sm px-4 py-2 bg-white dark:bg-slate-700 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-600 sm:mt-0">Annulla</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
