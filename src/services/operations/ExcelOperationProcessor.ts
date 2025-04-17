
import { ExcelData } from "../ExcelService";
import { GeminiResponse } from "../types/gemini-types";
import { GeminiApiClient } from "../apis/GeminiApiClient";

export class ExcelOperationProcessor {
  static async processExcelOperation(operation: string, currentData: ExcelData): Promise<GeminiResponse> {
    try {
      const activeSheetName = currentData.activeSheet;
      const sheetData = currentData.sheets[activeSheetName].data;
      const sampleData = sheetData.slice(0, Math.min(5, sheetData.length));
      
      const sheetContext = {
        activeSheet: activeSheetName,
        rowCount: sheetData.length,
        columnCount: Math.max(...sheetData.map((row: any[]) => row.length)),
        headerRow: sheetData[0],
        sampleData: sampleData
      };
      
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
                // You must include actual data points from the spreadsheet or create appropriate sample data
              ]
            }
          }
          EXCEL_OPERATION_END
          
          IMPORTANT: Be very specific about exact cell locations and ensure you're using the right data from the spreadsheet. A1 is row:0, col:0; B3 is row:2, col:1.
          
          After the JSON block, explain the chart and what it shows.
        `;
      } else if (operation.toLowerCase().includes("create") || operation.toLowerCase().includes("generate data") || operation.toLowerCase().includes("sample data")) {
        prompt = `
          I have an Excel spreadsheet with the following data structure:
          ${JSON.stringify(sheetContext)}
          
          I want to: ${operation}
          
          Please generate appropriate data for this task. Your response MUST include a series of structured operations in this format:
          
          EXCEL_OPERATION_START
          {
            "type": "update_cell",
            "data": {
              "row": 0, // EXACT row number (0-based)
              "col": 0, // EXACT column number (0-based)
              "value": "Header text or cell value"
            }
          }
          EXCEL_OPERATION_END
          
          IMPORTANT: 
          - Provide MULTIPLE update_cell operations, one for EACH cell that needs data
          - Use exact 0-based row/column indices (A1 = row:0, col:0; B3 = row:2, col:1)
          - Start data at row 0 or row 1 (if there's a header row)
          - Generate at least 5-10 rows of realistic data
          - Avoid overwriting any important existing data
          
          After the JSON block, explain the data you've created.
        `;
      } else {
        prompt = `
          I have an Excel spreadsheet with the following data structure:
          ${JSON.stringify(sheetContext)}
          
          Sample data from the active sheet:
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
          
          Be very specific about exact cell locations, values, and formulas.
          Remember to use 0-based indices for rows and columns (A1 = row:0, col:0; B3 = row:2, col:1).
          If creating data, provide the complete data set, not just placeholders.
          After the JSON block, explain the operation in natural language.
        `;
      }
      
      return await GeminiApiClient.callGeminiAPI(prompt);
    } catch (error) {
      console.error("Error processing Excel operation:", error);
      return { 
        text: "Sorry, I encountered an error while processing your Excel operation. Please try a simpler request.", 
        isError: true 
      };
    }
  }
}
