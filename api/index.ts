import express from 'express';
import crypto from 'crypto';
import {
  getAllLeads,
  createLeadRecord,
  updateLeadStatusRecord,
  updateLeadNotesRecord,
  deleteLeadRecord,
  getStoredSiteConfig,
  updateStoredSiteConfig,
  getAllConversations,
  getConversationById,
  getConversationByToken,
  createConversationRecord,
  addVisitorMessageRecord,
  addAdminReplyRecord,
  updateConversationStatusRecord,
  saveAllConversations,
} from '../serverStorage.ts';
import type { LeadStatus, PlatformType, ConversationStatus } from '../serverStorage.ts';
import {
  authenticateServerlessRequest,
  getAdminUsername,
  getAdminPassword,
  safeCompare,
  serverlessSessions,
} from './_auth.ts';
import type { AdminSession } from './_auth.ts';

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS headers for API calls
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Helper to authenticate Bearer token or body token
function getAuthenticatedSession(req: express.Request): AdminSession | null {
  return authenticateServerlessRequest(req);
}

// ----------------------------------------------------
// Health Check Endpoint
// ----------------------------------------------------
app.get(['/health', '/api/health'], (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ----------------------------------------------------
// Public Site Config Endpoint
// ----------------------------------------------------
app.get(['/site-config', '/api/site-config'], (req, res) => {
  try {
    const config = getStoredSiteConfig();
    res.status(200).json({ success: true, config });
  } catch (err: any) {
    console.error('Error fetching site config:', err);
    res.status(500).json({ success: false, error: 'Could not fetch site configuration' });
  }
});

// ----------------------------------------------------
// Public Contact Form / Lead Submission
// ----------------------------------------------------
const handleLeadSubmission = (req: express.Request, res: express.Response) => {
  try {
    const {
      fullName,
      name,
      email,
      phone,
      service,
      details,
      platform,
      accountType,
      banReason,
      accountHandle,
      urgency,
      caseId,
    } = req.body || {};

    const clientName = (name || fullName || '').trim();
    const clientEmail = (email || '').trim();
    const clientPhone = (phone || '').trim();
    const caseDetails = (details || '').trim();

    if (!clientName) {
      return res.status(400).json({
        success: false,
        error: 'Client name is required.',
      });
    }

    if (!clientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
      return res.status(400).json({
        success: false,
        error: 'A valid email address is required.',
      });
    }

    if (!clientPhone || clientPhone.length < 5) {
      return res.status(400).json({
        success: false,
        error: 'A valid phone/WhatsApp number is required.',
      });
    }

    if (!caseDetails || caseDetails.length < 5) {
      return res.status(400).json({
        success: false,
        error: 'Case description is required (minimum 5 characters).',
      });
    }

    const newLead = createLeadRecord({
      name: clientName,
      email: clientEmail,
      phone: clientPhone,
      service: service ? String(service).trim() : undefined,
      platform: platform as PlatformType,
      accountType: accountType ? String(accountType).trim() : undefined,
      banReason: banReason ? String(banReason).trim() : undefined,
      accountHandle: accountHandle ? String(accountHandle).trim() : undefined,
      details: caseDetails,
      urgency: urgency === 'standard' ? 'standard' : 'critical',
      caseId: caseId ? String(caseId).trim() : undefined,
    });

    return res.status(201).json({
      success: true,
      message: 'Case created and recorded successfully in Admin Case Pipeline.',
      caseId: newLead.id,
      lead: newLead,
    });
  } catch (err: any) {
    console.error('Lead submission error:', err);
    return res.status(500).json({
      success: false,
      error: 'An unexpected internal error occurred while recording your case.',
    });
  }
};

app.post(['/leads', '/api/leads'], handleLeadSubmission);

// ----------------------------------------------------
// Admin Authentication & Session Management
// ----------------------------------------------------
app.post(['/admin/login', '/api/admin/login'], async (req, res) => {
  try {
    const username = req.body?.username || req.body?.adminId;
    const password = req.body?.password;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Both username and password are required.',
      });
    }

    const expectedUsername = getAdminUsername();
    const expectedPassword = getAdminPassword();

    if (!expectedPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid username or password.',
      });
    }

    const usernameMatch =
      String(username).trim().toLowerCase() === expectedUsername.toLowerCase();
    const providedPassword = String(password).trim();
    const passwordMatch = safeCompare(providedPassword, expectedPassword);

    if (!usernameMatch || !passwordMatch) {
      await new Promise((resolve) => setTimeout(resolve, 350));
      return res.status(401).json({
        success: false,
        error: 'Invalid username or password.',
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const sessionDurationMs = 24 * 60 * 60 * 1000;
    const session: AdminSession = {
      token,
      username: expectedUsername,
      createdAt: Date.now(),
      expiresAt: Date.now() + sessionDurationMs,
    };

    serverlessSessions.set(token, session);

    return res.status(200).json({
      success: true,
      token,
      username: expectedUsername,
      expiresIn: sessionDurationMs / 1000,
    });
  } catch (err: any) {
    console.error('Admin login error:', err);
    return res.status(500).json({ success: false, error: 'Login service error' });
  }
});

