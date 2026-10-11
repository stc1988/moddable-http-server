# Each limiter instance shares a fixed window across its matching paths.
GET {{BASE_URL}}/limited/hello
[Options]
delay: 1100
HTTP 200

GET {{BASE_URL}}/limited/hello/
HTTP 200

GET {{BASE_URL}}/limited/hello
HTTP 429
[Asserts]
header "Retry-After" == "1"
body == "Too Many Requests"

GET {{BASE_URL}}/response/default
HTTP 200

GET {{BASE_URL}}/limited/hello
[Options]
delay: 1100
HTTP 200

# Missing routes still run the matching middleware and consume the budget.
GET {{BASE_URL}}/limited/missing
HTTP 404

GET {{BASE_URL}}/limited/hello
HTTP 429

POST {{BASE_URL}}/validated/hello
Content-Type: application/json; charset=utf-8
{"name":"利用者🌍"}
HTTP 200
[Asserts]
jsonpath "$.name" == "利用者🌍"

POST {{BASE_URL}}/validated/hello/
Content-Type: application/json
{"name":"ok"}
HTTP 200

POST {{BASE_URL}}/validated/hello
Content-Type: text/plain
`{"name":"ok"}`
HTTP 415

POST {{BASE_URL}}/validated/hello
Content-Type: application/json
`{broken`
HTTP 400

POST {{BASE_URL}}/validated/hello
Content-Type: application/json
Content-Length: 0
HTTP 400

POST {{BASE_URL}}/validated/hello
Content-Type: application/json
{"name":42}
HTTP 400

POST {{BASE_URL}}/validated/hello
Content-Type: application/json
{}
HTTP 400

POST {{BASE_URL}}/validated/hello
Content-Type: application/json
{"name":""}
HTTP 400

POST {{BASE_URL}}/validated/hello
Content-Type: application/json
`null`
HTTP 400

POST {{BASE_URL}}/validated/hello
Content-Type: application/json
{"name":"12345678901234567890123456789012"}
HTTP 200

POST {{BASE_URL}}/validated/hello
Content-Type: application/json
{"name":"123456789012345678901234567890123"}
HTTP 400
