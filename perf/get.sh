#!/bin/sh

rm -rf perf/report.json
hurl --repeat 100 --verbose perf/get.hurl --variable BASE_URL=http://localhost:80 --report-json perf/report.json
jq '
def r2: ((.*100)|round)/100;

[.[].entries[].calls[].timings.total/1000]
| sort as $t
| {
  count: length,
  avg_ms: ((add/length) | r2),
  min_ms: (min | r2),
  max_ms: (max | r2),
  median_ms: ($t[(length/2|floor)] | r2),
  p95_ms: ($t[(length*0.95|floor)] | r2)
}
' perf/report.json/report.json