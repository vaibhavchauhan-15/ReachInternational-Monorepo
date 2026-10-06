#!/usr/bin/env bash
# Typography CI Guard
# Warn/fail if typography properties are set directly outside canonical tokens and primitives.

COUNT=$(grep -rnE "fontSize|fontFamily|fontWeight|lineHeight|letterSpacing" \
  apps/mobile/app apps/mobile/components apps/mobile/lib --include='*.ts' --include='*.tsx' 2>/dev/null \
  | grep -vE "components/ui/Text.tsx|lib/typography/" | wc -l)

echo "Found $COUNT typography property instances across apps/mobile."

if [ "$COUNT" -gt 0 ]; then
  echo "ERROR: $COUNT typography properties detected outside Text.tsx / lib/typography."
  exit 1
fi

echo "Typography check passed cleanly: 0 raw typography properties found."
exit 0
