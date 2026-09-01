import http from 'http';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import healthHandler from '../api/health.js';
import inboundHandler from '../api/retell/inbound.js';
import webhookHandler from '../api/retell/webhook.js';
import retellTestHandler from '../api/retell/test.js';
import zohoTestHandler from '../api/zoho/test.js';

const PORT = process.env.PORT || 3000;

function parseBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve(body);
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const pathname = url.pathname;
  const method = req.method;

  // Add Express/Vercel-like helper methods to res
  const jsonResponse = (status: number, data: any) => {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
    });
    res.end(JSON.stringify(data, null, 2));
  };

  const vercelRes: any = res;
  vercelRes.status = (code: number) => {
    return {
      json: (data: any) => jsonResponse(code, data),
      send: (data: any) => {
        res.writeHead(code);
        res.end(data);
      },
    };
  };
  vercelRes.json = (data: any) => jsonResponse(200, data);
  vercelRes.setHeader = (name: string, value: string | string[]) => {
    res.setHeader(name, value);
  };

  const body = method === 'POST' || method === 'PUT' ? await parseBody(req) : {};
  const query: Record<string, string> = {};
  url.searchParams.forEach((v, k) => (query[k] = v));

  const vercelReq: any = req;
  vercelReq.body = body;
  vercelReq.query = query;

  console.log(`[${new Date().toISOString()}] ${method} ${pathname}`);

  try {
    if (pathname === '/api/health' || pathname === '/health') {
      return await healthHandler(vercelReq, vercelRes);
    }
    if (pathname === '/api/retell/inbound') {
      return await inboundHandler(vercelReq, vercelRes);
    }
    if (pathname === '/api/retell/webhook') {
      return await webhookHandler(vercelReq, vercelRes);
    }
    if (pathname === '/api/retell/test') {
      return await retellTestHandler(vercelReq, vercelRes);
    }
    if (pathname === '/api/zoho/test') {
      return await zohoTestHandler(vercelReq, vercelRes);
    }

    // Default welcome route
    return jsonResponse(200, {
      status: 'online',
      message: 'Retell AI ↔ Zoho CRM Integration Serverless Service',
      endpoints: [
        'GET  /api/health',
        'POST /api/retell/inbound',
        'POST /api/retell/webhook',
        'GET  /api/zoho/test',
        'POST /api/retell/test',
      ],
    });
  } catch (error: any) {
    console.error('Server error:', error);
    return jsonResponse(500, { error: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`\n🚀 Integration server running locally at: http://localhost:${PORT}`);
  console.log(`👉 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`👉 Live Zoho Test: http://localhost:${PORT}/api/zoho/test?phone=+971502764631`);
  console.log(`👉 Retell Inbound Endpoint: http://localhost:${PORT}/api/retell/inbound\n`);
});
