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

# basic auth middleware should reject missing credentials
GET {{BASE_URL}}/private/secret
HTTP 401
[Asserts]
header "WWW-Authenticate" == "Basic realm=\"Example\""
body == "Unauthorized"

# basic auth middleware should allow valid credentials
GET {{BASE_URL}}/private/secret
Authorization: Basic YWRtaW46c2VjcmV0
HTTP 200
[Asserts]
header "X-Powered-By" == "moddable-http-server"
jsonpath "$.message" == "Authenticated"
jsonpath "$.user" == "admin"

# UTF-8 credentials, including supplementary characters.
GET {{BASE_URL}}/unicode-private/secret
Authorization: Basic 5Yip55So6ICF8J+MjTrnp5jlr4bwn5SR
HTTP 200
[Asserts]
body == "Authenticated"

# Existing whitespace normalization is retained.
GET {{BASE_URL}}/private/secret
Authorization: Basic YWRt aW46 c2Vj cmV0
HTTP 200

# Invalid characters and incomplete Base64 must be rejected.
GET {{BASE_URL}}/private/secret
Authorization: Basic !!!!
HTTP 401

GET {{BASE_URL}}/private/secret
Authorization: Basic YWRtaW46c2VjcmV
HTTP 401

GET {{BASE_URL}}/private/secret
[BasicAuth]
admin: wrong
HTTP 401
