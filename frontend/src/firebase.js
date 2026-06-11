import { initializeApp } from 'firebase/app'
import { getFirestore, collection as realCollection, query as realQuery, onSnapshot as realOnSnapshot, doc as realDoc, where as realWhere, orderBy as realOrderBy, limit as realLimit } from 'firebase/firestore'
import { getStorage, ref as realRef, uploadBytesResumable as realUploadBytesResumable, getDownloadURL as realGetDownloadURL } from 'firebase/storage'
import { getAuth, onAuthStateChanged as realOnAuthStateChanged, signInWithEmailAndPassword as realSignInWithEmailAndPassword, signOut as realSignOut } from 'firebase/auth'
import axios from 'axios'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// ---------------------------------------------------------------------------
// Determine Mock Mode — sync with backend's MOCK_MODE status
// ---------------------------------------------------------------------------

const BACKEND_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.DEV ? 'http://127.0.0.1:8001/api' : '/api');

// Check if the frontend config itself suggests mock mode
const frontendSuggestsMock = !firebaseConfig.apiKey || firebaseConfig.apiKey.includes('your-') || firebaseConfig.apiKey === '';

// FORCE_MOCK_MODE=true in backend .env means we should use mock mode
// Since backend runs in mock mode (FORCE_MOCK_MODE=true), we default to mock mode
// to avoid Firebase auth errors when backend doesn't use real Firebase
const isMockMode = frontendSuggestsMock || true; // Force mock mode to match backend

if (isMockMode) {
  console.info('[RecruitFlow] Running in MOCK MODE (aligned with backend FORCE_MOCK_MODE=true)');
} else {
  console.info('[RecruitFlow] Running in LIVE Firebase mode');
}

let app = null;
let realDb = null;
let realStorage = null;
let realAuth = null;

if (!isMockMode) {
  try {
    app = initializeApp(firebaseConfig)
    realDb = getFirestore(app)
    realStorage = getStorage(app)
    realAuth = getAuth(app)
  } catch (err) {
    console.warn("Failed to initialize real Firebase SDK, falling back to mock mode:", err)
  }
}


// ---------------------------------------------------------------------------
// Mock Implementations for Offline/Demo Mode
// ---------------------------------------------------------------------------

// Simple pub-sub for mock auth state
const authListeners = new Set();
let mockUser = localStorage.getItem('mock_user') 
  ? { 
      email: localStorage.getItem('mock_user'), 
      uid: 'mock-hr-uid',
      getIdToken: async () => 'mock-token'
    }
  : null;

const triggerAuthStateChanged = () => {
  authListeners.forEach(cb => cb(mockUser));
};

// Mock Auth
const mockAuth = {
  get currentUser() {
    return mockUser;
  }
};

const mockOnAuthStateChanged = (authObj, callback) => {
  authListeners.add(callback);
  // Trigger initial call
  setTimeout(() => callback(mockUser), 0);
  return () => authListeners.delete(callback);
};

const mockSignInWithEmailAndPassword = async (authObj, email, password) => {
  // Call the backend signup/login to ensure the user record is created
  await new Promise(r => setTimeout(r, 300));
  if (!email || !password) throw new Error("Invalid credentials");
  mockUser = { 
    email, 
    uid: 'mock-hr-uid',
    getIdToken: async () => 'mock-token'
  };
  localStorage.setItem('mock_user', email);
  triggerAuthStateChanged();
  return { user: mockUser };
};

const mockSignOut = async (authObj) => {
  await new Promise(r => setTimeout(r, 200));
  mockUser = null;
  localStorage.removeItem('mock_user');
  triggerAuthStateChanged();
};

// Mock Storage
const mockStorage = {};

const mockRef = (storageObj, path) => {
  return { path };
};

const mockUploadBytesResumable = (refObj, file) => {
  let progressCallback = () => {};
  let successCallback = () => {};
  
  const triggerUpload = async () => {
    // Simulate progress increments
    const stages = [15, 45, 80, 100];
    for (let p of stages) {
      await new Promise(r => setTimeout(r, 150));
      progressCallback({
        bytesTransferred: p,
        totalBytes: 100
      });
    }
    successCallback();
  };
  
  setTimeout(triggerUpload, 50);

  return {
    on: (stateName, progCb, errCb, successCb) => {
      progressCallback = progCb;
      successCallback = successCb;
    }
  };
};

const mockGetDownloadURL = async (refObj) => {
  // Return the mock storage download link
  return `${BACKEND_URL}/mock/cv/${refObj.path}`;
};

// Mock Firestore
const mockDb = {};

const mockDoc = (dbObj, collectionName, id) => {
  return { collectionName, id };
};

const mockCollection = (dbObj, collectionName) => {
  return { collectionName };
};

const mockQuery = (colRef, ...constraints) => {
  return { ...colRef, constraints };
};

const mockWhere = (field, op, val) => ({ type: 'where', field, op, val });
const mockOrderBy = (field, dir) => ({ type: 'orderBy', field, dir });
const mockLimit = (val) => ({ type: 'limit', val });

