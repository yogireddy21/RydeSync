import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const BASE_URL = 'http://localhost:3000';

const loginDuration = new Trend('login_duration');
const registerDuration = new Trend('register_duration');
const profileDuration = new Trend('profile_duration');

export const options = {
  scenarios: {
    auth_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 50 },
        { duration: '30s', target: 200 },
        { duration: '20s', target: 500 },
        { duration: '10s', target: 0 },
      ],
    },
  },
  thresholds: {
    login_duration: ['p(95)<500', 'avg<300'],
    profile_duration: ['p(95)<50', 'avg<20'],
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  const id = `${__VU}_${__ITER}_${Date.now()}`;

  // Register
  const regRes = http.post(
    `${BASE_URL}/api/v1/auth/register`,
    JSON.stringify({
      name: `Stress User ${id}`,
      email: `stress_${id}@test.com`,
      phone: `${Math.floor(6000000000 + Math.random() * 3999999999)}`,
      password: 'Test@1234',
      role: 'rider',
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  if (regRes.status === 201) {
    registerDuration.add(regRes.timings.duration);
  }

  check(regRes, {
    'register 201': (r) => r.status === 201,
    'register < 500ms': (r) => r.timings.duration < 500,
  });

  if (regRes.status !== 201) return;

  const email = JSON.parse(regRes.body).data.user.email;

  // Login
  const loginRes = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ email, password: 'Test@1234' }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  loginDuration.add(loginRes.timings.duration);

  check(loginRes, {
    'login 200': (r) => r.status === 200,
    'login < 500ms': (r) => r.timings.duration < 500,
    'has token': (r) => JSON.parse(r.body).data.accessToken !== undefined,
  });

  const token = JSON.parse(loginRes.body).data.accessToken;

  // Profile (JWT verification speed)
  const profileRes = http.get(`${BASE_URL}/api/v1/auth/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  profileDuration.add(profileRes.timings.duration);

  check(profileRes, {
    'profile 200': (r) => r.status === 200,
    'profile < 50ms': (r) => r.timings.duration < 50,
  });

  sleep(0.2);
}