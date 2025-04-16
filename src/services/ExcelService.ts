import * as XLSX from 'xlsx';

export interface ExcelData {
  sheets: {
    [sheetName: string]: {
      data: any[][];
      activeCell?: {
        row: number;
        col: number;
      };
    };
  };
  activeSheet: string;
}

export class ExcelService {
  static parseExcelFile(file: File): Promise<ExcelData> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e: ProgressEvent<FileReader>) => {
        try {
          if (!e.target?.result) {
            throw new Error("Failed to read file");
          }
          
          const data = new Uint8Array(e.target.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          const excelData: ExcelData = {
            sheets: {},
            activeSheet: workbook.SheetNames[0]
          };
          
          workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
            
            excelData.sheets[sheetName] = {
              data: jsonData
            };
          });
          
          resolve(excelData);
        } catch (error) {
          console.error("Error parsing Excel file:", error);
          reject(error);
        }
      };
      
      reader.onerror = (error) => reject(error);
      reader.readAsArrayBuffer(file);
    });
  }

  static createEmptySheet(): ExcelData {
    // Create a basic empty sheet with headers
    return {
      sheets: {
        'Sheet 1': {
          data: [
            Array(15).fill(0).map((_, i) => String.fromCharCode(65 + i)),
            ...Array(20).fill(0).map(() => Array(15).fill(''))
          ]
        }
      },
      activeSheet: 'Sheet 1'
    };
  }

  static exportToExcel(data: ExcelData): Blob {
    const workbook = XLSX.utils.book_new();
    
    Object.entries(data.sheets).forEach(([sheetName, sheetData]) => {
      const worksheet = XLSX.utils.aoa_to_sheet(sheetData.data);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    });
    
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  static applyOperation(excelData: ExcelData, operation: any): ExcelData {
    // Create a deep copy of the data to avoid direct mutations
    const updatedData = JSON.parse(JSON.stringify(excelData));
    const activeSheet = updatedData.activeSheet;
    const sheetData = updatedData.sheets[activeSheet].data;
    
    try {
      switch (operation.type) {
        case "update_cell":
          if (operation.data && typeof operation.data.row === 'number' && typeof operation.data.col === 'number') {
            // Ensure the row exists
            while (sheetData.length <= operation.data.row) {
              sheetData.push(Array(15).fill(''));
            }
            
            // Ensure the column exists
            if (!sheetData[operation.data.row]) {
              sheetData[operation.data.row] = Array(15).fill('');
            }
            
            while (sheetData[operation.data.row].length <= operation.data.col) {
              sheetData[operation.data.row].push('');
            }
            
            // Update the cell with the value
            const value = operation.data.value;
            sheetData[operation.data.row][operation.data.col] = value;

            // Set this cell as active
            updatedData.sheets[activeSheet].activeCell = {
              row: operation.data.row,
              col: operation.data.col
            };
          }
          break;
          
        case "add_formula":
          if (operation.data) {
            const { row = 1, col = 1, formula } = operation.data;
            
            // Ensure rows and columns exist
            while (sheetData.length <= row) {
              sheetData.push(Array(15).fill(''));
            }
            
            if (!sheetData[row]) {
              sheetData[row] = Array(15).fill('');
            }
            
            while (sheetData[row].length <= col) {
              sheetData[row].push('');
            }
            
            // Add the formula
            sheetData[row][col] = formula;
            
            // Process the formula result if possible
            if (formula.startsWith('=')) {
              try {
                const formulaResult = this.calculateFormula(formula, sheetData);
                if (formulaResult !== null) {
                  // Show formula result as a string with the formula as title
                  sheetData[row][col] = {
                    value: formulaResult,
                    formula: formula,
                    toString: () => formulaResult.toString()
                  };
                }
              } catch (error) {
                console.error("Formula calculation error:", error);
                // Keep the formula as is if calculation fails
              }
            }

            // Set this cell as active
            updatedData.sheets[activeSheet].activeCell = {
              row,
              col
            };
          }
          break;
          
        case "create_chart":
          // In a real implementation, this would create a chart object
          // For now, we'll just add a placeholder text and mark the cells used for the chart
          if (operation.data?.chartType) {
            const startRow = 1; // Start at row 1 (after header)
            const startCol = 0;
            const chartRows = 5;
            const chartCols = 3;
            
            // Create chart placeholder
            sheetData[startRow][startCol] = `[Chart: ${operation.data.chartType}]`;
            sheetData[startRow][startCol + 1] = `${operation.data.title || 'Chart Title'}`;
            
            // Mark the chart area with background color
            for (let r = startRow; r < startRow + chartRows && r < sheetData.length; r++) {
              if (!sheetData[r]) sheetData[r] = [];
              for (let c = startCol; c < startCol + chartCols && c < 15; c++) {
                if (r === startRow && c === startCol) continue; // Skip the chart title cell
                if (!sheetData[r][c]) sheetData[r][c] = '';
                // Mark cells as chart data
                if (typeof sheetData[r][c] === 'string' || typeof sheetData[r][c] === 'number') {
                  sheetData[r][c] = {
                    value: sheetData[r][c],
                    isChartData: true,
                    toString: () => sheetData[r][c].value.toString()
                  };
                }
              }
            }
          }
          break;
          
        case "sort":
          if (operation.data && operation.data.column) {
            const colIndex = typeof operation.data.column === 'string' 
              ? operation.data.column.charCodeAt(0) - 65  // Convert A->0, B->1, etc.
              : Number(operation.data.column);
              
            if (colIndex >= 0 && sheetData.length > 1) {
              const headerRow = sheetData[0];
              const dataRows = sheetData.slice(1);
              
              dataRows.sort((a, b) => {
                const aVal = a[colIndex];
                const bVal = b[colIndex];
                
                if (typeof aVal === 'number' && typeof bVal === 'number') {
                  return aVal - bVal;
                }
                
                return String(aVal).localeCompare(String(bVal));
              });
              
              updatedData.sheets[activeSheet].data = [headerRow, ...dataRows];
            }
          }
          break;
          
        case "filter":
          // Simple filter implementation
          if (operation.data && operation.data.column && operation.data.value) {
            const colIndex = typeof operation.data.column === 'string'
              ? operation.data.column.charCodeAt(0) - 65  // Convert A->0, B->1, etc.
              : Number(operation.data.column);
            
            if (colIndex >= 0 && sheetData.length > 1) {
              const headerRow = sheetData[0];
              const dataRows = sheetData.slice(1);
              
              // Filter rows where the column matches the value
              const filteredRows = dataRows.filter(row => {
                const cellValue = row[colIndex];
                const targetValue = operation.data.value;
                
                if (typeof targetValue === 'string' && typeof cellValue === 'string') {
                  return cellValue.toLowerCase().includes(targetValue.toLowerCase());
                }
                
                return cellValue === targetValue;
              });
              
              updatedData.sheets[activeSheet].data = [headerRow, ...filteredRows];
            }
          }
          break;
      }
    } catch (error) {
      console.error("Error applying Excel operation:", error);
    }
    
    return updatedData;
  }
  
  // Helper method for simple formula calculation
  static calculateFormula(formula: string, data: any[][]): number | null {
    // Remove the = at the start
    const formulaText = formula.substring(1).trim();
    
    // Handle SUM formula
    if (formulaText.toUpperCase().startsWith('SUM(') && formulaText.endsWith(')')) {
      const range = formulaText.substring(4, formulaText.length - 1);
      return this.calculateSum(range, data);
    }
    
    // Handle AVERAGE formula
    if (formulaText.toUpperCase().startsWith('AVERAGE(') && formulaText.endsWith(')')) {
      const range = formulaText.substring(8, formulaText.length - 1);
      return this.calculateAverage(range, data);
    }
    
    // Handle COUNT formula
    if (formulaText.toUpperCase().startsWith('COUNT(') && formulaText.endsWith(')')) {
      const range = formulaText.substring(6, formulaText.length - 1);
      return this.countCells(range, data);
    }
    
    // Handle simple mathematical expressions
    try {
      // Replace cell references like A1, B2, etc. with their values
      let processedFormula = formulaText.replace(/([A-Z]+)(\d+)/g, (match, col, row) => {
        const colIndex = this.columnToIndex(col);
        const rowIndex = parseInt(row) - 1;
        
        if (rowIndex >= 0 && rowIndex < data.length && 
            colIndex >= 0 && colIndex < data[rowIndex].length) {
          const cellValue = data[rowIndex][colIndex];
          return typeof cellValue === 'number' ? cellValue.toString() : '0';
        }
        return '0';
      });
      
      // Safely evaluate the expression
      return Function('"use strict"; return (' + processedFormula + ')')();
    } catch (error) {
      console.error("Error evaluating formula:", error);
      return null;
    }
  }
  
  static calculateSum(range: string, data: any[][]): number {
    const cells = this.expandRange(range);
    let sum = 0;
    
    cells.forEach(cell => {
      const { row, col } = this.cellToIndices(cell);
      if (row >= 0 && row < data.length && col >= 0 && col < data[row].length) {
        const value = data[row][col];
        if (typeof value === 'number') {
          sum += value;
        } else if (typeof value === 'string' && !isNaN(Number(value))) {
          sum += Number(value);
        }
      }
    });
    
    return sum;
  }
  
  static calculateAverage(range: string, data: any[][]): number {
    const cells = this.expandRange(range);
    let sum = 0;
    let count = 0;
    
    cells.forEach(cell => {
      const { row, col } = this.cellToIndices(cell);
      if (row >= 0 && row < data.length && col >= 0 && col < data[row].length) {
        const value = data[row][col];
        if (typeof value === 'number') {
          sum += value;
          count++;
        } else if (typeof value === 'string' && !isNaN(Number(value))) {
          sum += Number(value);
          count++;
        }
      }
    });
    
    return count > 0 ? sum / count : 0;
  }
  
  static countCells(range: string, data: any[][]): number {
    const cells = this.expandRange(range);
    let count = 0;
    
    cells.forEach(cell => {
      const { row, col } = this.cellToIndices(cell);
      if (row >= 0 && row < data.length && col >= 0 && col < data[row].length) {
        const value = data[row][col];
        if (value !== null && value !== undefined && value !== '') {
          count++;
        }
      }
    });
    
    return count;
  }
  
  static expandRange(range: string): string[] {
    // Handle a range like "A1:C3"
    if (range.includes(':')) {
      const [start, end] = range.split(':');
      const startCell = this.cellToIndices(start);
      const endCell = this.cellToIndices(end);
      
      const cells = [];
      for (let r = startCell.row; r <= endCell.row; r++) {
        for (let c = startCell.col; c <= endCell.col; c++) {
          cells.push(this.indicesToCell(r, c));
        }
      }
      return cells;
    }
    
    // Handle comma-separated cells like "A1,B2,C3"
    if (range.includes(',')) {
      return range.split(',').map(cell => cell.trim());
    }
    
    // Single cell
    return [range];
  }
  
  static cellToIndices(cell: string): { row: number, col: number } {
    const colStr = cell.match(/[A-Z]+/)?.[0] || 'A';
    const rowStr = cell.match(/\d+/)?.[0] || '1';
    
    return {
      row: parseInt(rowStr) - 1,
      col: this.columnToIndex(colStr)
    };
  }
  
  static indicesToCell(row: number, col: number): string {
    return this.indexToColumn(col) + (row + 1);
  }
  
  static columnToIndex(col: string): number {
    let index = 0;
    for (let i = 0; i < col.length; i++) {
      index = index * 26 + col.charCodeAt(i) - 64;
    }
    return index - 1; // Convert to 0-based
  }
  
  static indexToColumn(index: number): string {
    let column = '';
    index += 1; // Convert to 1-based
    
    while (index > 0) {
      const remainder = (index - 1) % 26;
      column = String.fromCharCode(65 + remainder) + column;
      index = Math.floor((index - remainder) / 26);
    }
    
    return column;
  }
}
