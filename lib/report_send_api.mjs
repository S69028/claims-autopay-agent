import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import nodemailer from 'nodemailer';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(MODULE_DIR, '..');
const PRIVATE_DIR = path.join(ROOT, 'data', 'private');
const ARCHIVE_TABLE_PATH = path.join(PRIVATE_DIR, 'report_archive_fact.csv');
const REPORT_FILE_INDEX_PATH = path.join(PRIVATE_DIR, 'report_file_index.json');
const DELIVERY_LOG_PATH = path.join(PRIVATE_DIR, 'report_delivery_log.jsonl');
const REPORT_FILE_RE = /^monthly_auto_payment_report_(\d{4}-\d{2})(?:_.*)?\.docx$/;

function env(name, defaultValue = '') {
  return String(process.env[name] ?? defaultValue).trim();
}

function envBool(name, defaultValue = 'false') {
  return ['1', 'true', 'yes', 'y', 'on'].includes(env(name, defaultValue).toLowerCase());
}

function nowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === ',' && !quoted) {
      cells.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function parseCsv(text) {
  const lines = String(text || '')
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);
  if (!lines.length) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce((acc, header, index) => {
      acc[header] = values[index] ?? '';
      return acc;
    }, {});
  });
}

async function readTextIfExists(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return '';
    throw error;
  }
}

