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
                  
                  Always include structured operations in your responses using this format:
                  EXCEL_OPERATION_START
                  {
                    "type": "update_cell | add_formula | create_chart | sort | filter",
                    "data": {
                      // For update_cell: { row: number, col: number, value: any }
                      // For add_formula: { row: number, col: number, formula: string }
                      // For create_chart: { chartType: "bar|line|pie|radar", title: string }
                      // For sort: { column: "A" or number }
                      // For filter: { column: "A" or number, value: any }
                    }
                  }
                  EXCEL_OPERATION_END
                  
                  When working with charts:
                  1. Always specify the chart type: bar, line, pie, or radar
                  2. Provide a meaningful title for the chart
                  3. Make sure to refer to actual data in the spreadsheet
                  
                  For formulas:
                  1. Always use the '=' prefix (like =SUM(A1:A10))
                  2. Make sure to provide sensible cell references
                  3. Support formulas: SUM, AVERAGE, COUNT, MAX, MIN
                  
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
          text: `Sorry, I encountered an error while processing your request (Status: ${response.status}). Please try again with a different question.`, 
          isError: true 
        };
      }

      const data = await response.json();
      
      if (data.error) {
        console.error("Gemini API error:", data.error);
        return { 
          text: `Sorry, I encountered an error: ${data.error?.message || "Unknown error"}. Please try a different approach.`, 
          isError: true 
        };
      }

      console.log("Gemini API response received:", data);
      
      // Extract the response text
      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated";
      
      // Check if the response contains Excel operations
      const excelOperation = this.extractExcelOperation(responseText, prompt);
      
      return { 
        text: responseText, 
        isError: false,
        excelOperation
      };
    } catch (error) {
      console.error("Error calling Gemini API:", error);
      return { 
        text: "Sorry, I encountered an error while processing your request. Please try a simpler query or check your internet connection.", 
        isError: true 
      };
    }
  }

  // Function to analyze and process Excel operations
  static async processExcelOperation(operation: string, currentData: any): Promise<GeminiResponse> {
    try {
      const activeSheetName = currentData.activeSheet;
      const sheetData = currentData.sheets[activeSheetName].data;
      const sampleData = sheetData.slice(0, Math.min(5, sheetData.length));
      
      // Check for chart-related requests
      const isChartRequest = /chart|graph|plot|visual|pie|bar|line|radar/i.test(operation);
      
      let prompt;
      if (isChartRequest) {
        prompt = `
          I have an Excel spreadsheet with the following data structure:
          ${JSON.stringify(sampleData)}
          
          I want to create a chart: ${operation}
          
          Please generate a chart based on this data. Your response MUST include a structured operation like this:
          
          EXCEL_OPERATION_START
          {
            "type": "create_chart",
            "data": {
              "chartType": "bar" or "line" or "pie" or "radar",
              "title": "Appropriate chart title",
              "data": [
                {"name": "Category 1", "value": 100},
                {"name": "Category 2", "value": 200}
                // You can infer categories and values from the data
              ]
            }
          }
          EXCEL_OPERATION_END
          
          After the JSON block, explain the chart and what it shows.
        `;
      } else {
        prompt = `
          I have an Excel spreadsheet with the following data structure:
          ${JSON.stringify(sampleData)}
          
          I want to: ${operation}
          
          Please provide the exact steps and formulas needed to accomplish this in Excel.
          Your response MUST include a structured operation in this format:
          
          EXCEL_OPERATION_START
          {
            "type": "update_cell | add_formula | sort | filter",
            "data": {
              // For update_cell: { row: number, col: number, value: any }
              // For add_formula: { row: number, col: number, formula: string with = prefix }
              // For sort: { column: "A" or number }
              // For filter: { column: "A" or number, value: any }
            }
          }
          EXCEL_OPERATION_END
          
          After the JSON block, explain the operation in natural language.
        `;
      }
      
      const response = await this.processQuery(prompt);
      return response;
    } catch (error) {
      console.error("Error processing Excel operation:", error);
      return { 
        text: "Sorry, I encountered an error while processing your Excel operation. Please try a simpler request.", 
        isError: true 
      };
    }
  }
  
  // Helper function to extract Excel operations from Gemini response
  private static extractExcelOperation(text: string, originalQuery: string): { type: string, data?: any } | undefined {
    try {
      // Extract operation from the structured format
      if (text.includes("EXCEL_OPERATION_START") && text.includes("EXCEL_OPERATION_END")) {
        const operationMatch = text.match(/EXCEL_OPERATION_START\s*([\s\S]*?)\s*EXCEL_OPERATION_END/);
        if (operationMatch && operationMatch[1]) {
          try {
            // Clean up the JSON content by removing markdown code block syntax if present
            let jsonContent = operationMatch[1].trim();
            jsonContent = jsonContent.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
            
            // Remove any line numbers or extra characters that might break JSON parsing
            jsonContent = jsonContent.replace(/^\s*\d+[\s:]*/gm, '');
            
            console.log("Attempting to parse Excel operation:", jsonContent);
            
            try {
              const operationData = JSON.parse(jsonContent);
              console.log("Successfully parsed Excel operation:", operationData);
              return operationData;
            } catch (jsonErr) {
              console.error("First JSON parse error:", jsonErr);
              
              // Try to recover by fixing common JSON syntax issues
              const fixedJson = this.fixCommonJsonErrors(jsonContent);
              console.log("Attempting to parse with fixed JSON:", fixedJson);
              
              try {
                const operationData = JSON.parse(fixedJson);
                console.log("Successfully parsed fixed Excel operation:", operationData);
                return operationData;
              } catch (fixedJsonErr) {
                console.error("Fixed JSON parse error:", fixedJsonErr);
                // Fall back to detection logic
              }
            }
          } catch (err) {
            console.error("Error parsing Excel operation JSON:", err);
            console.log("Failed JSON content:", text);
          }
        }
      }
      
      // If no structured operation found, try to detect operations from the text
      return this.detectExcelOperation(text, originalQuery);
    } catch (error) {
      console.error("Error extracting Excel operation:", error);
      return undefined;
    }
  }
  
  // Helper to fix common JSON syntax errors
  private static fixCommonJsonErrors(jsonText: string): string {
    let fixed = jsonText;
    
    // Fix missing quotes around property names
    fixed = fixed.replace(/(\s*)(\w+)(\s*):/g, '$1"$2"$3:');
    
    // Fix single quotes to double quotes
    fixed = fixed.replace(/'/g, '"');
    
    // Fix trailing commas in arrays and objects
    fixed = fixed.replace(/,(\s*[\]}])/g, '$1');
    
    // Add missing quotes around string values
    // This is complex and might not catch all cases
    
    return fixed;
  }
  
  // Helper function to detect if the response contains an Excel operation
  private static detectExcelOperation(text: string, originalQuery: string): { type: string, data?: any } | undefined {
    console.log("Detecting Excel operation from text");
    
    try {
      // Detect chart creation requests
      const chartOperation = /chart|graph|plot|visual|pie|bar|line|radar/i;
      if (chartOperation.test(originalQuery) || chartOperation.test(text)) {
        let chartType = "bar"; // Default
        
        // Determine chart type from text
        if (/pie\s*chart/i.test(text) || /pie\s*chart/i.test(originalQuery)) {
          chartType = "pie";
        } else if (/line\s*chart|trend/i.test(text) || /line\s*chart|trend/i.test(originalQuery)) {
          chartType = "line";
        } else if (/radar|spider/i.test(text) || /radar|spider/i.test(originalQuery)) {
          chartType = "radar";
        }
        
        // Extract title if available
        let title = "Chart";
        const titleMatch = text.match(/title[:|=]["']?([^"'\n]+)["']?/i);
        if (titleMatch && titleMatch[1]) {
          title = titleMatch[1].trim();
        } else {
          // Generate title from query
          title = `${chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart: ${originalQuery.substring(0, 30)}`;
        }
        
        return {
          type: "create_chart",
          data: {
            chartType,
            title,
            data: [] // Empty data will be populated with samples by ExcelService
          }
        };
      }
      
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
      
      // Check for common Excel operations keywords
      const sumOperation = /sum|total|add up|calculate total/i;
      const averageOperation = /average|mean|avg/i;
      const maxOperation = /maximum|max value|highest/i;
      const minOperation = /minimum|min value|lowest/i;
      
      if (sumOperation.test(originalQuery) || sumOperation.test(text)) {
        // Extract range if available
        const rangeMatch = text.match(/([A-Z]+\d+\s*:\s*[A-Z]+\d+)/i);
        const formula = rangeMatch ? `=SUM(${rangeMatch[1]})` : "=SUM(A1:A10)";
        
        return {
          type: "add_formula",
          data: {
            formula,
            row: 10,
            col: 1
          }
        };
      }
      
      if (averageOperation.test(originalQuery) || averageOperation.test(text)) {
        // Extract range if available
        const rangeMatch = text.match(/([A-Z]+\d+\s*:\s*[A-Z]+\d+)/i);
        const formula = rangeMatch ? `=AVERAGE(${rangeMatch[1]})` : "=AVERAGE(A1:A10)";
        
        return {
          type: "add_formula",
          data: {
            formula,
            row: 10,
            col: 1
          }
        };
      }
      
      if (maxOperation.test(originalQuery) || maxOperation.test(text)) {
        // Extract range if available
        const rangeMatch = text.match(/([A-Z]+\d+\s*:\s*[A-Z]+\d+)/i);
        const formula = rangeMatch ? `=MAX(${rangeMatch[1]})` : "=MAX(A1:A10)";
        
        return {
          type: "add_formula",
          data: {
            formula,
            row: 10,
            col: 1
          }
        };
      }
      
      if (minOperation.test(originalQuery) || minOperation.test(text)) {
        // Extract range if available
        const rangeMatch = text.match(/([A-Z]+\d+\s*:\s*[A-Z]+\d+)/i);
        const formula = rangeMatch ? `=MIN(${rangeMatch[1]})` : "=MIN(A1:A10)";
        
        return {
          type: "add_formula",
          data: {
            formula,
            row: 10,
            col: 1
          }
        };
      }
      
      // Check for cell references like A1, B2, etc.
      const cellReferenceMatch = text.match(/([A-Z]+\d+)\s*=\s*(.+)/i);
      if (cellReferenceMatch) {
        const cellRef = cellReferenceMatch[1];
        const value = cellReferenceMatch[2].trim();
        
        // Extract row and column from cell reference
        const colStr = cellRef.match(/[A-Z]+/)?.[0] || 'A';
        const rowStr = cellRef.match(/\d+/)?.[0] || '1';
        
        const col = this.columnToIndex(colStr);
        const row = parseInt(rowStr) - 1;
        
        return {
          type: "update_cell",
          data: {
            row,
            col,
            value: value.startsWith('=') ? value : isNaN(Number(value)) ? value : Number(value)
          }
        };
      }
      
      // Detect sorting operations
      if (/sort|order|arrange/i.test(originalQuery) || /sort|order|arrange/i.test(text)) {
        const column = this.extractColumnFromText(text) || "A";
        return {
          type: "sort",
          data: {
            column
          }
        };
      }
      
      // Detect filter operations
      if (/filter|find|show only/i.test(originalQuery) || /filter|find|show only/i.test(text)) {
        const column = this.extractColumnFromText(text) || "A";
        const valueMatch = text.match(/filter\s+by\s+["']?([^"'\n]+)["']?/i);
        const value = valueMatch ? valueMatch[1] : originalQuery.substring(0, 50);
        
        return {
          type: "filter",
          data: {
            column,
            value
          }
        };
      }
      
      // Common "add this value" requests
      if (/add|insert|enter|put|set|place|create/i.test(originalQuery)) {
        // Most generic operation - add something at cell A1
        return {
          type: "update_cell",
          data: {
            row: 0,
            col: 0,
            value: originalQuery.substring(0, 100) // Use part of the query as the value
          }
        };
      }
    } catch (error) {
      console.error("Error in detectExcelOperation:", error);
    }
    
    // Couldn't detect any specific operation
    return undefined;
  }
  
  // Helper to suggest a cell for result placement
  private static suggestCellForResult(text: string): { row: number, col: number } {
    // Look for "in cell X" patterns
    const cellMatch = text.match(/in\s+cell\s+([A-Z]+\d+)/i);
    if (cellMatch && cellMatch[1]) {
      return this.cellToIndices(cellMatch[1]);
    }
    
    // Default to a reasonable location
    return {
      row: 10,
      col: 1
    };
  }
  
  // Helper to extract column letter from text
  private static extractColumnFromText(text: string): string | null {
    const columnMatch = text.match(/column\s+([A-Z])/i);
    if (columnMatch && columnMatch[1]) {
      return columnMatch[1];
    }
    
    // Also look for cell references and extract column
    const cellMatch = text.match(/cell\s+([A-Z]+)\d+/i);
    if (cellMatch && cellMatch[1]) {
      return cellMatch[1];
    }
    
    return null;
  }
  
  // Helper to extract formula from text
  private static extractFormulaFromText(text: string): string | null {
    // Look for formula syntax in text
    const formulaMatch = text.match(/=\s*([A-Z]+\s*\([^)]*\))/i);
    if (formulaMatch) {
      return formulaMatch[0];
    }
    
    // Look for formula statements like "Use SUM(A1:A10)"
    const functionMatch = text.match(/(SUM|AVERAGE|COUNT|MAX|MIN|IF|VLOOKUP)\s*\(([^)]+)\)/i);
    if (functionMatch) {
      return `=${functionMatch[1]}(${functionMatch[2]})`;
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
