

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Expense, ExpenseCategory, BankAccount, Attachment } from '../types';
import { Search, Filter, X, Calendar, ChevronDown, Trash2, AlertTriangle, SquarePen, Paperclip, FileDown, Download, Eye, FileText, FileCode, FileUp, Loader2, Check } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { useLanguage } from '../i18n/LanguageContext';
import { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx';
import { parseExpenseWithGemini, ParsedExpenseData } from '../services/geminiService';
import { generateId } from '../utils';
import mammoth from 'mammoth';

interface ExpenseListProps {
  expenses: Expense[];
  onDelete: (id: string) => void;
  onEdit: (expense: Expense) => void;
  condoName: string;
  bankAccounts: BankAccount[];
  onDuplicate: (expense: Expense) => void;
  onAdd: (expense: Expense) => void;
}

const categoryColors: Record<ExpenseCategory, string> = {
  [ExpenseCategory.MANUTENZIONE]: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  [ExpenseCategory.UTENZE]: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  [ExpenseCategory.PULIZIA]: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  [ExpenseCategory.PULIZIA_SCALE]: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  [ExpenseCategory.AMMINISTRAZIONE]: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  [ExpenseCategory.COMPENSO_AMMINISTRATORE]: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  [ExpenseCategory.ASSICURAZIONE]: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  [ExpenseCategory.SPESE_BANCARIE]: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  [ExpenseCategory.BOLLETTINO_POSTALE]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  [ExpenseCategory.LETTURA_ACQUA]: 'bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-200',
  [ExpenseCategory.VARIE]: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
};

const AttachmentPreviewModal: React.FC<{ attachments: Attachment[], onClose: () => void }> = ({ attachments, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-2xl w-full transform transition-all scale-100 border border-slate-200 dark:border-slate-700">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Allegati</h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {attachments.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {attachments.map(att => (
                <div key={att.id} className="bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <Paperclip className="w-5 h-5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate" title={att.name}>{att.name}</span>
                  </div>
                  <a 
                    href={att.url} 
                    download={att.name}
                    className="p-2 bg-white dark:bg-slate-800 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:text-indigo-400 dark:hover:bg-indigo-900/20 shadow-sm border border-slate-100 dark:border-slate-700 transition-colors"
                    title="Scarica"
                  >
                    <Download size={18} />
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-slate-500 dark:text-slate-400">Nessun allegato per questa spesa.</p>
          )}
        </div>
      </div>
    </div>
  );
};


