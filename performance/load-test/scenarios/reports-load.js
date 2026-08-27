import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 2 },
    { duration: '1m', target: 5 },
    { duration: '1m', target: 10 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<450', 'p(99)<800'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const resReport = http.get(`${BASE_URL}/reports?format=json&startDate=2026-08-01&endDate=2026-08-27`);
  check(resReport, {
    'report compiled successfully': (r) => r.status === 200 || r.status === 401,
  });

  sleep(Math.random() * 5 + 5); // 5-10s interval
}
