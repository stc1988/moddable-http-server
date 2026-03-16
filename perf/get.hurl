GET {{BASE_URL}}/json
HTTP 200
[Asserts]
jsonpath "$[0].title" == "Good Morning"
jsonpath "$[3].title" == "Good Night"