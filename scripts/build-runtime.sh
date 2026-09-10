#!/usr/bin/env bash
# Build the embedded DeepTutor runtime for one target platform.
# 构建单个目标平台的内嵌 DeepTutor runtime。
#
# Inputs are pinned, external, versioned dependencies — no upstream source is
# copied into this repository (see docs/adr/0003-embedded-web-stack.md):
#   - python-build-standalone CPython (via uv's managed downloads)
#   - deeptutor==<DEEPTUTOR_VERSION> from PyPI (wheel, includes deeptutor_web)
#   - Node.js official binary tarball
#
# Output layout (consumed by tauri.conf.json `bundle.resources`):
#   runtime/<target>/python/   relocatable CPython + deeptutor + deps
#   runtime/<target>/node/     official Node.js distribution
#
# Usage: scripts/build-runtime.sh [darwin-arm64]

set -euo pipefail

TARGET="${1:-darwin-arm64}"
DEEPTUTOR_VERSION="${DEEPTUTOR_VERSION:-1.6.6}"
PYTHON_VERSION="${PYTHON_VERSION:-3.13}"
NODE_VERSION="${NODE_VERSION:-22.20.0}"

case "$TARGET" in
  darwin-arm64) NODE_ARCH=darwin-arm64 ;;
  darwin-x64)   NODE_ARCH=darwin-x64 ;;
  win32-x64)    NODE_ARCH=win-x64 ;;
  linux-x64)    NODE_ARCH=linux-x64 ;;
  *) echo "unsupported target: $TARGET" >&2; exit 2 ;;
esac

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/runtime/$TARGET"
UV_PYTHON_DIR="${UV_PYTHON_DIR:-$HOME/.local/share/uv/python}"

echo "==> runtime output: $OUT"
rm -rf "$OUT/python" "$OUT/node"
mkdir -p "$OUT"

# 1. Relocatable CPython from uv's python-build-standalone download.
#    从 uv 管理的 python-build-standalone 拷贝可重定位 CPython。
uv python install "$PYTHON_VERSION"
PYTHON_SRC="$(ls -d "$UV_PYTHON_DIR"/cpython-"$PYTHON_VERSION".*-macos-aarch64-none 2>/dev/null | sort | tail -1 || true)"
if [[ "$TARGET" != darwin-arm64 || -z "$PYTHON_SRC" ]]; then
  echo "cross-target python builds require uv on the target platform" >&2
  exit 3
fi
# -L: the uv listing may itself be a symlink chain; dereference it.
# -L: uv 目录项可能是符号链接, 需要解引用拷贝。
cp -RL "$PYTHON_SRC" "$OUT/python"
# We own this copy; drop uv's externally-managed guard so pip installs work.
# 该拷贝归本仓库构建所有, 移除 uv 的 externally-managed 标记。
rm -f "$OUT/python/lib/python3."*/EXTERNALLY-MANAGED

# 2. deeptutor wheel as a pinned external dependency.
#    以锁定版本的外部依赖形式安装 deeptutor wheel。
uv pip install --python "$OUT/python/bin/python3" "deeptutor==$DEEPTUTOR_VERSION"

# 3. Official Node.js distribution.
#    官方 Node.js 发行版。
curl -fsSL -o "$OUT/node.tar.gz" "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-$NODE_ARCH.tar.gz"
tar xzf "$OUT/node.tar.gz" -C "$OUT"
mv "$OUT/node-v$NODE_VERSION-$NODE_ARCH" "$OUT/node"
rm "$OUT/node.tar.gz"

du -sh "$OUT/python" "$OUT/node"
echo "==> done: $OUT"
