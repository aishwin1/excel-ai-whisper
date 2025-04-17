
import { ExcelData } from "../ExcelService";
import { GeminiResponse } from "../types/gemini-types";
import { GeminiApiClient } from "../apis/GeminiApiClient";

export class ExcelOperationProcessor {
  static async processExcelOperation(operation: string, currentData: ExcelData): Promise<GeminiResponse> {
    try {
      const activeSheetName = currentData.activeSheet;
      const sheetData = currentData.sheets[activeSheetName].data;
      
      // Get more comprehensive sheet information to help Gemini understand the structure
      const rowCount = sheetData.length;
      const columnCount = Math.max(...sheetData.map((row: any[]) => row.length));
      const headerRow = sheetData[0] || [];
      
      // Find the last row with data for each column (to know where to append data)
      const lastDataRowByColumn = [];
      for (let col = 0; col < columnCount; col++) {
        let lastRow = -1;
        for (let row = rowCount - 1; row >= 0; row--) {
          if (sheetData[row] && sheetData[row][col] !== undefined && sheetData[row][col] !== "") {
            lastRow = row;
            break;
          }
        }
        lastDataRowByColumn.push(lastRow);
      }
      
      // Find empty regions in the sheet
      const emptyRegions = [];
      const minEmptyRegionSize = 3; // Minimum size of an empty region to track
      
      // Simple algorithm to find rectangular empty regions
      for (let row = 0; row < Math.min(30, rowCount); row++) {
        for (let col = 0; col < Math.min(10, columnCount); col++) {
          if (!sheetData[row] || !sheetData[row][col]) {
            // Check for a potential empty region
            let maxRowSpan = 0;
            let maxColSpan = 0;
            
            // Check how many rows down are empty
            for (let r = row; r < Math.min(row + 10, rowCount); r++) {
              if (!sheetData[r] || !sheetData[r][col]) {
                maxRowSpan++;
              } else {
                break;
              }
            }
            
            // Check how many columns right are empty
            for (let c = col; c < Math.min(col + 5, columnCount); c++) {
              if (!sheetData[row] || !sheetData[row][c]) {
                maxColSpan++;
              } else {
                break;
              }
            }
            
            if (maxRowSpan >= minEmptyRegionSize && maxColSpan >= minEmptyRegionSize) {
              emptyRegions.push({
                startRow: row,
                startCol: col,
                rowSpan: maxRowSpan,
                colSpan: maxColSpan
              });
              
              // Skip ahead to avoid finding the same region multiple times
              col += maxColSpan - 1;
            }
          }
        }
      }
      
      // Extract a reasonable sample of data (up to 10 rows)
      const sampleData = sheetData.slice(0, Math.min(10, sheetData.length));
      
      // Provide rich context about the sheet to help Gemini make intelligent decisions
      const sheetContext = {
        activeSheet: activeSheetName,
        rowCount: rowCount,
        columnCount: columnCount,
        headerRow: headerRow,
        sampleData: sampleData,
        lastDataRowByColumn: lastDataRowByColumn,
        emptyRegions: emptyRegions.slice(0, 3) // Limit to 3 for simplicity
      };
      
      // Improved detection for chart requests
      const isChartRequest = /chart|graph|plot|visual|pie|bar|line|radar|histogram|scatter|area/i.test(operation);
      
      let prompt;
      if (isChartRequest) {
        prompt = `
          I have an Excel spreadsheet with the following data structure:
          ${JSON.stringify(sheetContext)}
          
          I want to create a chart: ${operation}
          
          IMPORTANT GUIDELINES FOR CHART CREATION:
          1. First analyze the data to determine what would make the most meaningful visualization
          2. Select the appropriate chart type based on the data patterns:
             - Bar charts for comparing categories
             - Line charts for trends over time
             - Pie charts for showing proportions of a whole
             - Radar charts for comparing multiple variables
          3. Choose the most relevant columns/rows that contain numeric data
          4. Make sure to identify proper labels for data points
          
          Your response MUST include a structured operation like this:
          
          EXCEL_OPERATION_START
          {
            "type": "create_chart",
            "data": {
              "chartType": "bar" or "line" or "pie" or "radar",
              "title": "Appropriate chart title",
              "data": [
                {"name": "Category 1", "value": 100},
                {"name": "Category 2", "value": 200}
                // You must include at least 5 data points with actual values from the spreadsheet
              ]
            }
          }
          EXCEL_OPERATION_END
          
          IMPORTANT: 
          - Extract ACTUAL DATA from the sheet for visualization
          - Ensure each data point has both a name and a numeric value
          - Create at least 5 data points, preferably more for good visualization
          - For multi-series data, include additional properties beyond just name/value
          - Make sure values are numeric (not strings)
          
          After the JSON block, explain the chart and what it shows.
        `;
      } else if (operation.toLowerCase().includes("create") || operation.toLowerCase().includes("generate data") || operation.toLowerCase().includes("sample data")) {
        prompt = `
          I have an Excel spreadsheet with the following data structure:
          ${JSON.stringify(sheetContext)}
          
          I want to: ${operation}
          
          IMPORTANT GUIDELINES FOR CREATING DATA:
          1. First analyze the existing spreadsheet structure to understand its layout
          2. Find an appropriate location for the new data:
             - Look for empty regions in the sheet: ${JSON.stringify(emptyRegions)}
             - Avoid overwriting any existing data
             - If adding to an existing table, find the next empty row
          3. If headers already exist, use them to guide what data to create
          4. Create data that's consistent with any existing data patterns
          
          Your response MUST include a series of structured operations in this format:
          
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
          
          IMPORTANT GUIDELINES FOR EXCEL OPERATIONS:
          1. First analyze the spreadsheet structure to understand its layout and data patterns
          2. Look for existing data, headers, and already populated cells before placing new data
          3. For calculations or results:
             - If updating existing tables, find the last row with data and append below it
             - For totals/summaries, place them at the bottom of their associated column
             - For new data, find an empty area (${JSON.stringify(emptyRegions)}) to avoid overwriting existing content
          4. When adding formulas, ensure they reference the correct cell ranges based on actual data
          
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
