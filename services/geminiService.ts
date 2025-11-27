import { GoogleGenAI, Type } from "@google/genai";
import { ExpenseCategory } from "../types";

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

export interface ExpenseAnalysisResult {
  expenses: ParsedExpenseData[];
}

export interface FileInput {
  data: string;
  mimeType: string;
}

export const parseExpenseWithGemini = async (input: string, files?: FileInput[]): Promise<ExpenseAnalysisResult> => {
  const currentDate = new Date().toISOString().split('T')[0];
  
  const systemPrompt = `
    Sei un assistente contabile esperto per condomini.
    Analizza il testo e/o i file allegati (Fatture, Bollettini Postali, Scontrini).

    OBIETTIVO:
    Estrai una o più voci di spesa. 
    
    LOGICA DI DIVISIONE E ESTRAZIONE MULTIPLA:
    1. **Bollettini/Fatture Multiple**: Se ci sono più documenti distinti, crea una voce per ciascuno.
    2. **Divisione Richiesta**: Se l'utente chiede di dividere una spesa (es. "Dividi questa bolletta da 100€: 50% scale, 50% ascensore"), crea voci separate calcolando gli importi corretti.
    3. **Singola Spesa**: Se è un unico documento senza istruzioni di divisione, restituisci una singola voce nell'array.

    REGOLE PER I CAMPI:
    - **Importo**: Usa il numero esatto (virgola o punto decimale).
    - **Data**: Usa la data del documento o di scadenza. Se assente, usa ${currentDate}.
    - **Descrizione**: Sii preciso (es. "Bolletta Enel Luce Scale", "Riparazione Tubo"). Se stai dividendo, specifica (es. "Luce Scale (Quota 50%)").
    - **Categoria**: Scegli tra: 'Manutenzione', 'Utenze', 'Pulizia', 'Pulizia Scale', 'Amministrazione', 'Compenso Amministratore', 'Assicurazione', 'Spese Bancarie', 'Lettura Acqua', 'Varie'.

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
      text: input || "Analizza i documenti allegati. Se è un bollettino o una fattura, estrai i dati. Se richiesto, dividi le spese."
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
              description: "Lista delle spese estratte o divise.",
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
      // Ensure we always return an array, even if the model hallucinates a different structure (fallback)
      if (!data.expenses || !Array.isArray(data.expenses)) {
         // Fallback attempt if structure is wrong but has single fields
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
    throw new Error("Impossibile interpretare la spesa. Riprova con documenti più leggibili.");
  }
};