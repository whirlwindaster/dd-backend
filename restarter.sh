#!/bin/bash
until deno task start; do
    echo "server crashed with exit code $?. restarting..." >&2
    sleep 5
done
