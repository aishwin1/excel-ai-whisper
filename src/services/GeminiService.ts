
import { ExcelData } from "./ExcelService";

export interface GeminiResponse {
  text: string;
  isError: boolean;
  excelOperation?: {
    type: string;
    data?: any;
  };
}

export interface AgentState {
  thinking: string;
  status: 'idle' | 'planning' | 'executing' | 'complete';
  steps: Array<{
    description: string;
    completed: boolean;
    result?: string;
  }>;
  originalQuery: string;
}

export class GeminiService {
  private static API_KEY = "AIzaSyDvHZ5PRJkxXyTHfjkBUMgrpOa_iFd1HGY";
  private static API_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent";
  private static FIRECRAWL_API_KEY = "fc-eb885ba004f340d7b5f7e9ee96a6d8d1";
  private static MAX_AGENT_ITERATIONS = 5;
  private static currentAgentState: AgentState = {
    thinking: "",
    status: "idle",
    steps: [],
    originalQuery: ""
  };

  static getCurrentAgentState(): AgentState {
    return this.currentAgentState;
  }

  static resetAgentState() {
    this.currentAgentState = {
      thinking: "",
      status: "idle",
      steps: [],
      originalQuery: ""
    };
  }

  static async processQuery(prompt: string): Promise<GeminiResponse> {
    if (this.currentAgentState.status === 'idle' || this.currentAgentState.originalQuery !== prompt) {
      this.resetAgentState();
      this.currentAgentState.originalQuery = prompt;
    }

    this.currentAgentState.status = 'planning';
    this.currentAgentState.thinking = "Analyzing your request and planning the approach...";

    try {
      console.log("Calling Gemini API with prompt:", prompt.substring(0, 100) + "...");
      
      const planningResponse = await this.callGeminiAPI(`
        You are ExcelBot, an AI assistant specialized in working with Excel spreadsheets.
        First, analyze this user request and break it down into a series of concrete steps:
        "${prompt}"
        
        Format your response like this:
        PLAN:
        1. [First step description - be very specific and actionable]
        2. [Second step description - be very specific and actionable]
        ...
        
        REASONING:
        [Explain your approach]
        
        For each step, be specific about what Excel operations will be needed:
        - Cell updates (e.g., "Update cell A1 with header 'Sales'")
        - Formulas (e.g., "Add SUM formula in B10 to total values in B1:B9")
        - Charts (e.g., "Create bar chart showing monthly sales data")
        - Data transformations (e.g., "Sort column B in descending order")
        
        Each step must be concrete and executable, not vague.
      `);

      if (planningResponse.isError) {
        return planningResponse;
      }

      const planMatch = planningResponse.text.match(/PLAN:([\s\S]*?)(?:REASONING:|$)/);
      const plan = planMatch ? planMatch[1].trim() : "";
      
      const steps = plan.split(/\d+\./).filter(Boolean).map(step => ({
        description: step.trim(),
        completed: false,
        result: ""
      }));
      
      this.currentAgentState.steps = steps;
      this.currentAgentState.status = 'executing';
      this.currentAgentState.thinking = "Executing the plan step by step...";

      let finalResponse: GeminiResponse = { text: "", isError: false };
      
      for (let i = 0; i < Math.min(steps.length, this.MAX_AGENT_ITERATIONS); i++) {
        const step = steps[i];
        this.currentAgentState.thinking = `Working on step ${i+1}: ${step.description}`;
        console.log(`Executing step ${i+1}:`, step.description);
        
        const previousStepsContext = steps.slice(0, i)
          .filter(s => s.completed && s.result)
          .map((s, idx) => `Step ${idx+1} result: ${s.result}`)
          .join("\n");
        
        const stepPrompt = `
          Excel task: "${prompt}"
          
          Current step (${i+1}/${steps.length}): "${step.description}"
          ${previousStepsContext ? `\nPrevious steps results:\n${previousStepsContext}` : ''}
          
          Please implement this specific Excel operation in detail. Your response must include structured operations in this format:
          EXCEL_OPERATION_START
          {
            "type": "update_cell | add_formula | create_chart | sort | filter",
            "data": {
              // For update_cell: { row: number, col: number, value: any }
              // For add_formula: { row: number, col: number, formula: string with = prefix }
              // For create_chart: { chartType: "bar|line|pie|radar", title: string, data: [{name: string, value: number}, ...] }
              // For sort: { column: "A" or number }
              // For filter: { column: "A" or number, value: any }
            }
          }
          EXCEL_OPERATION_END
          
          Be very explicit and provide the exact data that should be used. If you need to create data, include that exact data in the operation.
          
          IMPORTANT: 
          - If working with data, ALWAYS specify EXACT cell locations (row, col values)
          - When generating data, make sure to specify enough rows/columns of data (not just one example)
          - Ensure that columns or rows you reference exist in the spreadsheet
          - For chart data, provide at least 5 data points with realistic values
          - Be careful not to overwrite existing important data - check the sheet structure first
          
          For example, if setting up a sales table, don't just say "Set up sales data" - instead provide the EXACT cells, values, and formulas needed.
          
          After the operation JSON block, explain what you did and why.
        `;
        
        const stepResponse = await this.callGeminiAPI(stepPrompt);
        
        if (stepResponse.isError) {
          step.completed = false;
          step.result = `Error: ${stepResponse.text}`;
          break;
        }
        
        step.completed = true;
        
        if (stepResponse.excelOperation && stepResponse.excelOperation.type) {
          const operationType = stepResponse.excelOperation.type;
          let operationSummary = "";
          
          switch (operationType) {
            case "update_cell":
              const cell = stepResponse.excelOperation.data;
              const cellRef = cell ? `${String.fromCharCode(65 + cell.col)}${cell.row + 1}` : "unknown";
              const cellValue = cell ? (typeof cell.value === 'object' ? JSON.stringify(cell.value).substring(0, 30) : String(cell.value).substring(0, 30)) : "unknown";
              operationSummary = `Updated cell ${cellRef} with value: ${cellValue}${cellValue.length > 30 ? '...' : ''}`;
              break;
              
            case "add_formula":
              const formula = stepResponse.excelOperation.data;
              const formulaRef = formula ? `${String.fromCharCode(65 + formula.col)}${formula.row + 1}` : "unknown";
              operationSummary = `Added formula ${formula ? formula.formula : ''} to cell ${formulaRef}`;
              break;
              
            case "create_chart":
              const chart = stepResponse.excelOperation.data;
              operationSummary = `Created ${chart ? chart.chartType : 'unknown'} chart: ${chart ? chart.title : ''}`;
              break;
              
            case "sort":
              const sort = stepResponse.excelOperation.data;
              operationSummary = `Sorted data by column ${sort ? sort.column : 'unknown'}`;
              break;
              
            case "filter":
              const filter = stepResponse.excelOperation.data;
              operationSummary = `Filtered data in column ${filter ? filter.column : 'unknown'} for "${filter ? filter.value : 'unknown'}"`;
              break;
              
            default:
              operationSummary = `Performed ${operationType} operation`;
          }
          
          step.result = operationSummary;
        } else {
          step.result = stepResponse.text.substring(0, 100) + "...";
        }
        
        console.log(`Step ${i+1} completed:`, step.result);
        finalResponse = stepResponse;
      }
      
      this.currentAgentState.status = 'complete';
      return finalResponse;
    } catch (error) {
      console.error("Error in processQuery:", error);
      this.currentAgentState.status = 'complete';
      return { 
        text: "Sorry, I encountered an error while processing your request. Please try a simpler query or check your internet connection.", 
        isError: true 
      };
    }
  }

