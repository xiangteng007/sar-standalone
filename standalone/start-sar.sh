#!/bin/sh
exec "${SAR_NODE_EXE:-node}" "$(dirname "$0")/launch.mjs" "$@"
