# Firebase Functions Deployment Guide

## Prerequisites

- ✅ Python 3.12 installed and configured
- ✅ Virtual environment set up with all dependencies
- ✅ Firebase CLI installed and authenticated
- ✅ Google Cloud project configured

## Quick Start

### 1. Activate Environment
```bash
cd backend/functions
source venv/bin/activate
```

### 2. Test Locally
```bash
# Start Firebase emulators
firebase emulators:start --only functions

# In another terminal, test your functions
curl http://localhost:5001/your-project-id/us-central1/your-function-name
```

### 3. Deploy to Production
```bash
# Deploy all functions
firebase deploy --only functions

# Deploy specific function
firebase deploy --only functions:functionName
```

## Configuration Files

### `firebase.json`
- Specifies Python 3.12 runtime
- Configures function source and ignore patterns

### `requirements.txt`
- Lists all Python dependencies
- Pinned versions for consistency

### `runtime.txt`
- Specifies Python 3.12 version

## Available Functions

Based on your `main.py`, the following functions are available:

### HTTP Functions
- `force_generate_schedule` - Manually trigger schedule generation
- `update_user` - Update user information
- `update_user_frequency` - Update user frequency based on location
- `sync_child_params` - Sync child parameters with parent
- `delete_child` - Delete child user
- `delete_user` - Delete user and children
- `check_classes` - Clean up empty classes
- `switch_server` - Switch servers in schedule
- `remove_server` - Remove server from altar
- `add_server` - Add server to altar
- `unavailable_for_week` - Mark user as unavailable
- `remove_family_schedules` - Remove family schedules
- `create_test_data` - Create test data
- `test_update_ages` - Test age updates
- `testing_notifcations` - Test notifications
- `test_liturgy_notification` - Test liturgy notifications

### Scheduled Functions
- `generate_schedule` - Generate schedules every Sunday at 4:00 PM
- `new_years_cleanup` - Clean up student data on September 11th
- `scheduled_update_ages` - Update ages every Sunday at midnight
- `first_reminder` - Send liturgy reminders every Sunday at 4:15 PM
- `second_reminder` - Send liturgy reminders every Friday at 8:00 PM
- `third_reminder` - Send liturgy reminders every Saturday at 8:00 PM
- `servants_meeting_notification` - Send servants meeting reminders every Sunday at 12:30 AM

## Environment Variables

Make sure to set up the following environment variables in Firebase:

```bash
firebase functions:config:set \
  firebase.project_id="your-project-id" \
  firebase.storage_bucket="your-storage-bucket"
```

## Monitoring

### View Logs
```bash
firebase functions:log
```

### Monitor Performance
```bash
firebase functions:log --only functionName
```

## Troubleshooting

### Common Issues

1. **Python Version Mismatch**
   ```bash
   python --version  # Should show 3.12.x
   ```

2. **Missing Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Firebase CLI Issues**
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

4. **Deployment Failures**
   ```bash
   # Check logs
   firebase functions:log
   
   # Redeploy with verbose output
   firebase deploy --only functions --debug
   ```

### Performance Optimization

- Use `asyncio` for concurrent operations
- Implement proper error handling
- Use Firestore batch operations
- Optimize database queries

## Security

- All functions include Firebase Auth token verification
- Proper input validation implemented
- Error messages don't expose sensitive information
- Rate limiting considerations for public endpoints

## Testing

Run the test script to verify setup:
```bash
python test_deployment.py
```

## Support

For issues specific to:
- **Firebase Functions**: Check [Firebase Documentation](https://firebase.google.com/docs/functions)
- **Python 3.12**: Check [Python Documentation](https://docs.python.org/3.12/)
- **Google Cloud**: Check [Google Cloud Documentation](https://cloud.google.com/docs) 