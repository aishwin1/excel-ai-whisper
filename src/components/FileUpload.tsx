
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X } from "lucide-react";

interface FileUploadProps {
  onUpload: (file: File) => void;
  onCancel: () => void;
}

export const FileUpload = ({ onUpload, onCancel }: FileUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) {
      setIsDragging(true);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls')) {
        setFile(droppedFile);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = () => {
    if (file) {
      onUpload(file);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50 p-6">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-apple-gray-900">Upload Excel File</h2>
          <Button variant="ghost" size="sm" onClick={onCancel} className="rounded-full h-8 w-8 p-0">
            <X size={18} />
          </Button>
        </div>

        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center ${
            isDragging
              ? "border-apple-blue bg-apple-blue/5"
              : "border-apple-gray-300"
          } transition-colors`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <div className="mx-auto bg-apple-gray-100 w-12 h-12 mb-4 rounded-full flex items-center justify-center">
            <Upload size={20} className="text-apple-blue" />
          </div>
          <p className="text-apple-gray-600 mb-2">
            <span className="font-medium">Click to upload</span> or drag and drop
          </p>
          <p className="text-apple-gray-500 text-sm mb-4">
            Excel files only (XLSX, XLS)
          </p>
          <input
            type="file"
            className="hidden"
            id="file-upload"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
          />
          <label htmlFor="file-upload">
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={(e) => e.stopPropagation()}
              asChild
            >
              <span>Select File</span>
            </Button>
          </label>
        </div>

        {file && (
          <div className="mt-4 bg-apple-gray-50 rounded-lg p-3 flex justify-between items-center">
            <div className="overflow-hidden">
              <p className="font-medium truncate">{file.name}</p>
              <p className="text-sm text-apple-gray-500">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <Button 
              className="bg-apple-blue hover:bg-apple-blue/90" 
              onClick={handleUpload}
            >
              Upload
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
