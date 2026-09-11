#!/usr/bin/env bash
# Build the embedded DeepTutor runtime for one target platform.
# 构建单个目标平台的内嵌 DeepTutor runtime。
#
# Inputs are pinned, external, versioned dependencies — no upstream source is
# copied into this repository (see docs/adr/0003-embedded-web-stack.md):
#   - python-build-standalone CPython (via uv's managed downloads)
#   - deeptutor==<DEEPTUTOR_VERSION> from PyPI (wheel, includes deeptutor_web)
#   - Node.js official binary archive
#
# Output layout (consumed by tauri.conf.json `bundle.resources`):
#   runtime/current/python/   relocatable CPython + deeptutor + deps
#   runtime/current/node/     official Node.js distribution
#
# The canonical platform directory (runtime/<target>/) is kept for inspection;
# `runtime/current` is what the bundle packs and must exist before `pnpm build`.
#
# Run on a runner matching the target platform/architecture. Supported targets:
#   darwin-arm64 | darwin-x64 | linux-x64 | win32-x64
#
# 构建输入均为锁定版本的外部依赖, 不拷贝上游源码 (见
# docs/adr/0003-embedded-web-stack.md)。需要在目标平台/架构一致的机器上运行。
# 规范目录 runtime/<target>/ 保留供检查; 实际打包读取 runtime/current。

set -euo pipefail

DEEPTUTOR_VERSION="${DEEPTUTOR_VERSION:-1.6.7}"
PYTHON_VERSION="${PYTHON_VERSION:-3.13}"
NODE_VERSION="${NODE_VERSION:-22.20.0}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# ---- Detect host platform and map it to a target id ----------------------
# 探测宿主平台并映射为目标标识。显式传入目标时跳过探测: Git Bash 的
# uname -s 会带上 -x86_64 后缀 (如 MINGW64_NT-10.0-26100-x86_64), 且 CI
# 总是运行在与目标一致的 runner 上, 无需依赖宿主探测。
# Skip host detection when a target is passed explicitly: Git Bash's uname -s
# carries an -x86_64 suffix (e.g. MINGW64_NT-10.0-26100-x86_64), and CI always
# runs on a runner matching the target anyway.
if [ -n "${1:-}" ]; then
  TARGET="$1"
else
  OS="$(uname -s)"
  ARCH="$(uname -m)"
  case "$OS-$ARCH" in
    Darwin-arm64) DEFAULT_TARGET=darwin-arm64 ;;
    Darwin-x86_64|Darwin-x64) DEFAULT_TARGET=darwin-x64 ;;
    Linux-x86_64) DEFAULT_TARGET=linux-x64 ;;
    # Accept both AMD64 and x86_64: MSYS2 reports either depending on version.
    # 同时接受 AMD64 与 x86_64: 不同版本 MSYS2 二者皆可能返回。
    MINGW*-AMD64|MINGW*-x86_64|MSYS*-AMD64|MSYS*-x86_64|CYGWIN*-AMD64|CYGWIN*-x86_64) DEFAULT_TARGET=win32-x64 ;;
    *)
      echo "unsupported host: $OS-$ARCH (pass an explicit target if confident)" >&2
      exit 2
      ;;
  esac
  TARGET="$DEFAULT_TARGET"
fi

# Mapping tables: uv/python-build-standalone triples and Node archives.
# 映射表: uv/python-build-standalone triple 与 Node 发行包。
case "$TARGET" in
  darwin-arm64)
    UV_TRIPLE=macos-aarch64-none;    NODE_ARCH=darwin-arm64; NODE_EXT=tar.gz ;;
  darwin-x64)
    UV_TRIPLE=macos-x86_64-none;     NODE_ARCH=darwin-x64;   NODE_EXT=tar.gz ;;
  linux-x64)
    UV_TRIPLE=linux-x86_64-gnu;      NODE_ARCH=linux-x64;    NODE_EXT=tar.xz ;;
  win32-x64)
    UV_TRIPLE=windows-x86_64-none;   NODE_ARCH=win-x64;      NODE_EXT=zip ;;
  *) echo "unsupported target: $TARGET" >&2; exit 2 ;;
esac

# Windows CI runners expose bash via Git for Windows; use it transparently.
is_windows() { [[ "$TARGET" == win32-* ]]; }

echo "==> target: $TARGET (deeptutor=$DEEPTUTOR_VERSION python=$PYTHON_VERSION node=$NODE_VERSION)"
OUT="$ROOT/runtime/$TARGET"
CURRENT="$ROOT/runtime/current"
rm -rf "$OUT"
mkdir -p "$OUT"

