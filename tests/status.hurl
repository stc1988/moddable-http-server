# HEAD request
HEAD {{BASE_URL}}/json
HTTP 200

# OPTIONS request
OPTIONS {{BASE_URL}}/json
HTTP 204

# status 204
GET {{BASE_URL}}/status/204
HTTP 204

# status 304
GET {{BASE_URL}}/status/304
HTTP 304