app.post(['/admin/logout', '/api/admin/logout'], (req, res) => {
  const authHeader = req.headers.authorization;
  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.body && req.body.token) {
    token = String(req.body.token).trim();
  }

  if (token) {
    serverlessSessions.delete(token);
  }

  return res.status(200).json({ success: true, message: 'Logged out successfully.' });
});

app.post(['/admin/verify', '/api/admin/verify'], (req, res) => {
  const session = getAuthenticatedSession(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      valid: false,
      error: 'Session is invalid or expired.',
    });
  }

  return res.status(200).json({
    success: true,
    valid: true,
    username: session.username,
    expiresAt: session.expiresAt,
  });
});

app.get(['/admin/status', '/api/admin/status'], (req, res) => {
  const session = getAuthenticatedSession(req);
  if (!session) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  return res.status(200).json({
    success: true,
    username: getAdminUsername(),
    hasEnvPasswordConfigured: Boolean(getAdminPassword()),
    activeSessionsCount: serverlessSessions.size,
  });
});

// ----------------------------------------------------
// Admin Leads Management (CRUD)
// ----------------------------------------------------
app.get(['/admin/leads', '/api/admin/leads'], (req, res) => {
  const session = getAuthenticatedSession(req);
  if (!session) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Valid admin session required.' });
  }

  const leads = getAllLeads();
  return res.status(200).json({ success: true, leads });
});

app.post(['/admin/leads', '/api/admin/leads'], (req, res) => {
  const session = getAuthenticatedSession(req);
  if (!session) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Valid admin session required.' });
  }

  const { action, id, status, notes, ...leadData } = req.body || {};

  if (action === 'update_status' && id) {
    const updated = updateLeadStatusRecord(id, status as LeadStatus);
    if (!updated) return res.status(404).json({ success: false, error: 'Case not found' });
    return res.status(200).json({ success: true, lead: updated });
  }

  if (action === 'update_notes' && id) {
    const updated = updateLeadNotesRecord(id, notes || '');
    if (!updated) return res.status(404).json({ success: false, error: 'Case not found' });
    return res.status(200).json({ success: true, lead: updated });
  }

  if (action === 'delete' && id) {
    const deleted = deleteLeadRecord(id);
    if (!deleted) return res.status(404).json({ success: false, error: 'Case not found' });
    return res.status(200).json({ success: true, message: 'Case deleted successfully' });
  }

  const lead = createLeadRecord(leadData);
  return res.status(201).json({ success: true, lead });
});

app.patch(['/admin/leads', '/api/admin/leads'], (req, res) => {
  const session = getAuthenticatedSession(req);
  if (!session) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Valid admin session required.' });
  }

  const { id, status, notes } = req.body || {};
  if (!id) {
    return res.status(400).json({ success: false, error: 'Case ID is required' });
  }

  if (status) {
    const updated = updateLeadStatusRecord(id, status as LeadStatus);
    if (!updated) return res.status(404).json({ success: false, error: 'Case not found' });
    return res.status(200).json({ success: true, lead: updated });
  }

  if (notes !== undefined) {
    const updated = updateLeadNotesRecord(id, notes);
    if (!updated) return res.status(404).json({ success: false, error: 'Case not found' });
    return res.status(200).json({ success: true, lead: updated });
  }

  return res.status(400).json({ success: false, error: 'No update parameters specified.' });
});

