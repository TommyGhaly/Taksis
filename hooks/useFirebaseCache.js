import { useState, useEffect, useCallback } from 'react';
import { FirestoreCache, StorageCache } from '../utils/cacheManager';

// Hook for Firestore document caching
export const useFirestoreDocument = (collectionPath, documentId, options = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDocument = useCallback(async (forceRefresh = false) => {
    if (!collectionPath || !documentId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const result = await FirestoreCache.getDocument(
        collectionPath, 
        documentId, 
        { ...options, forceRefresh }
      );
      
      setData(result);
    } catch (err) {
      setError(err);
      console.error('Error fetching document:', err);
    } finally {
      setLoading(false);
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

  useEffect(() => {
    fetchDocument();
  }, [fetchDocument]);

  return { 
    data, 
    loading, 
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