# HEAD request
HEAD {{BASE_URL}}/json
HTTP 200

# OPTIONS request
OPTIONS {{BASE_URL}}/json
HTTP 204
[Asserts]
header "Allow" == "GET, HEAD, OPTIONS"

# OPTIONS for unknown path
OPTIONS {{BASE_URL}}/no-route
HTTP 204
[Asserts]
header "Allow" == "OPTIONS"

# 405 method not allowed
POST {{BASE_URL}}/json
HTTP 405
[Asserts]
header "Allow" == "GET, HEAD, OPTIONS"
body == "Method Not Allowed"

# status 204
GET {{BASE_URL}}/status/204
HTTP 204

# status 304
GET {{BASE_URL}}/status/304
HTTP 304
