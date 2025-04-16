
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
  private static FIRECRAWL_API_KEY = "fc-eb885ba004f340d7b5f7e9ee96a6d8d1";

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
                  When working with Excel, provide clear formulas and operations that can be applied directly.
                  For calculations, use proper Excel formula syntax starting with '='.
                  
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
          text: `Sorry, I encountered an error while processing your request (Status: ${response.status}). Please try again.`, 
          isError: true 
        };
      }

      const data = await response.json();
      
      if (data.error) {
        console.error("Gemini API error:", data.error);
        return { 
          text: `Sorry, I encountered an error: ${data.error?.message || "Unknown error"}. Please try again.`, 
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
        I have an Excel spreadsheet with the following data structure:
        ${JSON.stringify(currentData.sheets[currentData.activeSheet].data.slice(0, 5))}
        
        I want to: ${operation}
        
        Please provide the exact steps and formulas needed to accomplish this in Excel.
        Format your response for machine processing with clear instructions on what cells to modify.
        
        If you're creating or modifying data, include the exact Excel operation in this format:
        
        EXCEL_OPERATION_START
        {
          "type": "update_cell | add_formula | create_chart | sort | filter",
          "data": {
            // For update_cell: { row: number, col: number, value: any }
            // For add_formula: { row: number, col: number, formula: string }
            // For create_chart: { chartType: "bar|line|pie", title: string }
            // For sort: { column: "A" or number }
            // For filter: { column: "A" or number, value: any }
          }
        }
        EXCEL_OPERATION_END
        
        After the JSON block, explain the operation in natural language.
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
      
      // If no explicit operation detected, try to extract implicitly
      const implicitOperation = this.extractImplicitOperation(response.text, operation);
      if (implicitOperation) {
        return {
          ...response,
          excelOperation: implicitOperation
        };
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
    
    // Check for formula-like patterns
    const formulaMatch = text.match(/=\s*([A-Z]+\s*\([^)]*\))/i);
    if (formulaMatch) {
      return {
        type: "add_formula",
        data: {
          formula: formulaMatch[0],
          row: 1,
          col: 1
        }
      };
    }
    
    // Check for cell references like A1, B2, etc.
    const cellReferenceMatch = text.match(/([A-Z]+\d+)\s*=\s*(.+)/);
    if (cellReferenceMatch) {
      const cellRef = cellReferenceMatch[1];
      const value = cellReferenceMatch[2].trim();
      
      // Extract row and column from cell reference
      const colStr = cellRef.match(/[A-Z]+/)?.[0] || 'A';
      const rowStr = cellRef.match(/\d+/)?.[0] || '1';
      
      const col = this.columnToIndex(colStr);
      const row = parseInt(rowStr) - 1;
      
      if (value.startsWith('=')) {
        // If it's a formula
        return {
          type: "add_formula",
          data: {
            row,
            col,
            formula: value
          }
        };
      } else {
        // Regular cell update
        return {
          type: "update_cell",
          data: {
            row,
            col,
            value
          }
        };
      }
    }
    
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
          column: this.extractColumnFromText(text) || "A",
          value: originalQuery.substring(0, 50)
        }
      };
    } else if (formulaOperation.test(originalQuery) || sumOperation.test(originalQuery) || averageOperation.test(originalQuery)) {
      // Look for formula suggestion
      const formula = this.extractFormulaFromText(text);
      if (formula) {
        return {
          type: "add_formula",
          data: {
            formula,
            row: 1,
            col: 1
          }
        };
      }
    }
    
    // If no specific operation detected
    return null;
  }
  
  // Extract implicit operations from text responses
  private static extractImplicitOperation(text: string, originalQuery: string): { type: string, data?: any } | null {
    // Look for cell updates in the format "Put X in cell Y"
    const cellUpdateMatch = text.match(/put|place|enter|insert|add\s+(.+?)\s+in\s+cell\s+([A-Z]+\d+)/i);
    if (cellUpdateMatch) {
      const value = cellUpdateMatch[1].trim();
      const cell = cellUpdateMatch[2].trim();
      
      const { row, col } = this.cellToIndices(cell);
      
      return {
        type: "update_cell",
        data: {
          row,
          col,
          value: value.startsWith('=') ? value : isNaN(Number(value)) ? value : Number(value)
        }
      };
    }
    
    // Look for simple formulas
    const formulaMatch = text.match(/use\s+formula\s+(.+?)\s+in\s+cell\s+([A-Z]+\d+)/i);
    if (formulaMatch) {
      const formula = formulaMatch[1].trim().startsWith('=') ? 
        formulaMatch[1].trim() : `=${formulaMatch[1].trim()}`;
      const cell = formulaMatch[2].trim();
      
      const { row, col } = this.cellToIndices(cell);
      
      return {
        type: "add_formula",
        data: {
          row,
          col,
          formula
        }
      };
    }
    
    return null;
  }
  
  // Helper to extract column letter from text
  private static extractColumnFromText(text: string): string | null {
    const columnMatch = text.match(/column\s+([A-Z])/i);
    return columnMatch ? columnMatch[1] : null;
  }
  
  // Helper to extract formula from text
  private static extractFormulaFromText(text: string): string | null {
    // Look for formula syntax in text
    const formulaMatch = text.match(/=\s*([A-Z]+\s*\([^)]*\))/i);
    if (formulaMatch) {
      return formulaMatch[0];
    }
    
    // Look for common formula keywords
    if (text.match(/sum|total/i)) {
      const rangeMatch = text.match(/([A-Z]+\d+\s*:\s*[A-Z]+\d+)/i);
      if (rangeMatch) {
        return `=SUM(${rangeMatch[1]})`;
      }
    }
    
    if (text.match(/average|avg/i)) {
      const rangeMatch = text.match(/([A-Z]+\d+\s*:\s*[A-Z]+\d+)/i);
      if (rangeMatch) {
        return `=AVERAGE(${rangeMatch[1]})`;
      }
    }
    
    return null;
  }
  
  // Helper to convert cell reference to indices
  private static cellToIndices(cell: string): { row: number, col: number } {
    const colStr = cell.match(/[A-Z]+/)?.[0] || 'A';
    const rowStr = cell.match(/\d+/)?.[0] || '1';
    
    return {
      row: parseInt(rowStr) - 1,
      col: this.columnToIndex(colStr)
    };
  }
  
  // Helper to convert column letter to index
  private static columnToIndex(col: string): number {
    let index = 0;
    for (let i = 0; i < col.length; i++) {
      index = index * 26 + col.charCodeAt(i) - 64;
    }
    return index - 1; // Convert to 0-based
  }
}
