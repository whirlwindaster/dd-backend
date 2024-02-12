#!
trap 'kill $(jobs -p)' EXIT; until deno task start & wait; do
    echo "server crashed with exit code $?. restarting..." >&2
    sleep 5
done