  private static async callGeminiAPI(prompt: string): Promise<GeminiResponse> {
    try {
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
                      // For create_chart: { chartType: "bar|line|pie|radar", title: string, data: [{name: string, value: number}, ...] }
                      // For sort: { column: "A" or number }
                      // For filter: { column: "A" or number, value: any }
                    }
                  }
                  EXCEL_OPERATION_END
                  
                  IMPORTANT GUIDELINES FOR EXCEL OPERATIONS:
                  1. When updating cells or adding data:
                     - ALWAYS use 0-based row/column indices (first row is 0, first column is 0)
                     - Make sure to specify exact row/column numbers for ALL data
                     - Avoid using relative references or placeholders
                     - Provide complete data sets with clear organization
                     - A1 = row:0, col:0; B3 = row:2, col:1
                  
                  2. When working with charts:
                     - Always specify the chart type: bar, line, pie, or radar
                     - Provide a meaningful title for the chart
                     - ALWAYS provide the actual data points for the chart in the 'data' array
                     - Include at least 5 data points with realistic values
                     - Example:
                       "data": [
                         {"name": "January", "value": 200},
                         {"name": "February", "value": 350},
                         {"name": "March", "value": 400}
                       ]
                  
                  3. For formulas:
                     - Always use the '=' prefix (like =SUM(A1:A10))
                     - Make sure to provide sensible cell references
                     - Support formulas: SUM, AVERAGE, COUNT, MAX, MIN
                  
