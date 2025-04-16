
import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { ChatPanel } from "@/components/ChatPanel";
import { ExcelPreview } from "@/components/ExcelPreview";
import { FileUpload } from "@/components/FileUpload";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useToast } from "@/components/ui/use-toast";
import { AiPoweredBadge } from "@/components/AiPoweredBadge";
import { ExcelData, ExcelService } from "@/services/ExcelService";
import { GeminiService, GeminiResponse } from "@/services/GeminiService";
import { FirecrawlService } from "@/services/FirecrawlService";

const Index = () => {
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [excelData, setExcelData] = useState<ExcelData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  
  useEffect(() => {
    toast({
      title: "Welcome to ExcelBot!",
      description: "Ask any Excel-related question or upload a spreadsheet to get started.",
      duration: 5000,
    });
  }, []);
  
  const handleFileUpload = async (file: File) => {
    try {
      setIsProcessing(true);
      toast({
        title: "Processing file...",
        description: "Please wait while we analyze your spreadsheet.",
        duration: 2000,
      });
      
      const data = await ExcelService.parseExcelFile(file);
      setExcelData(data);
      setShowFileUpload(false);
      
      toast({
        title: "File uploaded successfully!",
        description: `${file.name} is ready for analysis.`,
        duration: 3000,
      });
    } catch (error) {
      console.error("Error processing Excel file:", error);
      toast({
        title: "Error processing file",
        description: "There was an error reading your Excel file. Please try again.",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleCreateNewSheet = () => {
    const newSheet = ExcelService.createEmptySheet();
    setExcelData(newSheet);
    setShowFileUpload(false);
    toast({
      title: "New spreadsheet created",
      description: "Your blank spreadsheet is ready to use.",
      duration: 3000,
    });
  };
  
  const handleOpenFileUpload = () => {
    setShowFileUpload(true);
  };
  
  const handleExportFile = () => {
    if (!excelData) {
      toast({
        title: "No data to export",
        description: "Please create or upload a spreadsheet first.",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }
    
    const excelBlob = ExcelService.exportToExcel(excelData);
    const url = URL.createObjectURL(excelBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'excelbot-export.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "File exported successfully",
      description: "Your spreadsheet has been downloaded.",
      duration: 3000,
    });
  };
  
  const handleProcessGeminiResponse = async (query: string): Promise<GeminiResponse> => {
    console.log("Processing query:", query);
    
    // For creating a new sheet
    if (!excelData && query.toLowerCase().includes("create")) {
      handleCreateNewSheet();
      return {
        text: "I've created a new blank spreadsheet for you. What would you like to do with it?",
        isError: false
      };
    }
    
    if (excelData) {
      try {
        // Check for chart or visualization requests
        const isChartRequest = /chart|graph|plot|visual|pie|bar|line|radar/i.test(query.toLowerCase());
        
        // Direct Excel operations
        if (isChartRequest || 
            query.toLowerCase().includes("excel") || 
            /create|insert|add|calculate|sum|formula|sort|filter|average|min|max/.test(query.toLowerCase())) {
          console.log("Processing Excel operation");
          const response = await GeminiService.processExcelOperation(query, excelData);
          
          if (response.excelOperation) {
            console.log("Applying Excel operation:", response.excelOperation);
            try {
              const updatedData = ExcelService.applyOperation(excelData, response.excelOperation);
              setExcelData(updatedData);
              
              toast({
                title: "Excel Updated",
                description: `Applied ${response.excelOperation.type} operation`,
                duration: 3000
              });
            } catch (error) {
              console.error("Error applying Excel operation:", error);
              toast({
                title: "Operation Error",
                description: "Could not process the Excel operation. Please try again.",
                variant: "destructive",
                duration: 3000
              });
              
              return {
                text: "Sorry, I encountered an error while processing your Excel operation. Please try again with a simpler request.",
                isError: true
              };
            }
          }
          
          return response;
        } else {
          // Regular query with Excel context
          return await GeminiService.processQuery(`With context of this Excel data: 
            ${JSON.stringify(excelData.sheets[excelData.activeSheet].data.slice(0, 5))}.
            User query: ${query}`);
        }
      } catch (error) {
        console.error("Error processing Excel operation:", error);
        toast({
          title: "Operation Error",
          description: "Could not process the Excel operation",
          variant: "destructive",
          duration: 3000
        });
        
        return {
          text: "Sorry, I couldn't apply that operation to your spreadsheet. Please try a simpler approach or check your input.",
          isError: true
        };
      }
    }
    
    // Default processing for non-Excel queries
    return await GeminiService.processQuery(query);
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-white to-apple-gray-100">
      <Header 
        onUpload={handleOpenFileUpload}
        onNewSheet={handleCreateNewSheet}
        onDownload={handleExportFile}
      />
      
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup
          direction="horizontal"
          className="min-h-[calc(100vh-4rem)]"
          onLayout={(sizes) => {
            document.cookie = `react-resizable-panels:layout=${JSON.stringify(
              sizes
            )}`;
          }}
        >
          <ResizablePanel 
            defaultSize={35} 
            minSize={25}
            maxSize={45} 
            className="bg-white border-r border-apple-gray-200 shadow-sm"
          >
            <ChatPanel 
              onProcessQuery={(query) => handleProcessGeminiResponse(query)}
              excelData={excelData}
              onUpdateExcelData={setExcelData}
              onFetchWebData={(query) => FirecrawlService.fetchWebData(query)}
            />
          </ResizablePanel>
          
          <ResizableHandle className="w-1.5 bg-apple-gray-100 hover:bg-apple-blue transition-colors" />
          
          <ResizablePanel defaultSize={65} minSize={40}>
            <ExcelPreview 
              excelData={excelData}
              setShowFileUpload={setShowFileUpload}
              onCellUpdate={(sheet, row, col, value) => {
                if (excelData) {
                  try {
                    const updatedData = ExcelService.applyOperation(excelData, {
                      type: "update_cell",
                      data: { row, col, value, isAIGenerated: false }
                    });
                    setExcelData(updatedData);
                  } catch (error) {
                    console.error("Error updating cell:", error);
                    toast({
                      title: "Cell Update Error",
                      description: "Could not update the cell. Please try again.",
                      variant: "destructive",
                      duration: 3000
                    });
                  }
                }
              }}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      
      {showFileUpload && (
        <FileUpload 
          onUpload={handleFileUpload} 
          onCancel={() => setShowFileUpload(false)} 
          onCreateNew={handleCreateNewSheet}
          isProcessing={isProcessing}
        />
      )}
      <AiPoweredBadge />
    </div>
  );
};

export default Index;
