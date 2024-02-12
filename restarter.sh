#!
trap 'kill $(jobs -p)' EXIT; until deno task start & wait; do
    echo "ldap proxy crashed with exit code $?. Respawning.." >&2
    sleep 1
done
