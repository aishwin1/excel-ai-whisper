
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Bot, Search, FileSpreadsheet } from "lucide-react";
import { SampleCommands } from "./SampleCommands";
import { GeminiResponse } from "@/services/GeminiService";
import { ExcelData, ExcelService } from "@/services/ExcelService";
import { useToast } from "@/components/ui/use-toast";

interface Message {
  id: string;
  content: string;
  sender: "user" | "bot";
  timestamp: Date;
  excelOperation?: {
    type: string;
    description: string;
  };
}

interface ChatPanelProps {
  onProcessQuery: (query: string) => Promise<GeminiResponse>;
  excelData: ExcelData | null;
  onUpdateExcelData: (data: ExcelData) => void;
  onFetchWebData: (query: string) => Promise<any>;
}

export const ChatPanel = ({ 
  onProcessQuery,
  excelData,
  onUpdateExcelData,
  onFetchWebData
}: ChatPanelProps) => {
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content: "Hello! I'm ExcelBot. How can I help you with your spreadsheet today?",
      sender: "bot",
      timestamp: new Date(),
    },
  ]);

  useEffect(() => {
    // Scroll to bottom when messages change
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    
    // Show thinking indicator
    const thinkingId = Date.now() + 1;
    setMessages(prev => [...prev, {
      id: thinkingId.toString(),
      content: "Thinking...",
      sender: "bot",
      timestamp: new Date(),
    }]);
    
    setIsProcessing(true);
    setInput("");

    try {
      // Process with Gemini
      let response: GeminiResponse;
      
      // Check if it's a web data request
      if (input.toLowerCase().includes("search") || 
          input.toLowerCase().includes("find data") || 
          input.toLowerCase().includes("get data from web")) {
        
        const searchTerm = input.replace(/search for|search|find data about|get data from web about|get data about/gi, "").trim();
        
        toast({
          title: "Searching web data",
          description: `Looking for information about "${searchTerm}"`,
          duration: 3000,
        });
        
        const webData = await onFetchWebData(searchTerm);
        
        if (webData.success && webData.data?.length > 0) {
          // If we have excel data, we can update it with the web results
          if (excelData) {
            // Create a simple array from web data
            const webDataRows = webData.data.map((item: any) => {
              return [item.url, item.title, item.content?.substring(0, 100) || ""];
            });
            
            // Add headers
            webDataRows.unshift(["URL", "Title", "Content Preview"]);
            
            // Create a new sheet with web data
            const updatedExcelData = {
              ...excelData,
              sheets: {
                ...excelData.sheets,
                "Web Data": {
                  data: webDataRows
                }
              },
              activeSheet: "Web Data"
            };
            
            onUpdateExcelData(updatedExcelData);
            
            response = {
              text: `I found ${webData.data.length} results for "${searchTerm}" and added them to a new sheet called "Web Data".`,
              isError: false
            };
          } else {
            // If no excel data exists, create a new one
            const webDataSheet = {
              sheets: {
                "Web Data": {
                  data: [
                    ["URL", "Title", "Content Preview"],
                    ...webData.data.map((item: any) => {
                      return [item.url, item.title, item.content?.substring(0, 100) || ""];
                    })
                  ]
                }
              },
              activeSheet: "Web Data"
            };
            
            onUpdateExcelData(webDataSheet);
            
            response = {
              text: `I found ${webData.data.length} results for "${searchTerm}" and created a new sheet with the data.`,
              isError: false
            };
          }
        } else {
          response = {
            text: `I couldn't find any web data for "${searchTerm}". ${webData.error || "Please try a different search term."}`,
            isError: true
          };
        }
      } else if (!excelData && !input.toLowerCase().includes("create")) {
        // Handling the case when there's no Excel data
        response = {
          text: "I notice you don't have an Excel sheet open yet. Would you like to create a new spreadsheet or upload an existing file?",
          isError: false
        };
      } else {
        // Regular Gemini query with Excel context
        console.log("Processing Excel-related query");
        response = await onProcessQuery(input);
        
        // Check if the response includes Excel operations
        if (excelData && response.excelOperation) {
          console.log("Excel operation detected:", response.excelOperation);
          try {
            // Apply the operation to the Excel data
            const updatedData = ExcelService.applyOperation(excelData, response.excelOperation);
            onUpdateExcelData(updatedData);
            
            toast({
              title: "Excel Updated",
              description: `Applied ${response.excelOperation.type} operation successfully`,
              duration: 3000,
            });
          } catch (error) {
            console.error("Error applying Excel operation:", error);
            toast({
              title: "Operation Failed",
              description: "Could not apply the Excel operation",
              variant: "destructive",
              duration: 3000,
            });
            
            // Add error note to response
            response.text += "\n\nNote: There was an issue applying this operation to your spreadsheet.";
          }
        }
      }

      // Replace the thinking message with the actual response
      setMessages(prev => prev.filter(msg => msg.id !== thinkingId.toString()));
      
      const botMessage: Message = {
        id: (Date.now() + 2).toString(),
        content: response.text,
        sender: "bot",
        timestamp: new Date(),
        excelOperation: response.excelOperation ? {
          type: response.excelOperation.type,
          description: `Applied ${response.excelOperation.type} operation`
        } : undefined
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error("Error processing message:", error);
      
      // Replace the thinking message with an error message
      setMessages(prev => prev.filter(msg => msg.id !== thinkingId.toString()));
      
      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        content: "I'm sorry, I encountered an error while processing your request. Please try a different question or check if your Excel sheet is properly loaded.",
        sender: "bot",
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, errorMessage]);
      
      toast({
        title: "Error",
        description: "Failed to process your request. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectCommand = (command: string) => {
    setInput(command);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-apple-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot size={18} className="text-apple-blue" />
          <h2 className="font-medium text-apple-gray-900">Chat</h2>
        </div>
        <div className="text-xs text-apple-gray-500">Powered by Gemini</div>
      </div>
      
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.sender === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] rounded-xl p-3 ${
                message.sender === "user"
                  ? "bg-apple-blue text-white"
                  : message.content === "Thinking..."
                    ? "bg-apple-gray-100 text-apple-gray-600 animate-pulse"
                    : "bg-apple-gray-100 text-apple-gray-900"
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
              
              {/* Show Excel operation badge if applicable */}
              {message.excelOperation && (
                <div className="flex items-center gap-1 mt-2 bg-apple-green/10 text-apple-green text-xs py-1 px-2 rounded-full">
                  <FileSpreadsheet size={12} />
                  <span>{message.excelOperation.description}</span>
                </div>
              )}
              
              <p className="text-xs opacity-70 mt-1">
                {message.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      {messages.length === 1 && (
        <SampleCommands onSelectCommand={handleSelectCommand} />
      )}
      
      {/* Input area */}
      <div className="p-4 border-t border-apple-gray-200">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isProcessing ? "Processing..." : "Ask ExcelBot anything..."}
            className="flex-1 focus-visible:ring-apple-blue"
            disabled={isProcessing}
          />
          <Button 
            type="submit" 
            className="bg-apple-blue hover:bg-apple-blue/90"
            disabled={isProcessing || !input.trim()}
          >
            {isProcessing ? (
              <Bot size={18} className="animate-pulse" />
            ) : input.toLowerCase().includes("search") ? (
              <Search size={18} />
            ) : (
              <Send size={18} />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};
