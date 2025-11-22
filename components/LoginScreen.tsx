
import React, { useState } from 'react';
import { Building2, ArrowRight } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (condoName: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [condoName, setCondoName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!condoName.trim()) {
      setError('Inserisci il nome del condominio per proseguire');
      return;
    }
    onLogin(condoName.trim());
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCondoName(e.target.value.toUpperCase());
    if (error) {
      setError('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center p-4 transition-colors duration-200">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md p-8 text-center space-y-8 border border-slate-200 dark:border-slate-700">
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center shadow-lg">
            <Building2 className="text-white w-9 h-9" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Spese Condominiali</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">La tua gestione, semplice e chiara.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div>
            <label htmlFor="condoName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Nome del Condominio
            </label>
            <input
              type="text"
              id="condoName"
              value={condoName}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder-slate-400 dark:placeholder-slate-500 uppercase"
              placeholder="ES. CONDOMINIO VIA ROMA 123"
              autoFocus
            />
            {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg mt-2"
          >
            <span>ACCEDI</span>
            <ArrowRight size={20} />
          </button>
        </form>
        
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Inserisci il nome del condominio per iniziare a gestire le spese.
        </p>
      </div>
    </div>
  );
};
