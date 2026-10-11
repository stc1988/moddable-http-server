# json body
POST {{BASE_URL}}/post/json
Content-Type: application/json
{
  "name": "stackchan",
  "message": "hello"
}

HTTP 200
[Asserts]
jsonpath "$.name" == "stackchan"
jsonpath "$.message" == "hello"

# binary body
POST {{BASE_URL}}/post/binary
Content-Type: application/octet-stream
`hello`
HTTP 200
[Asserts]
body == "bytes: 5, text: hello"

# Supplementary characters survive request decoding and response encoding.
POST {{BASE_URL}}/post/text
Content-Type: text/plain
`こんにちは🌍`
HTTP 201
[Asserts]
jsonpath "$.message" == "こんにちは🌍 received!"

POST {{BASE_URL}}/post/json
Content-Type: application/json
{"message":"こんにちは🌍"}
HTTP 200
[Asserts]
jsonpath "$.message" == "こんにちは🌍"

POST {{BASE_URL}}/post/binary
Content-Type: application/octet-stream
`こんにちは🌍`
HTTP 200
[Asserts]
body == "bytes: 19, text: こんにちは🌍"

POST {{BASE_URL}}/post/form
[Form]
message: こんにちは🌍
HTTP 200
[Asserts]
body == "form: {\"message\":\"こんにちは🌍\"}"

# Empty request bodies keep their existing null result.
POST {{BASE_URL}}/post/text
Content-Length: 0
HTTP 201
[Asserts]
jsonpath "$.message" == "null received!"

POST {{BASE_URL}}/post/json
Content-Length: 0
HTTP 200
[Asserts]
body == "null"
