import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '2m', target: 25 },
    { duration: '2m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<85', 'p(99)<180'],
    http_req_failed: ['rate<0.005'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // 1. Fetch Supervisor Logs Hub Stream
  const resLogs = http.get(`${BASE_URL}/operations?tab=logs`);
  check(resLogs, {
    'logs stream 200': (r) => r.status === 200 || r.status === 303,
  });

  sleep(Math.random() * 3 + 2); // 2-5s audit interval

  // 2. Filter Machine Inventory
  const resMachines = http.get(`${BASE_URL}/machines?status=active`);
  check(resMachines, {
    'machines filter 200': (r) => r.status === 200 || r.status === 303,
  });
}
