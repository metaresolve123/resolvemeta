import { ChatConversation, ConversationStatus, PlatformType } from '../types';
import { getStoredAdminToken as getAdminSessionToken } from './adminStorage';

const CHAT_SESSION_KEY = 'metaresolve_visitor_chat_session';

export interface StoredVisitorChatSession {
  conversationId: string;
  accessToken: string;
  visitorName: string;
  visitorEmail: string;
}

export function getStoredVisitorChatSession(): StoredVisitorChatSession | null {
  try {
    const raw = localStorage.getItem(CHAT_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveStoredVisitorChatSession(session: StoredVisitorChatSession): void {
  try {
    localStorage.setItem(CHAT_SESSION_KEY, JSON.stringify(session));
  } catch (err) {
    console.error('Failed to save chat session to localStorage', err);
  }
}

export function clearStoredVisitorChatSession(): void {
  try {
    localStorage.removeItem(CHAT_SESSION_KEY);
  } catch (err) {
    console.error('Failed to clear chat session', err);
  }
}

// ----------------------------------------------------
// Public Visitor Chat API
// ----------------------------------------------------

export async function startChatConversation(data: {
  name: string;
  email: string;
  platform: PlatformType;
  message: string;
}): Promise<{ success: boolean; conversation?: ChatConversation; accessToken?: string; error?: string }> {
  try {
    const res = await fetch('/api/chat/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const body = await res.json();
    if (!res.ok || !body.success) {
      return { success: false, error: body.error || 'Failed to start support conversation.' };
    }

    if (body.conversationId && body.accessToken) {
      saveStoredVisitorChatSession({
        conversationId: body.conversationId,
        accessToken: body.accessToken,
        visitorName: data.name,
        visitorEmail: data.email,
      });
    }

    return {
      success: true,
      conversation: body.conversation,
      accessToken: body.accessToken,
    };
  } catch (err: any) {
    console.error('Error starting chat:', err);
    return { success: false, error: err?.message || 'Network error connecting to support chat.' };
  }
}

export async function fetchVisitorConversation(
  id: string,
  token: string
): Promise<{ success: boolean; conversation?: ChatConversation; error?: string }> {
  try {
    const res = await fetch(`/api/chat/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}`, {
      method: 'GET',
      headers: {
        'x-chat-token': token,
      },
    });

    const body = await res.json();
    if (!res.ok || !body.success) {
      return { success: false, error: body.error || 'Failed to load conversation.' };
    }

    return { success: true, conversation: body.conversation };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error loading messages.' };
  }
}

export async function sendVisitorMessage(
  id: string,
  token: string,
  message: string
): Promise<{ success: boolean; conversation?: ChatConversation; error?: string }> {
  try {
    const res = await fetch(`/api/chat/${encodeURIComponent(id)}/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-chat-token': token,
      },
      body: JSON.stringify({ token, message }),
    });

    const body = await res.json();
    if (!res.ok || !body.success) {
      return { success: false, error: body.error || 'Failed to send message.' };
    }

    return { success: true, conversation: body.conversation };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error sending message.' };
  }
}

// ----------------------------------------------------
// Admin Protected Chat API
// ----------------------------------------------------

function getAdminHeaders(): HeadersInit {
  const token = getAdminSessionToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function fetchAdminConversations(
  statusFilter?: string
): Promise<{ success: boolean; conversations: ChatConversation[]; unreadCount: number; error?: string }> {
  try {
    const url = statusFilter && statusFilter !== 'all'
      ? `/api/admin/conversations?status=${encodeURIComponent(statusFilter)}`
      : '/api/admin/conversations';

    const res = await fetch(url, {
      method: 'GET',
      headers: getAdminHeaders(),
    });

    const body = await res.json();
    if (!res.ok || !body.success) {
      return { success: false, conversations: [], unreadCount: 0, error: body.error || 'Failed to load conversations.' };
    }

    return {
      success: true,
      conversations: body.conversations || [],
      unreadCount: body.unreadCount || 0,
    };
  } catch (err: any) {
    return { success: false, conversations: [], unreadCount: 0, error: err?.message || 'Network error' };
  }
}

export async function fetchAdminConversation(
  id: string
): Promise<{ success: boolean; conversation?: ChatConversation; error?: string }> {
  try {
    const res = await fetch(`/api/admin/conversations/${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: getAdminHeaders(),
    });

    const body = await res.json();
    if (!res.ok || !body.success) {
      return { success: false, error: body.error || 'Failed to load conversation details.' };
    }

    return { success: true, conversation: body.conversation };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error' };
  }
}

export async function sendAdminReply(
  id: string,
  replyText: string,
  senderName?: string
): Promise<{ success: boolean; conversation?: ChatConversation; error?: string }> {
  try {
    const res = await fetch(`/api/admin/conversations/${encodeURIComponent(id)}/reply`, {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify({ replyText, senderName }),
    });

    const body = await res.json();
    if (!res.ok || !body.success) {
      return { success: false, error: body.error || 'Failed to send reply.' };
    }

    return { success: true, conversation: body.conversation };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error sending reply.' };
  }
}

export async function updateAdminConversationStatus(
  id: string,
  status: ConversationStatus
): Promise<{ success: boolean; conversation?: ChatConversation; error?: string }> {
  try {
    const res = await fetch(`/api/admin/conversations/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      headers: getAdminHeaders(),
      body: JSON.stringify({ status }),
    });

    const body = await res.json();
    if (!res.ok || !body.success) {
      return { success: false, error: body.error || 'Failed to update status.' };
    }

    return { success: true, conversation: body.conversation };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error updating status.' };
  }
}
