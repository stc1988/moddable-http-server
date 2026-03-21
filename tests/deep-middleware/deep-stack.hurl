GET {{BASE_URL}}/deep-stack/ok
HTTP 200
[Asserts]
jsonpath "$.message" == "deep middleware ok"
jsonpath "$.path" == "/deep-stack/ok"
