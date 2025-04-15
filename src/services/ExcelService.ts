
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
            ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
            ...Array(20).fill(0).map(() => Array(10).fill(''))
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
}
