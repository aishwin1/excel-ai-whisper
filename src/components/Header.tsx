
import { Button } from "@/components/ui/button";
import { PlusCircle, Upload, Download, Settings } from "lucide-react";
import { ExcelBotIcon } from "./ExcelBotIcon";

interface HeaderProps {
  onNewSheet?: () => void;
  onUpload?: () => void;
  onDownload?: () => void;
}

export const Header = ({ onNewSheet, onUpload, onDownload }: HeaderProps) => {
  return (
    <header className="flex items-center justify-between px-6 py-4 bg-white/90 backdrop-blur-md border-b border-apple-gray-200">
      <div className="flex items-center gap-2">
        <ExcelBotIcon size={32} />
        <h1 className="text-2xl font-semibold text-apple-gray-900">ExcelBot</h1>
      </div>
      <div className="flex items-center space-x-3">
        <Button 
          variant="ghost" 
          size="sm" 
          className="flex items-center gap-1 hover:bg-apple-gray-100"
          onClick={onNewSheet}
        >
          <PlusCircle size={18} className="text-apple-blue" />
          <span>New Sheet</span>
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          className="flex items-center gap-1 hover:bg-apple-gray-100"
          onClick={onUpload}
        >
          <Upload size={18} className="text-apple-green" />
          <span>Upload</span>
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          className="flex items-center gap-1 hover:bg-apple-gray-100"
          onClick={onDownload}
        >
          <Download size={18} className="text-apple-indigo" />
          <span>Download</span>
        </Button>
        <Button variant="ghost" size="sm" className="rounded-full p-2 hover:bg-apple-gray-100">
          <Settings size={18} />
        </Button>
      </div>
    </header>
  );
};
