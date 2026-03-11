#!/usr/bin/env bash

BASE_URL=${1:-http://localhost:80}

echo "======================================"
echo "Testing HttpServerService"
echo "BASE_URL: $BASE_URL"
echo "======================================"

echo
echo "1. GET /response"
curl -i "$BASE_URL/response"

echo
echo
echo "2. GET /header"
curl -i "$BASE_URL/header"

echo
echo
echo "3. GET /query"
curl -i "$BASE_URL/query?text=hello"

echo
echo
echo "4. GET /json"
curl -i "$BASE_URL/json"

echo
echo
echo "5. POST /post/text"
curl -i \
  -X POST \
  -H "Content-Type: text/plain" \
  --data "Hello Server" \
  "$BASE_URL/post/text"

echo
echo
echo "6. POST /post/json"
curl -i \
  -X POST \
  -H "Content-Type: application/json" \
  --data '{"name":"stackchan","message":"hello"}' \
  "$BASE_URL/post/json"

echo
echo
echo "7. POST /post/form"
curl -i \
  -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data "name=stackchan&age=4" \
  "$BASE_URL/post/form"
  
echo
echo
echo "8. GET /users/:id"
curl -i "$BASE_URL/users/123"

echo
echo
echo "9. GET /users/:id with trailing slash"
curl -i "$BASE_URL/users/123/"

echo
echo
echo "10. GET /files/*"
curl -i "$BASE_URL/files/images/icons/logo.png"

echo
echo
echo "11. HEAD request"
curl -i -X HEAD "$BASE_URL/json"

echo
echo
echo "12. OPTIONS request"
curl -i -X OPTIONS "$BASE_URL/json"

echo
echo
echo "13. Status 204"
curl -i "$BASE_URL/status/204"

echo
echo
echo "14. Status 304"
curl -i "$BASE_URL/status/304"

echo
echo "======================================"
echo "Done"
echo "======================================"
