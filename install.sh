#!/bin/sh
#
# duesentrieb installer
#
# Downloads the prebuilt pi binary for your platform from the fork's GitHub
# Releases, verifies its checksum, and installs it.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/binarybaron/duesentrieb/main/install.sh | sh
#
# Environment variables:
#   PI_VERSION      Version tag to install (e.g. v0.12.0). Default: latest release.
#   PI_INSTALL_DIR  Directory to unpack into. Default: ${XDG_DATA_HOME:-$HOME/.local/share}/duesentrieb
#   PI_BIN_DIR      Directory for the `pi` launcher symlink. Default: $HOME/.local/bin

set -eu

REPO="binarybaron/duesentrieb"

INSTALL_DIR="${PI_INSTALL_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/duesentrieb}"
BIN_DIR="${PI_BIN_DIR:-$HOME/.local/bin}"

info() { printf '%s\n' "$*" >&2; }
err() { printf 'error: %s\n' "$*" >&2; exit 1; }

need() { command -v "$1" >/dev/null 2>&1 || err "required command not found: $1"; }

need uname
need tar
need mkdir
need ln

if command -v curl >/dev/null 2>&1; then
	DL="curl -fsSL"
	DL_OUT="curl -fsSL -o"
elif command -v wget >/dev/null 2>&1; then
	DL="wget -qO-"
	DL_OUT="wget -qO"
else
	err "need curl or wget"
fi

# Detect platform.
os="$(uname -s)"
arch="$(uname -m)"

case "$os" in
	Darwin) os="darwin" ;;
	Linux) os="linux" ;;
	*) err "unsupported OS: $os (Windows: download the zip from https://github.com/$REPO/releases)" ;;
esac

case "$arch" in
	x86_64 | amd64) arch="x64" ;;
	arm64 | aarch64) arch="arm64" ;;
	*) err "unsupported architecture: $arch" ;;
esac

platform="${os}-${arch}"
asset="pi-${platform}.tar.gz"

# Resolve download base URL.
if [ -n "${PI_VERSION:-}" ]; then
	base="https://github.com/${REPO}/releases/download/${PI_VERSION}"
	info "Installing duesentrieb ${PI_VERSION} (${platform})"
else
	base="https://github.com/${REPO}/releases/latest/download"
	info "Installing duesentrieb latest (${platform})"
fi

# Work in a temp dir.
tmp="$(mktemp -d "${TMPDIR:-/tmp}/duesentrieb.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT INT TERM

info "Downloading ${asset}..."
$DL_OUT "$tmp/$asset" "$base/$asset" || err "download failed: $base/$asset"

# Verify checksum against the release SHA256SUMS (best effort; skip if absent).
if $DL_OUT "$tmp/SHA256SUMS" "$base/SHA256SUMS" 2>/dev/null; then
	expected="$(grep " $asset\$" "$tmp/SHA256SUMS" | awk '{print $1}')"
	if [ -n "$expected" ]; then
		if command -v sha256sum >/dev/null 2>&1; then
			actual="$(sha256sum "$tmp/$asset" | awk '{print $1}')"
		elif command -v shasum >/dev/null 2>&1; then
			actual="$(shasum -a 256 "$tmp/$asset" | awk '{print $1}')"
		else
			actual=""
			info "warning: no sha256 tool found, skipping checksum verification"
		fi
		if [ -n "$actual" ] && [ "$actual" != "$expected" ]; then
			err "checksum mismatch for $asset (expected $expected, got $actual)"
		fi
		[ -n "$actual" ] && info "Checksum verified."
	fi
else
	info "warning: SHA256SUMS not found, skipping checksum verification"
fi

# Unpack. Archive contains a top-level pi/ directory.
info "Unpacking into ${INSTALL_DIR}..."
rm -rf "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
tar -xzf "$tmp/$asset" -C "$INSTALL_DIR"

binary="$INSTALL_DIR/pi/pi"
[ -x "$binary" ] || chmod +x "$binary" 2>/dev/null || true
[ -f "$binary" ] || err "expected binary not found after unpack: $binary"

# Link launcher onto PATH.
mkdir -p "$BIN_DIR"
ln -sf "$binary" "$BIN_DIR/pi"

info ""
info "Installed pi -> $BIN_DIR/pi"

# PATH hint.
case ":$PATH:" in
	*":$BIN_DIR:"*) ;;
	*)
		info ""
		info "$BIN_DIR is not on your PATH. Add it, e.g.:"
		info "  echo 'export PATH=\"$BIN_DIR:\$PATH\"' >> ~/.profile"
		;;
esac

info ""
info "Run 'pi --version' to verify."
