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
