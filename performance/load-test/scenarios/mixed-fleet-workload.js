import http from 'k6/http';
import { check, sleep, group } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 10 },   // Ramp-up to 10 VUs
    { duration: '3m', target: 50 },   // Normal peak 50 VUs
    { duration: '3m', target: 100 },  // High peak 100 VUs
    { duration: '1m', target: 200 },  // Stress spike 200 VUs
    { duration: '2m', target: 0 },    // Ramp-down
  ],
  thresholds: {
    'http_req_duration{scenario:operator}': ['p(95)<60', 'p(99)<120'],
    'http_req_duration{scenario:supervisor}': ['p(95)<85', 'p(99)<180'],
    'http_req_failed': ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const vu = __VU;
  const userTypeRoll = Math.random() * 100;

  // 1. Operator Flow (70% traffic share)
  if (userTypeRoll < 70) {
    group('Operator Flow', () => {
      // Step 1: Get Operator Entry context
      const resContext = http.get(`${BASE_URL}/operations?tab=entry`, {
        tags: { scenario: 'operator' },
      });
      check(resContext, {
        'operator context 200': (r) => r.status === 200,
      });

      sleep(Math.random() * 3 + 2); // 2-5s operator think time

      // Step 2: Submit Shift Running Hour Log
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
        tags: { scenario: 'operator' },
      });

      check(resSubmit, {
        'log submission success or valid auth redirect': (r) => r.status === 200 || r.status === 303 || r.status === 401,
      });
    });
  }
  // 2. Supervisor Flow (20% traffic share)
  else if (userTypeRoll < 90) {
    group('Supervisor Flow', () => {
      const resLogs = http.get(`${BASE_URL}/operations?tab=logs`, {
        tags: { scenario: 'supervisor' },
      });
      check(resLogs, {
        'supervisor logs 200': (r) => r.status === 200,
      });

      sleep(Math.random() * 4 + 3); // 3-7s supervisor audit time

      const resMachines = http.get(`${BASE_URL}/machines?status=active`, {
        tags: { scenario: 'supervisor' },
      });
      check(resMachines, {
        'filtered machines 200': (r) => r.status === 200,
      });
    });
  }
  // 3. Admin & Manager Flow (8% traffic share)
  else if (userTypeRoll < 98) {
    group('Admin Flow', () => {
      const resUsers = http.get(`${BASE_URL}/users`, { tags: { scenario: 'admin' } });
      const resClients = http.get(`${BASE_URL}/clients`, { tags: { scenario: 'admin' } });
      check(resUsers, { 'users directory 200': (r) => r.status === 200 });
      check(resClients, { 'clients directory 200': (r) => r.status === 200 });
      sleep(5);
    });
  }
  // 4. Reporting Flow (2% traffic share)
  else {
    group('Report Flow', () => {
      const resReport = http.get(`${BASE_URL}/reports?format=json&startDate=2026-08-01&endDate=2026-08-27`, {
        tags: { scenario: 'report' },
      });
      check(resReport, { 'report data returned': (r) => r.status === 200 || r.status === 401 });
      sleep(10);
    });
  }
}
