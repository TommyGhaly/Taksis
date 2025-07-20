# Firebase Functions - Python 3.12 Setup

This directory contains Firebase Functions written in Python 3.12.

## Prerequisites

- Python 3.12 installed on your system
- Firebase CLI installed globally
- Google Cloud SDK (optional, for local testing)

## Installation

### 1. Install Python 3.12

**macOS:**
```bash
brew install python@3.12
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install python3.12 python3.12-venv python3.12-pip
```

**Windows:**
Download from [python.org](https://www.python.org/downloads/)

### 2. Setup Environment

Run the setup script:
```bash
cd backend/functions
./setup.sh
```

Or manually:
```bash
cd backend/functions
python3.12 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
```

### 3. Activate Environment

```bash
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

## Development

### Local Testing

```bash
# Activate virtual environment
source venv/bin/activate

# Test functions locally
firebase emulators:start --only functions
```

### Deployment

```bash
# Deploy to Firebase
firebase deploy --only functions
```

## Dependencies

- `firebase-functions`: Firebase Functions framework
- `firebase-admin`: Firebase Admin SDK
- `google-cloud-firestore`: Firestore client library
- `google-cloud-storage`: Cloud Storage client library
- `google-auth`: Google Auth library
- `requests`: HTTP library
- `flask`: Web framework (for request handling)

## Python 3.12 Features

This project uses Python 3.12 which includes:
- Improved error messages
- Better performance
- Enhanced type hints
- New language features

## Troubleshooting

### Python Version Issues
Make sure you're using Python 3.12:
```bash
python --version
```

### Virtual Environment Issues
If you encounter issues with the virtual environment:
```bash
rm -rf venv
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Firebase CLI Issues
Make sure Firebase CLI is up to date:
```bash
npm install -g firebase-tools
firebase login
``` 