// databaseRegistry.js
// Hardcoded list of collections the Database Manager can see.
// Add entries here when you add new top-level collections to Firestore.
//
// `subcollections` are subcollection NAMES that may exist under a doc in this
// collection. The client SDK can't list subcollections at runtime, so we
// declare them. If a doc doesn't have one, it'll just show empty when tapped.
//
// Search behavior: the manager screen scans the doc id + every field's value
// for a substring match. No need to declare searchable fields per collection.

export const KNOWN_COLLECTIONS = [
  {
    path: 'users',
    displayName: 'Users',
    protected: true, // extra confirm step on bulk delete
  },
  {
    path: 'churches',
    displayName: 'Churches',
    subcollections: [
      'Hymns Class',
      'Servants Meeting',
      'Sunday School',
      'schedule',
      'archive',
      'pascha',
    ],
    protected: true,
  },
  {
    path: 'cars',
    displayName: 'Vehicles',
  },
  {
    path: 'pending_vehicles',
    displayName: 'Pending Vehicles',
  },
  {
    path: 'suggestions',
    displayName: 'Suggestions',
  },
  // add more here as your DB grows
];

export const AUDIT_COLLECTION = '_admin_audit';
export const BULK_HARD_CEILING = 1000;