import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { handleSendMonthlyReport } from './lib/report_send_api.mjs';

const PORT = Number(process.env.REPORT_API_PORT || 8787);

async function serverHandler(req, res) {
  return handleSendMonthlyReport(req, res);
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

