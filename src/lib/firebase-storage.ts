import { 
  getStorage, 
  ref, 
  uploadBytesResumable, 
  getDownloadURL, 
  deleteObject,
  listAll,
  getMetadata,
  updateMetadata,
  UploadTaskSnapshot
} from 'firebase/storage';
import app from './firebase';

// Initialize Firebase Storage
const storage = getStorage(app);

// Storage configuration
const STORAGE_CONFIG = {
  maxFileSize: 5 * 1024 * 1024, // 5MB
  allowedTypes: [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ],
  compressionQuality: 0.8
};

export interface UploadOptions {
  onProgress?: (progress: number) => void;
  onComplete?: (url: string) => void;
  onError?: (error: Error) => void;
  metadata?: Record<string, string>;
  compress?: boolean;
}

export interface FileInfo {
  name: string;
  size: number;
  type: string;
  url: string;
  path: string;
  uploadedAt: Date;
  metadata?: Record<string, string>;
}

/**
 * Validate file before upload
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > STORAGE_CONFIG.maxFileSize) {
    return {
      valid: false,
      error: `File size exceeds ${STORAGE_CONFIG.maxFileSize / (1024 * 1024)}MB limit`
    };
  }

  // Check file type
  if (!STORAGE_CONFIG.allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'File type not supported'
    };
  }

  return { valid: true };
}

/**
 * Compress image file
 */
export function compressImage(file: File, quality: number = STORAGE_CONFIG.compressionQuality): Promise<File> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // Calculate new dimensions (max 1920x1080)
      const maxWidth = 1920;
      const maxHeight = 1080;
      let { width, height } = img;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }

      canvas.width = width;
      canvas.height = height;

      // Draw and compress
      ctx?.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now()
            });
            resolve(compressedFile);
          } else {
            reject(new Error('Failed to compress image'));
          }
        },
        file.type,
        quality
      );
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Generate secure file path
 */
export function generateFilePath(
  userId: string, 
  category: string, 
  filename: string,
  orderId?: string
): string {
  const timestamp = Date.now();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  const extension = sanitizedFilename.split('.').pop();
  const nameWithoutExtension = sanitizedFilename.replace(`.${extension}`, '');
  
  if (orderId) {
    return `users/${userId}/orders/${orderId}/${category}/${timestamp}_${nameWithoutExtension}.${extension}`;
  }
  
  return `users/${userId}/${category}/${timestamp}_${nameWithoutExtension}.${extension}`;
}

/**
 * Upload file to Firebase Storage
 */
export async function uploadFile(
  file: File,
  path: string,
  options: UploadOptions = {}
): Promise<string> {
  const { onProgress, onComplete, onError, metadata = {}, compress = true } = options;

  try {
    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Compress if needed
    let fileToUpload = file;
    if (compress && file.type.startsWith('image/')) {
      fileToUpload = await compressImage(file);
    }

    // Create storage reference
    const storageRef = ref(storage, path);
    
    // Prepare metadata
    const fileMetadata = {
      contentType: fileToUpload.type,
      customMetadata: {
        originalName: file.name,
        originalSize: file.size.toString(),
        uploadedAt: new Date().toISOString(),
        compressed: compress && file.type.startsWith('image/') ? 'true' : 'false',
        ...metadata
      }
    };

    // Start upload
    const uploadTask = uploadBytesResumable(storageRef, fileToUpload, fileMetadata);

    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot: UploadTaskSnapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          onProgress?.(Math.round(progress));
        },
        (error) => {
          console.error('Upload error:', error);
          onError?.(error);
          reject(error);
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            onComplete?.(downloadURL);
            resolve(downloadURL);
          } catch (error) {
            console.error('Error getting download URL:', error);
            onError?.(error as Error);
            reject(error);
          }
        }
      );
    });
  } catch (error) {
    console.error('Upload preparation error:', error);
    onError?.(error as Error);
    throw error;
  }
}

/**
 * Upload multiple files
 */
export async function uploadMultipleFiles(
  files: File[],
  basePath: string,
  options: UploadOptions = {}
): Promise<string[]> {
  const uploadPromises = files.map((file, index) => {
    const filePath = `${basePath}/${Date.now()}_${index}_${file.name}`;
    return uploadFile(file, filePath, options);
  });

  return Promise.all(uploadPromises);
}

/**
 * Delete file from storage
 */