app.delete(['/admin/leads', '/api/admin/leads'], (req, res) => {
  const session = getAuthenticatedSession(req);
  if (!session) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Valid admin session required.' });
  }

  const id = req.query?.id || req.body?.id;
  if (!id) {
    return res.status(400).json({ success: false, error: 'Case ID is required' });
  }

  const deleted = deleteLeadRecord(String(id));
  if (!deleted) return res.status(404).json({ success: false, error: 'Case not found' });
  return res.status(200).json({ success: true, message: 'Case deleted successfully' });
});

// ----------------------------------------------------
// Admin Site Config
// ----------------------------------------------------
app.post(['/admin/site-config', '/api/admin/site-config'], (req, res) => {
  const session = getAuthenticatedSession(req);
  if (!session) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const config = updateStoredSiteConfig(req.body || {});
  return res.status(200).json({ success: true, config });
});

// ----------------------------------------------------
// Admin Change Password
// ----------------------------------------------------
app.post(['/admin/change-password', '/api/admin/change-password'], (req, res) => {
  const session = getAuthenticatedSession(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Valid admin session required.',
    });
  }

  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || String(newPassword).trim().length < 6) {
    return res.status(400).json({
      success: false,
      error: 'New password must be at least 6 characters long.',
    });
  }

  const expectedPassword = getAdminPassword();
  const providedCurrent = String(currentPassword).trim();

  if (!expectedPassword || !safeCompare(providedCurrent, expectedPassword)) {
    return res.status(401).json({
      success: false,
      error: 'Current password does not match.',
    });
  }

  return res.json({
    success: true,
    message: 'To change the admin password permanently, update the ADMIN_PASSWORD environment variable in your Vercel project settings.'
  });
});

// ----------------------------------------------------
// Public Customer Support Chat Endpoints
// ----------------------------------------------------

// Start a new support conversation
app.post(['/chat/start', '/api/chat/start'], (req, res) => {
  try {
    const { name, email, platform, message } = req.body || {};

    const visitorName = String(name || '').trim();
    const visitorEmail = String(email || '').trim().toLowerCase();
    const text = String(message || '').trim();
    const plat = (platform as PlatformType) || 'other';

    if (!visitorName || visitorName.length < 2) {
      return res.status(400).json({ success: false, error: 'Please enter your name.' });
    }

    if (!visitorEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(visitorEmail)) {
      return res.status(400).json({ success: false, error: 'A valid email address is required so we can reply to your case.' });
    }

    if (!text || text.length < 3) {
      return res.status(400).json({ success: false, error: 'Please enter a message explaining your case (minimum 3 characters).' });
    }

    if (text.length > 5000) {
      return res.status(400).json({ success: false, error: 'Message exceeds maximum allowable length (5000 characters).' });
    }

    const { conversation, accessToken } = createConversationRecord({
      name: visitorName,
      email: visitorEmail,
      platform: plat,
      message: text,
    });

    return res.status(201).json({
      success: true,
      message: 'Support inquiry created successfully.',
      conversationId: conversation.id,
      accessToken,
      conversation,
    });
  } catch (err: any) {
    console.error('Error starting chat conversation:', err);
    return res.status(500).json({ success: false, error: 'Could not create support message. Please try again.' });
  }
});

// Fetch visitor conversation by ID and secure accessToken
app.get(['/chat/:id', '/api/chat/:id'], (req, res) => {
  try {
    const { id } = req.params;
    const token = String(req.query.token || req.headers['x-chat-token'] || '').trim();

    if (!token) {
      return res.status(401).json({ success: false, error: 'Secure conversation token required.' });
    }

    const convo = getConversationByToken(id, token);
    if (!convo) {
      return res.status(404).json({ success: false, error: 'Conversation not found or access token invalid.' });
    }

    // Mark visitor messages as read by visitor
    if (convo.unreadByVisitor) {
      convo.unreadByVisitor = false;
      const all = getAllConversations();
      saveAllConversations(all.map((c) => (c.id === convo.id ? convo : c)));
    }

    return res.status(200).json({ success: true, conversation: convo });
  } catch (err: any) {
    console.error('Error fetching chat conversation:', err);
    return res.status(500).json({ success: false, error: 'Error loading conversation.' });
  }
});

