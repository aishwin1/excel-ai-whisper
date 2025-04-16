
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileSpreadsheet, 
  Plus, 
  Table, 
  BarChart3, 
  ArrowDownUp, 
  ArrowLeft, 
  ArrowRight, 
  ZoomIn, 
  ZoomOut,
  Edit3
} from "lucide-react";
import { FooterStatus } from "./FooterStatus";
import { ExcelData } from "@/services/ExcelService";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

interface ExcelPreviewProps {
  excelData: ExcelData | null;
  setShowFileUpload: (show: boolean) => void;
  onCellUpdate?: (sheetName: string, row: number, col: number, value: any) => void;
}

export const ExcelPreview = ({ excelData, setShowFileUpload, onCellUpdate }: ExcelPreviewProps) => {
  const hasFile = !!excelData;
  const [zoomLevel, setZoomLevel] = useState(100);
  const [activeSheet, setActiveSheet] = useState<string | null>(excelData?.activeSheet || null);
  const [editingCell, setEditingCell] = useState<{ row: number, col: number } | null>(null);
  const [cellValue, setCellValue] = useState("");
  const { toast } = useToast();
  
  const handleCreateSheet = () => {
    setShowFileUpload(true);
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 10, 200));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 10, 50));
  };
  
  const handleCellClick = (row: number, col: number, currentValue: any) => {
    if (!hasFile || !onCellUpdate) return;
    
    setEditingCell({ row, col });
    setCellValue(String(currentValue || ""));
  };
  
  const handleCellUpdate = () => {
    if (!hasFile || !editingCell || !activeSheet || !onCellUpdate) return;
    
    // Try to convert to number if possible
    const processedValue = !isNaN(Number(cellValue)) && cellValue.trim() !== '' ? 
      Number(cellValue) : cellValue;
    
    onCellUpdate(activeSheet, editingCell.row, editingCell.col, processedValue);
    setEditingCell(null);
    
    toast({
      title: "Cell updated",
      description: `Updated cell ${String.fromCharCode(65 + editingCell.col)}${editingCell.row + 1}`,
      duration: 2000,
    });
  };
  
  const handleCellBlur = () => {
    handleCellUpdate();
  };
  
  const handleCellKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCellUpdate();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };
  
  const handleTabChange = (value: string) => {
    if (excelData) {
      setActiveSheet(value);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <Tabs 
        defaultValue={excelData?.activeSheet || "sheet1"} 
        className="flex-1 flex flex-col"
        onValueChange={handleTabChange}
      >
        <div className="flex items-center justify-between border-b border-apple-gray-200 px-4 bg-white">
          <TabsList className="h-10">
            {hasFile ? (
              Object.keys(excelData?.sheets || {}).map((sheetName) => (
                <TabsTrigger key={sheetName} value={sheetName} className="data-[state=active]:bg-apple-blue/10">
                  {sheetName}
                </TabsTrigger>
              ))
            ) : (
              <TabsTrigger value="sheet1" className="data-[state=active]:bg-apple-blue/10">
                Sheet 1
              </TabsTrigger>
            )}
            <Button variant="ghost" size="sm" className="h-8 px-2">
              <Plus size={16} />
            </Button>
          </TabsList>

          {hasFile && (
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0" 
                onClick={handleZoomOut}
                title="Zoom Out"
              >
                <ZoomOut size={14} />
              </Button>
              <span className="text-xs text-apple-gray-600">{zoomLevel}%</span>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0" 
                onClick={handleZoomIn}
                title="Zoom In"
              >
                <ZoomIn size={14} />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0"
                title="Edit Mode"
              >
                <Edit3 size={14} />
              </Button>
            </div>
          )}
        </div>

        {hasFile ? (
          Object.entries(excelData?.sheets || {}).map(([sheetName, sheet]) => (
            <TabsContent key={sheetName} value={sheetName} className="flex-1 p-0 m-0 flex flex-col">
              <div className="flex-1 overflow-hidden">
                <ScrollArea className="h-full w-full" type="hover">
                  <div className="min-w-max">
                    <div 
                      className="relative" 
                      style={{ 
                        transform: `scale(${zoomLevel / 100})`, 
                        transformOrigin: 'top left',
                        width: zoomLevel < 100 ? `${100 / (zoomLevel / 100)}%` : 'auto'
                      }}
                    >
                      <table className="min-w-full border-collapse">
                        <thead className="sticky top-0 z-10 bg-apple-gray-100">
                          <tr>
                            <th className="border border-apple-gray-200 p-2 text-center w-10 sticky left-0 z-20 bg-apple-gray-100"></th>
                            {Array(15).fill(0).map((_, i) => (
                              <th key={i} className="border border-apple-gray-200 p-2 text-center font-medium text-apple-gray-700 min-w-24">
                                {String.fromCharCode(65 + i)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {Array(Math.max(sheet?.data?.length || 0, 20)).fill(0).map((_, rowIndex) => (
                            <tr key={rowIndex} className={rowIndex % 2 === 0 ? "bg-white" : "bg-apple-gray-50/50"}>
                              <td className="border border-apple-gray-200 p-2 text-center font-medium text-apple-gray-700 bg-apple-gray-100/70 w-10 sticky left-0 z-10">
                                {rowIndex + 1}
                              </td>
                              {Array(15).fill(0).map((_, colIndex) => {
                                const cellValue = sheet?.data?.[rowIndex]?.[colIndex] || "";
                                const cellDisplay = typeof cellValue === 'object' && cellValue !== null ? 
                                  (cellValue.toString ? cellValue.toString() : JSON.stringify(cellValue)) : 
                                  String(cellValue);
                                  
                                const isActiveCell = sheet?.activeCell?.row === rowIndex && 
                                                   sheet?.activeCell?.col === colIndex;
                                const isEditing = editingCell?.row === rowIndex && 
                                                  editingCell?.col === colIndex;
                                
                                const isAiGenerated = typeof cellValue === 'string' && 
                                  cellValue.includes("AI Generated") ? "bg-apple-green-50" : "";
                                  
                                const isFormulaCell = typeof cellValue === 'object' && 
                                  cellValue !== null && 'formula' in cellValue;
                                  
                                const isChartCell = typeof cellValue === 'object' && 
                                  cellValue !== null && 'isChartData' in cellValue;
                                
                                return (
                                  <td 
                                    key={colIndex} 
                                    className={`border border-apple-gray-200 p-2 text-left min-w-24 
                                      ${isActiveCell ? "bg-apple-blue/10" : ""} 
                                      ${isAiGenerated} 
                                      ${isFormulaCell ? "bg-apple-blue/5" : ""} 
                                      ${isChartCell ? "bg-apple-orange/5" : ""}
                                      ${isEditing ? "p-0" : ""}
                                    `}
                                    onClick={() => handleCellClick(rowIndex, colIndex, cellValue)}
                                    title={isFormulaCell ? cellValue.formula : (isAiGenerated ? "This cell was generated by AI" : "")}
                                  >
                                    {isEditing ? (
                                      <Input
                                        className="h-full border-0 focus-visible:ring-0"
                                        value={cellValue}
                                        onChange={(e) => setCellValue(e.target.value)}
                                        onBlur={handleCellBlur}
                                        onKeyDown={handleCellKeyDown}
                                        autoFocus
                                      />
                                    ) : (
                                      cellDisplay
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </ScrollArea>
              </div>
              <FooterStatus />
            </TabsContent>
          ))
        ) : (
          <TabsContent value="sheet1" className="flex-1 p-0 m-0 flex flex-col">
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center p-6 max-w-sm">
                <div className="mx-auto bg-apple-gray-100 w-16 h-16 mb-4 rounded-full flex items-center justify-center">
                  <FileSpreadsheet size={28} className="text-apple-blue" />
                </div>
                <h3 className="text-lg font-medium text-apple-gray-900 mb-2">No Spreadsheet Open</h3>
                <p className="text-apple-gray-600 mb-4">
                  Upload an existing Excel file or create a new spreadsheet to get started.
                </p>
                <div className="flex flex-col gap-2">
                  <Button 
                    onClick={() => setShowFileUpload(true)}
                    className="bg-apple-blue hover:bg-apple-blue/90"
                  >
                    Upload Excel File
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCreateSheet}
                  >
                    Create New Sheet
                  </Button>
                </div>
                
                {/* Quick start cards */}
                <div className="grid grid-cols-3 gap-3 mt-8">
                  <div className="p-3 bg-white rounded-lg border border-apple-gray-200 shadow-sm text-center">
                    <div className="w-8 h-8 bg-apple-blue/10 rounded-full flex items-center justify-center mx-auto mb-2">
                      <Table className="h-4 w-4 text-apple-blue" />
                    </div>
                    <p className="text-xs">Data Analysis</p>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-apple-gray-200 shadow-sm text-center">
                    <div className="w-8 h-8 bg-apple-green/10 rounded-full flex items-center justify-center mx-auto mb-2">
                      <BarChart3 className="h-4 w-4 text-apple-green" />
                    </div>
                    <p className="text-xs">Visualization</p>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-apple-gray-200 shadow-sm text-center">
                    <div className="w-8 h-8 bg-apple-orange/10 rounded-full flex items-center justify-center mx-auto mb-2">
                      <ArrowDownUp className="h-4 w-4 text-apple-orange" />
                    </div>
                    <p className="text-xs">Sort & Filter</p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};
