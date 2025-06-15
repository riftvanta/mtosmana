'use client';

import React, { useState, useRef, useCallback } from 'react';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import app from '@/lib/firebase';

interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  url?: string;
  error?: string;
}

interface ClientSideUploadProps {
  orderId: string;
  onUploadComplete: (urls: string[]) => void;
  maxFiles?: number;
  maxFileSize?: number; // in MB
  acceptedTypes?: string[];
  className?: string;
}

const ClientSideUpload: React.FC<ClientSideUploadProps> = ({
  orderId,
  onUploadComplete,
  maxFiles = 5,
  maxFileSize = 5,
  acceptedTypes = ['image/jpeg', 'image/png', 'image/webp'],
  className = ''
}) => {
  const [uploadProgresses, setUploadProgresses] = useState<UploadProgress[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    // Check file type
    if (!acceptedTypes.includes(file.type)) {
      return `File type ${file.type} is not supported. Please use: ${acceptedTypes.join(', ')}`;
    }

    // Check file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxFileSize) {
      return `File size (${fileSizeMB.toFixed(1)}MB) exceeds maximum allowed size of ${maxFileSize}MB`;
    }

    return null;
  };

  const uploadFile = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        const storage = getStorage(app);
        const timestamp = Date.now();
        const fileName = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const storageRef = ref(storage, `orders/${orderId}/screenshots/${fileName}`);

        // Create a custom upload task to track progress
        const uploadTask = uploadBytes(storageRef, file);

        // Simulate progress tracking (Firebase doesn't provide detailed progress for uploadBytes)
        let progress = 0;
        const progressInterval = setInterval(() => {
          progress += Math.random() * 20;
          if (progress > 95) progress = 95;
          
          setUploadProgresses(prev => 
            prev.map(p => 
              p.fileName === file.name 
                ? { ...p, progress, status: 'uploading' }
                : p
            )
          );
        }, 200);

        uploadTask
          .then(async (snapshot) => {
            clearInterval(progressInterval);
            
            // Get download URL
            const downloadURL = await getDownloadURL(snapshot.ref);
            
            setUploadProgresses(prev => 
              prev.map(p => 
                p.fileName === file.name 
                  ? { ...p, progress: 100, status: 'completed', url: downloadURL }
                  : p
              )
            );
            
            resolve(downloadURL);
          })
          .catch((error) => {
            clearInterval(progressInterval);
            
            const errorMessage = error.message || 'Upload failed';
            setUploadProgresses(prev => 
              prev.map(p => 
                p.fileName === file.name 
                  ? { ...p, status: 'error', error: errorMessage }
                  : p
              )
            );
            
            reject(new Error(errorMessage));
          });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Upload initialization failed';
        setUploadProgresses(prev => 
          prev.map(p => 
            p.fileName === file.name 
              ? { ...p, status: 'error', error: errorMessage }
              : p
          )
        );
        reject(new Error(errorMessage));
      }
    });
  };

  const handleFiles = useCallback(async (files: FileList) => {
    setError(null);
    const fileArray = Array.from(files);

    // Check maximum files limit
    if (fileArray.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed. Please select fewer files.`);
      return;
    }

    // Validate all files first
    const validationErrors: string[] = [];
    for (const file of fileArray) {
      const error = validateFile(file);
      if (error) {
        validationErrors.push(`${file.name}: ${error}`);
      }
    }

    if (validationErrors.length > 0) {
      setError(validationErrors.join('\n'));
      return;
    }

    // Initialize progress tracking
    const initialProgresses: UploadProgress[] = fileArray.map(file => ({
      fileName: file.name,
      progress: 0,
      status: 'uploading' as const
    }));
    setUploadProgresses(initialProgresses);

    try {
      // Upload all files
      const uploadPromises = fileArray.map(file => uploadFile(file));
      const urls = await Promise.all(uploadPromises);
      
      // Notify parent component
      onUploadComplete(urls);
      
      // Clear progress after a delay
      setTimeout(() => {
        setUploadProgresses([]);
      }, 3000);
    } catch (error) {
      console.error('Upload failed:', error);
      setError('Upload failed. Please try again.');
    }
  }, [orderId, maxFiles, maxFileSize, acceptedTypes, onUploadComplete]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFiles(files);
    }
  }, [handleFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
  }, [handleFiles]);

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Drop Zone */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors duration-200 cursor-pointer ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={triggerFileSelect}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={handleFileSelect}
          className="hidden"
        />

        <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>

        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {isDragging ? 'Drop files here' : 'Upload Screenshots'}
        </h3>
        <p className="text-gray-500 text-sm mb-4">
          Drag and drop files here, or click to select files
        </p>
        <div className="text-xs text-gray-400">
          <p>Max {maxFiles} files, {maxFileSize}MB each. Supported: JPG, PNG, WebP</p>
          <p className="mt-1">
            Upload method: <span className="font-medium text-green-600">Client-side Firebase Storage</span>
          </p>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Upload Error</h3>
              <div className="mt-1 text-sm text-red-700 whitespace-pre-line">
                {error}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Progress */}
      {uploadProgresses.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-900">Upload Progress</h4>
          {uploadProgresses.map((upload) => (
            <div key={upload.fileName} className="bg-white border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900 truncate">
                  {upload.fileName}
                </span>
                <div className="flex items-center space-x-2">
                  {upload.status === 'uploading' && (
                    <div className="w-4 h-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                  )}
                  {upload.status === 'completed' && (
                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {upload.status === 'error' && (
                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    upload.status === 'completed' ? 'bg-green-500' : 
                    upload.status === 'error' ? 'bg-red-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${upload.progress}%` }}
                />
              </div>

              {/* Status Text */}
              <div className="flex justify-between text-xs">
                <span className={`${
                  upload.status === 'completed' ? 'text-green-600' :
                  upload.status === 'error' ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {upload.status === 'uploading' ? `Uploading... ${Math.round(upload.progress)}%` :
                   upload.status === 'completed' ? 'Upload completed' :
                   upload.error || 'Upload failed'}
                </span>
                {upload.status === 'completed' && (
                  <span className="text-gray-500">✓ Ready</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClientSideUpload; 