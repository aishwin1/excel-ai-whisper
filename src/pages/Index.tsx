
import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { ChatPanel } from "@/components/ChatPanel";
import { ExcelPreview } from "@/components/ExcelPreview";
import { FileUpload } from "@/components/FileUpload";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useToast } from "@/components/ui/use-toast";
import { AiPoweredBadge } from "@/components/AiPoweredBadge";
import { ExcelData, ExcelService } from "@/services/ExcelService";
import { GeminiService } from "@/services/GeminiService";
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
          {/* Chat Panel (Left Side) */}
          <ResizablePanel 
            defaultSize={35} 
            minSize={25}
            maxSize={45} 
            className="bg-white border-r border-apple-gray-200 shadow-sm"
          >
            <ChatPanel 
              onProcessQuery={(query) => GeminiService.processQuery(query)}
              excelData={excelData}
              onUpdateExcelData={setExcelData}
              onFetchWebData={(query) => FirecrawlService.fetchWebData(query)}
            />
          </ResizablePanel>
          
          <ResizableHandle className="w-1.5 bg-apple-gray-100 hover:bg-apple-blue transition-colors" />
          
          {/* Excel Preview (Right Side) */}
          <ResizablePanel defaultSize={65} minSize={40}>
            <ExcelPreview 
              excelData={excelData}
              setShowFileUpload={setShowFileUpload}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      
      {/* File Upload Modal (conditionally rendered) */}
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
