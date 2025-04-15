
import { useToast } from "@/components/ui/use-toast";

export interface GeminiResponse {
  text: string;
  isError: boolean;
}

export class GeminiService {
  private static API_KEY = "AIzaSyDvHZ5PRJkxXyTHfjkBUMgrpOa_iFd1HGY";
  private static API_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent";

  static async processQuery(prompt: string): Promise<GeminiResponse> {
    try {
      console.log("Calling Gemini API with prompt:", prompt.substring(0, 100) + "...");
      
      const response = await fetch(`${this.API_URL}?key=${this.API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `You are ExcelBot, an AI assistant specialized in helping users with Excel spreadsheets. 
                  Answer the following query about Excel: ${prompt}`
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.2,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Gemini API response not OK:", response.status, errorText);
        return { 
          text: "Sorry, I encountered an error while processing your request. Please try again.", 
          isError: true 
        };
      }

      const data = await response.json();
      
      if (data.error) {
        console.error("Gemini API error:", data.error);
        return { 
          text: "Sorry, I encountered an error while processing your request. Please try again.", 
          isError: true 
        };
      }

      console.log("Gemini API response received");
      return { 
        text: data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated", 
        isError: false 
      };
    } catch (error) {
      console.error("Error calling Gemini API:", error);
      return { 
        text: "Sorry, I encountered an error while processing your request. Please try again.", 
        isError: true 
      };
    }
  }

  // Function to analyze and process Excel operations
  static async processExcelOperation(operation: string, currentData: any): Promise<GeminiResponse> {
    try {
      const prompt = `
        I have an Excel spreadsheet with the following data:
        ${JSON.stringify(currentData)}
        
        I want to: ${operation}
        
        Please provide the exact steps and formulas needed to accomplish this in Excel.
        If you're creating or modifying data, return a JSON object with the updated data structure.
      `;
      
      return await this.processQuery(prompt);
    } catch (error) {
      console.error("Error processing Excel operation:", error);
      return { 
        text: "Sorry, I encountered an error while processing your Excel operation. Please try again.", 
        isError: true 
      };
    }
  }
}
