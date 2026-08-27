import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '5m', target: 50 },    // Ramp up to 50 VUs
    { duration: '3h50m', target: 50 }, // Sustain 50 VUs for nearly 4 hours
    { duration: '5m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<75'],
    http_req_failed: ['rate<0.001'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const vu = __VU;
  const resContext = http.get(`${BASE_URL}/operations?tab=logs`);
  check(resContext, { 'status is 200': (r) => r.status === 200 || r.status === 303 });
  sleep(Math.random() * 5 + 3);
}
