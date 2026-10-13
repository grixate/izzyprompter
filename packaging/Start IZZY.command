#!/bin/sh
set -eu
if [ "$(/usr/bin/uname -s)" != Darwin ] || [ "$(/usr/bin/uname -m)" != arm64 ]; then
  echo 'This IZZY package requires an Apple Silicon Mac. No server was started.' >&2
  exit 1
fi
package_dir=$(CDPATH= cd -- "$(/usr/bin/dirname -- "$0")" && pwd)
# Use only the included launcher/runtime and OS tools, not Homebrew or npm.
unset NODE_OPTIONS NODE_PATH ERL_LIBS ERL_FLAGS ERL_AFLAGS ERL_ZFLAGS
exec /usr/bin/env PATH=/usr/bin:/bin:/usr/sbin:/sbin \
  IZZY_RELEASE_DIR="$package_dir/release" IZZY_OPEN_BROWSER=1 \
  "$package_dir/runtime/node" "$package_dir/scripts/local.mjs" "$@"
