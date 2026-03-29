import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const RIDER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5YzgzOTcyOTI0OWVlNzM5YjBhZjc5MSIsInJvbGUiOiJyaWRlciIsImlhdCI6MTc3NDc2MDc2OSwiZXhwIjoxNzc0NzYxNjY5fQ.xhhWHOQawdYjLsdJZv7C5SX7xquigbaoL-yPZh5WEeU';
const BASE_URL = 'http://localhost:3000';

const surgeDuration = new Trend('surge_check_duration');

export const options = {
  scenarios: {
    surge_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 200 },
        { duration: '30s', target: 1000 },
        { duration: '20s', target: 2000 },
        { duration: '10s', target: 0 },
      ],
    },
  },
  thresholds: {
    surge_check_duration: ['p(95)<50', 'p(99)<100', 'avg<20'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const zones = [
    { lng: 78.4867, lat: 17.3850 },
    { lng: 78.3816, lat: 17.4435 },
    { lng: 78.4070, lat: 17.4325 },
    { lng: 78.3498, lat: 17.4401 },
    { lng: 78.4483, lat: 17.4375 },
    { lng: 78.5014, lat: 17.4399 },
  ];

  const zone = zones[Math.floor(Math.random() * zones.length)];
  const lng = zone.lng + (Math.random() - 0.5) * 0.02;
  const lat = zone.lat + (Math.random() - 0.5) * 0.01;

  const res = http.get(
    `${BASE_URL}/api/v1/surge/check?longitude=${lng}&latitude=${lat}`,
    { headers: { Authorization: `Bearer ${RIDER_TOKEN}` } }
  );

  surgeDuration.add(res.timings.duration);

  check(res, {
    'status 200': (r) => r.status === 200,
    '< 10ms': (r) => r.timings.duration < 10,
    '< 25ms': (r) => r.timings.duration < 25,
    '< 50ms': (r) => r.timings.duration < 50,
    'has multiplier': (r) => {
      try { return JSON.parse(r.body).data.multiplier >= 1; }
      catch (e) { return false; }
    },
  });

  sleep(0.02);
}