import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

const RIDER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5YzgzOTcyOTI0OWVlNzM5YjBhZjc5MSIsInJvbGUiOiJyaWRlciIsImlhdCI6MTc3NDc2MDc2OSwiZXhwIjoxNzc0NzYxNjY5fQ.xhhWHOQawdYjLsdJZv7C5SX7xquigbaoL-yPZh5WEeU';
const BASE_URL = 'http://localhost:3000';

const geosearchDuration = new Trend('geosearch_duration');
const geosearchSuccess = new Rate('geosearch_success');
const geosearchTotal = new Counter('geosearch_total');

export const options = {
  scenarios: {
    ramp_up: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '15s', target: 100 },
        { duration: '30s', target: 500 },
        { duration: '30s', target: 1000 },
        { duration: '15s', target: 0 },
      ],
    },
  },
  thresholds: {
    geosearch_duration: ['p(95)<100', 'p(99)<200', 'avg<50'],
    geosearch_success: ['rate>0.99'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const lng = 78.48 + Math.random() * 0.04;
  const lat = 17.38 + Math.random() * 0.02;

  const res = http.get(
    `${BASE_URL}/api/v1/driver/nearby?longitude=${lng}&latitude=${lat}&radius=5&count=5`,
    { headers: { Authorization: `Bearer ${RIDER_TOKEN}` } }
  );

  const success = res.status === 200;
  geosearchDuration.add(res.timings.duration);
  geosearchSuccess.add(success);
  geosearchTotal.add(1);

  check(res, {
    'status 200': (r) => r.status === 200,
    '< 10ms': (r) => r.timings.duration < 10,
    '< 25ms': (r) => r.timings.duration < 25,
    '< 50ms': (r) => r.timings.duration < 50,
    '< 100ms': (r) => r.timings.duration < 100,
    'found drivers': (r) => {
      try { return JSON.parse(r.body).data.length > 0; }
      catch (e) { return false; }
    },
  });

  sleep(0.05);
}