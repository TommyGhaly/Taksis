// databaseRegistry.js
// Declarative map of the collections the Database Manager can browse.
//
// SUBCOLLECTION MODEL (nested, unlimited depth):
//   The Firestore client SDK cannot enumerate subcollections at runtime, so we
//   declare the ones we know about. `subcollections` is an OBJECT keyed by the
//   subcollection name; each value may itself declare `subcollections`, so the
//   tree can go as deep as needed:
//
//     churches/{church}/Hymns Class/{grade}/students/{studentId}
//        ^col      ^doc      ^subcol   ^doc    ^subcol   ^doc
//
//   A subcollection entry may also set `dynamicChildren: '<name>'` to say
//   "every doc under here has a subcollection with this name" — used for the
//   grade lists where the grade docs vary but each one has `students`.
//
//   Regardless of what's declared, DocumentView ALSO lets you open any
//   subcollection by typing its name (escape hatch), so undeclared paths like
//   pascha/archive_2027 still work without a registry edit.
//
// SORTING:
//   `sortBy` controls how a collection's docs are ordered:
//     - omitted        -> auto (name field if present, else doc id)
//     - '<fieldName>'   -> orderBy that field
//     - '__id__'        -> orderBy document id
//     - '__date_mmddyy__' -> client-side chronological sort for mm-dd-yy ids
//                            (the `unavailable` weeks and schedule weeks)

// A reusable grade list for the Sunday School / Hymns Class trees. Each grade
// doc carries a `students` subcollection. Declared explicitly so they show up
// even before any doc is opened; undeclared grades still work via the escape
// hatch in DocumentView.
const GRADE_SUBTREE = {
  'Pre-School - Age 3': { subcollections: { students: {} } },
  'Pre-School - Age 4': { subcollections: { students: {} } },
  'Kindergarten': { subcollections: { students: {} } },
  '1st Grade': { subcollections: { students: {} } },
  '2nd Grade': { subcollections: { students: {} } },
  '3rd Grade': { subcollections: { students: {} } },
  '4th Grade': { subcollections: { students: {} } },
  '5th Grade': { subcollections: { students: {} } },
  '6th Grade': { subcollections: { students: {} } },
};

export const KNOWN_COLLECTIONS = [
  {
    path: 'users',
    displayName: 'Users',
    protected: true, // extra confirm step on bulk delete
  },
  {
    path: 'churches',
    displayName: 'Churches',
    protected: true,
    subcollections: {
      'Hymns Class': {
        // Grade docs each contain a `students` subcollection.
        subcollections: GRADE_SUBTREE,
        // Any grade doc not declared above still offers `students`.
        dynamicChildren: 'students',
      },
      'Sunday School': {
        subcollections: GRADE_SUBTREE,
        dynamicChildren: 'students',
      },
      "Servant's Meeting": {},
      'archive': {
        // archive docs are weeks keyed mm-dd-yy
        sortBy: '__date_mmddyy__',
      },
      'pascha': {
        // pascha holds config + schedule docs and archive_YYYY subcollections.
        // The archive_YYYY names vary by year, so we don't hardcode them; the
        // escape hatch in DocumentView opens archive_2024, archive_2025, etc.
        subcollections: {
          schedule: {},
          schedule_config: {},
          config: {},
        },
      },
      'schedule': {
        sortBy: '__date_mmddyy__',
      },
      'unavailable': {
        // One doc per week (mm-dd-yy). Each doc is a map of userId -> request.
        sortBy: '__date_mmddyy__',
      },
    },
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

// ---- subcollection resolution helpers ----------------------------------

// Walk KNOWN_COLLECTIONS following an array of segment names (subcollection /
// doc / subcollection / ...) and return the registry node for the collection
// the path currently points at. Doc id segments are skipped — only the named
// subcollection levels matter for the tree shape.
//
// pathSegs is the full slash-split path, e.g.
//   ['churches', 'StMark', 'Hymns Class', '1st Grade', 'students']
// We resolve to the node describing `students`.
const findTop = (collName) =>
  KNOWN_COLLECTIONS.find((c) => c.path === collName) || null;

// Given a full collection path (always odd number of segments: col/doc/col/...
// ending on a collection), return { node, parentDynamicChild }.
//   node                -> the registry entry for the deepest collection, or null
//   parentDynamicChild  -> if the parent declared dynamicChildren, the implied
//                          subcollection name available under every doc here
export const resolveCollectionNode = (collectionPath) => {
  const segs = collectionPath.split('/').filter(Boolean);
  if (segs.length === 0) return { node: null, dynamicChild: null };

  const top = findTop(segs[0]);
  if (!top) return { node: null, dynamicChild: null };
  if (segs.length === 1) return { node: top, dynamicChild: null };

  // Walk: segs = [topCol, doc, sub, doc, sub, ...]
  let node = top;
  let dynamicChild = null;
  for (let i = 2; i < segs.length; i += 2) {
    const subName = segs[i];
    const subs = node?.subcollections || {};
    if (subs[subName]) {
      dynamicChild = node?.dynamicChildren || null;
      node = subs[subName];
    } else if (node?.dynamicChildren === subName) {
      // Implied subcollection under a dynamic-children doc (e.g. `students`)
      dynamicChild = null;
      node = { path: subName }; // leaf-ish; no further declared children
    } else {
      // Undeclared (escape-hatch) path. No further declared structure.
      dynamicChild = null;
      node = null;
    }
  }
  return { node, dynamicChild };
};

// Return the list of declared subcollection names available under a DOCUMENT
// at docPath.
//
// There are two shapes a parent-collection node can take:
//
//  A) "doc-list with uniform children" — the node has `dynamicChildren`
//     (e.g. Hymns Class / Sunday School). Here the node's own `subcollections`
//     keys are the DOC NAMES (the grades), NOT subcollections of those docs.
//     Each such doc's subcollections are:
//       - the matching grade's own declared subs (if the doc id is declared), and
//       - the dynamicChildren name (applies to every doc).
//     For undeclared docs (e.g. a grade we didn't list) only dynamicChildren
//     applies. Since we don't have the doc id here in the general case, we
//     return the dynamicChildren name plus — for a declared doc id — its subs.
//
//  B) ordinary node — the node's `subcollections` ARE subcollections of its
//     docs (the original model). Return those names.
//
// The docId IS available (it's the last path segment), so we use it to pick a
// declared grade's specific children when present.
export const declaredSubcollectionsForDoc = (docPath) => {
  const segs = docPath.split('/').filter(Boolean);
  const docId = segs[segs.length - 1];
  const parentCollection = segs.slice(0, -1).join('/');
  const { node } = resolveCollectionNode(parentCollection);
  if (!node) return [];

  const names = new Set();

  if (node.dynamicChildren) {
    // Shape A: node.subcollections are doc names (grades).
    names.add(node.dynamicChildren);
    const declaredDoc = node.subcollections?.[docId];
    if (declaredDoc?.subcollections) {
      Object.keys(declaredDoc.subcollections).forEach((n) => names.add(n));
    }
  } else if (node.subcollections) {
    // Shape B: node.subcollections are this doc's subcollections.
    Object.keys(node.subcollections).forEach((n) => names.add(n));
  }

  return Array.from(names);
};