export async function deleteFile(path: string): Promise<void> {
  try {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
}

/**
 * Get file metadata
 */
export async function getFileMetadata(path: string): Promise<Record<string, string | number | boolean>> {
  try {
    const storageRef = ref(storage, path);
    const metadata = await getMetadata(storageRef);
    return {
      name: metadata.name,
      size: metadata.size,
      contentType: metadata.contentType || 'unknown',
      timeCreated: metadata.timeCreated,
      updated: metadata.updated,
      ...metadata.customMetadata
    };
  } catch (error) {
    console.error('Error getting file metadata:', error);
    throw error;
  }
}

/**
 * List files in a directory
 */
export async function listFiles(path: string): Promise<FileInfo[]> {
  try {
    const storageRef = ref(storage, path);
    const result = await listAll(storageRef);
    
    const fileInfos: FileInfo[] = [];
    
    for (const item of result.items) {
      try {
        const [url, metadata] = await Promise.all([
          getDownloadURL(item),
          getMetadata(item)
        ]);
        
        fileInfos.push({
          name: item.name,
          size: metadata.size,
          type: metadata.contentType || 'unknown',
          url,
          path: item.fullPath,
          uploadedAt: new Date(metadata.timeCreated),
          metadata: metadata.customMetadata
        });
      } catch (error) {
        console.error(`Error getting info for file ${item.name}:`, error);
      }
    }
    
    return fileInfos.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
  } catch (error) {
    console.error('Error listing files:', error);
    throw error;
  }
}

/**
 * Get download URL for a file
 */
export async function getFileURL(path: string): Promise<string> {
  try {
    const storageRef = ref(storage, path);
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.error('Error getting download URL:', error);
    throw error;
  }
}

/**
 * Update file metadata
 */
export async function updateFileMetadata(
  path: string, 
  metadata: Record<string, string>
): Promise<void> {
  try {
    const storageRef = ref(storage, path);
    await updateMetadata(storageRef, {
      customMetadata: metadata
    });
  } catch (error) {
    console.error('Error updating file metadata:', error);
    throw error;
  }
}

/**
 * Batch delete files
 */
export async function deleteMultipleFiles(paths: string[]): Promise<void> {
  const deletePromises = paths.map(path => deleteFile(path));
  await Promise.all(deletePromises);
}

/**
 * Get file size in human readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Check if file exists
 */
export async function fileExists(path: string): Promise<boolean> {
  try {
    const storageRef = ref(storage, path);
    await getMetadata(storageRef);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate thumbnail for image
 */
export async function generateThumbnail(
  file: File, 
  maxWidth: number = 200, 
  maxHeight: number = 200
): Promise<File> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('File is not an image'));
      return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // Calculate thumbnail dimensions
      let { width, height } = img;
      
      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      // Draw thumbnail
      ctx?.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const thumbnailFile = new File([blob], `thumb_${file.name}`, {
              type: file.type,
              lastModified: Date.now()
            });
            resolve(thumbnailFile);
          } else {
            reject(new Error('Failed to generate thumbnail'));
          }
        },
        file.type,
        0.8
      );
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Upload file with thumbnail
 */
export async function uploadFileWithThumbnail(
  file: File,
  basePath: string,
  options: UploadOptions = {}
): Promise<{ url: string; thumbnailUrl?: string }> {
  const mainFileUrl = await uploadFile(file, `${basePath}/${file.name}`, options);
  
  let thumbnailUrl: string | undefined;
  
  if (file.type.startsWith('image/')) {
    try {
      const thumbnail = await generateThumbnail(file);
      thumbnailUrl = await uploadFile(
        thumbnail, 
        `${basePath}/thumbnails/thumb_${file.name}`,
        { ...options, compress: false }
      );
    } catch (error) {
      console.error('Error generating thumbnail:', error);
      // Continue without thumbnail
    }
  }
  
  return { url: mainFileUrl, thumbnailUrl };
}

/**
 * Clean up expired files (utility function)
 */
export async function cleanupExpiredFiles(
  basePath: string, 
  maxAge: number = 7 * 24 * 60 * 60 * 1000 // 7 days
): Promise<number> {
  try {
    const files = await listFiles(basePath);
    const now = Date.now();
    let deletedCount = 0;
    
    for (const file of files) {
      const fileAge = now - file.uploadedAt.getTime();
      if (fileAge > maxAge) {
        try {
          await deleteFile(file.path);
          deletedCount++;
        } catch (error) {
          console.error(`Error deleting expired file ${file.path}:`, error);
        }
      }
    }
    
    return deletedCount;
  } catch (error) {
    console.error('Error cleaning up expired files:', error);
    throw error;
  }
}

// Export storage configuration
export const storageConfig = STORAGE_CONFIG;

// Export storage instance for advanced usage
export { storage }; 