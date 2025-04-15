
import { useToast } from "@/components/ui/use-toast";

export interface GeminiResponse {
  text: string;
  isError: boolean;
  excelOperation?: {
    type: string;
    data?: any;
  };
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
      
      // Extract the response text
      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated";
      
      // Check if the response contains Excel operations
      const hasExcelOperation = this.detectExcelOperation(responseText, prompt);
      
      return { 
        text: responseText, 
        isError: false,
        ...(hasExcelOperation ? { excelOperation: hasExcelOperation } : {})
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
        If you're creating or modifying data, return your response in this format:
        
        EXCEL_OPERATION_START
        {
          "type": "operation_type", // Can be: "update_cell", "add_formula", "create_chart", "sort", "filter", etc.
          "data": {
            // The specific data for the operation
            // For update_cell: { row: number, col: number, value: any }
            // For add_formula: { row: number, col: number, formula: string }
            // For create_chart: { type: "bar"|"line"|"pie", data: { labels: string[], values: number[] } }
            // etc.
          }
        }
        EXCEL_OPERATION_END
        
        After the JSON block, you can explain the operation in natural language.
      `;
      
      const response = await this.processQuery(prompt);
      
      // Extract operation if present
      if (response.text.includes("EXCEL_OPERATION_START") && response.text.includes("EXCEL_OPERATION_END")) {
        const operationMatch = response.text.match(/EXCEL_OPERATION_START\s*([\s\S]*?)\s*EXCEL_OPERATION_END/);
        if (operationMatch && operationMatch[1]) {
          try {
            const operationData = JSON.parse(operationMatch[1].trim());
            return {
              ...response,
              excelOperation: operationData
            };
          } catch (err) {
            console.error("Error parsing Excel operation JSON:", err);
          }
        }
      }
      
      return response;
    } catch (error) {
      console.error("Error processing Excel operation:", error);
      return { 
        text: "Sorry, I encountered an error while processing your Excel operation. Please try again.", 
        isError: true 
      };
    }
  }
  
  // Helper function to detect if the response contains an Excel operation
  private static detectExcelOperation(text: string, originalQuery: string): { type: string, data?: any } | null {
    // Common Excel operations keywords
    const sumOperation = /sum|total|add up|calculate total/i;
    const averageOperation = /average|mean|avg/i;
    const sortOperation = /sort|order|arrange/i;
    const filterOperation = /filter|find|show only/i;
    const chartOperation = /chart|graph|plot|visualize|visualization/i;
    const formulaOperation = /formula|function|calculate|compute/i;
    
    // Detect the operation type based on keywords in the query or response
    if (chartOperation.test(originalQuery)) {
      // Example chart operation
      const chartType = text.match(/bar chart|line chart|pie chart/i)?.[0] || "bar chart";
      return {
        type: "create_chart",
        data: {
          chartType: chartType.includes("bar") ? "bar" : 
                     chartType.includes("line") ? "line" : "pie",
          title: `Chart from query: ${originalQuery.substring(0, 30)}...`
        }
      };
    } else if (sortOperation.test(originalQuery)) {
      return {
        type: "sort",
        data: {
          column: this.extractColumnFromText(text) || "A"
        }
      };
    } else if (filterOperation.test(originalQuery)) {
      return {
        type: "filter",
        data: {
          criteria: originalQuery.substring(0, 50)
        }
      };
    } else if (formulaOperation.test(originalQuery) || sumOperation.test(originalQuery) || averageOperation.test(originalQuery)) {
      // Try to extract a formula from the text
      const formulaMatch = text.match(/=\s*([A-Z]+\s*\([^)]*\))/i);
      if (formulaMatch) {
        return {
          type: "add_formula",
          data: {
            formula: formulaMatch[0]
          }
        };
      }
    }
    
    // If no specific operation detected
    return null;
  }
  
  // Helper to extract column letter from text
  private static extractColumnFromText(text: string): string | null {
    const columnMatch = text.match(/column\s+([A-Z])/i);
    return columnMatch ? columnMatch[1] : null;
  }
}
