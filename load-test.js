import http from 'k6/http';
import { sleep } from 'k6';

const BASE_URL = 'http://34.129.236.248';

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '60s', target: 10 },
    { duration: '30s', target: 50 },
    { duration: '60s', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  http.get(`${BASE_URL}/`);
  http.get(`${BASE_URL}/api/auth/health`);
  http.get(`${BASE_URL}/api/diary/health`);
  sleep(1);
}
