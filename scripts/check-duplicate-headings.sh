#!/bin/bash

# Check for duplicate heading IDs in markdown files

echo "Checking for duplicate heading IDs..."
echo

has_duplicates=false

for file in ./content/**/*.md; do
  # Extract headings and convert to IDs using the same logic as our marked renderer
  ids=$(grep "^##" "$file" | sed 's/^#* //' | tr '[:upper:]' '[:lower:]' | sed 's/[^a-zA-Z0-9 -]//g' | tr ' ' '-')

  # Check for duplicates
  duplicates=$(echo "$ids" | sort | uniq -d)

  if [ -n "$duplicates" ]; then
    echo "❌ $file has duplicate heading IDs:"
    echo "$duplicates" | sed 's/^/   - /'
    echo
    has_duplicates=true
  fi
done

if [ "$has_duplicates" = false ]; then
  echo "✅ No duplicate heading IDs found!"
else
  echo "Fix the duplicate headings above to avoid React key errors."
fi
