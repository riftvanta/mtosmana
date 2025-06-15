import { NextRequest, NextResponse } from 'next/server';
import { getStorage, ref, uploadBytes, getDownloadURL, FirebaseStorage } from 'firebase/storage';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';

// Firebase configuration - ensure all env vars are available
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDT2ucPBS2vS_YwxEoZd-bDAhXqj9Dz_j8",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "mtosmana.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "mtosmana",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "mtosmana.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "77387574915",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:77387574915:web:7b6855e73ec15269d935b6",
};

// Initialize Firebase with error handling
function getFirebaseStorage(): FirebaseStorage | null {
  try {
    const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    return getStorage(app);
  } catch (error) {
    console.error('Firebase initialization error:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get Firebase storage instance
    const storage = getFirebaseStorage();
    if (!storage) {
      console.error('Firebase Storage not initialized');
      return NextResponse.json(
        { error: 'Storage service unavailable' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const orderId = formData.get('orderId') as string;
    const category = formData.get('category') as string || 'screenshots';

    console.log('Upload request:', { 
      fileName: file?.name, 
      fileSize: file?.size, 
      fileType: file?.type,
      orderId, 
      category 
    });

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPG, PNG, and WebP are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size too large. Maximum 5MB allowed.' },
        { status: 400 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    
    console.log('Uploading file:', fileName);
    
    // Create storage reference
    const storageRef = ref(storage, `orders/${orderId}/${category}/${fileName}`);

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload file
    const snapshot = await uploadBytes(storageRef, buffer, {
      contentType: file.type,
    });

    console.log('File uploaded successfully, getting download URL...');

    // Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref);

    console.log('Upload completed:', downloadURL);

    return NextResponse.json({
      success: true,
      url: downloadURL,
      fileName: fileName,
      size: file.size,
      type: file.type,
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Upload API endpoint' });
} 