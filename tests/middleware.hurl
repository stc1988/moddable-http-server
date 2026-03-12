# middleware smoke test
GET {{BASE_URL}}/json
HTTP 200
[Asserts]
jsonpath "$[0].title" == "Good Morning"

# middleware should not change status/body behavior
POST {{BASE_URL}}/post/json
Content-Type: application/json
{
  "name": "stackchan"
}
HTTP 200
[Asserts]
jsonpath "$.name" == "stackchan"
