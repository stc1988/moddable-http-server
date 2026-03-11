GET {{BASE_URL}}/response
HTTP 201
[Asserts]
header "X-Message" == "Hello"
body == "Thank you for coming"

GET {{BASE_URL}}/json
HTTP 200
[Asserts]
jsonpath "$[0].title" == "Good Morning"
jsonpath "$[3].title" == "Good Night"