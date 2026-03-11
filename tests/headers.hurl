# request header
GET {{BASE_URL}}/header
User-Agent: hurl-test-agent
HTTP 200
[Asserts]
body contains "hurl-test-agent"

# query parameter
GET {{BASE_URL}}/query?text=hello
HTTP 200
[Asserts]
body contains "hello"