# Taksis: Comprehensive Church Management System

Taksis is an enterprise-grade church management platform serving 2500+ users across multiple Coptic Orthodox communities. Built by Tommy Ghaly it automates deacon scheduling, attendance tracking, donations management, and administrative workflows while providing real-time synchronization across mobile and web platforms.

---

## Core Features

### Dynamic Deacon Scheduling
Multi-factor scheduling algorithm that optimizes liturgical role assignments based on:
- **Age & Experience:** Role-appropriate assignments with experience weighting
- **Service Frequency:** Fair rotation preventing burnout
- **Recency Scoring:** Weeks-since-last-service calculations
- **Role-Specific Logic:** Dedicated algorithms for matins, third hour, sixth hour, gospel reading, and altar service
- **Real-time Adjustments:** Handles last-minute changes and absences

### Comprehensive Attendance Management
- **Multi-Service Tracking:** Sunday School, Servants Meeting, Alhan (hymns), and liturgical services
- **Historical Records:** Detailed participation analytics per deacon and service
- **Grading System:** Performance tracking with customizable evaluation criteria
- **Absence Management:** Excuse submission and approval workflows

### Donations & Financial Management
- **Multi-Category Support:** Sunday offerings, annual membership, charitable giving, special occasions
- **Payment Processing:** Multiple payment method support with transaction history
- **Receipt Generation:** Automated digital receipts with PDF export
- **Financial Reporting:** Donor analytics and contribution tracking
- **Anonymous Donations:** Privacy-preserving contribution options

### User & Role Management
- **Family Accounts:** Parent accounts with child profile management
- **Multi-Church Support:** Users can belong to multiple congregations
- **Role-Based Access:** Granular permissions for administrators, servants, and members
- **Profile Customization:** Service preferences, availability, and contact information

### Real-Time Synchronization
- **Firebase Integration:** Cloud Firestore for instant data propagation
- **Offline Support:** Local caching with AsyncStorage for offline access
- **Optimistic Updates:** UI responsiveness with background sync
- **Live Listeners:** Real-time schedule and attendance updates

---

## Technical Architecture

### Frontend (React Native)
```
/components
├── attendance/          # Attendance UI components
│   ├── attendanceHistory.js
│   ├── attendenceList.js
│   └── checkList.js
├── donations/          # Payment and receipt components
├── scheduling/         # Schedule display and management
└── shared/            # Reusable UI elements

/screens
├── Home/              # Main dashboard and navigation
├── SundaySchool/      # Class attendance and grading
├── ServantsMeeting/   # Servant-specific features
├── Alhan/             # Hymns service management
├── Settings/          # User preferences and account
└── Donations/         # Financial contributions
```

### Backend (Firebase Cloud Functions - Python)
- **Scheduling Engine:** Multi-algorithm deacon assignment system
- **Attendance Processor:** Automated record keeping and analytics
- **Donation Handler:** Transaction processing and receipt generation
- **User Management:** Account creation, updates, and role assignment
- **Scheduled Tasks:** Weekly schedule generation, data cleanup, notifications
- **Real-time Triggers:** Document change listeners for instant updates

### Data Layer (Firestore)
```
/churches/{churchId}
├── /deacons           # Deacon profiles and service history
├── /schedules         # Weekly liturgical schedules
├── /attendance        # Service attendance records
├── /donations         # Financial transactions
├── /users             # User accounts and preferences
└── /settings          # Church-specific configurations
```

### Performance Optimizations
- **Firestore Caching:** Persistent query caching with TTL
- **AsyncStorage:** Local data persistence for offline operation
- **Custom Hooks:** `useFirestoreDocument`, `useFirestoreCollection` for efficient data fetching
- **Lazy Loading:** Component-level code splitting
- **Memoization:** React.memo and useMemo for expensive computations

---

## Key Workflows

### Deacon Scheduling Process
1. **Data Collection:** Aggregate deacon service history, availability, and role qualifications
2. **Value Calculation:** Apply role-specific algorithms computing suitability scores
3. **Sorting & Selection:** Rank candidates and assign top matches to roles
4. **Conflict Resolution:** Handle double-bookings and role dependencies
5. **Publication:** Push schedule to Firestore with real-time notifications
6. **Updates:** Handle last-minute substitutions with re-computation

### Attendance Tracking
1. **Check-in:** Digital attendance marking with timestamp
2. **Validation:** Cross-reference with scheduled assignments
3. **Grading:** Performance evaluation by administrators
4. **History Update:** Append to individual service records
5. **Analytics:** Generate participation reports and trends

### Donation Processing
1. **Selection:** Choose donation category and amount
2. **Payment:** Process through integrated payment gateway
3. **Verification:** Transaction confirmation and validation
4. **Receipt:** Automatic PDF generation with church branding
5. **Record Keeping:** Store in user history and church financial records
6. **Reporting:** Export for accounting and tax purposes

---

## Technology Stack

**Mobile App:**
- React Native (Expo framework)
- React Navigation for routing
- Firebase SDK (Authentication, Firestore, Cloud Functions)
- AsyncStorage for local persistence
- Custom hooks for Firebase integration

**Backend:**
- Firebase Cloud Functions (Python 3.11+)
- `firebase_admin` SDK
- `google-cloud-firestore` for database operations
- Scheduled function triggers (Cloud Scheduler)

**Development Tools:**
- Babel & Metro bundler configuration
- Microsoft Live Share for collaborative coding
- Git for version control
- Firebase CLI for deployment

**Key Libraries:**
- `react-native-firebase` for native Firebase integration
- `@react-navigation/native` for navigation
- `react-native-async-storage` for offline storage
- Custom date/time utilities for church calendar integration

---

## Setup & Configuration

### Prerequisites
```bash
node >= 18.0.0
npm >= 9.0.0
expo-cli
firebase-tools
python >= 3.11 (for Cloud Functions)
```

### Installation
```bash
# Clone repository
git clone [repository-url]
cd taksis

# Install dependencies
npm install

# Configure Firebase
firebase login
firebase use [project-id]

# Deploy Cloud Functions
cd backend
pip install -r requirements.txt
firebase deploy --only functions

# Run development server
npm start
```

### Environment Configuration
Create `firebase.config.js` with your Firebase project credentials:
```javascript
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  // ... other config
};
```

---

## Future Enhancements

- **Push Notifications:** Schedule reminders and absence alerts
- **Calendar Integration:** Export schedules to Google Calendar/iCal
- **Analytics Dashboard:** Church-wide participation metrics
- **Multi-language Support:** Arabic, English, Coptic liturgical text
- **Web Portal:** Desktop administration interface
- **Automated Reporting:** Weekly/monthly email summaries
- **Mobile Check-in:** QR code-based attendance marking
- **Resource Booking:** Church facility scheduling

---

## Contributing

We welcome contributions! Please follow these guidelines:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Contact & Support

For questions, feature requests, or technical support, please contact the development team or open an issue on GitHub.

**Taksis** - Modernizing church administration through intelligent automation and seamless user experience.