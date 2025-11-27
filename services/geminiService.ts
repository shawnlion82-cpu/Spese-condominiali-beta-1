

import { GoogleGenAI, Type } from "@google/genai";
import { ExpenseCategory, IncomeCategory } from "../types";

// Initialize the Gemini client safely
// Use a safe access pattern for process.env to prevent crashes in browsers where process might be undefined
const getApiKey = () => {
  try {
    if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
      return process.env.API_KEY;
    }
  } catch (e) {
    console.warn("Error accessing process.env");
  }
  return '';
};

const ai = new GoogleGenAI({ apiKey: getApiKey() });

const MODEL_NAME = 'gemini-2.5-flash';

export interface ParsedExpenseData {
  description: string;
  amount: number;
  category: ExpenseCategory;
  date: string;
}

export interface ParsedIncomeData {
  description: string;
  amount: number;
  category: IncomeCategory;
  date: string;
}

export interface ExpenseAnalysisResult {
  expenses: ParsedExpenseData[];
}

export interface IncomeAnalysisResult {
  incomes: ParsedIncomeData[];
}

export interface FileInput {
  data: string;
  mimeType: string;
}

export const parseExpenseWithGemini = async (input: string, files?: FileInput[]): Promise<ExpenseAnalysisResult> => {
  const currentDate = new Date().toISOString().split('T')[0];
  
  const systemPrompt = `
    Sei un assistente contabile esperto per condomini.
    Analizza il testo e/o i file allegati. 
    Potresti ricevere un singolo documento (Fattura/Bollettino) o un documento contenente UNA LISTA di spese (es. Report PDF o DOCX).

    OBIETTIVO:
    Estrai TUTTE le voci di spesa trovate.
    
    LOGICA DI ESTRAZIONE:
    1. **Lista/Tabella**: Se il file contiene una tabella con più righe, estrai OGNI riga come voce separata.
    2. **Bollettini/Fatture Multiple**: Se ci sono più documenti distinti, crea una voce per ciascuno.
    3. **Divisione Richiesta**: Se l'utente chiede di dividere una spesa (es. "Dividi questa bolletta da 100€: 50% scale, 50% ascensore"), crea voci separate.
    4. **Singola Spesa**: Se è un unico documento semplice, restituisci una singola voce.
    
    REGOLA SPECIALE BOLLETTINO POSTALE:
    - Se rilevi una commissione bollettino (es. €1,50) separata dall'importo principale, crea due voci separate.

    REGOLE PER I CAMPI:
    - **Importo**: Usa il numero esatto (virgola o punto decimale).
    - **Data**: Usa la data del documento o di scadenza. Se assente, usa ${currentDate}.
    - **Descrizione**: Sii preciso (es. "Bolletta Enel Luce Scale", "Riparazione Tubo"). 
    - **Categoria**: Scegli tra: 'Manutenzione', 'Utenze', 'Pulizia', 'Pulizia Scale', 'Amministrazione', 'Compenso Amministratore', 'Assicurazione', 'Spese Bancarie', 'Bollettino Postale', 'Lettura Acqua', 'Varie'.

    Output atteso: Un oggetto JSON contenente un array 'expenses'.
  `;

  try {
    const parts: any[] = [];
    
    // Add file parts if available
    if (files && files.length > 0) {
      files.forEach(file => {
        parts.push({
          inlineData: {
            data: file.data,
            mimeType: file.mimeType
          }
        });
      });
    }

    // Add text part
    parts.push({
      text: input || "Analizza i documenti allegati ed estrai la lista delle spese."
    });

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: parts
      },
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            expenses: {
              type: Type.ARRAY,
              description: "Lista delle spese estratte.",
              items: {
                type: Type.OBJECT,
                properties: {
                  description: { 
                    type: Type.STRING,
                    description: "Descrizione della spesa." 
                  },
                  amount: { 
                    type: Type.NUMBER,
                    description: "Importo della singola voce." 
                  },
                  category: { 
                    type: Type.STRING,
                    enum: Object.values(ExpenseCategory),
                    description: "Categoria della spesa."
                  },
                  date: { 
                    type: Type.STRING,
                    description: "Data (YYYY-MM-DD)." 
                  }
                },
                required: ["description", "amount", "category", "date"]
              }
            }
          }
        }
      }
    });

    if (response.text) {
      const data = JSON.parse(response.text) as ExpenseAnalysisResult;
      // Ensure we always return an array
      if (!data.expenses || !Array.isArray(data.expenses)) {
         const single = data as any;
         if (single.amount && single.description) {
            return { expenses: [single as ParsedExpenseData] };
         }
         return { expenses: [] };
      }
      return data;
    } else {
      throw new Error("Nessun dato generato dal modello.");
    }
  } catch (error) {
    console.error("Errore durante l'analisi Gemini:", error);
    throw new Error("Impossibile interpretare i dati.");
  }
};

export const parseIncomeWithGemini = async (input: string, files?: FileInput[]): Promise<IncomeAnalysisResult> => {
    const currentDate = new Date().toISOString().split('T')[0];
    
    const systemPrompt = `
      Sei un assistente contabile esperto per condomini.
      Analizza il testo e/o i file allegati per trovare INCASSI (entrate).
      
      OBIETTIVO:
      Estrai TUTTE le voci di incasso presenti (es. Lista versamenti quote condomini).
  
      REGOLE PER I CAMPI:
      - **Importo**: Usa il numero esatto.
      - **Data**: Usa la data del versamento o del documento. Se assente, usa ${currentDate}.
      - **Descrizione**: Sii preciso (es. "Quota Condominiale Rossi", "Affitto Lastrico").
      - **Categoria**: Scegli tra: 'Quote Condominiali', 'Spese Pulizia Giardino', 'Quota AQP', 'Altro'.
  
      Output atteso: Un oggetto JSON contenente un array 'incomes'.
    `;
  
    try {
      const parts: any[] = [];
      
      if (files && files.length > 0) {
        files.forEach(file => {
          parts.push({
            inlineData: {
              data: file.data,
              mimeType: file.mimeType
            }
          });
        });
      }
  
      parts.push({
        text: input || "Analizza i documenti allegati ed estrai la lista degli incassi."
      });
  
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: {
          parts: parts
        },
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              incomes: {
                type: Type.ARRAY,
                description: "Lista degli incassi estratti.",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    description: { type: Type.STRING },
                    amount: { type: Type.NUMBER },
                    category: { 
                      type: Type.STRING,
                      enum: Object.values(IncomeCategory)
                    },
                    date: { type: Type.STRING }
                  },
                  required: ["description", "amount", "category", "date"]
                }
              }
            }
          }
        }
      });
  
      if (response.text) {
        const data = JSON.parse(response.text) as IncomeAnalysisResult;
        if (!data.incomes || !Array.isArray(data.incomes)) {
           const single = data as any;
           if (single.amount && single.description) {
              return { incomes: [single as ParsedIncomeData] };
           }
           return { incomes: [] };
        }
        return data;
      } else {
        throw new Error("Nessun dato generato dal modello.");
      }
    } catch (error) {
      console.error("Errore durante l'analisi Gemini:", error);
      throw new Error("Impossibile interpretare i dati.");
    }
  };