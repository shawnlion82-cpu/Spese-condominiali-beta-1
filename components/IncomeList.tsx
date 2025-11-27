

import React, { useState, useRef, useEffect } from 'react';
import { Income, IncomeCategory, BankAccount } from '../types';
import { Search, Filter, X, Calendar, ChevronDown, Trash2, AlertTriangle, Pencil, FileDown, FileText, FileCode, FileUp, Loader2, Check } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx';
import { parseIncomeWithGemini, ParsedIncomeData } from '../services/geminiService';
import { generateId } from '../utils';
import mammoth from 'mammoth';

interface IncomeListProps {
  incomes: Income[];
  onDelete: (id: string) => void;
  onEdit: (income: Income) => void;
  condoName: string;
  bankAccounts: BankAccount[];
  onAdd: (income: Income) => void;
}

const categoryColors: Record<IncomeCategory, string> = {
  [IncomeCategory.QUOTE]: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  [IncomeCategory.PULIZIA_GIARDINO]: 'bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-300',
  [IncomeCategory.QUOTA_AQP]: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  [IncomeCategory.ALTRO]: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
};

export const IncomeList: React.FC<IncomeListProps> = ({ incomes, onDelete, onEdit, condoName, onAdd }) => {
  const { t, language } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  
  const [incomeToDelete, setIncomeToDelete] = useState<string | null>(null);
  
  // Import State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importCandidates, setImportCandidates] = useState<ParsedIncomeData[]>([]);
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
        const items = xmlDoc.getElementsByTagName("income");
        
        let count = 0;
        Array.from(items).forEach(item => {
           const id = item.getElementsByTagName("id")[0]?.textContent || generateId();
           const desc = item.getElementsByTagName("description")[0]?.textContent || "";
           const amount = parseFloat(item.getElementsByTagName("amount")[0]?.textContent || "0");
           const cat = item.getElementsByTagName("category")[0]?.textContent as IncomeCategory || IncomeCategory.QUOTE;
           const date = item.getElementsByTagName("date")[0]?.textContent || new Date().toISOString().split('T')[0];
           
           if (desc && amount > 0) {
             onAdd({
               id, description: desc, amount, category: cat, date
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

         const result = await parseIncomeWithGemini(textContent, fileInputData ? [fileInputData] : undefined);
         
         if (result.incomes.length > 0) {
            setImportCandidates(result.incomes);
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
       });
    });
    setShowImportReview(false);
    setImportCandidates([]);
  };

  const updateCandidate = (index: number, field: keyof ParsedIncomeData, value: any) => {
    setImportCandidates(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };
  
  const removeCandidate = (index: number) => {
    setImportCandidates(prev => prev.filter((_, i) => i !== index));
    if (importCandidates.length <= 1) setShowImportReview(false);
  };

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
    setShowExportMenu(false);
  };

  const handleExportPDF = () => {
      const doc = new jsPDF();
      const locale = language === 'en' ? 'en-US' : (language === 'it' ? 'it-IT' : language);

      const tableData = filteredIncomes.map(i => {
          return [
              new Date(i.date).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }),
              i.description,
              i.category,
              new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(i.amount)
          ]
      });
      const totalString = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(filteredTotal);
  
      doc.setFontSize(18);
      doc.text(`Riepilogo Incassi - ${condoName}`, 14, 22);
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Report generato il ${new Date().toLocaleDateString(locale)}`, 14, 28);
  
      (doc as any).autoTable({
        startY: 35,
        head: [['Data', 'Descrizione', 'Categoria', 'Importo']],
        body: tableData,
        foot: [['', '', 'TOTALE', totalString]],
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129] }, // Green for income
        footStyles: { fontStyle: 'bold', fillColor: [241, 245, 249] },
        didDrawPage: (data: any) => {
          const pageCount = doc.getNumberOfPages();
          doc.setFontSize(10);
          doc.text(`Pagina ${data.pageNumber} di ${pageCount}`, data.settings.margin.left, doc.internal.pageSize.height - 10);
        }
      });
  
      const fileName = `incassi_${condoName.replace(/\s/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(fileName);
      setShowExportMenu(false);
  };

  const handleExportXML = () => {
    if (filteredIncomes.length === 0) return;

    let xmlContent = `<?xml version="1.0" encoding="UTF-8"?>\n<incomes>\n`;
    
    filteredIncomes.forEach(i => {
      xmlContent += `  <income>\n`;
      xmlContent += `    <id>${i.id}</id>\n`;
      xmlContent += `    <date>${i.date}</date>\n`;
      xmlContent += `    <description>${i.description.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</description>\n`;
      xmlContent += `    <category>${i.category}</category>\n`;
      xmlContent += `    <amount>${i.amount}</amount>\n`;
      xmlContent += `  </income>\n`;
    });
    
    xmlContent += `</incomes>`;

    const blob = new Blob([xmlContent], { type: 'application/xml' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    const fileName = `incassi_${condoName.replace(/\s/g, '_')}_${new Date().toISOString().slice(0, 10)}.xml`;
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportMenu(false);
  };

  const handleExportDOCX = async () => {
    if (filteredIncomes.length === 0) return;

    const rows = [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: "Data", style: "strong" })], width: { size: 20, type: WidthType.PERCENTAGE } }),
          new TableCell({ children: [new Paragraph({ text: "Descrizione", style: "strong" })], width: { size: 45, type: WidthType.PERCENTAGE } }),
          new TableCell({ children: [new Paragraph({ text: "Categoria", style: "strong" })], width: { size: 20, type: WidthType.PERCENTAGE } }),
          new TableCell({ children: [new Paragraph({ text: "Importo", style: "strong" })], width: { size: 15, type: WidthType.PERCENTAGE } }),
        ],
        tableHeader: true,
      }),
    ];

    const locale = language === 'en' ? 'en-US' : (language === 'it' ? 'it-IT' : language);

    filteredIncomes.forEach(i => {
       rows.push(
         new TableRow({
           children: [
             new TableCell({ children: [new Paragraph(new Date(i.date).toLocaleDateString(locale))] }),
             new TableCell({ children: [new Paragraph(i.description)] }),
             new TableCell({ children: [new Paragraph(i.category)] }),
             new TableCell({ children: [new Paragraph(new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(i.amount))] }),
           ],
         })
       );
    });

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({ text: `Riepilogo Incassi - ${condoName}`, heading: "Heading1" }),
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
      link.download = `incassi_${condoName.replace(/\s/g, '_')}_${new Date().toISOString().slice(0, 10)}.docx`;
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
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">Storico Incassi</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Visualizzati {filteredIncomes.length} movimenti per un totale di 
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
                      {new Date(income.date).toLocaleDateString(language === 'en' ? 'en-US' : (language === 'it' ? 'it-IT' : language), { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4 text-slate-900 dark:text-white font-medium">{income.description}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${categoryColors[income.category as IncomeCategory] || 'bg-slate-100 text-slate-600'}`}>
                        {income.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-green-600 dark:text-green-400">
                      {new Intl.NumberFormat(language === 'en' ? 'en-US' : (language === 'it' ? 'it-IT' : language), { style: 'currency', currency: 'EUR' }).format(income.amount)}
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
                    {new Intl.NumberFormat(language === 'en' ? 'en-US' : (language === 'it' ? 'it-IT' : language), { style: 'currency', currency: 'EUR' }).format(filteredTotal)}
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
                {importCandidates.map((inc, idx) => (
                  <div key={idx} className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-xl border border-slate-200 dark:border-slate-600 relative grid grid-cols-1 sm:grid-cols-12 gap-3">
                     <button onClick={() => removeCandidate(idx)} className="absolute top-2 right-2 p-1 text-slate-400 hover:text-red-500"><X size={16} /></button>
                     <div className="sm:col-span-5">
                       <label className="text-[10px] text-slate-500 uppercase block">Descrizione</label>
                       <input type="text" value={inc.description} onChange={(e) => updateCandidate(idx, 'description', e.target.value)} className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm outline-none focus:border-indigo-500" />
                     </div>
                     <div className="sm:col-span-2">
                       <label className="text-[10px] text-slate-500 uppercase block">Importo</label>
                       <input type="number" step="0.01" value={inc.amount} onChange={(e) => updateCandidate(idx, 'amount', parseFloat(e.target.value))} className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm outline-none focus:border-indigo-500" />
                     </div>
                     <div className="sm:col-span-3">
                       <label className="text-[10px] text-slate-500 uppercase block">Categoria</label>
                       <select value={inc.category} onChange={(e) => updateCandidate(idx, 'category', e.target.value)} className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm outline-none focus:border-indigo-500">
                          {Object.values(IncomeCategory).map(c => <option key={c} value={c}>{c}</option>)}
                       </select>
                     </div>
                     <div className="sm:col-span-2">
                       <label className="text-[10px] text-slate-500 uppercase block">Data</label>
                       <input type="date" value={inc.date} onChange={(e) => updateCandidate(idx, 'date', e.target.value)} className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm outline-none focus:border-indigo-500" />
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