# ---- 1. Relocatable CPython from uv's python-build-standalone download ----
# 从 uv 管理的 python-build-standalone 拷贝可重定位 CPython。
uv python install "$PYTHON_VERSION"
# uv's install root is platform-specific (~/.local/share/uv/python on Unix,
# %APPDATA%\uv\python on Windows) — ask uv instead of hard-coding a path.
# uv 的安装根目录随平台不同 (Unix 为 ~/.local/share/uv/python, Windows 为
# %APPDATA%\uv\python), 直接向 uv 查询而非硬编码路径。
UV_PYTHON_DIR="${UV_PYTHON_DIR:-$(uv python dir)}"
# The listing entry may be a symlink (e.g. cpython-3.13 -> cpython-3.13.x);
# pick the newest matching triple and dereference on copy (-L). ls exits 2
# when nothing matches, so swallow that to reach the friendly error below.
# 目录项可能是符号链接 (如 cpython-3.13 -> cpython-3.13.x); 选取最新匹配的
# triple, 拷贝时解引用 (-L)。无匹配时 ls 以码 2 退出, 吞掉以走到下方报错。
PYTHON_SRC="$(ls -d "$UV_PYTHON_DIR"/cpython-"$PYTHON_VERSION".*-"$UV_TRIPLE" 2>/dev/null | sort -V | tail -1 || true)"
if [ -z "$PYTHON_SRC" ]; then
  echo "no uv-managed python for $UV_TRIPLE under $UV_PYTHON_DIR; is this runner the right arch?" >&2
  exit 3
fi
echo "==> python: $PYTHON_SRC"
# python-build-standalone install-only archives nest a top-level python/
# directory on Windows; uv flattens it on Unix. Handle both layouts.
# python-build-standalone 的 install-only 包在 Windows 下嵌套顶层 python/
# 目录, Unix 下被 uv 展平。两种布局都兼容。
PY_ROOT="$PYTHON_SRC"
if is_windows && [ -d "$PYTHON_SRC/python" ]; then
  PY_ROOT="$PYTHON_SRC/python"
fi
cp -RL "$PY_ROOT" "$OUT/python"
# We own this copy; drop uv's externally-managed guard so pip installs work.
# Unix stores the marker in lib/python3.x/, Windows in Lib/.
# 该拷贝归本仓库构建所有, 移除 uv 的 externally-managed 标记。
# Unix 下标记位于 lib/python3.x/, Windows 下位于 Lib/。
rm -f "$OUT"/python/lib/python3.*/EXTERNALLY-MANAGED "$OUT"/python/Lib/EXTERNALLY-MANAGED

# Windows interpreters live at the install root, Unix ones under bin/.
# Windows 解释器位于安装根目录, Unix 的位于 bin/ 下。
PYTHON_BIN="$OUT/python/bin/python3"
is_windows && PYTHON_BIN="$OUT/python/python.exe"

# ---- 2. deeptutor wheel as a pinned external dependency -------------------
# 以锁定版本的外部依赖形式安装 deeptutor wheel。
uv pip install --python "$PYTHON_BIN" "deeptutor==$DEEPTUTOR_VERSION"

# ---- 3. Official Node.js distribution ------------------------------------
# 官方 Node.js 发行版。
NODE_ARCHIVE="node-v$NODE_VERSION-$NODE_ARCH.$NODE_EXT"
echo "==> node: $NODE_ARCHIVE"
curl -fsSL -o "$OUT/$NODE_ARCHIVE" "https://nodejs.org/dist/v$NODE_VERSION/$NODE_ARCHIVE"
if is_windows; then
  # unzip ships with GitHub Windows runners; fall back to powershell.
  # Windows runner 自带 unzip; 缺失时回退 powershell。
  unzip -q "$OUT/$NODE_ARCHIVE" -d "$OUT" \
    || powershell -NoProfile -Command "Expand-Archive -Force '$OUT/$NODE_ARCHIVE' '$OUT'"
  mv "$OUT/node-v$NODE_VERSION-$NODE_ARCH" "$OUT/node"
else
  tar xf "$OUT/$NODE_ARCHIVE" -C "$OUT"
  mv "$OUT/node-v$NODE_VERSION-$NODE_ARCH" "$OUT/node"
fi
rm -f "$OUT/$NODE_ARCHIVE"

# ---- 4. Publish the uniform path consumed by tauri.conf.json -------------
# 生成 tauri.conf.json 引用的统一路径 runtime/current。
rm -rf "$CURRENT"
# Use Git Bash cp on Windows too: PowerShell's Copy-Item cannot consume the
# POSIX-style paths (/d/a/...) this script produces.
# Windows 下同样用 Git Bash 的 cp: PowerShell 的 Copy-Item 无法解析本脚本
# 生成的 POSIX 风格路径 (/d/a/...)。
cp -RL "$OUT" "$CURRENT"

du -sh "$OUT/python" "$OUT/node" "$CURRENT"
echo "==> done: $CURRENT (from $OUT)"
