import React, { useState } from 'react';
import { Copy, CheckCircle, FileText } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const ApiEndpoints = () => {
  const [copied, setCopied] = useState(null);

  const endpoints = [
    {
      category: 'PUBLIC ENDPOINTS (No Authentication)',
      items: [
        {
          method: 'GET',
          path: '/api/claimgift/{uid}',
          description: 'Claim items for a player (FIFO queue - returns all items, deletes first item only)',
          example: `${API_URL}/api/claimgift/player_12345`,
          response: `{
  "length": 3,
  "variable": "wood",
  "amount": "14",
  "items": [
    {"variable": "workbench", "amount": "2"},
    {"variable": "stone", "amount": "5"}
  ]
}

// After this GET, only "wood" is deleted
// Next GET will return length: 2 with workbench and stone`,
          note: 'FIFO Queue: Each GET returns all items but deletes only the oldest one'
        },
        {
          method: 'GET',
          path: '/api/status',
          description: 'Get current server status',
          example: `${API_URL}/api/status`,
          response: `{
  "status": "open"
}`
        },
        {
          method: 'GET',
          path: '/api/variable/{variable_name}',
          description: 'Get variable values by name',
          example: `${API_URL}/api/variable/max_players`,
          response: `{
  "variable_name": "max_players",
  "values": ["100", "200", "500"]
}`
        }
      ]
    },
    {
      category: 'AUTHENTICATION',
      items: [
        {
          method: 'POST',
          path: '/api/auth/login',
          description: 'Login with master key or user access key',
          example: `${API_URL}/api/auth/login`,
          body: `{
  "key": "your_access_key_or_master_key"
}`,
          response: `{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "super_admin",
    "username": "Super Admin",
    "is_super_admin": true,
    "permissions": ["send_items", "change_status", "view_logs", "manage_users", "manage_variables"]
  }
}`,
          note: 'Use the master key configured in backend environment (MASTER_KEY)'
        },
        {
          method: 'GET',
          path: '/api/auth/verify',
          description: 'Verify current JWT token',
          example: `${API_URL}/api/auth/verify`,
          auth: true,
          response: `{
  "valid": true,
  "user": {...}
}`
        }
      ]
    },
    {
      category: 'USER MANAGEMENT (Super Admin Only)',
      items: [
        {
          method: 'POST',
          path: '/api/users',
          description: 'Create a new user with permissions',
          example: `${API_URL}/api/users`,
          auth: true,
          body: `{
  "username": "john_doe",
  "permissions": ["send_items", "view_logs"]
}`,
          response: `{
  "username": "john_doe",
  "access_key": "generated_access_key_here",
  "permissions": ["send_items", "view_logs"]
}`,
          note: '⚠️ Save the access_key - it will not be shown again!'
        },
        {
          method: 'GET',
          path: '/api/users',
          description: 'List all users',
          example: `${API_URL}/api/users`,
          auth: true,
          response: `{
  "users": [
    {
      "username": "john_doe",
      "permissions": ["send_items", "view_logs"],
      "created_by": "Super Admin",
      "created_at": "2024-04-05T..."
    }
  ]
}`
        },
        {
          method: 'PUT',
          path: '/api/users/{username}/permissions',
          description: 'Update user permissions',
          example: `${API_URL}/api/users/john_doe/permissions`,
          auth: true,
          body: `{
  "permissions": ["send_items", "view_logs", "manage_variables"]
}`,
          response: `{
  "success": true,
  "username": "john_doe",
  "permissions": ["send_items", "view_logs", "manage_variables"]
}`
        },
        {
          method: 'DELETE',
          path: '/api/users/{username}',
          description: 'Delete a user',
          example: `${API_URL}/api/users/john_doe`,
          auth: true,
          response: `{
  "success": true,
  "message": "User 'john_doe' deleted successfully"
}`
        }
      ]
    },
    {
      category: 'ITEMS MANAGEMENT',
      items: [
        {
          method: 'POST',
          path: '/api/items/send',
          description: 'Send items to a player (requires send_items permission)',
          example: `${API_URL}/api/items/send`,
          auth: true,
          body: `{
  "uid": "player_12345",
  "variable": "legendary_sword",
  "amount": "epic quality"
}`,
          response: `{
  "success": true,
  "message": "Sent epic quality x legendary_sword to player_12345"
}`,
          note: 'Amount field accepts ANY text or number value'
        }
      ]
    },
    {
      category: 'SERVER STATUS',
      items: [
        {
          method: 'POST',
          path: '/api/status',
          description: 'Change server status (requires change_status permission)',
          example: `${API_URL}/api/status`,
          auth: true,
          body: `{
  "status": "maintenance"
}`,
          response: `{
  "success": true,
  "status": "maintenance"
}`,
          note: 'Valid statuses: open, maintenance, closed'
        }
      ]
    },
    {
      category: 'VARIABLES MANAGEMENT',
      items: [
        {
          method: 'POST',
          path: '/api/variables',
          description: 'Create a new variable (requires manage_variables permission)',
          example: `${API_URL}/api/variables`,
          auth: true,
          body: `{
  "variable_name": "max_players",
  "values": ["100", "200", "500"]
}`,
          response: `{
  "success": true,
  "variable_name": "max_players",
  "values": ["100", "200", "500"]
}`
        },
        {
          method: 'GET',
          path: '/api/variables',
          description: 'List all variables (requires manage_variables permission)',
          example: `${API_URL}/api/variables`,
          auth: true,
          response: `{
  "variables": [
    {
      "variable_name": "max_players",
      "values": ["100", "200", "500"],
      "created_by": "Super Admin",
      "created_at": "2024-04-05T..."
    }
  ]
}`
        },
        {
          method: 'PUT',
          path: '/api/variables/{variable_name}',
          description: 'Update variable values (requires manage_variables permission)',
          example: `${API_URL}/api/variables/max_players`,
          auth: true,
          body: `{
  "values": ["150", "250", "1000"]
}`,
          response: `{
  "success": true,
  "variable_name": "max_players",
  "values": ["150", "250", "1000"]
}`
        },
        {
          method: 'DELETE',
          path: '/api/variables/{variable_name}',
          description: 'Delete a variable (requires manage_variables permission)',
          example: `${API_URL}/api/variables/max_players`,
          auth: true,
          response: `{
  "success": true,
  "message": "Variable 'max_players' deleted successfully"
}`
        }
      ]
    },
    {
      category: 'LOGS',
      items: [
        {
          method: 'GET',
          path: '/api/logs',
          description: 'Get activity logs with filters (requires view_logs permission)',
          example: `${API_URL}/api/logs?log_type=send&limit=50`,
          auth: true,
          response: `{
  "logs": [
    {
      "type": "send",
      "user": "Super Admin",
      "uid": "player_12345",
      "variable": "wood",
      "amount": "14",
      "timestamp": "2024-04-05T12:30:00Z",
      "message": "Sent 14x wood to player_12345"
    }
  ],
  "count": 1
}`,
          note: 'Query params: log_type, user, uid, limit (default: 100)'
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
    <div className="max-w-7xl">
      <div className="bg-white border border-[#EDE5DB] rounded-xl shadow-sm">
        <div className="px-6 py-4 border-b border-[#EDE5DB] bg-gradient-to-r from-[#4F4F4F]/5 to-[#828282]/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#4F4F4F] to-[#828282] flex items-center justify-center shadow-sm">
              <FileText size={16} className="text-white" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-[#1A1A2E]">API Documentation</h3>
              <p className="text-xs text-[#8A8A9A] mt-1">Complete API reference with examples</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-8">
          {endpoints.map((section, sectionIdx) => (
            <div key={sectionIdx}>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-px flex-1 bg-[#EDE5DB]"></div>
                <div className="text-xs font-bold text-[#8A8A9A] px-3">{section.category}</div>
                <div className="h-px flex-1 bg-[#EDE5DB]"></div>
              </div>

              <div className="space-y-4">
                {section.items.map((endpoint, endpointIdx) => {
                  const uniqueId = `${sectionIdx}-${endpointIdx}`;
                  const methodColors = {
                    GET: { bg: '#27AE6015', color: '#27AE60', border: '#27AE60' },
                    POST: { bg: '#2F80ED15', color: '#2F80ED', border: '#2F80ED' },
                    PUT: { bg: '#FEF3C7', color: '#F59E0B', border: '#F59E0B' },
                    DELETE: { bg: '#EB575715', color: '#EB5757', border: '#EB5757' }
                  };
                  const methodStyle = methodColors[endpoint.method];

                  return (
                    <div key={endpointIdx} className="border border-[#EDE5DB] rounded-lg bg-white">
                      <div className="p-4 border-b border-[#EDE5DB] bg-[#FBF9F7]">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <span
                              className="px-3 py-1 text-xs font-bold rounded-lg"
                              style={{
                                backgroundColor: methodStyle.bg,
                                color: methodStyle.color,
                                border: `1px solid ${methodStyle.border}`
                              }}
                            >
                              {endpoint.method}
                            </span>
                            <code className="text-sm font-mono text-[#1A1A2E] flex-1">
                              {endpoint.path}
                            </code>
                            {endpoint.auth && (
                              <span className="text-xs px-2 py-1 bg-[#FEF3C7] text-[#F59E0B] border border-[#F59E0B] rounded-lg font-medium">
                                AUTH REQUIRED
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => copyToClipboard(endpoint.example, `url-${uniqueId}`)}
                            className="ml-3 p-2 border border-[#EDE5DB] hover:bg-[#F5F0EB] rounded-lg transition-colors"
                            data-testid={`copy-endpoint-${uniqueId}`}
                          >
                            {copied === `url-${uniqueId}` ? (
                              <CheckCircle size={16} className="text-[#27AE60]" />
                            ) : (
                              <Copy size={16} className="text-[#8A8A9A]" />
                            )}
                          </button>
                        </div>
                        <p className="mt-2 text-sm text-[#8A8A9A]">{endpoint.description}</p>
                        {endpoint.note && (
                          <div className="mt-2 p-2 bg-[#2F80ED15] border border-[#2F80ED] rounded-lg">
                            <p className="text-xs text-[#2F80ED]">💡 {endpoint.note}</p>
                          </div>
                        )}
                      </div>

                      <div className="p-4 space-y-4">
                        <div>
                          <div className="text-xs font-semibold text-[#8A8A9A] mb-2">ENDPOINT URL</div>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 p-2 bg-[#FBF9F7] border border-[#EDE5DB] text-[#1A1A2E] text-sm font-mono rounded-lg break-all">
                              {endpoint.example}
                            </code>
                          </div>
                        </div>

                        {endpoint.body && (
                          <div>
                            <div className="text-xs font-semibold text-[#8A8A9A] mb-2">REQUEST BODY</div>
                            <div className="flex items-start gap-2">
                              <pre className="flex-1 p-3 bg-[#FBF9F7] border border-[#EDE5DB] text-[#1A1A2E] text-sm font-mono rounded-lg overflow-x-auto">
                                {endpoint.body}
                              </pre>
                              <button
                                onClick={() => copyToClipboard(endpoint.body, `body-${uniqueId}`)}
                                className="p-2 border border-[#EDE5DB] hover:bg-[#F5F0EB] rounded-lg transition-colors"
                              >
                                {copied === `body-${uniqueId}` ? (
                                  <CheckCircle size={16} className="text-[#27AE60]" />
                                ) : (
                                  <Copy size={16} className="text-[#8A8A9A]" />
                                )}
                              </button>
                            </div>
                          </div>
                        )}

                        {endpoint.auth && (
                          <div>
                            <div className="text-xs font-semibold text-[#8A8A9A] mb-2">AUTHORIZATION</div>
                            <code className="block p-2 bg-[#FBF9F7] border border-[#EDE5DB] text-[#1A1A2E] text-sm font-mono rounded-lg">
                              Authorization: Bearer YOUR_JWT_TOKEN
                            </code>
                          </div>
                        )}

                        <div>
                          <div className="text-xs font-semibold text-[#8A8A9A] mb-2">RESPONSE EXAMPLE</div>
                          <div className="flex items-start gap-2">
                            <pre className="flex-1 p-3 bg-[#FBF9F7] border border-[#EDE5DB] text-[#1A1A2E] text-sm font-mono rounded-lg overflow-x-auto">
                              {endpoint.response}
                            </pre>
                            <button
                              onClick={() => copyToClipboard(endpoint.response, `response-${uniqueId}`)}
                              className="p-2 border border-[#EDE5DB] hover:bg-[#F5F0EB] rounded-lg transition-colors"
                            >
                              {copied === `response-${uniqueId}` ? (
                                <CheckCircle size={16} className="text-[#27AE60]" />
                              ) : (
                                <Copy size={16} className="text-[#8A8A9A]" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}\n              </div>
            </div>
          ))}
        </div>

        <div className="mx-6 mb-6 p-4 border border-[#2F80ED] bg-[#2F80ED15] rounded-lg">
          <div className="text-sm font-medium text-[#2F80ED] mb-2">🔒 Security Note</div>
          <p className="text-sm text-[#1A1A2E]">
            All authenticated endpoints require a valid JWT token in the Authorization header.
            Only public endpoints (claimgift, status, variable) can be accessed without authentication.
          </p>
        </div>

        <div className="mx-6 mb-6 p-4 border border-[#27AE60] bg-[#27AE6015] rounded-lg">
          <div className="text-sm font-medium text-[#27AE60] mb-2">📘 Permissions System</div>
          <div className="text-sm text-[#1A1A2E] space-y-1">
            <p><strong>send_items:</strong> Send items to players</p>
            <p><strong>change_status:</strong> Change server status</p>
            <p><strong>view_logs:</strong> View activity logs</p>
            <p><strong>manage_users:</strong> Create, edit, delete users</p>
            <p><strong>manage_variables:</strong> Manage system variables</p>
          </div>
        </div>
      </div>
    </div>
  );
};
