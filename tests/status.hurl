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

# custom 404 handler
GET {{BASE_URL}}/no-route
HTTP 404
[Asserts]
jsonpath "$.error" == "Not Found"
jsonpath "$.path" == "/no-route"

# 405 method not allowed
POST {{BASE_URL}}/json
HTTP 405
[Asserts]
header "Allow" == "GET, HEAD, OPTIONS"
jsonpath "$.error" == "Method Not Allowed"
jsonpath "$.allow[0]" == "GET"
jsonpath "$.allow[1]" == "HEAD"
jsonpath "$.allow[2]" == "OPTIONS"

# status 204
GET {{BASE_URL}}/status/204
HTTP 204

# status 304
GET {{BASE_URL}}/status/304
HTTP 304

# redirect helper
GET {{BASE_URL}}/redirect
HTTP 302
[Asserts]
header "Location" == "/json"

# redirect helper respects c.status
GET {{BASE_URL}}/redirect/307
HTTP 307
[Asserts]
header "Location" == "/json"

# custom 500 handler
GET {{BASE_URL}}/error
HTTP 500
[Asserts]
jsonpath "$.error" == "Internal Server Error"
