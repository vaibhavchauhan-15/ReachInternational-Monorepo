import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '2m', target: 50 },
    { duration: '1m', target: 100 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<50', 'p(99)<120'],
    http_req_failed: ['rate<0.001'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const vu = __VU;

  // 1. Fetch Operator Entry Context
  const resContext = http.get(`${BASE_URL}/operations?tab=entry`);
  check(resContext, {
    'context status is 200': (r) => r.status === 200 || r.status === 303,
  });

  sleep(Math.random() * 2 + 1); // 1-3s think time

  // 2. Submit Shift Running Hour Log
  const payload = JSON.stringify({
    machineId: '00000000-0000-0000-0000-000000000001',
    operatorId: `00000000-0000-0000-0000-${String(vu).padStart(12, '0')}`,
    startMeter: 1200.0,
    endMeter: 1208.5,
    startTime: '06:00 AM',
    endTime: '02:00 PM',
    shift: 'morning',
    isBreakdown: false,
    idempotencyKey: `idemp-loadtest-${vu}-${Date.now()}`,
  });

  const resSubmit = http.post(`${BASE_URL}/api/operations/submit-log`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(resSubmit, {
    'submission handled': (r) => r.status === 200 || r.status === 303 || r.status === 401,
  });
}
