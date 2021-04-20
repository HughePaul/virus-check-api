#!/bin/bash

FILENAME=$1

echo "test av scanner $FILENAME"

sleep 5

if grep virus "$FILENAME"; then
  echo "preamble"
  echo ">>> Virus 'TEST-VIRUS' found in file $FILENAME"
  echo "tail"
  exit 1
else
  echo "FILE OK"
  exit 0
fi
