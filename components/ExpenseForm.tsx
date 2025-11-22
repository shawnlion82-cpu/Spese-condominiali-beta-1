
import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Check, X, Loader2, Upload, Image as ImageIcon, Trash2, FileText, Plus, AlertTriangle, Download, Paperclip } from 'lucide-react';
import { Expense, ExpenseCategory, Attachment, BankAccount } from '../types';
import { parseExpenseWithGemini, FileInput } from '../services/geminiService';
import { generateId } from '../utils';

interface ExpenseFormProps {
  onAdd: (expense: Expense) => void;
  onUpdate?: (expense: Expense) => void;
  onCancel: () => void;
  initialData?: Expense;
  existingExpenses?: Expense[];
  bankAccounts: BankAccount[];
}

interface FormAttachment {
  id: string;
  name: string;
  type: string;
  url: string;
  file?: File;
  base64?: string;
}

export const ExpenseForm: React.FC<ExpenseFormProps> = ({ onAdd, onUpdate, onCancel, initialData, existingExpenses = [], bankAccounts }) => {
  const [mode, setMode] = useState<'manual' | 'ai'>(initialData ? 'manual' : 'ai');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiInput, setAiInput] = useState('');
  
  const [attachments, setAttachments] = useState<FormAttachment[]>(() => {
    if (initialData?.attachments) {
      return initialData.attachments.map(att => ({
        id: att.id,
        name: att.name,
        type: att.type,
        url: att.url
      }));
    }
    return [];
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  
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
  
  const [category, setCategory] = useState<ExpenseCategory>(
    (initialData?.category as ExpenseCategory) || ExpenseCategory.VARIE
  );

  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>(initialData?.bankAccountId || '');
  const [status, setStatus] = useState<'paid' | 'unpaid'>(initialData?.status || 'unpaid');

  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [pendingExpenseData, setPendingExpenseData] = useState<Expense | null>(null);

  const isEditing = !!initialData && !initialData.description.endsWith('(Copia)');

  const readFileAsAttachment = (file: File): Promise<FormAttachment> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve({
            id: generateId(),
            name: file.name,
            type: file.type,
            file,
            url: reader.result,
            base64: reader.result.split(',')[1]
          });
        } else {
          reject(new Error('Failed to convert file to base64'));
        }
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      try {
        const newAttachments = await Promise.all(files.map(readFileAsAttachment));
        setAttachments(prev => [...prev, ...newAttachments]);
      } catch (error) {
        console.error("Error reading files:", error);
        alert("Errore durante il caricamento dei file.");
      }
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleAnalyze = async () => {
    if (!aiInput.trim() && attachments.length === 0) return;

    setIsAnalyzing(true);
    try {
      const supportedTypes = ['image/', 'application/pdf', 'text/', 'audio/', 'video/'];
      const filesPayload: FileInput[] = attachments
        .filter(att => att.base64 && supportedTypes.some(type => att.type.startsWith(type)))
        .map(att => ({
          data: att.base64!,
          mimeType: att.type
        }));

      if (filesPayload.length === 0 && attachments.length > 0 && !aiInput.trim()) {
        alert("I file allegati non sono supportati per l'analisi AI (solo Immagini, PDF, Testo). Inserisci una descrizione manuale.");
        setIsAnalyzing(false);
        return;
      }

      const result = await parseExpenseWithGemini(aiInput, filesPayload);
      
      setDescription(result.description);
      setAmount(result.amount.toString());
      setDate(result.date);
      setCategory(result.category);
      setMode('manual');
    } catch (error) {
      alert('Non sono riuscito a interpretare i dati. Assicurati che i documenti siano leggibili o la descrizione chiara.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);

    const finalAttachments: Attachment[] = attachments.map(att => ({
      id: att.id,
      name: att.name,
      type: att.type,
      url: att.url
    }));

    const expenseData: any = {
      description,
      amount: parsedAmount,
      date,
      category,
      bankAccountId: selectedBankAccountId || undefined,
      status,
      attachments: finalAttachments
    };

    if (isEditing && initialData) {
      expenseData.id = initialData.id;
    } else {
      expenseData.id = generateId();
    }

    if (!isEditing && existingExpenses.length > 0) {
      const isDuplicate = existingExpenses.some(exp => 
        exp.amount === parsedAmount &&
        exp.date === date &&
        exp.description.toLowerCase().trim() === description.toLowerCase().trim()
      );

      if (isDuplicate) {
        setPendingExpenseData(expenseData);
        setShowDuplicateWarning(true);
        return;
      }
    }

    processSubmission(expenseData);
  };

  const processSubmission = (data: Expense) => {
    if (isEditing && onUpdate) {
      onUpdate(data);
    } else {
      onAdd(data);
    }
  };

  const confirmDuplicateSubmission = () => {
    if (pendingExpenseData) {
      processSubmission(pendingExpenseData);
      setShowDuplicateWarning(false);
      setPendingExpenseData(null);
    }
  };

  const renderAttachmentsList = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {attachments.map((att) => (
        <div key={att.id} className="relative bg-slate-100 dark:bg-slate-700 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-600 flex items-center p-2 group">
          <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-lg overflow-hidden flex-shrink-0 border border-slate-200 dark:border-slate-600 flex items-center justify-center">
            {att.type.startsWith('image/') ? (
              <img src={att.url} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <FileText className="text-slate-400 dark:text-slate-500" size={24} />
            )}
          </div>
          <div className="ml-3 flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate" title={att.name}>{att.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase">{att.type.split('/')[1] || 'FILE'}</p>
          </div>
          <div className="flex items-center gap-1 ml-2">
            <a 
              href={att.url} 
              download={att.name}
              className="p-1.5 bg-white dark:bg-slate-800 rounded-lg text-slate-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 shadow-sm border border-slate-100 dark:border-slate-600 transition-colors"
              title="Scarica"
            >
              <Download size={16} />
            </a>
            <button 
              type="button"
              onClick={() => removeAttachment(att.id)}
              className="p-1.5 bg-white dark:bg-slate-800 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 shadow-sm border border-slate-100 dark:border-slate-600 transition-colors"
              title="Rimuovi"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 max-w-2xl mx-auto overflow-hidden transition-colors duration-200">
        <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">
            {isEditing ? 'Modifica Spesa' : 'Nuova Spesa'}
          </h2>
          <div className="flex gap-2 text-sm">
            <button
              onClick={() => setMode('ai')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors ${mode === 'ai' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 font-medium' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
            >
              <Sparkles size={16} />
              AI Assistant
            </button>
            <button
              onClick={() => setMode('manual')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${mode === 'manual' ? 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-white font-medium' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
            >
              Manuale
            </button>
          </div>
        </div>

        <div className="p-6">
          <input 
            type="file" 
            ref={fileInputRef}
            className="hidden" 
            multiple 
            onChange={handleFileChange}
          />

          {mode === 'ai' ? (
            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 p-4 rounded-xl">
                <p className="text-green-800 dark:text-green-300 text-sm font-medium mb-1">Come funziona?</p>
                <p className="text-green-600 dark:text-green-400 text-sm">
                  Carica una o più ricevute (foto o PDF) o descrivi la spesa. L'IA estrarrà i dettagli automaticamente.
                </p>
              </div>

              <textarea
                className="w-full p-4 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none min-h-[80px] resize-none placeholder-slate-400 dark:placeholder-slate-500"
                placeholder="Esempio: Pagato 150€ per manutenzione ascensore..."
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
              />

              {attachments.length > 0 && renderAttachmentsList()}

              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center transition-all cursor-pointer
                  ${attachments.length > 0 
                    ? 'border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 py-4' 
                    : 'border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-green-500 dark:hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/10'
                  }
                `}
              >
                {attachments.length > 0 ? (
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-medium">
                    <Plus size={20} />
                    <span>Aggiungi altri file</span>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 mb-2 text-slate-400 dark:text-slate-500" />
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Clicca per caricare uno o più file</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">Tutti i formati supportati (Max 50MB)</p>
                  </>
                )}
              </div>
              
              <div className="flex justify-end pt-2">
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || (!aiInput.trim() && attachments.length === 0)}
                  className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium w-full sm:w-auto justify-center"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      Analisi in corso...
                    </>
                  ) : (
                    <>
                      <Sparkles size={20} />
                      Analizza Spesa
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Descrizione</label>
                  <input
                    type="text"
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                    placeholder="Es. Riparazione portone"
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
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Data</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                  />
                </div>

                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Categoria</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                  >
                    {Object.values(ExpenseCategory).map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Stato Pagamento</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as 'paid' | 'unpaid')}
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                  >
                    <option value="unpaid">Da Pagare</option>
                    <option value="paid">Pagato</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Conto Corrente</label>
                  <select
                    value={selectedBankAccountId}
                    onChange={(e) => setSelectedBankAccountId(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                  >
                    <option value="">Seleziona un conto (Opzionale)</option>
                    {bankAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>{acc.name} ({acc.iban})</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Allegati</label>
                  {attachments.length > 0 && (
                    <div className="mb-3">
                      {renderAttachmentsList()}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg text-sm font-medium hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors w-full sm:w-auto justify-center border border-green-200 dark:border-green-800"
                  >
                    <Paperclip size={18} />
                    {attachments.length > 0 ? 'Aggiungi altri file' : 'Carica file (Ricevute, PDF)'}
                  </button>
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
                  className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 font-medium"
                >
                  <Check size={18} />
                  {isEditing ? 'Aggiorna Spesa' : 'Salva Spesa'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {showDuplicateWarning && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-sm w-full p-6 transform transition-all animate-fade-in scale-100 border border-slate-200 dark:border-slate-700">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
                <AlertTriangle className="text-yellow-600 dark:text-yellow-400 w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Possibile Duplicato</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Esiste già una spesa con la stessa descrizione, importo e data. Vuoi salvarla comunque?
                </p>
              </div>
              <div className="flex gap-3 w-full mt-2">
                <button
                  onClick={() => {
                    setShowDuplicateWarning(false);
                    setPendingExpenseData(null);
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 font-medium transition-colors"
                >
                  Annulla
                </button>
                <button
                  onClick={confirmDuplicateSubmission}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
                >
                  Salva Comunque
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