async function loadDotenvFile(filePath) {
  try {
    const text = await fs.readFile(filePath, 'utf8');
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#') || !line.includes('=')) continue;
      const [keyPart, ...valueParts] = line.split('=');
      const key = keyPart.trim();
      let value = valueParts.join('=').trim();
      if (!key) continue;
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

async function loadRecipients(csvPath) {
  const text = await fs.readFile(csvPath, 'utf8');
  return parseCsv(text).filter((row) => String(row.active_flag || '').toUpperCase() === 'Y');
}

async function readCsvTable(filePath) {
  const text = await readTextIfExists(filePath);
  if (!text.trim()) return [];
  return parseCsv(text);
}

async function writeCsvTable(filePath, rows, fieldnames) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const lines = [fieldnames.join(',')];
  for (const row of rows) {
    const values = fieldnames.map((key) => {
      const raw = String(row?.[key] ?? '');
      if (/[,"\n\r]/.test(raw)) {
        return `"${raw.replace(/"/g, '""')}"`;
      }
      return raw;
    });
    lines.push(values.join(','));
  }
  await fs.writeFile(filePath, `${lines.join('\n')}\n`, 'utf8');
}

async function appendJsonl(filePath, row) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.appendFile(filePath, `${JSON.stringify(row, null, 0)}\n`, 'utf8');
}

async function buildReportFileIndex() {
  const rows = [];
  try {
    const entries = await fs.readdir(path.join(ROOT, 'reports'), { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const match = entry.name.match(REPORT_FILE_RE);
      if (!match) continue;
      const filePath = path.join(ROOT, 'reports', entry.name);
      const stat = await fs.stat(filePath);
      rows.push({
        snapshot_month: match[1],
        file_name: entry.name,
        file_path: filePath,
        updated_at: stat.mtime.toISOString().replace(/\.\d{3}Z$/, 'Z'),
        size_bytes: stat.size,
      });
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  rows.sort((a, b) => {
    const monthCompare = String(b.snapshot_month || '').localeCompare(String(a.snapshot_month || ''));
    if (monthCompare !== 0) return monthCompare;
    const updatedCompare = String(b.updated_at || '').localeCompare(String(a.updated_at || ''));
    if (updatedCompare !== 0) return updatedCompare;
    return String(b.file_name || '').localeCompare(String(a.file_name || ''));
  });

  return {
    generated_at: nowIso(),
    reports: rows,
  };
}

async function writeReportFileIndex() {
  await fs.mkdir(path.dirname(REPORT_FILE_INDEX_PATH), { recursive: true });
  await fs.writeFile(REPORT_FILE_INDEX_PATH, `${JSON.stringify(await buildReportFileIndex(), null, 2)}\n`, 'utf8');
}

async function upsertArchiveRow(row) {
  const fieldnames = [
    'report_archive_id',
    'snapshot_month',
    'comparison_month',
    'report_title',
    'file_name',
    'file_path',
    'checksum',
    'generated_at',
    'sent_at',
    'generated_flag',
    'sent_flag',
    'recipient_count',
    'report_status',
    'notes',
    'created_at',
    'updated_at',
  ];
  const rows = await readCsvTable(ARCHIVE_TABLE_PATH);
  const snapshotMonth = String(row.snapshot_month);
  const matchIndex = rows.findIndex((item) => String(item.snapshot_month || '') === snapshotMonth);
  let nextRow;
  if (matchIndex === -1) {
    const nextId = Math.max(0, ...rows.map((item) => Number(item.report_archive_id || 0))) + 1;
    nextRow = {
      ...row,
      report_archive_id: nextId,
      created_at: row.generated_at,
      updated_at: row.generated_at,
    };
    rows.push(nextRow);
  } else {
    nextRow = {
      ...rows[matchIndex],
      ...row,
      updated_at: row.generated_at,
    };
    rows[matchIndex] = nextRow;
  }
  rows.sort((a, b) => String(a.snapshot_month || '').localeCompare(String(b.snapshot_month || '')));
  await writeCsvTable(ARCHIVE_TABLE_PATH, rows, fieldnames);
  return nextRow;
}

async function recordDeliveryLog({ reportArchiveId, recipients, sentAt, success, errorMessage = null }) {
  const status = success ? '발송됨' : '실패';
  let existing = 0;
  try {
    const text = await fs.readFile(DELIVERY_LOG_PATH, 'utf8');
    existing = text.split(/\r?\n/).filter(Boolean).length;
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  for (const [offset, recipient] of recipients.entries()) {
    await appendJsonl(DELIVERY_LOG_PATH, {
      delivery_id: existing + offset + 1,
      report_archive_id: reportArchiveId,
      recipient_email: recipient,
      delivery_status: status,
      sent_at: success ? sentAt : null,
      error_message: errorMessage,
      created_at: sentAt,
    });
  }
}

async function buildArchiveState({ reportMonth, reportPath, recipientCount, sentAt, success, notes }) {
  const generatedAt = nowIso();
  const [year, month] = reportMonth.split('-').map(Number);
  const comparisonMonth = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`;
  const checksum = await sha256File(reportPath);
  return {
    snapshot_month: reportMonth,
    comparison_month: comparisonMonth,
    report_title: `월간 자동심사 현황 리포트 ${reportMonth}`,
    file_name: path.basename(reportPath),
    file_path: String(reportPath),
    checksum,
    generated_at: generatedAt,
    sent_at: sentAt,
    generated_flag: 'Y',
    sent_flag: success ? 'Y' : 'N',
    recipient_count: recipientCount,
    report_status: success ? '발송됨' : '미발송',
    notes,
  };
}

async function resolveReportPath(reportPath, reportMonth) {
  if (reportPath) {
    return path.resolve(reportPath);
  }
  const index = await buildReportFileIndex();
  const matched = index.reports.find((row) => row.snapshot_month === reportMonth);
  if (matched?.file_path) return matched.file_path;
  return path.join(ROOT, 'reports', `monthly_auto_payment_report_${reportMonth}.docx`);
}

async function ensureReportFile(reportPath, reportMonth) {
  try {
    await fs.access(reportPath);
    return reportPath;
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  if (process.env.VERCEL) {
    throw new Error(`report file not found: ${reportPath}`);
  }

  const generator = path.join(ROOT, 'scripts', 'generate_monthly_report.py');
  execFileSync(process.env.PYTHON || 'python3', [
    generator,
    '--source',
    'auto',
    '--month',
    reportMonth,
    '--out',
    reportPath,
  ], { stdio: 'inherit' });
  await fs.access(reportPath);
  return reportPath;
}

function buildTransport() {
  const host = env('REPORT_SMTP_HOST', 'smtp.gmail.com');
  const port = Number(env('REPORT_SMTP_PORT', '465'));
  const useSsl = envBool('REPORT_SMTP_USE_SSL', 'true');
  const useStartTls = envBool('REPORT_SMTP_USE_STARTTLS', 'true');
  const username = env('REPORT_SMTP_USERNAME');
  const password = env('REPORT_SMTP_PASSWORD');
  return {
    host,
    port,
    useSsl,
    useStartTls,
    username,
    password,
    transporter: nodemailer.createTransport({
      host,
      port,
      secure: useSsl,
      requireTLS: !useSsl && useStartTls,
      auth: username ? { user: username, pass: password } : undefined,
    }),
  };
}

async function checkConnection() {
  const { transporter } = buildTransport();
  await transporter.verify();
}

async function sendMail({ sender, displayName, subjectPrefix, reportMonth, reportPath, recipients }) {
  const { transporter } = buildTransport();
  const fromHeader = displayName ? `${displayName} <${sender}>` : sender;
  const subject = `${subjectPrefix} ${reportMonth} 월간 리포트`;
  const body = `안녕하세요.\n\n${reportMonth} 기준 자동심사 현황 월간 리포트를 전달드립니다.\n\n첨부 파일을 확인해 주세요.\n`;
  const attachment = {
    filename: path.basename(reportPath),
    content: await fs.readFile(reportPath),
  };
  await transporter.sendMail({
    from: fromHeader,
    to: recipients.join(', '),
    subject,
    text: body,
    attachments: [attachment],
  });
}

function writeJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req) {
  if (req && typeof req.body !== 'undefined' && req.body !== null) {
    if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
    if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString('utf8') || '{}');
    if (typeof req.body === 'object') return req.body;
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

async function handleSendMonthlyReport(req, res) {
  if (req.method === 'OPTIONS') {
    writeJson(res, 204, {});
    return;
  }

  const pathname = (() => {
    try {
      return new URL(req.url || '/', 'http://localhost').pathname;
    } catch (_) {
      return String(req.url || '/');
    }
  })();

  if (req.method !== 'POST' || pathname !== '/api/send-monthly-report') {
    writeJson(res, 404, { error: 'not found' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const reportMonth = String(body.reportMonth || '').trim();
    if (!/^\d{4}-\d{2}$/.test(reportMonth)) {
      writeJson(res, 400, { error: 'reportMonth must be YYYY-MM' });
      return;
    }

    const reportPath = await resolveReportPath(body.reportPath, reportMonth);

    const recipients = await loadRecipients(path.join(PRIVATE_DIR, 'report_subscription_accounts.csv'));
    const recipientEmails = recipients.map((row) => row.recipient_email).filter(Boolean);
    if (!recipientEmails.length) {
      throw new Error('no active recipients found');
    }

    const sender = env('REPORT_SMTP_FROM') || env('REPORT_SMTP_USERNAME') || '<pending>';
    if (sender === '<pending>' && !body.dryRun) {
      throw new Error('REPORT_SMTP_FROM or REPORT_SMTP_USERNAME is required');
    }

    const subjectPrefix = env('REPORT_DEFAULT_SUBJECT_PREFIX', '[자동심사 현황분석]');
    const displayName = env('REPORT_SMTP_DISPLAY_NAME', '자동심사 현황분석 Agent');
    const summary = {
      provider: env('REPORT_SMTP_PROVIDER', 'gmail'),
      host: env('REPORT_SMTP_HOST', 'smtp.gmail.com'),
      port: Number(env('REPORT_SMTP_PORT', '465')),
      use_ssl: envBool('REPORT_SMTP_USE_SSL', 'true'),
      sender,
      recipient_count: recipientEmails.length,
      report_path: String(reportPath),
      report_month: reportMonth,
      dry_run: Boolean(body.dryRun),
    };

    if (body.checkConnection) {
      await checkConnection();
      writeJson(res, 200, { ...summary, connection_ok: true });
      return;
    }

    if (body.dryRun) {
      writeJson(res, 200, summary);
      return;
    }

    await ensureReportFile(reportPath, reportMonth);

    const sentAt = nowIso();
    try {
      await writeReportFileIndex();
      await sendMail({
        sender,
        displayName,
        subjectPrefix,
        reportMonth,
        reportPath,
        recipients: recipientEmails,
      });
      const archiveRow = await upsertArchiveRow(
        await buildArchiveState({
          reportMonth,
          reportPath,
          recipientCount: recipientEmails.length,
          sentAt,
          success: true,
          notes: `sent via ${summary.provider} smtp`,
        })
      );
      await recordDeliveryLog({
        reportArchiveId: Number(archiveRow.report_archive_id),
        recipients: recipientEmails,
        sentAt,
        success: true,
      });
      writeJson(res, 200, {
        ...summary,
        report_archive_id: archiveRow.report_archive_id,
        archive_log: ARCHIVE_TABLE_PATH,
        delivery_log: DELIVERY_LOG_PATH,
      });
    } catch (error) {
      await writeReportFileIndex();
      const archiveRow = await upsertArchiveRow(
        await buildArchiveState({
          reportMonth,
          reportPath,
          recipientCount: recipientEmails.length,
          sentAt,
          success: false,
          notes: `send failed: ${error.message}`,
        })
      );
      await recordDeliveryLog({
        reportArchiveId: Number(archiveRow.report_archive_id),
        recipients: recipientEmails,
        sentAt,
        success: false,
        errorMessage: error.message,
      });
      throw error;
    }
  } catch (error) {
    writeJson(res, 500, {
      ok: false,
      error: error.message,
    });
  }
}

async function loadLocalEnvIfNeeded() {
  if (!process.env.VERCEL) {
    await loadDotenvFile(path.join(ROOT, '.env'));
  }
}

await loadLocalEnvIfNeeded();

export {
  ARCHIVE_TABLE_PATH,
  DELIVERY_LOG_PATH,
  REPORT_FILE_INDEX_PATH,
  ROOT,
  handleSendMonthlyReport,
  loadDotenvFile,
  resolveReportPath,
  writeReportFileIndex,
};