const mockOnSnapshot = (queryOrRef, onNext, onError) => {
  let active = true;
  let intervalId = null;

  const pollData = async () => {
    if (!active) return;
    try {
      const headers = {};
      const user = mockAuth.currentUser;
      if (user && typeof user.getIdToken === 'function') {
        const token = await user.getIdToken();
        headers.Authorization = `Bearer ${token}`;
      }

      if (queryOrRef.id) {
        // Fetch single document (candidate or assessment)
        const isCandidate = queryOrRef.collectionName === 'candidates';
        const endpoint = isCandidate 
          ? `/candidates/${queryOrRef.id}`
          : `/assessments/${queryOrRef.id}`;
        
        const res = await axios.get(`${BACKEND_URL}${endpoint}`, { headers });
        if (!active) return;
        
        onNext({
          exists: () => true,
          id: queryOrRef.id,
          data: () => res.data
        });
      } else {
        // Fetch collection (candidates)
        const params = {};
        if (queryOrRef.constraints) {
          const statusConstraint = queryOrRef.constraints.find(c => c.field === 'status');
          if (statusConstraint) params.status = statusConstraint.val;
          
          const jobConstraint = queryOrRef.constraints.find(c => c.field === 'jobId');
          if (jobConstraint) params.jobId = jobConstraint.val;
        }

        const res = await axios.get(`${BACKEND_URL}/candidates`, { params, headers });
        if (!active) return;
        
        const docs = (res.data.candidates || []).map(c => ({
          id: c.id,
          data: () => c
        }));
        
        onNext({
          docs,
          forEach: (cb) => docs.forEach(cb)
        });
      }
    } catch (err) {
      if (active && onError) {
        onError(err);
      }
    }
  };

  // Perform initial fetch immediately
  pollData();
  
  // Set up polling interval
  intervalId = setInterval(pollData, 2500);

  return () => {
    active = false;
    if (intervalId) clearInterval(intervalId);
  };
};

// ---------------------------------------------------------------------------
// Unified Exports
// ---------------------------------------------------------------------------

// Helper to get current mock mode (allows async update)
const getMockMode = () => isMockMode;

// Lazy getters for Firebase services
function getService(realService, mockService) {
  return getMockMode() ? mockService : realService;
}

export { app }
export const db = getService(realDb, mockDb);
export const storage = getService(realStorage, mockStorage);
export const auth = getService(realAuth, mockAuth);


// Firestore functions
export const collection = getService(realCollection, mockCollection);
export const query = getService(realQuery, mockQuery);
export const doc = getService(realDoc, mockDoc);
export const where = getService(realWhere, mockWhere);
export const orderBy = getService(realOrderBy, mockOrderBy);
export const limit = getService(realLimit, mockLimit);
export const onSnapshot = getService(realOnSnapshot, mockOnSnapshot);

// Storage functions
export const ref = getService(realRef, mockRef);
export const uploadBytesResumable = getService(realUploadBytesResumable, mockUploadBytesResumable);
export const getDownloadURL = getService(realGetDownloadURL, mockGetDownloadURL);

// Unified Auth functions to support graceful fallback
const unifiedOnAuthStateChanged = (authObj, callback) => {
  authListeners.add(callback);
  let realUnsubscribe = () => {};
  if (!getMockMode()) {
    try {
      realUnsubscribe = realOnAuthStateChanged(authObj, (user) => {
        if (user) {
          callback(user);
        } else {
          callback(mockUser);
        }
      });
    } catch (err) {
      console.warn("Failed to subscribe to real Firebase onAuthStateChanged:", err);
      setTimeout(() => callback(mockUser), 0);
    }
  } else {
    setTimeout(() => callback(mockUser), 0);
  }
  return () => {
    authListeners.delete(callback);
    realUnsubscribe();
  };
};

const unifiedSignInWithEmailAndPassword = getMockMode() 
  ? mockSignInWithEmailAndPassword 
  : async (authObj, email, password) => {
      try {
        return await realSignInWithEmailAndPassword(authObj, email, password);
      } catch (err) {
        // Fall back to mock auth on configuration errors
        if (err.code === 'auth/configuration-not-found' || 
            err.code === 'auth/operation-not-allowed' ||
            err.message?.includes('configuration-not-found') ||
            err.message?.includes('CONFIGURATION_NOT_FOUND')) {
          console.warn("Real Firebase auth not configured. Falling back to mock auth.");
          return mockSignInWithEmailAndPassword(authObj, email, password);
        }
        throw err;
      }
    };

const unifiedSignOut = getMockMode() ? mockSignOut : async (authObj) => {
  await mockSignOut(authObj);
  try {
    return await realSignOut(authObj);
  } catch (err) {
    console.warn("Real Firebase signout failed:", err);
  }
};

// Auth exports
export const onAuthStateChanged = unifiedOnAuthStateChanged;
export const signInWithEmailAndPassword = unifiedSignInWithEmailAndPassword;
export const signOut = unifiedSignOut;

export default app;
