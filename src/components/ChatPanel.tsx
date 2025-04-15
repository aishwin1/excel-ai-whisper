
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Bot } from "lucide-react";
import { SampleCommands } from "./SampleCommands";

interface Message {
  id: string;
  content: string;
  sender: "user" | "bot";
  timestamp: Date;
}

export const ChatPanel = () => {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content: "Hello! I'm ExcelBot. How can I help you with your spreadsheet today?",
      sender: "bot",
      timestamp: new Date(),
    },
  ]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      sender: "user",
      timestamp: new Date(),
    };

    // Add placeholder bot response
    const botMessage: Message = {
      id: (Date.now() + 1).toString(),
      content: "I'm processing your request. This is a placeholder response until API integration.",
      sender: "bot",
      timestamp: new Date(),
    };

    setMessages([...messages, userMessage, botMessage]);
    setInput("");
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
                  : "bg-apple-gray-100 text-apple-gray-900"
              }`}
            >
              <p>{message.content}</p>
              <p className="text-xs opacity-70 mt-1">
                {message.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        ))}
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
            placeholder="Ask ExcelBot anything..."
            className="flex-1 focus-visible:ring-apple-blue"
          />
          <Button 
            type="submit" 
            className="bg-apple-blue hover:bg-apple-blue/90"
          >
            <Send size={18} />
          </Button>
        </form>
      </div>
    </div>
  );
};
