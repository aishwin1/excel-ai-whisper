
export class ExcelUtils {
  static suggestCellForResult(text: string): { row: number, col: number } {
    const cellMatch = text.match(/in\s+cell\s+([A-Z]+\d+)/i);
    if (cellMatch && cellMatch[1]) {
      return this.cellToIndices(cellMatch[1]);
    }
    
    return {
      row: 10,
      col: 1
    };
  }

  static extractColumnFromText(text: string): string | null {
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

  static extractFormulaFromText(text: string): string | null {
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

  static cellToIndices(cell: string): { row: number, col: number } {
    const colStr = cell.match(/[A-Z]+/)?.[0] || 'A';
    const rowStr = cell.match(/\d+/)?.[0] || '1';
    
    return {
      row: parseInt(rowStr) - 1,
      col: this.columnToIndex(colStr)
    };
  }

  static columnToIndex(col: string): number {
    let index = 0;
    for (let i = 0; i < col.length; i++) {
      index = index * 26 + col.charCodeAt(i) - 64;
    }
    return index - 1;
  }

  static indexToColumn(index: number): string {
    let column = '';
    index += 1;
    
    while (index > 0) {
      const remainder = (index - 1) % 26;
      column = String.fromCharCode(65 + remainder) + column;
      index = Math.floor((index - remainder) / 26);
    }
    
    return column;
  }
  
  static indicesToCell(row: number, col: number): string {
    return this.indexToColumn(col) + (row + 1);
  }
}
