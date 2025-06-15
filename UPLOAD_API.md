# Upload API Documentation

## Overview
The system supports two upload methods for handling file uploads:

## 1. Local Storage Upload (`/api/upload-simple`)
**Default for development** - Files are saved locally in the `public/uploads/` directory.

### Features:
- ✅ No external dependencies
- ✅ Fast upload speeds
- ✅ Easy debugging
- ✅ Works offline
- ⚠️ Files stored locally (not suitable for production)

### File Structure:
```
public/uploads/orders/[orderId]/[category]/[timestamp]_[filename]
```

## 2. Firebase Storage Upload (`/api/upload`)
**Production-ready** - Files are uploaded to Firebase Storage.

### Features:
- ✅ Cloud storage with CDN
- ✅ Secure access control
- ✅ Scalable and reliable
- ✅ Automatic backup
- ⚠️ Requires Firebase configuration

### Configuration Required:
Ensure these environment variables are set:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

## Switching Upload Methods

### In Components:
```tsx
// Use local storage (default)
<EnhancedFileUpload 
  orderId="T25060001"
  uploadMethod="local"
  onUploadComplete={handleUpload}
/>

// Use Firebase storage
<EnhancedFileUpload 
  orderId="T25060001"
  uploadMethod="firebase"
  onUploadComplete={handleUpload}
/>
```

### API Endpoints:
- `POST /api/upload-simple` - Local storage upload
- `POST /api/upload` - Firebase storage upload

## Testing Upload APIs

### Test Local Upload:
```bash
curl -X GET http://localhost:3001/api/upload-simple
```

### Test Firebase Upload:
```bash
curl -X GET http://localhost:3001/api/upload
```

## File Validation
Both APIs enforce the same validation rules:
- **File Types**: JPG, PNG, WebP only
- **File Size**: Maximum 5MB per file
- **Security**: File names are sanitized
- **Organization**: Files stored by order ID and category

## Troubleshooting

### Local Upload Issues:
- Check file system permissions
- Ensure `public/uploads/` directory is writable

### Firebase Upload Issues:
- Verify environment variables are set
- Check Firebase project configuration
- Ensure Firebase Storage is enabled
- Review Firebase Security Rules

## Production Deployment
For production, always use Firebase storage:
1. Set `uploadMethod="firebase"` in components
2. Configure Firebase environment variables
3. Deploy Firebase Security Rules
4. Set up Firebase Storage CORS if needed 