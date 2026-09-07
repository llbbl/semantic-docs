#!/usr/bin/env bash
#
# Decides the next release version from commit subjects since the last tag.
#
# Usage:  git log <tag>..HEAD --pretty=format:%s | next-version.sh <latest-tag> [allow-major]
# Output: version=X.Y.Z / bump=major|minor|patch / suppressed_major=true|false
#         (key=value lines, appendable straight to $GITHUB_OUTPUT)
#
# Major bumps are opt-in. This project does not follow strict semver: a
# breaking-change marker produces a minor, and majors are cut deliberately by
# a human running the release workflow with allow-major set.

set -euo pipefail

latest_tag="${1:-v0.0.0}"
allow_major="${2:-false}"

version="${latest_tag#v}"
IFS='.' read -r major minor patch <<<"$version"

major=${major:-0}
minor=${minor:-0}
patch=${patch:-0}

commits=$(cat)

# Subjects only, matching what the workflow pipes in; a BREAKING CHANGE footer
# in a commit body is not seen here and never was.
breaking_re='^feat(\(.+\))?!:|^fix(\(.+\))?!:|^refactor(\(.+\))?!:|BREAKING CHANGE'
feature_re='^feat(\(.+\))?:'

suppressed_major=false

if printf '%s\n' "$commits" | grep -qE "$breaking_re"; then
  if [ "$allow_major" = "true" ]; then
    bump='major'
    major=$((major + 1))
    minor=0
    patch=0
  else
    bump='minor'
    suppressed_major=true
    minor=$((minor + 1))
    patch=0
  fi
elif printf '%s\n' "$commits" | grep -qE "$feature_re"; then
  bump='minor'
  minor=$((minor + 1))
  patch=0
else
  bump='patch'
  patch=$((patch + 1))
fi

echo "version=${major}.${minor}.${patch}"
echo "bump=${bump}"
echo "suppressed_major=${suppressed_major}"
