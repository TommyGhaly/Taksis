import { useState, useEffect, useCallback, useRef } from 'react';
import {
  doc as firestoreDoc,
  getFirestore,
  onSnapshot,
} from '@react-native-firebase/firestore';
import { CacheManager, FirestoreCache, StorageCache } from '../utils/cacheManager';

// Hook for Firestore document caching
export const useFirestoreDocument = (collectionPath, documentId, options = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  // Mirrors `data` so fetchDocument can tell a cold load from a refresh
  // without having to depend on `data` (which would recreate the callback).
  const dataRef = useRef(null);

  const fetchDocument = useCallback(async (forceRefresh = false) => {
    if (!collectionPath || !documentId) {
      setLoading(false);
      return;
    }

    // Only block the UI when there is nothing cached to render. Setting
    // loading on every fetch made each refresh flash a full-screen spinner
    // and unmount the content behind it.
    const isColdLoad = dataRef.current == null;
    if (isColdLoad) setLoading(true);
    else setRefreshing(true);

    try {
      setError(null);

      const result = await FirestoreCache.getDocument(
        collectionPath,
        documentId,
        { ...options, forceRefresh }
      );

      dataRef.current = result;
      setData(result);
    } catch (err) {
      setError(err);
      console.error('Error fetching document:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [collectionPath, documentId, JSON.stringify(options)]);

  const refresh = useCallback(() => {
    return fetchDocument(true);
  }, [fetchDocument]);

  const updateDocument = useCallback(async (updateData, updateOptions = {}) => {
    try {
      await FirestoreCache.updateDocument(collectionPath, documentId, updateData, updateOptions);
      
      // Update local state
      setData(prevData => prevData ? { ...prevData, ...updateData } : null);
      
      return true;
    } catch (err) {
      setError(err);
      throw err;
    }
  }, [collectionPath, documentId]);

  // Paint from the AsyncStorage copy, then stay live. This hook used to be a
  // one-shot read behind a 1-day cache, so an admin's edit (or a deleted doc)
  // never reached the screen until the cache expired or someone pulled to
  // refresh. The listener is the source of truth; the cache only covers the
  // first frame.
  useEffect(() => {
    if (!collectionPath || !documentId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    CacheManager.getFromCache(`${collectionPath}/${documentId}`, 'FIRESTORE')
      .then((cached) => {
        if (cancelled || cached == null || dataRef.current != null) return;
        dataRef.current = cached;
        setData(cached);
        setLoading(false);
      })
      .catch(() => {});

    const unsubscribe = onSnapshot(
      firestoreDoc(getFirestore(), collectionPath, documentId),
      (snap) => {
        const result = snap.exists ? { id: snap.id, ...snap.data() } : null;
        dataRef.current = result;
        setData(result);
        setError(null);
        setLoading(false);
        if (result) {
          CacheManager.setCache(`${collectionPath}/${documentId}`, result, 'FIRESTORE');
        } else {
          CacheManager.removeFromCache(`${collectionPath}/${documentId}`, 'FIRESTORE');
        }
      },
      (err) => {
        console.warn(`Live read of ${collectionPath}/${documentId} failed:`, err);
        setError(err);
        setLoading(false);
      }
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [collectionPath, documentId]);

  return {
    data,
    loading,
    refreshing,
    error,
    refresh,
    updateDocument
  };
};

// Hook for Firestore collection caching
export const useFirestoreCollection = (collectionPath, queryOptions = {}, options = {}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCollection = useCallback(async (forceRefresh = false) => {
    if (!collectionPath) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const result = await FirestoreCache.getCollection(
        collectionPath, 
        queryOptions, 
        { ...options, forceRefresh }
      );
      
      setData(result || []);
    } catch (err) {
      setError(err);
      console.error('Error fetching collection:', err);
    } finally {
      setLoading(false);
    }
  }, [collectionPath, JSON.stringify(queryOptions), JSON.stringify(options)]);

  const refresh = useCallback(() => {
    return fetchCollection(true);
  }, [fetchCollection]);

  useEffect(() => {
    fetchCollection();
  }, [fetchCollection]);

  return { 
    data, 
    loading, 
    error, 
    refresh 
  };
};

// Hook for Firebase Storage URL caching
export const useStorageURL = (path, options = {}) => {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchURL = useCallback(async (forceRefresh = false) => {
    if (!path) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const result = await StorageCache.getDownloadURL(
        path, 
        { ...options, forceRefresh }
      );
      
      setUrl(result);
    } catch (err) {
      setError(err);
      console.error('Error fetching storage URL:', err);
    } finally {
      setLoading(false);
    }
  }, [path, JSON.stringify(options)]);

  const refresh = useCallback(() => {
    return fetchURL(true);
  }, [fetchURL]);

  useEffect(() => {
    fetchURL();
  }, [fetchURL]);

  return { 
    url, 
    loading, 
    error, 
    refresh 
  };
};

// Hook for Firebase Storage metadata caching
export const useStorageMetadata = (path, options = {}) => {
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMetadata = useCallback(async (forceRefresh = false) => {
    if (!path) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const result = await StorageCache.getMetadata(
        path, 
        { ...options, forceRefresh }
      );
      
      setMetadata(result);
    } catch (err) {
      setError(err);
      console.error('Error fetching storage metadata:', err);
    } finally {
      setLoading(false);
    }
  }, [path, JSON.stringify(options)]);

  const refresh = useCallback(() => {
    return fetchMetadata(true);
  }, [fetchMetadata]);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  return { 
    metadata, 
    loading, 
    error, 
    refresh 
  };
};

// Hook for batch Firebase operations with caching
export const useFirebaseBatch = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const batchFetch = useCallback(async (operations, forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      const results = await Promise.allSettled(
        operations.map(async (op) => {
          switch (op.type) {
            case 'document':
              return await FirestoreCache.getDocument(
                op.collectionPath, 
                op.documentId, 
                { forceRefresh }
              );
            case 'collection':
              return await FirestoreCache.getCollection(
                op.collectionPath, 
                op.queryOptions || {}, 
                { forceRefresh }
              );
            case 'storageURL':
              return await StorageCache.getDownloadURL(
                op.path, 
                { forceRefresh }
              );
            case 'storageMetadata':
              return await StorageCache.getMetadata(
                op.path, 
                { forceRefresh }
              );
            default:
              throw new Error(`Unknown operation type: ${op.type}`);
          }
        })
      );

      const data = results.map((result, index) => ({
        success: result.status === 'fulfilled',
        data: result.status === 'fulfilled' ? result.value : null,
        error: result.status === 'rejected' ? result.reason : null,
        operation: operations[index]
      }));

      return data;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    batchFetch,
    loading,
    error
  };
};