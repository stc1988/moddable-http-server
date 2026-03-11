# path parameter
GET {{BASE_URL}}/users/123
HTTP 200
[Asserts]
jsonpath "$.route" == "/users/:id"
jsonpath "$.id" == "123"

# trailing slash
GET {{BASE_URL}}/users/123/
HTTP 200
[Asserts]
jsonpath "$.id" == "123"

# wildcard route
GET {{BASE_URL}}/files/images/icons/logo.png
HTTP 200
[Asserts]
jsonpath "$.route" == "/files/*"
jsonpath "$.path" == "images/icons/logo.png"