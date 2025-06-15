#!/usr/bin/env node

/**
 * Firebase Index Deployment Helper
 * 
 * This script helps deploy missing Firebase indexes or provides direct links
 * to create them manually in the Firebase console.
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require('child_process');
const fs = require('fs');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFirebaseConfig() {
  try {
    const firebaseConfig = JSON.parse(fs.readFileSync('.firebaserc', 'utf8'));
    const projectId = firebaseConfig.projects?.default;
    if (!projectId) {
      throw new Error('No default project found in .firebaserc');
    }
    return projectId;
  } catch (error) {
    log('❌ Error reading Firebase config:', 'red');
    log(error.message, 'red');
    return null;
  }
}

function deployIndexes() {
  try {
    log('🚀 Deploying Firebase indexes...', 'blue');
    execSync('firebase deploy --only firestore:indexes', { stdio: 'pipe' });
    log('✅ Firebase indexes deployed successfully!', 'green');
    return true;
  } catch (error) {
    log('❌ Error deploying indexes:', 'red');
    log(error.message, 'red');
    return false;
  }
}

function getIndexCreationLinks(projectId) {
  const baseUrl = `https://console.firebase.google.com/v1/r/project/${projectId}/firestore/indexes`;
  
  return {
    workflowTasks: `${baseUrl}?create_composite=Ck5wcm9qZWN0cy9tdG9zbWFuYS9kYXRhYmFzZXMvKGRlZmF1bHQpL2NvbGxlY3Rpb25Hcm91cHMvd29ya2Zsb3dUYXNrcy9pbmRleGVzL18QARoKCgZzdGF0dXMQARoPCgtzY2hlZHVsZWRBdBACGgwKCF9fbmFtZV9fEAI`,
    notifications: `${baseUrl}?create_composite=Ck5wcm9qZWN0cy9tdG9zbWFuYS9kYXRhYmFzZXMvKGRlZmF1bHQpL2NvbGxlY3Rpb25Hcm91cHMvbm90aWZpY2F0aW9ucy9pbmRleGVzL18QARoKCgZ1c2VySWQQARoNCgljcmVhdGVkQXQQAhoMCghfX25hbWVfXxAC`
  };
}

function main() {
  log('🔥 Firebase Index Deployment Helper', 'bright');
  log('=====================================', 'bright');
  
  const projectId = checkFirebaseConfig();
  if (!projectId) {
    log('\n💡 Please ensure you have a valid .firebaserc file with a default project.', 'yellow');
    process.exit(1);
  }
  
  log(`📋 Project ID: ${projectId}`, 'cyan');
  
  // Check if firestore.indexes.json exists
  if (!fs.existsSync('firestore.indexes.json')) {
    log('❌ firestore.indexes.json not found!', 'red');
    process.exit(1);
  }
  
  log('\n🔄 Attempting to deploy indexes...', 'blue');
  
  const deploySuccess = deployIndexes();
  
  if (!deploySuccess) {
    log('\n📝 Manual Index Creation Required', 'yellow');
    log('================================', 'yellow');
    log('\nSome indexes may already exist or require manual creation.', 'yellow');
    log('Please create the missing indexes using these direct links:\n', 'yellow');
    
    const links = getIndexCreationLinks(projectId);
    
    log('1. WorkflowTasks Index (status + scheduledAt + __name__):', 'cyan');
    log(`   ${links.workflowTasks}\n`, 'blue');
    
    log('2. Notifications Index (userId + createdAt + __name__):', 'cyan');
    log(`   ${links.notifications}\n`, 'blue');
    
    log('💡 Tips:', 'yellow');
    log('- Click on the links above to open the Firebase console', 'yellow');
    log('- Review and confirm the index configuration', 'yellow');
    log('- Indexes typically take 5-15 minutes to build', 'yellow');
    log('- Refresh your app after indexes are built', 'yellow');
  }
  
  log('\n🔧 Alternative: Create indexes manually', 'magenta');
  log('======================================', 'magenta');
  log('If the links don\'t work, create these composite indexes manually:\n', 'magenta');
  
  log('WorkflowTasks Collection:', 'cyan');
  log('- Collection: workflowTasks', 'white');
  log('- Fields: status (Ascending), scheduledAt (Descending), __name__ (Descending)\n', 'white');
  
  log('Notifications Collection:', 'cyan');
  log('- Collection: notifications', 'white');
  log('- Fields: userId (Ascending), createdAt (Descending), __name__ (Descending)\n', 'white');
  
  log('📚 Documentation:', 'blue');
  log('https://firebase.google.com/docs/firestore/query-data/indexing', 'blue');
  
  log('\n✨ Your app should work normally after indexes are created!', 'green');
}

if (require.main === module) {
  main();
} 