
import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { ChatPanel } from "@/components/ChatPanel";
import { ExcelPreview } from "@/components/ExcelPreview";
import { FileUpload } from "@/components/FileUpload";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useToast } from "@/components/ui/use-toast";
import { AiPoweredBadge } from "@/components/AiPoweredBadge";

const Index = () => {
  const [showFileUpload, setShowFileUpload] = useState(false);
  const { toast } = useToast();
  
  useEffect(() => {
    toast({
      title: "Welcome to ExcelBot!",
      description: "Ask any Excel-related question or upload a spreadsheet to get started.",
      duration: 5000,
    });
  }, []);
  
  const handleFileUpload = (file: File) => {
    console.log("File uploaded:", file);
    setShowFileUpload(false);
    toast({
      title: "File uploaded successfully!",
      description: `${file.name} is ready for analysis.`,
      duration: 3000,
    });
    // In a real app, we would process the file here
  };
  
  const handleOpenFileUpload = () => {
    setShowFileUpload(true);
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-white to-apple-gray-100">
      <Header 
        onUpload={handleOpenFileUpload}
        onNewSheet={() => toast({
          title: "Feature Coming Soon",
          description: "New sheet creation will be available in the next version.",
          duration: 3000,
        })}
        onDownload={() => toast({
          title: "Feature Coming Soon",
          description: "Export functionality will be available in the next version.",
          duration: 3000,
        })}
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
            <ChatPanel />
          </ResizablePanel>
          
          <ResizableHandle className="w-1.5 bg-apple-gray-100 hover:bg-apple-blue transition-colors" />
          
          {/* Excel Preview (Right Side) */}
          <ResizablePanel defaultSize={65} minSize={40}>
            <ExcelPreview />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      
      {/* File Upload Modal (conditionally rendered) */}
      {showFileUpload && (
        <FileUpload 
          onUpload={handleFileUpload} 
          onCancel={() => setShowFileUpload(false)} 
        />
      )}
      <AiPoweredBadge />
    </div>
  );
};

export default Index;
