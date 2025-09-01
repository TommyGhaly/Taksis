import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { 
  useFirestoreDocument, 
  useFirestoreCollection, 
  useStorageURL 
} from '../hooks/useFirebaseCache';

// Cached user profile component
export const CachedUserProfile = ({ userId, style }) => {
  const { data: user, loading, error, refresh } = useFirestoreDocument('users', userId);

  if (loading) {
    return (
      <View style={[{ padding: 20, alignItems: 'center' }, style]}>
        <ActivityIndicator size="small" />
        <Text style={{ marginTop: 10 }}>Loading profile...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[{ padding: 20, alignItems: 'center' }, style]}>
        <Text style={{ color: 'red' }}>Error loading profile</Text>
        <TouchableOpacity onPress={refresh} style={{ marginTop: 10 }}>
          <Text style={{ color: 'blue' }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[{ padding: 20, alignItems: 'center' }, style]}>
        <Text>User not found</Text>
      </View>
    );
  }

  return (
    <View style={style}>
      <Text style={{ fontSize: 18, fontWeight: 'bold' }}>{user.name}</Text>
      <Text style={{ fontSize: 14, color: 'gray' }}>{user.email}</Text>
      <TouchableOpacity onPress={refresh} style={{ marginTop: 10 }}>
        <Text style={{ color: 'blue' }}>Refresh</Text>
      </TouchableOpacity>
    </View>
  );
};

// Cached attendance list component
export const CachedAttendanceList = ({ 
  collectionPath, 
  filters = {}, 
  style,
  renderItem 
}) => {
  const queryOptions = {
    where: Object.entries(filters).map(([field, value]) => [field, '==', value]),
    orderBy: [['date', 'desc']]
  };

  const { data: attendance, loading, error, refresh } = useFirestoreCollection(
    collectionPath, 
    queryOptions
  );

  if (loading) {
    return (
      <View style={[{ padding: 20, alignItems: 'center' }, style]}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 10 }}>Loading attendance...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[{ padding: 20, alignItems: 'center' }, style]}>
        <Text style={{ color: 'red' }}>Error loading attendance</Text>
        <TouchableOpacity onPress={refresh} style={{ marginTop: 10 }}>
          <Text style={{ color: 'blue' }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={style}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
        <Text style={{ fontSize: 16, fontWeight: 'bold' }}>
          Attendance ({attendance.length})
        </Text>
        <TouchableOpacity onPress={refresh}>
          <Text style={{ color: 'blue' }}>Refresh</Text>
        </TouchableOpacity>
      </View>
      
      {attendance.length === 0 ? (
        <Text style={{ textAlign: 'center', color: 'gray', marginTop: 20 }}>
          No attendance records found
        </Text>
      ) : (
        attendance.map((item, index) => (
          <View key={item.id || index}>
            {renderItem ? renderItem(item, index) : (
              <Text style={{ padding: 10 }}>{item.name || item.id}</Text>
            )}
          </View>
        ))
      )}
    </View>
  );
};

// Cached profile image component
export const CachedProfileImage = ({ 
  imagePath, 
  style,
  placeholderSource,
  onPress
}) => {
  const { url, loading, error, refresh } = useStorageURL(imagePath);

  if (loading) {
    return (
      <View style={[{ 
        width: 80, 
        height: 80, 
        borderRadius: 40, 
        backgroundColor: 'lightgray',
        alignItems: 'center',
        justifyContent: 'center'
      }, style]}>
        <ActivityIndicator size="small" />
      </View>
    );
  }

  if (error || !url) {
    return (
      <TouchableOpacity onPress={refresh} style={style}>
        <Image 
          source={placeholderSource || { uri: 'https://via.placeholder.com/80' }}
          style={[{ width: 80, height: 80, borderRadius: 40 }, style]}
        />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity onPress={onPress} style={style}>
      <Image 
        source={{ uri: url }}
        style={[{ width: 80, height: 80, borderRadius: 40 }, style]}
      />
    </TouchableOpacity>
  );
};

// Cached church info component
export const CachedChurchInfo = ({ churchId, style }) => {
  const { data: church, loading, error, refresh } = useFirestoreDocument('churches', churchId);

  if (loading) {
    return (
      <View style={[{ padding: 15, alignItems: 'center' }, style]}>
        <ActivityIndicator size="small" />
        <Text style={{ marginTop: 5 }}>Loading church info...</Text>
      </View>
    );
  }

  if (error || !church) {
    return (
      <View style={[{ padding: 15, alignItems: 'center' }, style]}>
        <Text style={{ color: 'red' }}>Church information unavailable</Text>
        <TouchableOpacity onPress={refresh} style={{ marginTop: 5 }}>
          <Text style={{ color: 'blue' }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={style}>
      <Text style={{ fontSize: 16, fontWeight: 'bold' }}>{church.name}</Text>
      {church.address && (
        <Text style={{ fontSize: 12, color: 'gray', marginTop: 2 }}>
          {church.address}
        </Text>
      )}
      <TouchableOpacity onPress={refresh} style={{ marginTop: 5 }}>
        <Text style={{ color: 'blue', fontSize: 12 }}>Refresh</Text>
      </TouchableOpacity>
    </View>
  );
};