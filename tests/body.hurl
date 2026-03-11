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
