# middleware smoke test
GET {{BASE_URL}}/json
HTTP 200
[Asserts]
header "X-Powered-By" == "moddable-http-server"
jsonpath "$[0].title" == "Good Morning"

# middleware should also apply to raw Response returns
GET {{BASE_URL}}/response
HTTP 201
[Asserts]
header "X-Powered-By" == "moddable-http-server"
body == "Thank you for coming"

# middleware should not change status/body behavior
POST {{BASE_URL}}/post/json
Content-Type: application/json
{
  "name": "stackchan"
}
HTTP 200
[Asserts]
header "X-Powered-By" == "moddable-http-server"
jsonpath "$.name" == "stackchan"
