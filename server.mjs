import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = __dirname;
const PORT = Number(process.env.REPORT_API_PORT || 8787);

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(payload));
}

function collectBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolveBody(raw ? JSON.parse(raw) : {});
      } catch (error) {
        rejectBody(error);
      }
    });
    req.on('error', rejectBody);
  });
}

function runSendScript(reportMonth) {
  return new Promise((resolveRun, rejectRun) => {
    const scriptPath = resolve(ROOT, 'scripts', 'send_monthly_report.py');
    const child = spawn('python3', [scriptPath, '--report-month', reportMonth], {
      cwd: ROOT,
      env: process.env,
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', rejectRun);
    child.on('close', (code) => {
      if (code !== 0) {
        rejectRun(new Error(stderr.trim() || `send script exited with code ${code}`));
        return;
      }
      try {
        resolveRun(JSON.parse(stdout.trim() || '{}'));
      } catch (error) {
        rejectRun(new Error(`failed to parse send script output: ${error.message}`));
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  if (req.method !== 'POST' || req.url !== '/api/send-monthly-report') {
    sendJson(res, 404, { error: 'not found' });
    return;
  }

  try {
    const body = await collectBody(req);
    const reportMonth = String(body.reportMonth || '').trim();
    if (!/^\d{4}-\d{2}$/.test(reportMonth)) {
      sendJson(res, 400, { error: 'reportMonth must be YYYY-MM' });
      return;
    }

    const result = await runSendScript(reportMonth);
    sendJson(res, 200, {
      ok: true,
      ...result,
      report_month: reportMonth,
    });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: error.message,
    });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`report api listening on http://127.0.0.1:${PORT}`);
});
