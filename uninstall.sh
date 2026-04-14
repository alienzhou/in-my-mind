#!/bin/bash

# In-My-Mind (IMM) Uninstaller
# Removes the global symlink

set -e

TARGET_BIN="/usr/local/bin/imm"

if [ -L "$TARGET_BIN" ]; then
    echo "Removing symlink: $TARGET_BIN"
    rm "$TARGET_BIN" 2>/dev/null || sudo rm "$TARGET_BIN"
    echo "✅ Uninstall complete!"
elif [ -f "$TARGET_BIN" ]; then
    echo "Error: $TARGET_BIN exists but is not a symlink created by this installer."
    echo "Please remove it manually if needed."
    exit 1
else
    echo "Nothing to uninstall: $TARGET_BIN does not exist."
fi