export const ExpenseList: React.FC<ExpenseListProps> = ({ expenses, onDelete, onEdit, condoName, bankAccounts, onDuplicate, onAdd }) => {
  const { t, language } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<string>('');

  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
  const [viewingAttachments, setViewingAttachments] = useState<Attachment[] | null>(null);
  
  // Import State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importCandidates, setImportCandidates] = useState<ParsedExpenseData[]>([]);
  const [showImportReview, setShowImportReview] = useState(false);

  // Export Menu State
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const activeFiltersCount = useMemo(() => {
    return [startDate, endDate, selectedCategory, selectedAccountId, paymentStatus].filter(Boolean).length;
  }, [startDate, endDate, selectedCategory, selectedAccountId, paymentStatus]);

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedCategory('');
    setSelectedAccountId('');
    setPaymentStatus('');
    setSearchTerm('');
  };

  const confirmDelete = (id: string) => {
    setExpenseToDelete(id);
  };

  const executeDelete = () => {
    if (expenseToDelete) {
      onDelete(expenseToDelete);
      setExpenseToDelete(null);
    }
  };
  
  const filteredExpenses = useMemo(() => expenses.filter(e => {
    const searchLower = searchTerm.toLowerCase();
    const bankAccountName = bankAccounts.find(acc => acc.id === e.bankAccountId)?.name || '';

    const matchesSearch = 
      e.description.toLowerCase().includes(searchLower) ||
      e.category.toLowerCase().includes(searchLower) ||
      bankAccountName.toLowerCase().includes(searchLower);

    const matchesStartDate = startDate ? e.date >= startDate : true;
    const matchesEndDate = endDate ? e.date <= endDate : true;
    const matchesCategory = selectedCategory ? e.category === selectedCategory : true;
    const matchesAccount = selectedAccountId ? e.bankAccountId === selectedAccountId : true;
    const matchesStatus = paymentStatus ? e.status === paymentStatus : true;

    return matchesSearch && matchesStartDate && matchesEndDate && matchesCategory && matchesAccount && matchesStatus;
  }), [expenses, searchTerm, startDate, endDate, selectedCategory, selectedAccountId, paymentStatus, bankAccounts]);

  const filteredTotal = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    setIsImporting(true);
    setImportCandidates([]);

    try {
      if (file.name.endsWith('.xml')) {
        const text = await file.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");
        const items = xmlDoc.getElementsByTagName("expense");
        
        let count = 0;
        Array.from(items).forEach(item => {
           const id = item.getElementsByTagName("id")[0]?.textContent || generateId();
           const desc = item.getElementsByTagName("description")[0]?.textContent || "";
           const amount = parseFloat(item.getElementsByTagName("amount")[0]?.textContent || "0");
           const cat = item.getElementsByTagName("category")[0]?.textContent as ExpenseCategory || ExpenseCategory.VARIE;
           const date = item.getElementsByTagName("date")[0]?.textContent || new Date().toISOString().split('T')[0];
           const status = item.getElementsByTagName("status")[0]?.textContent as 'paid'|'unpaid' || 'unpaid';
           const bankName = item.getElementsByTagName("bankAccount")[0]?.textContent;
           
           // Try to match bank account by name, otherwise ignore
           const bankId = bankAccounts.find(b => b.name === bankName)?.id;

           if (desc && amount > 0) {
             onAdd({
               id, description: desc, amount, category: cat, date, status, bankAccountId: bankId, attachments: []
             });
             count++;
           }
        });
        alert(t('list.importSuccess').replace('{count}', count.toString()));

      } else if (file.name.endsWith('.pdf') || file.name.endsWith('.docx')) {
         
         let textContent = '';
         let fileInputData: {data: string, mimeType: string} | undefined = undefined;

         if (file.name.endsWith('.docx')) {
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer });
            textContent = result.value;
         } else {
            // PDF
            const base64 = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.readAsDataURL(file);
              reader.onload = () => resolve((reader.result as string).split(',')[1]);
            });
            fileInputData = { data: base64, mimeType: 'application/pdf' };
         }

         const result = await parseExpenseWithGemini(textContent, fileInputData ? [fileInputData] : undefined);
         
         if (result.expenses.length > 0) {
            setImportCandidates(result.expenses);
            setShowImportReview(true);
         } else {
            alert(t('list.noDataImport'));
         }
      }

    } catch (error) {
      console.error(error);
      alert(t('list.importError').replace('{error}', (error as Error).message));
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveImportCandidates = () => {
    importCandidates.forEach(cand => {
       onAdd({
         id: generateId(),
         description: cand.description,
         amount: Number(cand.amount),
         date: cand.date,
         category: cand.category,
         status: 'unpaid',
         attachments: []
       });
    });
    setShowImportReview(false);
    setImportCandidates([]);
  };

  const updateCandidate = (index: number, field: keyof ParsedExpenseData, value: any) => {
    setImportCandidates(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };
  
  const removeCandidate = (index: number) => {
    setImportCandidates(prev => prev.filter((_, i) => i !== index));
    if (importCandidates.length <= 1) setShowImportReview(false);
  };

  // ... Export functions (same as before)
  const handleExportPDF = () => {
    const doc = new jsPDF();
    const tableData = filteredExpenses.map(e => {
        const bankAccountName = bankAccounts.find(acc => acc.id === e.bankAccountId)?.name || 'N/A';
        const locale = language === 'en' ? 'en-US' : (language === 'it' ? 'it-IT' : language);
        return [
            new Date(e.date).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }),
            e.description,
            e.category,
            bankAccountName,
            new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(e.amount)
        ]
    });
    const locale = language === 'en' ? 'en-US' : (language === 'it' ? 'it-IT' : language);
    const totalString = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(filteredTotal);

    doc.setFontSize(18);
    doc.text(`Riepilogo Spese - ${condoName}`, 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Report generato il ${new Date().toLocaleDateString(locale)}`, 14, 28);

    (doc as any).autoTable({
      startY: 35,
      head: [['Data', 'Descrizione', 'Categoria', 'Conto', 'Importo']],
      body: tableData,
      foot: [['', '', '', 'TOTALE', totalString]],
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
      footStyles: { fontStyle: 'bold', fillColor: [241, 245, 249] },
      didDrawPage: (data: any) => {
        const pageCount = doc.getNumberOfPages();
        doc.setFontSize(10);
        doc.text(`Pagina ${data.pageNumber} di ${pageCount}`, data.settings.margin.left, doc.internal.pageSize.height - 10);
      }
    });

    const fileName = `spese_${condoName.replace(/\s/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(fileName);
    setShowExportMenu(false);
  };

  const handleExportCSV = () => {
    if (filteredExpenses.length === 0) return;

    const escapeCSV = (str: string) => `"${String(str || '').replace(/"/g, '""')}"`;

    const headers = ['ID', 'Data', 'Descrizione', 'Categoria', 'Importo', 'Stato Pagamento', 'Conto Corrente', 'ID Conto', 'Numero Allegati'];
    
    const rows = filteredExpenses.map(e => {
        const bankAccountName = bankAccounts.find(acc => acc.id === e.bankAccountId)?.name || '';
        return [
            e.id,
            e.date,
            escapeCSV(e.description),
            e.category,
            e.amount.toString().replace('.', ','),
            e.status,
            escapeCSV(bankAccountName),
            e.bankAccountId,
            e.attachments?.length || 0
        ].join(';');
    });

    const csvContent = [headers.join(';'), ...rows].join('\n');
    
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    const fileName = `spese_${condoName.replace(/\s/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportMenu(false);
  };

  const handleExportXML = () => {
    if (filteredExpenses.length === 0) return;

    let xmlContent = `<?xml version="1.0" encoding="UTF-8"?>\n<expenses>\n`;
    
    filteredExpenses.forEach(e => {
      const bankAccountName = bankAccounts.find(acc => acc.id === e.bankAccountId)?.name || '';
      xmlContent += `  <expense>\n`;
      xmlContent += `    <id>${e.id}</id>\n`;
      xmlContent += `    <date>${e.date}</date>\n`;
      xmlContent += `    <description>${e.description.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</description>\n`;
      xmlContent += `    <category>${e.category}</category>\n`;
      xmlContent += `    <amount>${e.amount}</amount>\n`;
      xmlContent += `    <status>${e.status}</status>\n`;
      xmlContent += `    <bankAccount>${bankAccountName.replace(/&/g, '&amp;')}</bankAccount>\n`;
      xmlContent += `  </expense>\n`;
    });
    
    xmlContent += `</expenses>`;

    const blob = new Blob([xmlContent], { type: 'application/xml' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    const fileName = `spese_${condoName.replace(/\s/g, '_')}_${new Date().toISOString().slice(0, 10)}.xml`;
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportMenu(false);
  };

  const handleExportDOCX = async () => {
    if (filteredExpenses.length === 0) return;

    const rows = [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: "Data", style: "strong" })], width: { size: 15, type: WidthType.PERCENTAGE } }),
          new TableCell({ children: [new Paragraph({ text: "Descrizione", style: "strong" })], width: { size: 40, type: WidthType.PERCENTAGE } }),
          new TableCell({ children: [new Paragraph({ text: "Categoria", style: "strong" })], width: { size: 25, type: WidthType.PERCENTAGE } }),
          new TableCell({ children: [new Paragraph({ text: "Importo", style: "strong" })], width: { size: 20, type: WidthType.PERCENTAGE } }),
        ],
        tableHeader: true,
      }),
    ];

    const locale = language === 'en' ? 'en-US' : (language === 'it' ? 'it-IT' : language);

    filteredExpenses.forEach(e => {
       rows.push(
         new TableRow({
           children: [
             new TableCell({ children: [new Paragraph(new Date(e.date).toLocaleDateString(locale))] }),
             new TableCell({ children: [new Paragraph(e.description)] }),
             new TableCell({ children: [new Paragraph(e.category)] }),
             new TableCell({ children: [new Paragraph(new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(e.amount))] }),
           ],
         })
       );
    });

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({ text: `Riepilogo Spese - ${condoName}`, heading: "Heading1" }),
          new Paragraph({ text: `Data export: ${new Date().toLocaleDateString(locale)}` }),
          new Paragraph({ text: "" }), // spacer
          new Table({
            rows: rows,
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
               top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
               bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
               left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
               right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
               insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
               insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            }
          })
        ],
      }],
    });

    try {
      const blob = await Packer.toBlob(doc);
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = `spese_${condoName.replace(/\s/g, '_')}_${new Date().toISOString().slice(0, 10)}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error("Error creating DOCX", e);
      alert("Errore durante la creazione del file Word.");
    }
    setShowExportMenu(false);
  };

  return (
    <>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-colors duration-200">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">{t('list.historyExpenses')}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Visualizzati {filteredExpenses.length} movimenti per un totale di 
                <span className="font-bold text-slate-700 dark:text-slate-200 ml-1">
                  {new Intl.NumberFormat(language === 'en' ? 'en-US' : (language === 'it' ? 'it-IT' : language), { style: 'currency', currency: 'EUR' }).format(filteredTotal)}
                </span>
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="relative flex-grow sm:flex-grow-0">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4" />
                <input
                  type="text"
                  placeholder={t('list.search')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-full sm:w-48"
                />
              </div>
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2 border rounded-lg transition-colors flex items-center gap-2 ${
                  showFilters || activeFiltersCount > 0
                    ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400' 
                    : 'border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}
                title={t('list.filters')}
              >
                <Filter size={16} />
                {activeFiltersCount > 0 && (
                  <span className="bg-indigo-600 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full">
                    {activeFiltersCount}
                  </span>
                )}
              </button>

              {/* Import Button */}
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".xml,.pdf,.docx" 
                onChange={handleImportFile} 
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="p-2 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition-colors flex items-center justify-center gap-2"
                title={t('list.importDesc')}
              >
                 {isImporting ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />}
              </button>

              {/* Export Dropdown */}
              <div className="relative" ref={exportMenuRef}>
                 <button
                   onClick={() => setShowExportMenu(!showExportMenu)}
                   className="px-3 py-2 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
                 >
                   <FileDown size={16} />
                   <span className="hidden sm:inline">{t('list.export')}</span>
                   <ChevronDown size={14} className="hidden sm:inline" />
                 </button>
                 {showExportMenu && (
                    <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 py-1 z-20 animate-fade-in">
                       <button onClick={handleExportPDF} className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300">
                          <FileText size={16} className="text-red-500" /> {t('list.exportPDF')}
                       </button>
                       <button onClick={handleExportCSV} className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300">
                          <FileText size={16} className="text-green-500" /> {t('list.exportCSV')}
                       </button>
                       <button onClick={handleExportDOCX} className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300">
                          <FileText size={16} className="text-blue-500" /> {t('list.exportDOCX')}
                       </button>
                       <button onClick={handleExportXML} className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300">
                          <FileCode size={16} className="text-orange-500" /> {t('list.exportXML')}
                       </button>
                    </div>
                 )}
              </div>
            </div>
          </div>

          {showFilters && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
              {/* Date Filters */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Dal</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full py-2 px-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Al</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full py-2 px-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"/>
                </div>
              </div>

              {/* Select Filters */}
              <div className="grid grid-cols-2 gap-2">
                 <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Categoria</label>
                    <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="w-full py-2 px-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none appearance-none">
                      <option value="">Tutte</option>
                      {Object.values(ExpenseCategory).map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Conto Corrente</label>
                    <select value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)} className="w-full py-2 px-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none appearance-none">
                      <option value="">Tutti i conti</option>
                      {bankAccounts.map((acc) => (<option key={acc.id} value={acc.id}>{acc.name}</option>))}
                    </select>
                  </div>
              </div>
              
              {/* Reset Button */}
              <div className="flex items-end">
                <button onClick={clearFilters} className="w-full py-2 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg text-sm font-medium flex items-center justify-center gap-2"><X size={16} />{t('list.reset')}</button>
              </div>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-300 uppercase tracking-wider text-xs">
              <tr>
                <th className="px-6 py-3 font-medium">{t('list.colDate')}</th>
                <th className="px-6 py-3 font-medium">{t('list.colDesc')}</th>
                <th className="px-6 py-3 font-medium">{t('list.colCat')}</th>
                <th className="px-6 py-3 font-medium">{t('list.colStatus')}</th>
                <th className="px-6 py-3 font-medium text-right">{t('list.colAmount')}</th>
                <th className="px-6 py-3 font-medium text-center">{t('list.colActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {filteredExpenses.length > 0 ? (
                filteredExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span>{new Date(expense.date).toLocaleDateString(language === 'en' ? 'en-US' : (language === 'it' ? 'it-IT' : language), { day: '2-digit', month: 'short' })}</span>
                        <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600 px-2 py-0.5 rounded">{new Date(expense.date).getFullYear()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-900 dark:text-white font-medium">
                      <div className="flex items-center gap-2">
                        {expense.description}
                        {expense.attachments && expense.attachments.length > 0 && (
                          <button onClick={() => setViewingAttachments(expense.attachments!)} title="Visualizza allegati">
                            <Paperclip size={14} className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${categoryColors[expense.category as ExpenseCategory] || 'bg-slate-100 text-slate-600'}`}>{expense.category}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${expense.status === 'paid' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'}`}>
                        <span className={`w-2 h-2 mr-1.5 rounded-full ${expense.status === 'paid' ? 'bg-green-400' : 'bg-yellow-400'}`}></span>
                        {expense.status === 'paid' ? t('common.paid') : t('common.unpaid')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-slate-800 dark:text-slate-200">
                      {new Intl.NumberFormat(language === 'en' ? 'en-US' : (language === 'it' ? 'it-IT' : language), { style: 'currency', currency: 'EUR' }).format(expense.amount)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => onDuplicate(expense)} className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-2 rounded-lg transition-colors" title="Duplica Spesa"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
                        <button onClick={() => onEdit(expense)} className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-2 rounded-lg transition-colors" title="Modifica Spesa"><SquarePen size={18} /></button>
                        <button onClick={() => confirmDelete(expense.id)} className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 p-2 rounded-lg transition-colors" title="Elimina Spesa"><Trash2 size={18} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Search className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                      <p>{t('list.noData')}</p>
                      {activeFiltersCount > 0 && <button onClick={clearFilters} className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline mt-1">Rimuovi filtri</button>}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
            {filteredExpenses.length > 0 && (
              <tfoot className="bg-slate-50 dark:bg-slate-700 border-t-2 border-slate-200 dark:border-slate-600">
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-right font-bold text-slate-600 dark:text-slate-300 uppercase">{t('list.totalFiltered')}</td>
                  <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-white text-base">{new Intl.NumberFormat(language === 'en' ? 'en-US' : (language === 'it' ? 'it-IT' : language), { style: 'currency', currency: 'EUR' }).format(filteredTotal)}</td>
                  <td className="px-6 py-4"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {expenseToDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-sm w-full p-6 border border-slate-200 dark:border-slate-700">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30"><AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" /></div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mt-3">{t('common.confirmDeleteTitle')}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{t('common.confirmDeleteMsg')}</p>
            </div>
            <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
              <button onClick={executeDelete} type="button" className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700">{t('common.delete')}</button>
              <button onClick={() => setExpenseToDelete(null)} type="button" className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-slate-600 shadow-sm px-4 py-2 bg-white dark:bg-slate-700 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-600 sm:mt-0">{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {viewingAttachments && (
        <AttachmentPreviewModal attachments={viewingAttachments} onClose={() => setViewingAttachments(null)} />
      )}

      {showImportReview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-3xl w-full p-6 border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
             <div className="flex justify-between items-center mb-4 border-b border-slate-100 dark:border-slate-700 pb-3">
               <h3 className="text-lg font-bold text-slate-800 dark:text-white">{t('list.reviewImport')}</h3>
               <button onClick={() => setShowImportReview(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                 <X size={20} />
               </button>
             </div>
             
             <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                {importCandidates.map((exp, idx) => (
                  <div key={idx} className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-xl border border-slate-200 dark:border-slate-600 relative grid grid-cols-1 sm:grid-cols-12 gap-3">
                     <button onClick={() => removeCandidate(idx)} className="absolute top-2 right-2 p-1 text-slate-400 hover:text-red-500"><X size={16} /></button>
                     <div className="sm:col-span-5">
                       <label className="text-[10px] text-slate-500 uppercase block">Descrizione</label>
                       <input type="text" value={exp.description} onChange={(e) => updateCandidate(idx, 'description', e.target.value)} className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm outline-none focus:border-indigo-500" />
                     </div>
                     <div className="sm:col-span-2">
                       <label className="text-[10px] text-slate-500 uppercase block">Importo</label>
                       <input type="number" step="0.01" value={exp.amount} onChange={(e) => updateCandidate(idx, 'amount', parseFloat(e.target.value))} className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm outline-none focus:border-indigo-500" />
                     </div>
                     <div className="sm:col-span-3">
                       <label className="text-[10px] text-slate-500 uppercase block">Categoria</label>
                       <select value={exp.category} onChange={(e) => updateCandidate(idx, 'category', e.target.value)} className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm outline-none focus:border-indigo-500">
                          {Object.values(ExpenseCategory).map(c => <option key={c} value={c}>{c}</option>)}
                       </select>
                     </div>
                     <div className="sm:col-span-2">
                       <label className="text-[10px] text-slate-500 uppercase block">Data</label>
                       <input type="date" value={exp.date} onChange={(e) => updateCandidate(idx, 'date', e.target.value)} className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm outline-none focus:border-indigo-500" />
                     </div>
                  </div>
                ))}
             </div>

             <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3">
               <button onClick={() => setShowImportReview(false)} className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700">
                 {t('common.cancel')}
               </button>
               <button onClick={handleSaveImportCandidates} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 flex items-center gap-2">
                 <Check size={16} />
                 {t('list.saveAll')} ({importCandidates.length})
               </button>
             </div>
          </div>
        </div>
      )}
    </>
  );
};