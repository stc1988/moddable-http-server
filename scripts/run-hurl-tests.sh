#!/bin/sh

HOST=${1:-localhost}

hurl --test --jobs 1 --color --variable BASE_URL=http://$HOST:80 tests/*.hurl
