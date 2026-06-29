import React, { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import Header from "@/components/header";
import { Upload, FileText, AlertCircle, Download, Loader2 } from "lucide-react";
import { useJobPolling } from "@/hooks/useJobPolling";
import { useToast } from "@/hooks/use-toast";

export default function PdfConverterAsyncPage() {
  const [location, navigate] = useLocation();
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Use the polling hook
  const { jobStatus, isPolling, error: pollingError } = useJobPolling(currentJobId);

  // Handle job completion
  React.useEffect(() => {
    if (jobStatus?.status === 'completed' && jobStatus.result) {
      toast({
        title: "Conversion Complete!",
        description: "Your PDF has been successfully converted to Excel.",
      });
      
      // Au the file
      const downloadUrl = jobStatus.result.download_url;
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = jobStatus.result.output_file;
      link.click();
      
      // Reset state
      setCurrentJobId(null);
      setPdfFile(null);
      setLoading(false);
    } else if (jobStatus?.status === 'failed') {
      toast({
        title: "Conversion Failed",
        description: jobStatus.error || "An error occurred during conversion.",
        variant: "destructive",
      });
      
      // Reset state
      setCurrentJobId(null);
      setLoading(false);
    }
  }, [jobStatus, toast]);

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
      if (file.type === 'application/pdf') {
        setPdfFile(file);
        toast({
          title: "File Uploaded",
          description: `${file.name} is ready for conversion.`,
        });
      } else {
        toast({
          title: "Invalid File",
          description: "Please drop a PDF file only.",
          variant: "destructive",
        });
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type === 'application/pdf') {
        setPdfFile(file);
        toast({
          title: "File Selected",
          description: `${file.name} is ready for conversion.`,
        });
      } else {
        toast({
          title: "Invalid File",
          description: "Please select a PDF file only.",
          variant: "destructive",
        });
      }
    }
  };

  const handleBrowse = () => {
    fileInputRef.current?.click();
  };

  const handleConvert = async () => {
    if (!pdfFile) {
      toast({
        title: "No File Selected",
        description: "Please select or drop a PDF file first.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setCurrentJobId(null);

    try {
      const formData = new FormData();
      formData.append('pdf_file', pdfFile);

      const response = await fetch("/api/users/convert-pdf", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        // Handle binary file response
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        // Extract filename from Content-Disposition header
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'converted.xlsx';
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
          if (filenameMatch && filenameMatch[1]) {
            filename = filenameMatch[1].replace(/['"]/g, '');
          }
        }

        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast({
          title: "Conversion Complete!",
          description: "Your PDF has been successfully converted to Excel.",
        });
      } else {
        const errorText = await response.text();
        throw new Error(errorText || "Conversion failed");
      }
    } catch (err) {
      toast({
        title: "Conversion Error",
        description: err instanceof Error ? err.message : "An error occurred during conversion.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const getProgressPercentage = () => {
    if (jobStatus?.progress) {
      return jobStatus.progress;
    }
    return 0;
  };

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-20">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">PDF to Excel Converter</h1>
          <p className="text-sm text-muted-foreground mt-1">Convert PDF tables to Excel with advanced processing</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Converter Form */}
          <div className="bg-card border border-card-border rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-foreground mb-6">Convert PDF</h2>
            
            {/* Drag and Drop Area */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
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
                accept=".pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              <div className="space-y-4">
                {isDragging ? (
                  <div className="flex flex-col items-center">
                    <Upload className="w-12 h-12 text-primary mb-4" />
                    <p className="text-lg font-medium text-foreground">Drop your PDF file here</p>
                    <p className="text-sm text-muted-foreground">Release to upload</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <Upload className="w-12 h-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium text-foreground">Drag & Drop PDF file</p>
                    <p className="text-sm text-muted-foreground mb-4">or</p>
                    <button
                      onClick={handleBrowse}
                      className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors font-medium"
                    >
                      Browse Files
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* File Display */}
            {pdfFile && (
              <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-foreground truncate max-w-xs">
                    {pdfFile.name}
                  </span>
                </div>
              </div>
            )}

            {/* Progress Bar */}
            {(loading || isPolling) && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">
                    {isPolling ? 'Processing PDF...' : 'Starting conversion...'}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {getProgressPercentage()}%
                  </span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${getProgressPercentage()}%` }}
                  />
                </div>
              </div>
            )}

            {/* Convert Button */}
            <button
              onClick={handleConvert}
              disabled={loading || isPolling || !pdfFile}
              className="w-full px-4 py-3 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 rounded-lg transition-colors font-medium"
            >
              {loading || isPolling ? (
                <div className="flex items-center justify-center">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {isPolling ? 'Processing...' : 'Starting...'}
                </div>
              ) : (
                "Convert to Excel"
              )}
            </button>

            {/* Error Display */}
            {pollingError && (
              <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  <p className="text-sm text-destructive">{pollingError}</p>
                </div>
              </div>
            )}

            {/* Status Display */}
            {jobStatus && (
              <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                <h3 className="text-sm font-medium text-foreground mb-2">Job Status</h3>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p><strong>Job ID:</strong> {jobStatus.jobId}</p>
                  <p><strong>Status:</strong> {jobStatus.status}</p>
                  <p><strong>Progress:</strong> {jobStatus.progress}%</p>
                  {jobStatus.result && (
                    <div className="mt-2">
                      <button
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = jobStatus.result!.download_url;
                          link.download = jobStatus.result!.output_file;
                          link.click();
                        }}
                        className="px-3 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors font-medium flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Download Excel File
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="bg-card border border-card-border rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-foreground mb-6">How to Use</h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-foreground mb-2">1. Drag & Drop or Browse</h3>
                <p className="text-sm text-muted-foreground">
                  Drag and drop PDF files directly onto converter area, or click "Browse Files" to select from your device.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-foreground mb-2">2. Click Convert</h3>
                <p className="text-sm text-muted-foreground">
                  The system will process your PDF in the background and show real-time progress.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-foreground mb-2">3. Automatic Download</h3>
                <p className="text-sm text-muted-foreground">
                  Once conversion is complete, the Excel file will download automatically.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-foreground mb-2">Background Processing</h3>
                <p className="text-sm text-muted-foreground">
                  Large files are processed in the background to avoid timeouts. You can track progress in real-time.
                </p>
              </div>
            </div>
          </div>
        </div>
        </main>
    </div>
  );
}
