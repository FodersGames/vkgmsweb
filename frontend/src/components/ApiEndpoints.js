import React, { useState } from 'react';
import { Copy, CheckCircle, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useProject } from '../context/ProjectContext';
import { Card, CardHeader, CardBody } from '../ui';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const ApiEndpoints = () => {
  const { selectedProject } = useProject();
  const [copied, setCopied] = useState(null);

  const slug = selectedProject?.slug || '{project_slug}';

  const endpoints = [
    {
      category: 'PROJECT MANAGEMENT',
      items: [
        {
          method: 'POST',
          path: '/api/projects',
          description: 'Create a new project/game (Super Admin only)',
          example: `${API_URL}/api/projects`,
          auth: true,
          body: `{\n  "name": "My Game"\n}`,
          response: `{\n  "success": true,\n  "name": "My Game",\n  "slug": "my-game",\n  "created_at": "2025-...",\n  "created_by": "Super Admin"\n}`
        },
        {
          method: 'GET',
          path: '/api/projects',
          description: 'List all projects',
          example: `${API_URL}/api/projects`,
          auth: true,
          response: `{\n  "projects": [\n    {"name": "My Game", "slug": "my-game", "created_by": "Super Admin", ...}\n  ]\n}`
        },
        {
          method: 'DELETE',
          path: '/api/projects/{project_slug}',
          description: 'Delete a project and ALL its data (Super Admin only)',
          example: `${API_URL}/api/projects/${slug}`,
          auth: true,
          response: `{\n  "success": true,\n  "message": "Project 'My Game' and all its data deleted"\n}`,
          note: 'This permanently deletes ALL items, variables, status, and logs for this project'
        }
      ]
    },
    {
      category: 'PUBLIC ENDPOINTS (No Authentication)',
      items: [
        {
          method: 'GET',
          path: `/api/projects/{project_slug}/claimgift/{uid}`,
          description: 'Claim items for a player (FIFO queue)',
          example: `${API_URL}/api/projects/${slug}/claimgift/player_12345`,
          response: `{\n  "length": 3,\n  "variable": "wood",\n  "amount": "14",\n  "items": [\n    {"variable": "workbench", "amount": "2"},\n    {"variable": "stone", "amount": "5"}\n  ]\n}`,
          note: 'FIFO Queue: Each GET returns all items but deletes only the oldest one'
        },
        {
          method: 'GET',
          path: `/api/projects/{project_slug}/status`,
          description: 'Get current server status for this project',
          example: `${API_URL}/api/projects/${slug}/status`,
          response: `{\n  "status": "open"\n}`
        },
        {
          method: 'GET',
          path: `/api/projects/{project_slug}/variable/{variable_name}`,
          description: 'Get variable values by name (flat JSON format)',
          example: `${API_URL}/api/projects/${slug}/variable/max_players`,
          response: `{\n  "variable_name": "max_players",\n  "value_0": "100",\n  "value_1": "200",\n  "count": 2\n}`
        },
        {
          method: 'POST',
          path: `/api/projects/{project_slug}/chat`,
          description: "Post a message to this game's chat (requires chat API key header, see Chat tab)",
          example: `${API_URL}/api/projects/${slug}/chat`,
          body: `{\n  "username": "PlayerOne",\n  "message": "Hello!",\n  "level": 42\n}`,
          response: `{\n  "success": true,\n  "message_data": {\n    "id": "...",\n    "project_slug": "${slug}",\n    "username": "PlayerOne",\n    "level": 42,\n    "message": "Hello!",\n    "timestamp": "2026-..."\n  }\n}`,
          note: 'Header required: X-Chat-Api-Key: <your_game_chat_key>. Rate-limited to 1 request / 3 seconds per IP. "level" is optional (integer 1–9999). Messages are auto-censored against the global banned words list. Auto-purge keeps the last 100 messages per project.'
        },
        {
          method: 'GET',
          path: `/api/projects/{project_slug}/chat`,
          description: 'Get the latest chat messages for this game (use for polling)',
          example: `${API_URL}/api/projects/${slug}/chat?limit=50`,
          response: `{\n  "messages": [\n    {\n      "id": "...",\n      "username": "PlayerOne",\n      "level": 42,\n      "message": "Hello!",\n      "timestamp": "2026-..."\n    }\n  ]\n}`,
          note: 'No authentication required. "limit" query param: 1–100, defaults to 50. Messages returned oldest-first. "level" is null if the player did not send one.'
        }
      ]
    },
    {
      category: 'AUTHENTICATION',
      items: [
        {
          method: 'POST',
          path: '/api/auth/login',
          description: 'Login with email and password',
          example: `${API_URL}/api/auth/login`,
          body: `{\n  "email": "user@example.com",\n  "password": "yourpassword"\n}`,
          response: `{\n  "token": "eyJhbGci...",\n  "user": {\n    "id": "...",\n    "email": "user@example.com",\n    "username": "johndoe",\n    "is_super_admin": false,\n    "permissions": [...]\n  },\n  "first_login": false\n}`,
          note: 'Returns a JWT token (24h expiry). Pass it as Authorization: Bearer <token>'
        },
        {
          method: 'POST',
          path: '/api/auth/register',
          description: 'Create a new user account',
          example: `${API_URL}/api/auth/register`,
          body: `{\n  "email": "user@example.com",\n  "password": "pass1234",\n  "firstName": "Jane",\n  "lastName": "Doe",\n  "username": "jane_doe"\n}`,
          response: `{\n  "success": true,\n  "message": "Account created successfully"\n}`,
          note: 'Password requires 8+ chars, at least one letter and one number'
        },
        {
          method: 'GET',
          path: '/api/auth/me',
          description: 'Get current user profile',
          example: `${API_URL}/api/auth/me`,
          auth: true,
          response: `{\n  "id": "...",\n  "email": "...",\n  "username": "...",\n  "firstName": "...",\n  "role": "user",\n  "is_super_admin": false,\n  "permissions": [...]\n}`
        }
      ]
    },
    {
      category: 'ITEMS MANAGEMENT (Auth Required)',
      items: [
        {
          method: 'POST',
          path: `/api/projects/{project_slug}/items/send`,
          description: 'Send items to a player (requires send_items permission)',
          example: `${API_URL}/api/projects/${slug}/items/send`,
          auth: true,
          body: `{\n  "uid": "player_12345",\n  "variable": "legendary_sword",\n  "amount": "epic quality"\n}`,
          response: `{\n  "success": true,\n  "message": "Sent epic quality x legendary_sword to player_12345"\n}`,
          note: 'Amount field accepts ANY text or number value'
        }
      ]
    },
    {
      category: 'SERVER STATUS (Auth Required)',
      items: [
        {
          method: 'POST',
          path: `/api/projects/{project_slug}/status`,
          description: 'Change server status (requires change_status permission)',
          example: `${API_URL}/api/projects/${slug}/status`,
          auth: true,
          body: `{\n  "status": "maintenance"\n}`,
          response: `{\n  "success": true,\n  "status": "maintenance"\n}`,
          note: 'Valid statuses: open, maintenance, closed'
        }
      ]
    },
    {
      category: 'VARIABLES MANAGEMENT (Auth Required)',
      items: [
        {
          method: 'POST',
          path: `/api/projects/{project_slug}/variables`,
          description: 'Create a new variable',
          example: `${API_URL}/api/projects/${slug}/variables`,
          auth: true,
          body: `{\n  "variable_name": "max_players",\n  "values": ["100", "200"]\n}`,
          response: `{\n  "success": true,\n  "variable_name": "max_players",\n  "values": ["100", "200"]\n}`
        },
        {
          method: 'GET',
          path: `/api/projects/{project_slug}/variables`,
          description: 'List all variables for this project',
          example: `${API_URL}/api/projects/${slug}/variables`,
          auth: true,
          response: `{\n  "variables": [...]\n}`
        },
        {
          method: 'PUT',
          path: `/api/projects/{project_slug}/variables/{variable_name}`,
          description: 'Update variable values',
          example: `${API_URL}/api/projects/${slug}/variables/max_players`,
          auth: true,
          body: `{\n  "values": ["150", "250"]\n}`,
          response: `{\n  "success": true,\n  "variable_name": "max_players",\n  "values": ["150", "250"]\n}`
        },
        {
          method: 'DELETE',
          path: `/api/projects/{project_slug}/variables/{variable_name}`,
          description: 'Delete a variable',
          example: `${API_URL}/api/projects/${slug}/variables/max_players`,
          auth: true,
          response: `{\n  "success": true,\n  "message": "Variable 'max_players' deleted successfully"\n}`
        }
      ]
    },
    {
      category: 'LOGS (Auth Required)',
      items: [
        {
          method: 'GET',
          path: `/api/projects/{project_slug}/logs`,
          description: 'Get activity logs for this project',
          example: `${API_URL}/api/projects/${slug}/logs?log_type=send&limit=50`,
          auth: true,
          response: `{\n  "logs": [...],\n  "count": 1\n}`,
          note: 'Query params: log_type, user, uid, limit (default: 100)'
        }
      ]
    },
    {
      category: 'USER MANAGEMENT (manage_users Permission)',
      items: [
        {
          method: 'GET',
          path: '/api/users',
          description: 'List all registered users',
          example: `${API_URL}/api/users`,
          auth: true,
          response: `{\n  "users": [{\n    "id": "...",\n    "email": "...",\n    "username": "...",\n    "firstName": "...",\n    "role": "user",\n    "permissions": [...],\n    "isSuspended": false\n  }],\n  "total": 1\n}`
        },
        {
          method: 'PATCH',
          path: '/api/users/{user_id}/suspend',
          description: 'Suspend or reactivate a user',
          example: `${API_URL}/api/users/{user_id}/suspend`,
          auth: true,
          body: `{\n  "suspended": true\n}`,
          response: `{\n  "success": true,\n  "suspended": true\n}`
        },
        {
          method: 'DELETE',
          path: '/api/users/{user_id}',
          description: 'Permanently delete a user',
          example: `${API_URL}/api/users/{user_id}`,
          auth: true,
          response: `{\n  "success": true,\n  "message": "User 'john_doe' deleted successfully"\n}`
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

  const methodColors = {
    GET:    { bg: '#27AE6015', color: '#27AE60', border: '#27AE60' },
    POST:   { bg: '#2F80ED15', color: '#2F80ED', border: '#2F80ED' },
    PUT:    { bg: '#FEF3C7',   color: '#F59E0B', border: '#F59E0B' },
    PATCH:  { bg: '#9B59B615', color: '#9B59B6', border: '#9B59B6' },
    DELETE: { bg: '#EB575715', color: '#EB5757', border: '#EB5757' },
  };

  return (
    <div className="max-w-7xl">
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg w-9 h-9 flex items-center justify-center" style={{ backgroundColor: '#6E6E7318' }}>
              <FileText size={16} style={{ color: '#6E6E73' }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">API Documentation</h3>
              <p className="text-xs text-[#6E6E73]">All endpoints scoped per project</p>
            </div>
          </div>
        </CardHeader>

        <CardBody className="space-y-8">
          {endpoints.map((section, sectionIdx) => (
            <div key={sectionIdx}>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-px flex-1 bg-[#D2D2D7] dark:bg-[#2a2a3c]"></div>
                <div className="text-xs font-bold text-[#6E6E73] px-3">{section.category}</div>
                <div className="h-px flex-1 bg-[#D2D2D7] dark:bg-[#2a2a3c]"></div>
              </div>

              <div className="space-y-4">
                {section.items.map((endpoint, endpointIdx) => {
                  const uniqueId = `${sectionIdx}-${endpointIdx}`;
                  const methodStyle = methodColors[endpoint.method];

                  return (
                    <div key={endpointIdx} className="rounded-xl border border-[#D2D2D7] dark:border-[#2a2a3c] bg-[#F5F5F7] dark:bg-[#111118]">
                      <div className="p-4 border-b border-[#D2D2D7] dark:border-[#2a2a3c] bg-white dark:bg-[#151520]">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <span className="px-3 py-1 text-xs font-bold"
                              style={{ backgroundColor: methodStyle.bg, color: methodStyle.color, border: `1px solid ${methodStyle.border}` }}>
                              {endpoint.method}
                            </span>
                            <code className="text-sm font-mono text-[#1D1D1F] dark:text-[#e4e4e7] flex-1">{endpoint.path}</code>
                            {endpoint.auth && (
                              <span className="text-xs px-2 py-1 bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/30 font-medium">AUTH</span>
                            )}
                          </div>
                          <button onClick={() => copyToClipboard(endpoint.example, `url-${uniqueId}`)}
                            className="rounded-xl ml-3 p-2 border border-[#D2D2D7] dark:border-[#2a2a3c] hover:border-[#4ECDC4]/30 transition-colors"
                            data-testid={`copy-endpoint-${uniqueId}`}>
                            {copied === `url-${uniqueId}` ? <CheckCircle size={16} className="text-[#4ECDC4]" /> : <Copy size={16} className="text-[#6E6E73]" />}
                          </button>
                        </div>
                        <p className="mt-2 text-sm text-[#6E6E73]">{endpoint.description}</p>
                        {endpoint.note && (
                          <div className="mt-2 p-2 bg-[#4ECDC4]/5 border border-[#4ECDC4]/20">
                            <p className="text-xs text-[#4ECDC4]">{endpoint.note}</p>
                          </div>
                        )}
                      </div>

                      <div className="p-4 space-y-4">
                        <div>
                          <div className="text-xs font-semibold text-[#6E6E73] mb-2">ENDPOINT URL</div>
                          <code className="rounded-xl block p-2 bg-[#EDEDEF] dark:bg-[#0d0d14] border border-[#D2D2D7] dark:border-[#2a2a3c] text-[#1D1D1F] dark:text-[#e4e4e7] text-sm font-mono break-all">
                            {endpoint.example}
                          </code>
                        </div>

                        {endpoint.body && (
                          <div>
                            <div className="text-xs font-semibold text-[#6E6E73] mb-2">REQUEST BODY</div>
                            <div className="flex items-start gap-2">
                              <pre className="rounded-xl flex-1 p-3 bg-[#EDEDEF] dark:bg-[#0d0d14] border border-[#D2D2D7] dark:border-[#2a2a3c] text-[#1D1D1F] dark:text-[#e4e4e7] text-sm font-mono overflow-x-auto">
                                {endpoint.body}
                              </pre>
                              <button onClick={() => copyToClipboard(endpoint.body, `body-${uniqueId}`)}
                                className="rounded-xl p-2 border border-[#D2D2D7] dark:border-[#2a2a3c] hover:border-[#4ECDC4]/30 transition-colors">
                                {copied === `body-${uniqueId}` ? <CheckCircle size={16} className="text-[#4ECDC4]" /> : <Copy size={16} className="text-[#6E6E73]" />}
                              </button>
                            </div>
                          </div>
                        )}

                        {endpoint.auth && (
                          <div>
                            <div className="text-xs font-semibold text-[#6E6E73] mb-2">AUTHORIZATION</div>
                            <code className="rounded-xl block p-2 bg-[#EDEDEF] dark:bg-[#0d0d14] border border-[#D2D2D7] dark:border-[#2a2a3c] text-[#1D1D1F] dark:text-[#e4e4e7] text-sm font-mono">
                              Authorization: Bearer YOUR_JWT_TOKEN
                            </code>
                          </div>
                        )}

                        <div>
                          <div className="text-xs font-semibold text-[#6E6E73] mb-2">RESPONSE</div>
                          <div className="flex items-start gap-2">
                            <pre className="rounded-xl flex-1 p-3 bg-[#EDEDEF] dark:bg-[#0d0d14] border border-[#D2D2D7] dark:border-[#2a2a3c] text-[#1D1D1F] dark:text-[#e4e4e7] text-sm font-mono overflow-x-auto">
                              {endpoint.response}
                            </pre>
                            <button onClick={() => copyToClipboard(endpoint.response, `resp-${uniqueId}`)}
                              className="rounded-xl p-2 border border-[#D2D2D7] dark:border-[#2a2a3c] hover:border-[#4ECDC4]/30 transition-colors">
                              {copied === `resp-${uniqueId}` ? <CheckCircle size={16} className="text-[#4ECDC4]" /> : <Copy size={16} className="text-[#6E6E73]" />}
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
        </CardBody>

        <div className="px-6 pb-6">
          <div className="p-4 border border-[#6C5CE7]/30 bg-[#6C5CE7]/5">
            <div className="text-sm font-medium text-[#6C5CE7] mb-2">Multi-Project Architecture</div>
            <p className="text-sm text-[#1D1D1F] dark:text-[#e4e4e7]/70">
              All game data (items, status, variables, logs) is isolated per project. Each project has its own set of endpoints prefixed with <code className="text-xs bg-[#EDEDEF] dark:bg-[#0d0d14] px-1.5 py-0.5 rounded border border-[#D2D2D7] dark:border-[#2a2a3c] text-[#4ECDC4]">/api/projects/{'{'}&lt;slug&gt;{'}'}</code>.
              Users and authentication are shared globally across all projects.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};
