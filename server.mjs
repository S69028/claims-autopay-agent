import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { handleSendMonthlyReport } from './lib/report_send_api.mjs';

const PORT = Number(process.env.REPORT_API_PORT || 8787);
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DASHBOARD_PATH = path.join(ROOT, 'preview', 'operations-dashboard.html');
const PRIVATE_DIR = path.join(ROOT, 'data', 'private');
const REPORTS_DIR = path.join(ROOT, 'reports');

async function serverHandler(req, res) {
  const requestUrl = new URL(req.url || '/', 'http://localhost');
  const pathname = requestUrl.pathname;

  if (pathname === '/' || pathname === '/index.html' || pathname === '/preview/operations-dashboard.html') {
    const html = await fs.readFile(DASHBOARD_PATH, 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  if (pathname === '/api/send-monthly-report') {
    return handleSendMonthlyReport(req, res);
  }

  if (pathname === '/data/private/report_file_index.json') {
    const text = await fs.readFile(path.join(PRIVATE_DIR, 'report_file_index.json'), 'utf8');
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(text);
    return;
  }

  if (pathname === '/data/private/report_archive_fact.csv') {
    const text = await fs.readFile(path.join(PRIVATE_DIR, 'report_archive_fact.csv'), 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8' });
    res.end(text);
    return;
  }

  if (pathname.startsWith('/reports/') && pathname.endsWith('.docx')) {
    const filePath = path.join(REPORTS_DIR, path.basename(pathname));
    try {
      const file = await fs.readFile(filePath);
      res.writeHead(200, { 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      res.end(file);
      return;
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }

  res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: 'not found' }));
}

export default serverHandler;
export { serverHandler };

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (!process.env.VERCEL && isDirectRun) {
  const server = http.createServer((req, res) => {
    void serverHandler(req, res);
  });

  server.listen(PORT, '127.0.0.1', () => {
    console.log(`report api listening on http://127.0.0.1:${PORT}`);
  });
}
