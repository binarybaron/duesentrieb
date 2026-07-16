#!/usr/bin/env bash
# Bootstrap installer for dusentrieb-cli.
# Usage: curl -fsSL https://binarybaron.github.io/duesentrieb/install.sh | bash
set -euo pipefail

REPO_URL="https://github.com/binarybaron/duesentrieb"

command -v git >/dev/null 2>&1 || { echo "Error: git is required." >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Error: Node.js >= 22.19 is required." >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "Error: npm is required." >&2; exit 1; }

node_major="$(node -p 'Number(process.versions.node.split(".")[0])')"
if [[ "$node_major" -lt 22 ]]; then
    echo "Error: Node.js >= 22.19 is required (found $(node --version))." >&2
    exit 1
fi

work_dir="$(mktemp -d "${TMPDIR:-/tmp}/dusentrieb-install.XXXXXX")"
trap 'rm -rf "$work_dir"' EXIT

echo "Cloning $REPO_URL ..."
git clone --depth 1 "$REPO_URL" "$work_dir/duesentrieb"

cd "$work_dir/duesentrieb"
echo "Installing dependencies ..."
npm install --ignore-scripts </dev/null

echo "Building and installing ..."
./scripts/install-fork.sh </dev/null
