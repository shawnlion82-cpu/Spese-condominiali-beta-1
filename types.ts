
// FIX: Added BankAccount interface
export interface BankAccount {
  id: string;
  name: string;
  initialBalance: number;
  iban: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  date: string; // ISO string YYYY-MM-DD
  category: string;
  attachments?: Attachment[];
  // FIX: Added bankAccountId to allow associating expenses with a bank account
  bankAccountId?: string;
  status: 'paid' | 'unpaid';
}

export interface Income {
  id: string;
  description: string;
  amount: number;
  date: string; // ISO string YYYY-MM-DD
  category: string;
  // FIX: Added bankAccountId to allow associating incomes with a bank account
  bankAccountId?: string;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
}

export enum ExpenseCategory {
  MANUTENZIONE = 'Manutenzione',
  UTENZE = 'Utenze',
  PULIZIA = 'Pulizia',
  PULIZIA_SCALE = 'Pulizia Scale',
  AMMINISTRAZIONE = 'Amministrazione',
  COMPENSO_AMMINISTRATORE = 'Compenso Amministratore',
  ASSICURAZIONE = 'Assicurazione',
  SPESE_BANCARIE = 'Spese Bancarie',
  BOLLETTINO_POSTALE = 'Bollettino Postale',
  LETTURA_ACQUA = 'Lettura Acqua',
  VARIE = 'Varie',
}

export enum IncomeCategory {
  QUOTE = 'Quote Condominiali',
  PULIZIA_GIARDINO = 'Spese Pulizia Giardino',
  QUOTA_AQP = 'Quota AQP',
  ALTRO = 'Altro',
}