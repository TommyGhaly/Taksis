import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection,
  doc as firestoreDoc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query as firestoreQuery,
  updateDoc,
  where,
} from '@react-native-firebase/firestore';
import {
  getDownloadURL,
  getMetadata,
  getStorage,
  putFile,
  ref,
} from '@react-native-firebase/storage';

const CACHE_PREFIXES = {
  FIRESTORE: 'firestore_cache_',
  STORAGE: 'storage_cache_',
};

const CACHE_DURATIONS = {
  FIRESTORE: 24 * 60 * 60 * 1000, // 1 day in milliseconds
  STORAGE: 3 * 24 * 60 * 60 * 1000, // 3 days in milliseconds
};

class CacheManager {
  static async getFromCache(key, cacheType = 'FIRESTORE') {
    try {
      const cacheKey = CACHE_PREFIXES[cacheType] + key;
      const cachedData = await AsyncStorage.getItem(cacheKey);
      
      if (!cachedData) return null;
      
      const parsedData = JSON.parse(cachedData);
      const now = Date.now();
      
      // Check if cache is expired
      if (now - parsedData.timestamp > CACHE_DURATIONS[cacheType]) {
        await AsyncStorage.removeItem(cacheKey);
        return null;
      }
      
      return parsedData.data;
    } catch (error) {
      console.warn('Cache read error:', error);
      return null;
    }
  }

  static async setCache(key, data, cacheType = 'FIRESTORE') {
    try {
      const cacheKey = CACHE_PREFIXES[cacheType] + key;
      const cacheData = {
        data,
        timestamp: Date.now(),
      };
      
      await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Cache write error:', error);
    }
  }

  static async clearCache(cacheType = null) {
    try {
      if (cacheType) {
        const keys = await AsyncStorage.getAllKeys();
        const targetKeys = keys.filter(key => key.startsWith(CACHE_PREFIXES[cacheType]));
        await AsyncStorage.multiRemove(targetKeys);
      } else {
        // Clear all cache types
        const keys = await AsyncStorage.getAllKeys();
        const cacheKeys = keys.filter(key => 
          key.startsWith(CACHE_PREFIXES.FIRESTORE) || 
          key.startsWith(CACHE_PREFIXES.STORAGE)
        );
        await AsyncStorage.multiRemove(cacheKeys);
      }
    } catch (error) {
      console.warn('Cache clear error:', error);
    }
  }

  static async clearExpiredCache() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => 
        key.startsWith(CACHE_PREFIXES.FIRESTORE) || 
        key.startsWith(CACHE_PREFIXES.STORAGE)
      );
      
      const now = Date.now();
      const expiredKeys = [];
      
      for (const key of cacheKeys) {
        try {
          const cachedData = await AsyncStorage.getItem(key);
          if (cachedData) {
            const parsedData = JSON.parse(cachedData);
            const cacheType = key.startsWith(CACHE_PREFIXES.FIRESTORE) ? 'FIRESTORE' : 'STORAGE';
            
            if (now - parsedData.timestamp > CACHE_DURATIONS[cacheType]) {
              expiredKeys.push(key);
            }
          }
        } catch (error) {
          // If parsing fails, consider it expired
          expiredKeys.push(key);
        }
      }
      
      if (expiredKeys.length > 0) {
        await AsyncStorage.multiRemove(expiredKeys);
      }
    } catch (error) {
      console.warn('Expired cache cleanup error:', error);
    }
  }
}

// Lazy Firebase Database Cache
export class FirestoreCache {
  static async getDocument(collectionPath, documentId, options = {}) {
    const cacheKey = `${collectionPath}/${documentId}`;
    
    // Try to get from cache first
    const cachedData = await CacheManager.getFromCache(cacheKey, 'FIRESTORE');
    if (cachedData && !options.forceRefresh) {
      return cachedData;
    }
    
    try {
      // Fetch from Firestore
      const doc = await getDoc(firestoreDoc(getFirestore(), collectionPath, documentId));
      const data = doc.exists ? { id: doc.id, ...doc.data() } : null;
      
      // Cache the result
      if (data) {
        await CacheManager.setCache(cacheKey, data, 'FIRESTORE');
      }
      
      return data;
    } catch (error) {
      // If network fails and we have cached data, return it
      if (cachedData) {
        console.warn('Using cached data due to network error:', error);
        return cachedData;
      }
      throw error;
    }
  }