                  4. For sample data:
                     - Always provide SPECIFIC data, not placeholders
                     - Use realistic values for the user's task
                     - Make sure the data makes sense in the context of the task

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
      
      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated";
      
      const excelOperation = this.extractExcelOperation(responseText);
      
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

  static async processExcelOperation(operation: string, currentData: any): Promise<GeminiResponse> {
    this.currentAgentState.thinking = `Processing operation: ${operation}`;
    
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
      
      const response = await this.callGeminiAPI(prompt);
      
      if (this.currentAgentState.status === 'executing') {
        const lastIncompleteStep = this.currentAgentState.steps.find(step => !step.completed);
        if (lastIncompleteStep) {
          lastIncompleteStep.completed = true;
          lastIncompleteStep.result = operation + " - " + (response.excelOperation?.type || "processed");
        }
      }
      
      return response;
    } catch (error) {
      console.error("Error processing Excel operation:", error);
      return { 
        text: "Sorry, I encountered an error while processing your Excel operation. Please try a simpler request.", 
        isError: true 
      };
    }
  }

  private static extractExcelOperation(text: string): { type: string, data?: any } | undefined {
    try {
      if (text.includes("EXCEL_OPERATION_START") && text.includes("EXCEL_OPERATION_END")) {
        const operationMatch = text.match(/EXCEL_OPERATION_START\s*([\s\S]*?)\s*EXCEL_OPERATION_END/);
        if (operationMatch && operationMatch[1]) {
          try {
            let jsonContent = operationMatch[1].trim();
            jsonContent = jsonContent.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
            
            jsonContent = jsonContent.replace(/^\s*\d+[\s:]*/gm, '');
            
            console.log("Attempting to parse Excel operation:", jsonContent);
            
            try {
              const operationData = JSON.parse(jsonContent);
              console.log("Successfully parsed Excel operation:", operationData);
              return operationData;
            } catch (jsonErr) {
              console.error("First JSON parse error:", jsonErr);
              
              const fixedJson = this.fixCommonJsonErrors(jsonContent);
              console.log("Attempting to parse with fixed JSON:", fixedJson);
              
              try {
                const operationData = JSON.parse(fixedJson);
                console.log("Successfully parsed fixed Excel operation:", operationData);
                return operationData;
              } catch (fixedJsonErr) {
                console.error("Fixed JSON parse error:", fixedJsonErr);
                return undefined;
              }
            }
          } catch (err) {
            console.error("Error parsing Excel operation JSON:", err);
            console.log("Failed JSON content:", text);
          }
        }
      }
      
      // Check for multiple operations
      const multipleOperations = this.extractMultipleOperations(text);
      if (multipleOperations.length > 0) {
        console.log("Found multiple Excel operations:", multipleOperations.length);
        // Just return the first operation for now
        // In the future, we could process all operations
        return multipleOperations[0];
      }
      
      return this.detectExcelOperation(text);
    } catch (error) {
      console.error("Error extracting Excel operation:", error);
      return undefined;
    }
  }
  
  // New method to extract multiple operations
  private static extractMultipleOperations(text: string): Array<{ type: string, data?: any }> {
    const operations: Array<{ type: string, data?: any }> = [];
    
    // Look for patterns like "update_cell" followed by JSON structure
    const updateCellMatches = text.matchAll(/\{\s*"type"\s*:\s*"update_cell"\s*,\s*"data"\s*:\s*\{\s*"row"\s*:\s*(\d+)\s*,\s*"col"\s*:\s*(\d+)\s*,\s*"value"\s*:\s*("[^"]*"|\d+|true|false|null)\s*\}\s*\}/g);
    
    if (updateCellMatches) {
      for (const match of updateCellMatches) {
        try {
          const fullMatch = match[0];
          const parsedOp = JSON.parse(fullMatch);
          if (parsedOp.type && parsedOp.data) {
            operations.push(parsedOp);
          }
        } catch (e) {
          console.error("Error parsing operation in multiple operations extraction:", e);
        }
      }
    }
    
    return operations;
  }

  private static fixCommonJsonErrors(jsonText: string): string {
    let fixed = jsonText;
    
    fixed = fixed.replace(/(\s*)(\w+)(\s*):/g, '$1"$2"$3:');
    fixed = fixed.replace(/'/g, '"');
    fixed = fixed.replace(/,(\s*[\]}])/g, '$1');
    
    return fixed;
  }

  private static detectExcelOperation(text: string): { type: string, data?: any } | undefined {
    console.log("Detecting Excel operation from text");
    
    // First look for data creation patterns with multiple values
    const dataCreationPattern = this.extractDataCreationPattern(text);
    if (dataCreationPattern) {
      return dataCreationPattern;
    }
    
    const chartMatch = text.match(/create\s+(a|an)\s+(bar|line|pie|radar)\s+chart/i);
    if (chartMatch) {
      const chartType = chartMatch[2].toLowerCase();
      
      let title = "Chart";
      const titleMatch = text.match(/title[:|=]["']?([^"'\n]+)["']?/i);
      if (titleMatch && titleMatch[1]) {
        title = titleMatch[1].trim();
      }
      
      const dataPoints = this.extractChartDataPoints(text);
      
      return {
        type: "create_chart",
        data: {
          chartType,
          title,
          data: dataPoints.length > 0 ? dataPoints : [
            {name: "Sample 1", value: 30},
            {name: "Sample 2", value: 50},
            {name: "Sample 3", value: 70},
            {name: "Sample 4", value: 90},
            {name: "Sample 5", value: 40}
          ]
        }
      };
    }
    
    const formulaMatch = text.match(/=\s*([A-Z]+\s*\([^)]*\))/i);
    if (formulaMatch) {
      const cellRefMatch = text.match(/(?:in|to)\s+cell\s+([A-Z]+\d+)/i);
      let row = 0, col = 0;
      
      if (cellRefMatch && cellRefMatch[1]) {
        const cellRef = cellRefMatch[1];
        col = cellRef.charCodeAt(0) - 65;
        row = parseInt(cellRef.substring(1)) - 1;
      }
      
      return {
        type: "add_formula",
        data: {
          formula: formulaMatch[0].trim(),
          row,
          col
        }
      };
    }
    
    const cellUpdateMatch = text.match(/(?:set|put|update)\s+(?:cell\s+)?([A-Z]+\d+)\s+(?:to|with|as|=)\s+["']?([^"'\n]+)["']?/i);
    if (cellUpdateMatch) {
      const cellRef = cellUpdateMatch[1];
      const value = cellUpdateMatch[2].trim();
      
      const col = cellRef.charCodeAt(0) - 65;
      const row = parseInt(cellRef.substring(1)) - 1;
      
      return {
        type: "update_cell",
        data: {
          row,
          col,
          value: !isNaN(Number(value)) ? Number(value) : value
        }
      };
    }
    
    const sortMatch = text.match(/sort\s+(?:by\s+)?(?:column\s+)?([A-Z]|[0-9]+)/i);
    if (sortMatch) {
      const column = sortMatch[1];
      return {
        type: "sort",
        data: {
          column
        }
      };
    }
    
    const filterMatch = text.match(/filter\s+(?:by|where)\s+(?:column\s+)?([A-Z]|[0-9]+)\s+(?:is|=|contains)\s+["']?([^"'\n]+)["']?/i);
    if (filterMatch) {
      const column = filterMatch[1];
      const value = filterMatch[2].trim();
      
      return {
        type: "filter",
        data: {
          column,
          value
        }
      };
    }
    
    const dataInsertionMatch = text.match(/insert|create|add|populate|fill|enter\s+data/i);
    if (dataInsertionMatch) {
      const tableData = this.extractTableData(text);
      if (tableData.length > 0) {
        // Create multiple update_cell operations for the table data
        return {
          type: "update_cell",
          data: {
            row: 0,
            col: 0,
            value: tableData[0][0] || "Data"
          }
        };
      }
    }
    
    return undefined;
  }
  
  // New helper method to extract data creation patterns
  private static extractDataCreationPattern(text: string): { type: string, data?: any } | undefined {
    // Look for tables in markdown format
    const tableRows = text.split('\n').filter(line => line.trim().startsWith('|'));
    if (tableRows.length > 2) {
      const headerRow = tableRows[0].split('|').filter(Boolean).map(cell => cell.trim());
      
      // Return an update for the first cell as a preview
      if (headerRow.length > 0) {
        return {
          type: "update_cell",
          data: {
            row: 0,
            col: 0,
            value: headerRow[0]
          }
        };
      }
    }
    
    // Look for mentions of specific cell references with values
    const cellValuePairs = [];
    const cellValueRegex = /([A-Z]+\d+)\s*[:=]\s*["']?([^"',\n]+)["']?/g;
    let match;
    while ((match = cellValueRegex.exec(text)) !== null) {
      const cellRef = match[1];
      const value = match[2].trim();
      
      const col = cellRef.charCodeAt(0) - 65;
      const row = parseInt(cellRef.substring(1)) - 1;
      
      cellValuePairs.push({
        row,
        col,
        value: !isNaN(Number(value)) ? Number(value) : value
      });
    }
    
    if (cellValuePairs.length > 0) {
      // Return the first cell-value pair
      return {
        type: "update_cell",
        data: cellValuePairs[0]
      };
    }
    
    return undefined;
  }

  private static extractChartDataPoints(text: string): Array<{name: string, value: number}> {
    const dataPoints: Array<{name: string, value: number}> = [];
    
    const dataArrayMatch = text.match(/data\s*:\s*\[\s*([\s\S]*?)\s*\]/i);
    if (dataArrayMatch && dataArrayMatch[1]) {
      const dataContent = dataArrayMatch[1];
      
      const itemMatches = dataContent.matchAll(/{\s*["']?name["']?\s*:\s*["']?([^"',]+)["']?\s*,\s*["']?value["']?\s*:\s*(\d+)/g);
      if (itemMatches) {
        for (const match of itemMatches) {
          const name = match[1].trim();
          const value = parseInt(match[2]);
          if (name && !isNaN(value)) {
            dataPoints.push({ name, value });
          }
        }
      }
    }
    
    if (dataPoints.length === 0) {
      const lines = text.split('\n');
      for (const line of lines) {
        const dataMatch = line.match(/([A-Za-z0-9\s]+)(?:\s*[-:|]\s*)(\d+)/);
        if (dataMatch) {
          const name = dataMatch[1].trim();
          const value = parseInt(dataMatch[2]);
          if (name && !isNaN(value)) {
            dataPoints.push({ name, value });
          }
        }
      }
    }
    
    return dataPoints;
  }

  private static extractTableData(text: string): string[][] {
    const tableData: string[][] = [];
    
    let inTable = false;
    let headerPassed = false;
    
    for (const line of text.split('\n')) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.match(/^\|?\s*[-:]+\s*\|/)) {
        inTable = true;
        headerPassed = true;
        continue;
      }
      
      if (inTable && trimmedLine.startsWith('|')) {
        const cells = trimmedLine
          .split('|')
          .slice(1, -1)
          .map(cell => cell.trim());
        
        if (cells.length > 0) {
          tableData.push(cells);
        }
      } else if (inTable && !trimmedLine) {
        inTable = false;
      }
    }
    
    if (tableData.length === 0) {
      let consecutiveDataRows = 0;
      
      for (const line of text.split('\n')) {
        const trimmedLine = line.trim();
        if (!trimmedLine) {
          consecutiveDataRows = 0;
          continue;
        }
        
        if (trimmedLine.includes(',') || trimmedLine.includes('\t')) {
          const separator = trimmedLine.includes(',') ? ',' : '\t';
          const cells = trimmedLine.split(separator).map(cell => cell.trim());
          
          if (cells.length > 1) {
            tableData.push(cells);
            consecutiveDataRows++;
            
            if (consecutiveDataRows >= 2) {
              break;
            }
          } else {
            consecutiveDataRows = 0;
          }
        }
      }
    }
    
    return tableData;
  }

  private static suggestCellForResult(text: string): { row: number, col: number } {
    const cellMatch = text.match(/in\s+cell\s+([A-Z]+\d+)/i);
    if (cellMatch && cellMatch[1]) {
      return this.cellToIndices(cellMatch[1]);
    }
    
    return {
      row: 10,
      col: 1
    };
  }

  private static extractColumnFromText(text: string): string | null {
    const columnMatch = text.match(/column\s+([A-Z])/i);
    if (columnMatch && columnMatch[1]) {
      return columnMatch[1];
    }
    
    const cellMatch = text.match(/cell\s+([A-Z]+)\d+/i);
    if (cellMatch && cellMatch[1]) {
      return cellMatch[1];
    }
    
    return null;
  }

  private static extractFormulaFromText(text: string): string | null {
    const formulaMatch = text.match(/=\s*([A-Z]+\s*\([^)]*\))/i);
    if (formulaMatch) {
      return formulaMatch[0];
    }
    
    const functionMatch = text.match(/(SUM|AVERAGE|COUNT|MAX|MIN|IF|VLOOKUP)\s*\(([^)]+)\)/i);
    if (functionMatch) {
      return `=${functionMatch[1]}(${functionMatch[2]})`;
    }
    
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

  private static cellToIndices(cell: string): { row: number, col: number } {
    const colStr = cell.match(/[A-Z]+/)?.[0] || 'A';
    const rowStr = cell.match(/\d+/)?.[0] || '1';
    
    return {
      row: parseInt(rowStr) - 1,
      col: this.columnToIndex(colStr)
    };
  }

  private static columnToIndex(col: string): number {
    let index = 0;
    for (let i = 0; i < col.length; i++) {
      index = index * 26 + col.charCodeAt(i) - 64;
    }
    return index - 1;
  }

  private static indexToColumn(index: number): string {
    let column = '';
    index += 1;
    
    while (index > 0) {
      const remainder = (index - 1) % 26;
      column = String.fromCharCode(65 + remainder) + column;
      index = Math.floor((index - remainder) / 26);
    }
    
    return column;
  }
}
