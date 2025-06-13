# 🔥 Firebase Setup Guide

This guide will help you fix the Firebase permission errors and configure your project properly.

## 🚨 Current Issues & Solutions

### Issue 1: Firebase Permission Denied
**Error**: `FirebaseError: Missing or insufficient permissions`

**Solution**: Deploy Firebase security rules

### Issue 2: Authentication Flow Issues
**Error**: User going directly to dashboard without proper authentication

**Solution**: Clear localStorage and configure Firebase properly

---

## 🔧 Quick Fix Steps

### Step 1: Deploy Firebase Security Rules

1. **Install Firebase CLI** (if not installed):
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**:
   ```bash
   firebase login
   ```

3. **Initialize Firebase in your project**:
   ```bash
   firebase init firestore
   ```
   - Select your existing project: `mtosmana`
   - Use the existing `firestore.rules` file when prompted
   - Use the default `firestore.indexes.json` when prompted

4. **Deploy the security rules**:
   ```bash
   firebase deploy --only firestore:rules
   ```

### Step 2: Clear Authentication State

1. **Open browser developer tools** (F12)
2. **Go to Application/Storage tab**
3. **Clear localStorage** or click the "Clear Auth & Reload" button in the debug panel
4. **Refresh the page**

### Step 3: Test Authentication

1. **Navigate to** `http://localhost:3000`
2. **You should be redirected to** `/login`
3. **Login with**:
   - **Username**: `admin`
   - **Password**: `admin123`

---

## 📋 Firebase Console Configuration

### 1. Firestore Database Setup

1. **Go to** [Firebase Console](https://console.firebase.google.com)
2. **Select your project**: `mtosmana`
3. **Navigate to Firestore Database**
4. **Create database** if not exists:
   - Choose "Start in test mode" for development
   - Select a location (closest to Jordan: `europe-west1`)

### 2. Security Rules Configuration

**Current Rules** (Development - Open Access):
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

**Production Rules** (Recommended for later):
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null;
    }
    match /orders/{orderId} {
      allow read, write: if request.auth != null;
    }
    // Add more specific rules as needed
  }
}
```

### 3. Storage Rules (if using file uploads)

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if true; // Development only
    }
  }
}
```

---

## 🧪 Testing & Verification

### Debug Panel Features

The app includes a debug panel (bottom-right corner) that shows:

- **Authentication Status**: Current user state
- **Firebase Connection**: Whether Firebase is accessible
- **LocalStorage State**: What's stored in browser
- **Quick Actions**: Clear auth, reload app

### Test Scenarios

1. **Fresh Login**:
   - Clear localStorage
   - Navigate to `/`
   - Should redirect to `/login`
   - Login with admin credentials
   - Should redirect to `/dashboard`

2. **Session Persistence**:
   - Login successfully
   - Refresh the page
   - Should remain logged in
   - Should see correct dashboard for user role

3. **Firebase Connection**:
   - Check debug panel
   - Should show "Firebase Connected"
   - If showing "Permission Denied", deploy security rules

---

## 🔍 Troubleshooting

### Common Issues

#### 1. Still getting permission errors after deploying rules
```bash
# Re-deploy rules
firebase deploy --only firestore:rules

# Check rules in Firebase Console
# Go to Firestore → Rules tab
# Verify rules are applied
```

#### 2. Authentication not working
```bash
# Clear all browser data
# In Chrome: Settings → Privacy → Clear browsing data
# Or use incognito/private browsing
```

#### 3. Firebase CLI issues
```bash
# Re-login to Firebase
firebase logout
firebase login

# Check project configuration
firebase projects:list
firebase use mtosmana
```

#### 4. Project ID mismatch
- Verify `.env.local` has correct project ID: `mtosmana`
- Check Firebase Console project ID matches

### Debug Commands

```bash
# Check Firebase project
firebase projects:list

# Check current project
firebase use

# Deploy only rules
firebase deploy --only firestore:rules

# Check deployment status
firebase deploy --dry-run
```

---

## 🚀 Alternative Solutions

### Option 1: Demo Mode (No Firebase)

If Firebase setup is problematic, the app includes fallback authentication:

**Demo Credentials**:
- **Admin**: username=`admin`, password=`admin123`
- **Exchange**: username=`exchange1`, password=`exchange123`

The app will automatically use demo mode if Firebase is not accessible.

### Option 2: Reset Firebase Project

1. Create a new Firebase project
2. Update `.env.local` with new project configuration
3. Deploy fresh security rules

### Option 3: Local Development Only

For development without Firebase:
1. Comment out Firebase operations in `auth.ts`
2. Use only the fallback authentication
3. Mock all database operations

---

## 📞 Support

If you continue to have issues:

1. **Check the debug panel** for specific error messages
2. **Verify Firebase Console** shows your project correctly
3. **Ensure security rules** are deployed and active
4. **Clear browser cache** and localStorage completely
5. **Try incognito/private browsing** to rule out cache issues

---

## ✅ Success Checklist

- [ ] Firebase CLI installed and logged in
- [ ] Firestore database created
- [ ] Security rules deployed (`firebase deploy --only firestore:rules`)
- [ ] Browser localStorage cleared
- [ ] Login page appears when accessing `/`
- [ ] Admin login works with `admin`/`admin123`
- [ ] Dashboard loads correctly after login
- [ ] Debug panel shows "Firebase Connected"
- [ ] No console errors related to permissions 