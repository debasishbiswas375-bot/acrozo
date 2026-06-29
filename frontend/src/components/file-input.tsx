import { useState, useRef } from "react";
import { Upload, X, FileText } from "lucide-react";

interface FileInputProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  placeholder?: string;
  className?: string;
}

export default function FileInput({ onFileSelect, accept = "*", placeholder, className = "" }: FileInputProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      onFileSelect(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      onFileSelect(file);
    }
  };

  const handleBrowse = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors relative ${
        isDragging 
          ? 'border-primary bg-primary/5' 
          : 'border-muted-foreground/30 bg-muted/5 hover:border-muted-foreground/50'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        className="hidden"
      />
      
      <div className="space-y-4">
        {isDragging ? (
          <div className="flex flex-col items-center">
            <Upload className="w-12 h-12 text-primary mb-4" />
            <p className="text-lg font-medium text-foreground">Drop your file here</p>
            <p className="text-sm text-muted-foreground">Release to upload</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <Upload className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-foreground">Drag & Drop file</p>
            <p className="text-sm text-muted-foreground mb-4">or</p>
            <button
              onClick={handleBrowse}
              className="px-4 py-2 font-semibold rounded-full hover:-translate-y-0.5 transition-all"
            >
              Browse Files
            </button>
          </div>
        )}
      </div>
      
      {placeholder && (
        <div className="mt-4 p-3 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{placeholder}</span>
          </div>
        </div>
      )}
    </div>
  );
}
