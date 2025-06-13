# Financial Transfer Management System - Setup Guide

## 🚀 Quick Start

### 1. Environment Configuration

Create a `.env.local` file in the root directory with the following variables:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyDT2ucPBS2vS_YwxEoZd-bDAhXqj9Dz_j8
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=mtosmana.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=mtosmana
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=mtosmana.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=77387574915
NEXT_PUBLIC_FIREBASE_APP_ID=1:77387574915:web:7b6855e73ec15269d935b6
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-110ZTYS339

# Session configuration
SESSION_SECRET=your-session-secret-key-here-change-in-production
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## 📱 Authentication System

### Default Admin Credentials
- **Username**: `admin`
- **Password**: `admin123`

### Features Implemented

#### ✅ Authentication System
- Username-based authentication with bcrypt password hashing
- Role-based access control (Admin vs Exchange)
- Session management with localStorage
- Automatic redirect based on authentication status

#### ✅ Mobile-First Design
- Responsive design optimized for 320px - 768px screens
- Touch-friendly interface
- Mobile navigation with collapsible sidebar
- Mobile-optimized forms and layouts

#### ✅ Dashboard System
- **Admin Dashboard**: Statistics, quick actions, system status
- **Exchange Dashboard**: Account info, order creation, balance tracking
- Role-based navigation and features

#### ✅ Firebase Integration
- Firebase Firestore for database operations
- Firebase Storage for file uploads
- Firebase Analytics for performance monitoring
- Proper environment variable configuration

## 🏗️ Architecture

### Project Structure
```
src/
├── app/                    # Next.js App Router pages
│   ├── dashboard/         # Dashboard page
│   ├── login/            # Login page
│   └── layout.tsx        # Root layout with AuthProvider
├── components/           # React components
│   ├── AdminDashboard.tsx
│   ├── ExchangeDashboard.tsx
│   ├── DashboardLayout.tsx
│   └── LoginForm.tsx
├── contexts/            # React contexts
│   └── AuthContext.tsx  # Authentication state management
├── lib/                # Utility functions
│   ├── firebase.ts     # Firebase configuration
│   └── auth.ts         # Authentication utilities
└── types/              # TypeScript definitions
    └── index.ts        # All type definitions
```

### Technology Stack
- **Frontend**: Next.js 15 + TypeScript + Tailwind CSS
- **Backend**: Firebase Firestore + Firebase Storage
- **Authentication**: Custom username-based with bcrypt
- **State Management**: React Context API

## 🔧 Usage

### For Administrators
1. Login with admin credentials
2. Access admin dashboard with:
   - System statistics
   - Exchange management tools
   - Order monitoring
   - Bank management interface

### For Exchange Users
1. Admin creates exchange accounts
2. Exchange users login with provided credentials
3. Access exchange dashboard with:
   - Account information
   - Order creation tools
   - Balance tracking
   - Order history

## 🔒 Security Features

- Password hashing with bcrypt (12 salt rounds)
- Username validation (3-50 characters, alphanumeric + underscore/hyphen)
- Role-based access control
- Firebase security rules
- Session management
- Environment variable protection

## 📊 Firebase Collections

The system creates the following Firestore collections:

### Users Collection
- `username` (unique identifier)
- `password` (hashed)
- `role` ('admin' | 'exchange')
- `exchangeName` (for exchange users)
- `balance`, `commissionRates`, `assignedBanks`
- `status`, `createdAt`, `updatedAt`

## 🎯 Next Steps

This authentication system provides the foundation for:
- Order management system
- Real-time features
- File upload capabilities
- Mobile PWA features
- Advanced admin tools

## 🔧 Debug Features

### Debug Panel
The app includes a debug panel (bottom-right corner) that shows:
- **Authentication Status**: Current user state
- **Firebase Connection**: Whether Firebase is accessible  
- **LocalStorage State**: What's stored in browser
- **Quick Actions**: Clear auth, reload app

### Fallback Authentication
If Firebase is not accessible, the app will use demo credentials:
- **Admin**: `admin` / `admin123`
- **Exchange**: `exchange1` / `exchange123`

## 🐛 Troubleshooting

### Common Issues

1. **Firebase Permission Error** (`FirebaseError: Missing or insufficient permissions`)
   - **Solution**: Deploy Firebase security rules using `firebase deploy --only firestore:rules`
   - **Quick Setup**: See `FIREBASE_SETUP.md` for detailed instructions
   - **Alternative**: App will work in demo mode if Firebase is not accessible

2. **Going directly to dashboard without login**
   - **Solution**: Click "Clear Auth & Reload" in the debug panel
   - **Alternative**: Clear localStorage manually in browser dev tools

3. **Login Issues**
   - Default admin user is created automatically on first run
   - Check browser console for authentication errors
   - Use debug panel to see authentication status

4. **Build Errors**
   - Ensure all dependencies are installed: `npm install`
   - Check TypeScript errors: `npm run build`

5. **Next.js Metadata Warnings** (Fixed in latest version)
   - ✅ Viewport and themeColor moved to proper viewport export

## 📱 Mobile Testing

The app is optimized for mobile devices. Test on:
- Mobile browsers (Chrome, Safari, Firefox)
- Different screen sizes (320px - 768px)
- Touch interactions
- Responsive layouts 