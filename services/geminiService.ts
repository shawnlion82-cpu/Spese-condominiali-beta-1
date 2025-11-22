import { GoogleGenAI, Type } from "@google/genai";
import { ExpenseCategory } from "../types";

// Initialize the Gemini client
// Note: In a real production app, you might want to proxy this through a backend
// to hide the key, but for this frontend-only demo, we use the environment variable.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_NAME = 'gemini-2.5-flash';

interface ParsedExpenseData {
  description: string;
  amount: number;
  category: ExpenseCategory;
  date: string;
}

export interface FileInput {
  data: string;
  mimeType: string;
}

export const parseExpenseWithGemini = async (input: string, files?: FileInput[]): Promise<ParsedExpenseData> => {
  const currentDate = new Date().toISOString().split('T')[0];
  
  const systemPrompt = `
    Sei un assistente contabile intelligente per condomini.
    Il tuo compito è analizzare un testo in linguaggio naturale (italiano) E/O uno o più file allegati (immagini di ricevute, fatture PDF, documenti, ecc.).
    
    OBIETTIVO PRINCIPALE:
    Estrai un singolo record di spesa aggregato. Se sono presenti multipli file o ricevute, SOMMA GLI IMPORTI per calcolare il totale.

    Regole:
    1. CALCOLO IMPORTO: 
       - Identifica l'importo totale di ogni singolo documento/ricevuta allegata.
       - Somma tutti gli importi trovati.
       - Restituisci la somma totale come 'amount'.
    
    2. DATA:
       - Usa la data del documento più recente.
       - Se non visibile, usa la data odierna: ${currentDate}.
    
    3. DESCRIZIONE:
       - Se è un singolo documento: descrizione sintetica (es. "Fattura Enel", "Riparazione Luce").
       - Se sono più documenti: usa una descrizione riepilogativa (es. "Riepilogo Spese Manutenzione", "Totale fatture fornitori diversi") indicando magari il numero di documenti.
       - Max 50 caratteri.

    4. CATEGORIA:
       - Normalizza in una delle seguenti (scegli la più rappresentativa per l'insieme): 
       - 'Manutenzione'
       - 'Utenze'
       - 'Pulizia'
       - 'Pulizia Scale'
       - 'Amministrazione'
       - 'Compenso Amministratore'
       - 'Assicurazione'
       - 'Spese Bancarie'
       - 'Lettura Acqua'
       - 'Varie'

    5. Se l'utente non specifica una valuta, assumi Euro.
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

    // Add text part (even if empty, though UI should prevent empty submission)
    parts.push({
      text: input || "Analizza questi documenti, somma gli importi se ce ne sono multipli, ed estrai i dati di spesa complessivi."
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
            description: { 
              type: Type.STRING,
              description: "Una descrizione breve e chiara della spesa." 
            },
            amount: { 
              type: Type.NUMBER,
              description: "L'importo totale della spesa (somma di tutti i documenti)." 
            },
            category: { 
              type: Type.STRING,
              enum: Object.values(ExpenseCategory),
              description: "La categoria della spesa."
            },
            date: { 
              type: Type.STRING,
              description: "La data della spesa nel formato YYYY-MM-DD." 
            }
          },
          required: ["description", "amount", "category", "date"]
        }
      }
    });

    if (response.text) {
      const data = JSON.parse(response.text) as ParsedExpenseData;
      return data;
    } else {
      throw new Error("Nessun dato generato dal modello.");
    }
  } catch (error) {
    console.error("Errore durante l'analisi Gemini:", error);
    throw new Error("Impossibile interpretare la spesa. Riprova con una descrizione più chiara o documenti leggibili.");
  }
};