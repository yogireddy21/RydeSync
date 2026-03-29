import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const RIDER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5YzgzOTcyOTI0OWVlNzM5YjBhZjc5MSIsInJvbGUiOiJyaWRlciIsImlhdCI6MTc3NDc2MDc2OSwiZXhwIjoxNzc0NzYxNjY5fQ.xhhWHOQawdYjLsdJZv7C5SX7xquigbaoL-yPZh5WEeU';
const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5YzgzOTcyOTI0OWVlNzM5YjBhZjc5MSIsInJvbGUiOiJyaWRlciIsImlhdCI6MTc3NDc2MDc2OSwiZXhwIjoxNzc0NzYxNjY5fQ.xhhWHOQawdYjLsdJZv7C5SX7xquigbaoL-yPZh5WEeU';
const BASE_URL = 'http://localhost:3000';

const healthDuration = new Trend('health_duration');
const nearbyDuration = new Trend('nearby_duration');
const surgeDuration = new Trend('surge_duration');
const profileDuration = new Trend('profile_duration');
const overallSuccess = new Rate('overall_success');

export const options = {
  scenarios: {
    mixed: {
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
    overall_success: ['rate>0.95'],
    nearby_duration: ['p(95)<100'],
    surge_duration: ['p(95)<50'],
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  const rand = Math.random();

  if (rand < 0.4) {
    // 40% — Nearby driver search (most common)
    const lng = 78.48 + Math.random() * 0.04;
    const lat = 17.38 + Math.random() * 0.02;
    const res = http.get(
      `${BASE_URL}/api/v1/driver/nearby?longitude=${lng}&latitude=${lat}`,
      { headers: { Authorization: `Bearer ${RIDER_TOKEN}` } }
    );
    nearbyDuration.add(res.timings.duration);
    overallSuccess.add(res.status === 200);
    check(res, { 'nearby 200': (r) => r.status === 200 });

  } else if (rand < 0.7) {
    // 30% — Surge check
    const lng = 78.35 + Math.random() * 0.2;
    const lat = 17.38 + Math.random() * 0.1;
    const res = http.get(
      `${BASE_URL}/api/v1/surge/check?longitude=${lng}&latitude=${lat}`,
      { headers: { Authorization: `Bearer ${RIDER_TOKEN}` } }
    );
    surgeDuration.add(res.timings.duration);
    overallSuccess.add(res.status === 200);
    check(res, { 'surge 200': (r) => r.status === 200 });

  } else if (rand < 0.85) {
    // 15% — Profile check
    const res = http.get(`${BASE_URL}/api/v1/auth/profile`, {
      headers: { Authorization: `Bearer ${RIDER_TOKEN}` },
    });
    profileDuration.add(res.timings.duration);
    overallSuccess.add(res.status === 200);
    check(res, { 'profile 200': (r) => r.status === 200 });

  } else {
    // 15% — Health check
    const res = http.get(`${BASE_URL}/health`);
    healthDuration.add(res.timings.duration);
    overallSuccess.add(res.status === 200);
    check(res, { 'health 200': (r) => r.status === 200 });
  }

  sleep(0.05);
}