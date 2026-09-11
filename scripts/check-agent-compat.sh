#!/usr/bin/env bash
# Deterministic compatibility gates for a candidate upstream `deeptutor` release.
# 候选上游 `deeptutor` 版本的确定性兼容性门禁。
#
# The watch workflow (.github/workflows/watch-deeptutor.yml) runs this script
# before bumping the embedded agent version. Every gate is a plain shell check
# with a pass/fail exit code — no LLM or human judgment is involved, so a
# candidate version either satisfies all gates or stops the pipeline.
#
# watch workflow (.github/workflows/watch-deeptutor.yml) 在提升内嵌 agent
# 版本前运行本脚本。每道门禁都是退出码二值的普通 shell 检查 —— 不涉及任何
# 模型或人工判断, 候选版本要么通过全部门禁, 要么终止流水线。
#
# Gates / 门禁:
#   1. the version exists on PyPI and ships at least one wheel
#      (source-only releases cannot be pinned into the runtime);
#   2. the dependency set resolves for the shell's pinned base interpreter
#      (default 3.13). `uv pip install --dry-run` also enforces the wheel's
#      `Requires-Python` metadata, so an interpreter mismatch fails here too.
#
# Usage / 用法:
#   scripts/check-agent-compat.sh <version>     # e.g. scripts/check-agent-compat.sh 1.6.7
#   BASE_PYTHON=3.13 scripts/check-agent-compat.sh <version>
set -euo pipefail

VERSION="${1:?usage: check-agent-compat.sh <deeptutor-version>}"
BASE_PYTHON="${BASE_PYTHON:-3.13}"

for tool in curl jq uv; do
  command -v "$tool" >/dev/null || {
    echo "missing required tool: $tool" >&2
    exit 2
  }
done

echo "==> fetching PyPI metadata for deeptutor==${VERSION}"
META="$(curl -fsSL "https://pypi.org/pypi/deeptutor/${VERSION}/json")"

echo "==> gate 1: at least one wheel artifact on PyPI"
WHEELS="$(printf '%s' "$META" | jq -r '[.urls[] | select(.packagetype == "bdist_wheel")] | length')"
if [ "$WHEELS" -lt 1 ]; then
  echo "deeptutor==${VERSION} has no wheel on PyPI; source-only releases are not packaged" >&2
  exit 1
fi

echo "==> gate 2: dependency resolution dry-run on python ${BASE_PYTHON}"
# `uv pip` needs a target environment even for --dry-run, so resolve inside a
# throwaway venv. `uv venv --python 3.13` auto-installs the managed CPython.
# A resolution failure — including a `Requires-Python` conflict or an
# unsatisfiable dependency — exits non-zero and fails the gate.
# 即便 --dry-run, `uv pip` 也需要目标环境, 因此在一次性 venv 中解析。
# `uv venv --python 3.13` 会自动安装受管 CPython。解析失败 —— 包括
# `Requires-Python` 冲突或依赖不可满足 —— 都以非零退出, 门禁失败。
VENV="$(mktemp -d)/gate-venv"
trap 'rm -rf "$(dirname "$VENV")"' EXIT
uv venv --quiet --python "$BASE_PYTHON" "$VENV"
uv pip install --dry-run --python "$VENV/bin/python" "deeptutor==${VERSION}"

echo "==> all gates passed for deeptutor==${VERSION}"