  static async getCollection(collectionPath, queryOptions = {}, options = {}) {
    const cacheKey = `collection_${collectionPath}_${JSON.stringify(queryOptions)}`;
    
    // Try to get from cache first
    const cachedData = await CacheManager.getFromCache(cacheKey, 'FIRESTORE');
    if (cachedData && !options.forceRefresh) {
      return cachedData;
    }
    
    try {
      // Build query
      let query = collection(getFirestore(), collectionPath);
      
      if (queryOptions.where) {
        queryOptions.where.forEach(([field, operator, value]) => {
          query = firestoreQuery(query, where(field, operator, value));
        });
      }
      
      if (queryOptions.orderBy) {
        queryOptions.orderBy.forEach(([field, direction = 'asc']) => {
          query = firestoreQuery(query, orderBy(field, direction));
        });
      }
      
      if (queryOptions.limit) {
        query = firestoreQuery(query, limit(queryOptions.limit));
      }
      
      // Execute query
      const snapshot = await getDocs(query);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Cache the result
      await CacheManager.setCache(cacheKey, data, 'FIRESTORE');
      
      return data;
    } catch (error) {
      // If network fails and we have cached data, return it
      if (cachedData) {
        console.warn('Using cached data due to network error:', error);
        return cachedData;
      }
      throw error;
    }
  }

  static async updateDocument(collectionPath, documentId, data, options = {}) {
    try {
      // Update Firestore
      await updateDoc(firestoreDoc(getFirestore(), collectionPath, documentId), data);
      
      // Invalidate cache if specified
      if (options.invalidateCache !== false) {
        const cacheKey = `${collectionPath}/${documentId}`;
        const cachedData = await CacheManager.getFromCache(cacheKey, 'FIRESTORE');
        
        if (cachedData) {
          // Update cached data with new values
          const updatedData = { ...cachedData, ...data };
          await CacheManager.setCache(cacheKey, updatedData, 'FIRESTORE');
        }
      }
      
      return true;
    } catch (error) {
      throw error;
    }
  }
}

// Lazy Firebase Storage Cache
export class StorageCache {
  static async getDownloadURL(path, options = {}) {
    const cacheKey = `url_${path}`;
    
    // Try to get from cache first
    const cachedData = await CacheManager.getFromCache(cacheKey, 'STORAGE');
    if (cachedData && !options.forceRefresh) {
      return cachedData;
    }
    
    try {
      // Get download URL from Firebase Storage
      const url = await getDownloadURL(ref(getStorage(), path));
      
      // Cache the URL
      await CacheManager.setCache(cacheKey, url, 'STORAGE');
      
      return url;
    } catch (error) {
      // If network fails and we have cached data, return it
      if (cachedData) {
        console.warn('Using cached URL due to network error:', error);
        return cachedData;
      }
      throw error;
    }
  }

  static async getMetadata(path, options = {}) {
    const cacheKey = `metadata_${path}`;
    
    // Try to get from cache first
    const cachedData = await CacheManager.getFromCache(cacheKey, 'STORAGE');
    if (cachedData && !options.forceRefresh) {
      return cachedData;
    }
    
    try {
      // Get metadata from Firebase Storage
      const metadata = await getMetadata(ref(getStorage(), path));
      
      // Cache the metadata
      await CacheManager.setCache(cacheKey, metadata, 'STORAGE');
      
      return metadata;
    } catch (error) {
      // If network fails and we have cached data, return it
      if (cachedData) {
        console.warn('Using cached metadata due to network error:', error);
        return cachedData;
      }
      throw error;
    }
  }

  static async uploadFile(path, file, metadata = {}) {
    try {
      // Upload to Firebase Storage
      const task = putFile(ref(getStorage(), path), file, metadata);
      const snapshot = await task;
      
      // Get download URL and cache it
      const url = await getDownloadURL(ref(getStorage(), path));
      const cacheKey = `url_${path}`;
      await CacheManager.setCache(cacheKey, url, 'STORAGE');
      
      return { snapshot, url };
    } catch (error) {
      throw error;
    }
  }
}

// Initialize cache cleanup on app start
export const initializeCacheManager = () => {
  // Clean expired cache on app start
  CacheManager.clearExpiredCache();
  
  // Set up periodic cleanup (every hour)
  setInterval(() => {
    CacheManager.clearExpiredCache();
  }, 60 * 60 * 1000);
};

export { CacheManager };