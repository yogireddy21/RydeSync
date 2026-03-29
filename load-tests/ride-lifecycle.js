import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';

const BASE_URL = 'http://localhost:3000';

const rideRequestDuration = new Trend('ride_request_duration');
const rideAcceptDuration = new Trend('ride_accept_duration');
const rideCompleteDuration = new Trend('ride_complete_duration');
const ridesCompleted = new Counter('rides_completed');

export const options = {
  scenarios: {
    rides: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 10 },
        { duration: '40s', target: 50 },
        { duration: '10s', target: 0 },
      ],
    },
  },
  thresholds: {
    ride_request_duration: ['p(95)<500', 'avg<200'],
    http_req_failed: ['rate<0.3'],
  },
};

export default function () {
  const id = `${__VU}_${__ITER}_${Date.now()}`;

  // Register rider
  const riderRes = http.post(
    `${BASE_URL}/api/v1/auth/register`,
    JSON.stringify({
      name: `Ride Rider ${id}`,
      email: `ride_rider_${id}@test.com`,
      phone: `${Math.floor(6000000000 + Math.random() * 3999999999)}`,
      password: 'Test@1234',
      role: 'rider',
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  if (riderRes.status !== 201) return;
  const riderToken = JSON.parse(riderRes.body).data.accessToken;

  // Register driver
  const driverRes = http.post(
    `${BASE_URL}/api/v1/auth/register`,
    JSON.stringify({
      name: `Ride Driver ${id}`,
      email: `ride_driver_${id}@test.com`,
      phone: `${Math.floor(6000000000 + Math.random() * 3999999999)}`,
      password: 'Test@1234',
      role: 'driver',
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  if (driverRes.status !== 201) return;
  const driverToken = JSON.parse(driverRes.body).data.accessToken;

  // Driver online
  const lng = 78.48 + Math.random() * 0.04;
  const lat = 17.38 + Math.random() * 0.02;

  http.post(
    `${BASE_URL}/api/v1/driver/online`,
    JSON.stringify({ longitude: lng, latitude: lat }),
    { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${driverToken}` } }
  );

  sleep(0.5);

  // Request ride
  const reqRes = http.post(
    `${BASE_URL}/api/v1/rides/request`,
    JSON.stringify({
      pickupCoords: [lng, lat],
      destinationCoords: [lng + 0.02, lat + 0.01],
      pickupAddress: 'Point A',
      destinationAddress: 'Point B',
    }),
    { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${riderToken}` } }
  );

  rideRequestDuration.add(reqRes.timings.duration);

  if (reqRes.status !== 201) return;

  const ride = JSON.parse(reqRes.body).data;
  const rideId = ride._id;

  check(reqRes, {
    'ride requested': (r) => r.status === 201,
    'ride matched': () => ride.status === 'MATCHED',
    'request < 300ms': (r) => r.timings.duration < 300,
  });

  // Driver accepts
  const acceptRes = http.post(
    `${BASE_URL}/api/v1/rides/${rideId}/respond`,
    JSON.stringify({ accept: true }),
    { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${driverToken}` } }
  );

  rideAcceptDuration.add(acceptRes.timings.duration);

  check(acceptRes, {
    'ride accepted': (r) => r.status === 200,
  });

  if (acceptRes.status !== 200) return;

  // Driver arrived
  http.patch(
    `${BASE_URL}/api/v1/rides/${rideId}/status`,
    JSON.stringify({ status: 'DRIVER_ARRIVED' }),
    { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${driverToken}` } }
  );

  // Start ride
  http.patch(
    `${BASE_URL}/api/v1/rides/${rideId}/status`,
    JSON.stringify({ status: 'IN_PROGRESS' }),
    { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${driverToken}` } }
  );

  sleep(1);

  // Complete ride
  const completeRes = http.patch(
    `${BASE_URL}/api/v1/rides/${rideId}/status`,
    JSON.stringify({ status: 'COMPLETED' }),
    { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${driverToken}` } }
  );

  rideCompleteDuration.add(completeRes.timings.duration);

  check(completeRes, {
    'ride completed': (r) => r.status === 200,
    'complete < 500ms': (r) => r.timings.duration < 500,
  });

  if (completeRes.status === 200) {
    ridesCompleted.add(1);
  }

  sleep(0.5);
}