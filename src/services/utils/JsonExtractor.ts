
interface ExcelOperationData {
  type: string;
  data?: any;
}

export class JsonExtractor {
  static fixCommonJsonErrors(jsonText: string): string {
    let fixed = jsonText;
    
    fixed = fixed.replace(/(\s*)(\w+)(\s*):/g, '$1"$2"$3:');
    fixed = fixed.replace(/'/g, '"');
    fixed = fixed.replace(/,(\s*[\]}])/g, '$1');
    
    return fixed;
  }
  
  static extractExcelOperation(text: string): { type: string, data?: any } | undefined {
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
        return multipleOperations[0];
      }
      
      return this.detectExcelOperation(text);
    } catch (error) {
      console.error("Error extracting Excel operation:", error);
      return undefined;
    }
  }
  
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
}
