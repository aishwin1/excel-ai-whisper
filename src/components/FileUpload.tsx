
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, Plus, Loader2, FileSpreadsheet, AlertCircle } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

interface FileUploadProps {
  onUpload: (file: File) => void;
  onCancel: () => void;
  onCreateNew?: () => void;
  isProcessing?: boolean;
}

export const FileUpload = ({ onUpload, onCancel, onCreateNew, isProcessing = false }: FileUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validateExcelFile = (file: File): boolean => {
    const allowedTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
    
    if (!allowedTypes.includes(file.type) && 
        !file.name.endsWith('.xlsx') && 
        !file.name.endsWith('.xls')) {
      setError("Please upload only Excel files (.xlsx or .xls)");
      return false;
    }
    
    if (file.size > 15 * 1024 * 1024) { // 15MB limit
      setError("File size exceeds 15MB limit");
      return false;
    }
    
    setError(null);
    return true;
  };

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
      if (validateExcelFile(droppedFile)) {
        setFile(droppedFile);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      if (validateExcelFile(selectedFile)) {
        setFile(selectedFile);
      }
    }
  };

  const handleUpload = () => {
    if (file) {
      onUpload(file);
    }
  };

  const clearFile = () => {
    setFile(null);
    setError(null);
    // Reset the file input
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50 p-6">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in fade-in-0 zoom-in-95">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-apple-gray-900">Upload Excel File</h2>
          <Button variant="ghost" size="sm" onClick={onCancel} className="rounded-full h-8 w-8 p-0">
            <X size={18} />
          </Button>
        </div>

        {isProcessing ? (
          <div className="py-10 flex flex-col items-center justify-center">
            <Loader2 size={40} className="text-apple-blue animate-spin mb-4" />
            <p className="text-apple-gray-600 text-center">Processing your Excel file...</p>
            <p className="text-apple-gray-500 text-sm mt-2">This may take a moment for larger files</p>
          </div>
        ) : (
          <>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center ${
                isDragging
                  ? "border-apple-blue bg-apple-blue/5"
                  : error 
                    ? "border-red-400 bg-red-50" 
                    : "border-apple-gray-300"
              } transition-colors`}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <div className="mx-auto bg-apple-gray-100 w-12 h-12 mb-4 rounded-full flex items-center justify-center">
                {error ? (
                  <AlertCircle size={20} className="text-red-500" />
                ) : (
                  <FileSpreadsheet size={20} className="text-apple-blue" />
                )}
              </div>
              <p className="text-apple-gray-600 mb-2">
                <span className="font-medium">Click to upload</span> or drag and drop
              </p>
              <p className="text-apple-gray-500 text-sm mb-4">
                Excel files only (XLSX, XLS) up to 15MB
              </p>
              <input
                type="file"
                className="hidden"
                id="file-upload"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
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

            {error && (
              <Alert variant="destructive" className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {file && !error && (
              <div className="mt-4 bg-apple-gray-50 rounded-lg p-3 flex justify-between items-center">
                <div className="flex items-center gap-2 overflow-hidden">
                  <FileSpreadsheet size={18} className="text-apple-blue shrink-0" />
                  <div className="overflow-hidden">
                    <p className="font-medium truncate">{file.name}</p>
                    <p className="text-sm text-apple-gray-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={clearFile}
                    className="h-8 w-8 p-0"
                  >
                    <X size={16} />
                  </Button>
                  <Button 
                    className="bg-apple-blue hover:bg-apple-blue/90" 
                    onClick={handleUpload}
                  >
                    Upload
                  </Button>
                </div>
              </div>
            )}

            {onCreateNew && (
              <div className="mt-4 pt-4 border-t border-apple-gray-200">
                <p className="text-center text-apple-gray-600 mb-3">Or start from scratch</p>
                <Button 
                  onClick={onCreateNew}
                  variant="outline"
                  className="w-full flex items-center justify-center gap-2"
                >
                  <Plus size={16} />
                  <span>Create New Spreadsheet</span>
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