// Add message from visitor to existing conversation
app.post(['/chat/:id/message', '/api/chat/:id/message'], (req, res) => {
  try {
    const { id } = req.params;
    const { token, message } = req.body || {};

    const accessToken = String(token || req.headers['x-chat-token'] || '').trim();
    const text = String(message || '').trim();

    if (!accessToken) {
      return res.status(401).json({ success: false, error: 'Secure conversation token required.' });
    }

    if (!text || text.length < 1) {
      return res.status(400).json({ success: false, error: 'Message text cannot be empty.' });
    }

    if (text.length > 5000) {
      return res.status(400).json({ success: false, error: 'Message exceeds maximum length.' });
    }

    const result = addVisitorMessageRecord(id, accessToken, text);
    if (!result.success || !result.conversation) {
      return res.status(403).json({ success: false, error: result.error || 'Failed to send message.' });
    }

    return res.status(200).json({
      success: true,
      conversation: result.conversation,
    });
  } catch (err: any) {
    console.error('Error sending message:', err);
    return res.status(500).json({ success: false, error: 'Could not send message.' });
  }
});

// ----------------------------------------------------
// Admin Customer Messages Endpoints (Session Protected)
// ----------------------------------------------------

// List all conversations
app.get(['/admin/conversations', '/api/admin/conversations'], (req, res) => {
  const session = getAuthenticatedSession(req);
  if (!session) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Admin login required.' });
  }

  const { status } = req.query;
  let conversations = getAllConversations();

  if (status && typeof status === 'string' && status !== 'all') {
    conversations = conversations.filter((c) => c.status === status);
  }

  return res.status(200).json({
    success: true,
    conversations,
    unreadCount: conversations.filter((c) => c.unreadByAdmin).length,
  });
});

// Get single conversation details & mark read by admin
app.get(['/admin/conversations/:id', '/api/admin/conversations/:id'], (req, res) => {
  const session = getAuthenticatedSession(req);
  if (!session) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Admin login required.' });
  }

  const { id } = req.params;
  const convo = getConversationById(id);
  if (!convo) {
    return res.status(404).json({ success: false, error: 'Conversation not found.' });
  }

  if (convo.unreadByAdmin) {
    convo.unreadByAdmin = false;
    const all = getAllConversations();
    saveAllConversations(all.map((c) => (c.id === convo.id ? convo : c)));
  }

  return res.status(200).json({ success: true, conversation: convo });
});

// Admin sends reply to visitor
app.post(['/admin/conversations/:id/reply', '/api/admin/conversations/:id/reply'], (req, res) => {
  const session = getAuthenticatedSession(req);
  if (!session) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Admin login required.' });
  }

  const { id } = req.params;
  const { replyText, senderName } = req.body || {};

  const text = String(replyText || '').trim();
  if (!text) {
    return res.status(400).json({ success: false, error: 'Reply text cannot be empty.' });
  }

  const name = String(senderName || 'META RESOLVE Specialist').trim();
  const result = addAdminReplyRecord(id, text, name);

  if (!result.success || !result.conversation) {
    return res.status(404).json({ success: false, error: result.error || 'Failed to post reply.' });
  }

  return res.status(200).json({
    success: true,
    conversation: result.conversation,
  });
});

// Admin updates conversation status
app.patch(['/admin/conversations/:id/status', '/api/admin/conversations/:id/status'], (req, res) => {
  const session = getAuthenticatedSession(req);
  if (!session) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Admin login required.' });
  }

  const { id } = req.params;
  const { status } = req.body || {};

  if (!status) {
    return res.status(400).json({ success: false, error: 'Status is required.' });
  }

  const updated = updateConversationStatusRecord(id, status as ConversationStatus);
  if (!updated) {
    return res.status(404).json({ success: false, error: 'Conversation not found.' });
  }

  return res.status(200).json({ success: true, conversation: updated });
});

// Default 404 for unhandled API paths
app.all('*', (req, res) => {
  res.status(404).json({ success: false, error: `API route not found: ${req.method} ${req.originalUrl || req.url}` });
});

// Export default serverless handler for Vercel
export default function handler(req: any, res: any) {
  return app(req, res);
}

export { app };
