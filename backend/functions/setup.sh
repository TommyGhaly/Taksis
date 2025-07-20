#!/bin/bash

# Setup script for Python 3.12 Firebase Functions

echo "Setting up Python 3.12 environment for Firebase Functions..."

# Check if Python 3.12 is available
if ! command -v python3.12 &> /dev/null; then
    echo "Python 3.12 is not installed. Please install Python 3.12 first."
    echo "On macOS: brew install python@3.12"
    echo "On Ubuntu: sudo apt-get install python3.12 python3.12-venv"
    exit 1
fi

# Remove existing virtual environment if it exists
if [ -d "venv" ]; then
    echo "Removing existing virtual environment..."
    rm -rf venv
fi

# Create new virtual environment with Python 3.12
echo "Creating virtual environment with Python 3.12..."
python3.12 -m venv venv

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "Upgrading pip..."
pip install --upgrade pip

# Install requirements
echo "Installing requirements..."
pip install -r requirements.txt

echo "Setup complete! To activate the environment, run:"
echo "source venv/bin/activate" 