#!/bin/bash

# In-My-Mind (IMM) Installer
# Creates a symlink to /usr/local/bin/imm for global access

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
IMM_BIN="$SCRIPT_DIR/bin/imm"
TARGET_DIR="/usr/local/bin"
TARGET_BIN="$TARGET_DIR/imm"

# Check if bin/imm exists
if [ ! -f "$IMM_BIN" ]; then
    echo "Error: bin/imm not found at $IMM_BIN"
    exit 1
fi

# Ensure bin/imm is executable
chmod +x "$IMM_BIN"

# Check if target directory exists
if [ ! -d "$TARGET_DIR" ]; then
    echo "Error: $TARGET_DIR does not exist"
    exit 1
fi

# Remove existing symlink if present
if [ -L "$TARGET_BIN" ]; then
    echo "Removing existing symlink..."
    rm "$TARGET_BIN" 2>/dev/null || sudo rm "$TARGET_BIN"
elif [ -f "$TARGET_BIN" ]; then
    echo "Error: $TARGET_BIN exists and is not a symlink. Please remove it manually."
    exit 1
fi

# Create symlink (may need sudo)
echo "Creating symlink: $TARGET_BIN -> $IMM_BIN"
if ln -s "$IMM_BIN" "$TARGET_BIN" 2>/dev/null; then
    :
else
    echo "Permission denied. Trying with sudo..."
    sudo ln -s "$IMM_BIN" "$TARGET_BIN"
fi

echo ""
echo "✅ Installation complete!"
echo ""
echo "You can now use 'imm' from anywhere:"
echo "  imm gateway      # Start the Gateway API service"
echo "  imm sync         # Synchronize data from collectors"
echo "  imm status       # Show database statistics"
