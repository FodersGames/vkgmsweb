import React, { useState } from 'react';
import { Copy, CheckCircle } from '@phosphor-icons/react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const ApiEndpoints = () => {
  const [copied, setCopied] = useState(null);

  const endpoints = [
    {
      category: 'PUBLIC ENDPOINTS',
      items: [
        {
          method: 'GET',
          path: '/api/claimgift/{uid}',
          description: 'Claim all pending items for a player UID',
          example: `${API_URL}/api/claimgift/player_12345`,
          response: `{\n  "items": [\n    {"variable": "wood", "amount": 10}\n  ]\n}`
        },
        {
          method: 'GET',
          path: '/api/status',
          description: 'Get current server status',
          example: `${API_URL}/api/status`,
          response: `{\n  "status": "open"\n}`
        }
      ]
    },
    {
      category: 'AUTHENTICATED ENDPOINTS',
      items: [
        {
          method: 'POST',
          path: '/api/auth/login',
          description: 'Login with master key or access key',
          example: `${API_URL}/api/auth/login`,
          body: `{\n  "key": "your_access_key"\n}`,
          response: `{\n  "token": "jwt_token",\n  "user": {...}\n}`
        },
        {
          method: 'POST',
          path: '/api/items/send',
          description: 'Send items to a player (requires send_items permission)',
          example: `${API_URL}/api/items/send`,
          auth: true,
          body: `{\n  "uid": "player_12345",\n  "variable": "wood",\n  "amount": 10\n}`,
          response: `{\n  "success": true,\n  "message": "..."\n}`
        },
        {
          method: 'POST',
          path: '/api/status',
          description: 'Change server status (requires change_status permission)',
          example: `${API_URL}/api/status`,
          auth: true,
          body: `{\n  "status": "maintenance"\n}`,
          response: `{\n  "success": true,\n  "status": "maintenance"\n}`
        },
        {
          method: 'GET',
          path: '/api/logs',
          description: 'Get logs with filters (requires view_logs permission)',
          example: `${API_URL}/api/logs?log_type=send&limit=50`,
          auth: true,
          response: `{\n  "logs": [...],\n  "count": 50\n}`
        },
        {
          method: 'POST',
          path: '/api/users',
          description: 'Create new user (Super Admin only)',
          example: `${API_URL}/api/users`,
          auth: true,
          body: `{\n  "username": "user123",\n  "permissions": ["send_items"]\n}`,
          response: `{\n  "username": "user123",\n  "access_key": "...",\n  "permissions": [...]\n}`
        }
      ]
    }
  ];

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="max-w-6xl">
      <div className="bg-white border border-neutral-300 p-8">
        <div className="flex items-center gap-3 mb-6">
          <Copy size={28} weight="bold" className="text-neutral-950" />
          <h2 className="text-3xl font-bold text-neutral-950" style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}>
            API ENDPOINTS
          </h2>
        </div>

        <div className="space-y-8">
          {endpoints.map((section, sectionIdx) => (
            <div key={sectionIdx}>
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-500 mb-4"
                   style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                {section.category}
              </div>

              <div className="space-y-4">
                {section.items.map((endpoint, endpointIdx) => {
                  const uniqueId = `${sectionIdx}-${endpointIdx}`;
                  return (
                    <div key={endpointIdx} className="border border-neutral-300 bg-white">
                      <div className="p-4 border-b border-neutral-200 bg-neutral-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span
                              className="px-2 py-1 text-xs font-mono font-bold"
                              style={{
                                backgroundColor: endpoint.method === 'GET' ? '#16A34A20' : '#2563EB20',
                                color: endpoint.method === 'GET' ? '#16A34A' : '#2563EB',
                                border: `1px solid ${endpoint.method === 'GET' ? '#16A34A' : '#2563EB'}`
                              }}
                            >
                              {endpoint.method}
                            </span>
                            <code className="text-sm font-mono text-neutral-950">
                              {endpoint.path}
                            </code>
                            {endpoint.auth && (
                              <span className="text-xs px-2 py-1 border border-amber-600 bg-amber-50 text-amber-900 font-mono">
                                AUTH REQUIRED
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => copyToClipboard(endpoint.example, `url-${uniqueId}`)}
                            className="p-2 border border-neutral-300 hover:bg-neutral-100 transition-all duration-200"
                            data-testid={`copy-endpoint-${uniqueId}`}
                          >
                            {copied === `url-${uniqueId}` ? (
                              <CheckCircle size={16} weight="bold" className="text-green-600" />
                            ) : (
                              <Copy size={16} />
                            )}
                          </button>
                        </div>
                        <p className="mt-2 text-sm text-neutral-600" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                          {endpoint.description}
                        </p>
                      </div>

                      <div className="p-4">
                        <div className="mb-3">
                          <div className="text-xs font-bold uppercase text-neutral-500 mb-2" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                            EXAMPLE URL
                          </div>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 p-2 bg-neutral-50 border border-neutral-300 text-neutral-950 text-sm font-mono break-all">
                              {endpoint.example}
                            </code>
                          </div>
                        </div>

                        {endpoint.body && (
                          <div className="mb-3">
                            <div className="text-xs font-bold uppercase text-neutral-500 mb-2" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                              REQUEST BODY
                            </div>
                            <div className="flex items-start gap-2">
                              <pre className="flex-1 p-3 bg-neutral-50 border border-neutral-300 text-neutral-950 text-sm font-mono overflow-x-auto">
                                {endpoint.body}
                              </pre>
                              <button
                                onClick={() => copyToClipboard(endpoint.body, `body-${uniqueId}`)}
                                className="p-2 border border-neutral-300 hover:bg-neutral-100 transition-all duration-200"
                              >
                                {copied === `body-${uniqueId}` ? (
                                  <CheckCircle size={16} weight="bold" className="text-green-600" />
                                ) : (
                                  <Copy size={16} />
                                )}
                              </button>
                            </div>
                          </div>
                        )}

                        {endpoint.auth && (
                          <div className="mb-3">
                            <div className="text-xs font-bold uppercase text-neutral-500 mb-2" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                              AUTHORIZATION HEADER
                            </div>
                            <code className="block p-2 bg-neutral-50 border border-neutral-300 text-neutral-950 text-sm font-mono">
                              Authorization: Bearer YOUR_JWT_TOKEN
                            </code>
                          </div>
                        )}

                        <div>
                          <div className="text-xs font-bold uppercase text-neutral-500 mb-2" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                            RESPONSE EXAMPLE
                          </div>
                          <div className="flex items-start gap-2">
                            <pre className="flex-1 p-3 bg-neutral-50 border border-neutral-300 text-neutral-950 text-sm font-mono overflow-x-auto">
                              {endpoint.response}
                            </pre>
                            <button
                              onClick={() => copyToClipboard(endpoint.response, `response-${uniqueId}`)}
                              className="p-2 border border-neutral-300 hover:bg-neutral-100 transition-all duration-200"
                            >
                              {copied === `response-${uniqueId}` ? (
                                <CheckCircle size={16} weight="bold" className="text-green-600" />
                              ) : (
                                <Copy size={16} />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 p-4 border border-amber-600 bg-amber-50">
          <div className="text-sm font-bold text-amber-900 mb-2" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
            ⚠️ SECURITY NOTE
          </div>
          <p className="text-sm text-amber-800" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
            All authenticated endpoints require a valid JWT token in the Authorization header.
            Only the public endpoints (/api/claimgift and GET /api/status) can be accessed without authentication.
          </p>
        </div>
      </div>
    </div>
  );
};