#!/usr/bin/env python3
"""
Script to set Railway environment variables from .env.railway file
"""

import subprocess
import sys
import os

def read_env_file(filepath):
    """Read and parse .env file"""
    variables = []
    
    with open(filepath, 'r') as f:
        for line in f:
            line = line.strip()
            
            # Skip comments and empty lines
            if not line or line.startswith('#'):
                continue
            
            # Parse key=value pairs
            if '=' in line:
                variables.append(line)
    
    return variables

def set_railway_variables(variables):
    """Set variables in Railway using CLI"""
    
    if not variables:
        print("❌ No variables found in .env.railway")
        return False
    
    print(f"📦 Found {len(variables)} variables to set")
    print("\n🚀 Setting variables in Railway...")
    
    # Build the command with all --set flags
    cmd = ['railway', 'variables']
    for var in variables:
        cmd.extend(['--set', var])
    
    try:
        # Execute the command
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        print("✅ Variables set successfully!")
        print(result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Error setting variables: {e}")
        print(e.stderr)
        return False

def main():
    env_file = '.env.railway'
    
    if not os.path.exists(env_file):
        print(f"❌ File {env_file} not found!")
        print("Please create it first or run from the correct directory.")
        sys.exit(1)
    
    print(f"📋 Reading variables from {env_file}...")
    variables = read_env_file(env_file)
    
    # Show what will be set (keys only, not values for security)
    print("\n🔑 Variables to be set:")
    for var in variables:
        key = var.split('=')[0]
        print(f"  - {key}")
    
    # Ask for confirmation
    print("\n⚠️  This will set these variables in your Railway project.")
    confirm = input("Continue? (y/N): ").strip().lower()
    
    if confirm != 'y':
        print("❌ Cancelled")
        sys.exit(0)
    
    # Set the variables
    success = set_railway_variables(variables)
    
    if success:
        print("\n✨ Done! Variables have been set in Railway.")
        print("💡 Tip: Run 'railway variables' to verify")
    else:
        sys.exit(1)

if __name__ == '__main__':
    main()
