import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MessageSquare,
  X,
  Send,
  Shield,
  ShieldCheck,
  CheckCircle2,
  Clock,
  RefreshCw,
  AlertCircle,
  Instagram,
  Facebook,
  Video,
  Send as TelegramIcon,
  Twitter,
  MessageCircle,
  HelpCircle,
  ChevronDown,
  Sparkles
} from 'lucide-react';
import { PlatformType, ChatConversation, ChatMessage } from '../types';
import {
  getStoredVisitorChatSession,
  saveStoredVisitorChatSession,
  clearStoredVisitorChatSession,
  startChatConversation,
  fetchVisitorConversation,
  sendVisitorMessage
} from '../utils/chatApi';

interface SupportChatWidgetProps {
  isOpenExternal?: boolean;
  onCloseExternal?: () => void;
  defaultPlatform?: PlatformType;
}

const PLATFORM_OPTIONS: { id: PlatformType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'instagram', label: 'Instagram', icon: Instagram },
  { id: 'facebook', label: 'Facebook', icon: Facebook },
  { id: 'tiktok', label: 'TikTok', icon: Video },
  { id: 'telegram', label: 'Telegram', icon: TelegramIcon },
  { id: 'x', label: 'X (Twitter)', icon: Twitter },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { id: 'other', label: 'Other', icon: HelpCircle },
];

export const SupportChatWidget: React.FC<SupportChatWidgetProps> = ({
  isOpenExternal,
  onCloseExternal,
  defaultPlatform = 'instagram'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnreadReply, setHasUnreadReply] = useState(false);

  // Form state
  const [visitorName, setVisitorName] = useState('');
  const [visitorEmail, setVisitorEmail] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformType>(defaultPlatform);
  const [initialMessage, setInitialMessage] = useState('');

  // Active conversation state
  const [activeConversation, setActiveConversation] = useState<ChatConversation | null>(null);
  const [accessToken, setAccessToken] = useState<string>('');
  const [replyInput, setReplyInput] = useState('');

  // Status flags
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isPolling, setIsPolling] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync external open state if provided
  useEffect(() => {
    if (typeof isOpenExternal === 'boolean') {
      setIsOpen(isOpenExternal);
    }
  }, [isOpenExternal]);

  // Load existing session from localStorage on mount
  useEffect(() => {
    const session = getStoredVisitorChatSession();
    if (session?.conversationId && session?.accessToken) {
      setAccessToken(session.accessToken);
      setVisitorName(session.visitorName || '');
      setVisitorEmail(session.visitorEmail || '');

      fetchVisitorConversation(session.conversationId, session.accessToken).then((res) => {
        if (res.success && res.conversation) {
          setActiveConversation(res.conversation);
          if (res.conversation.unreadByVisitor) {
            setHasUnreadReply(true);
          }
        }
      });
    }
  }, []);

  // Poll for new messages when open and active conversation exists
  useEffect(() => {
    if (!isOpen || !activeConversation || !accessToken) return;

    const pollInterval = setInterval(async () => {
      setIsPolling(true);
      const res = await fetchVisitorConversation(activeConversation.id, accessToken);
      setIsPolling(false);

      if (res.success && res.conversation) {
        setActiveConversation((prev) => {
          if (!prev) return res.conversation!;
          // If message count increased, scroll to bottom
          if (res.conversation!.messages.length > prev.messages.length) {
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
          }
          return res.conversation!;
        });
        setHasUnreadReply(false);
      }
    }, 3500);

    return () => clearInterval(pollInterval);
  }, [isOpen, activeConversation?.id, accessToken]);

  // Auto-scroll on active conversation changes
  useEffect(() => {
    if (isOpen && activeConversation?.messages?.length) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, activeConversation?.messages?.length]);

  const toggleChat = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      setHasUnreadReply(false);
    }
    if (!nextState && onCloseExternal) {
      onCloseExternal();
    }
  };

  const handleStartConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!visitorName.trim()) {
      setErrorMessage('Please enter your name.');
      return;
    }
    if (!visitorEmail.trim() || !visitorEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!initialMessage.trim() || initialMessage.trim().length < 3) {
      setErrorMessage('Please enter a message explaining your case (minimum 3 characters).');
      return;
    }

    setIsSubmitting(true);
    const res = await startChatConversation({
      name: visitorName.trim(),
      email: visitorEmail.trim(),
      platform: selectedPlatform,
      message: initialMessage.trim(),
    });
    setIsSubmitting(false);

    if (res.success && res.conversation && res.accessToken) {
      setActiveConversation(res.conversation);
      setAccessToken(res.accessToken);
      setInitialMessage('');
      setErrorMessage('');
    } else {
      setErrorMessage(res.error || 'Failed to start chat. Please try again.');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyInput.trim() || !activeConversation || !accessToken || isSendingMessage) return;

    const text = replyInput.trim();
    setReplyInput('');
    setIsSendingMessage(true);

    const res = await sendVisitorMessage(activeConversation.id, accessToken, text);
    setIsSendingMessage(false);

    if (res.success && res.conversation) {
      setActiveConversation(res.conversation);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } else {
      setErrorMessage(res.error || 'Failed to deliver message.');
    }
  };

  const handleStartNewCase = () => {
    if (window.confirm('Start a new inquiry? Your previous conversation can still be accessed via its reference ID.')) {
      clearStoredVisitorChatSession();
      setActiveConversation(null);
      setAccessToken('');
      setInitialMessage('');
      setErrorMessage('');
    }
  };

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <>
      {/* ---------------------------------------------------- */}
      {/* FLOATING CHAT BUTTON (Bottom-Right, Dark Charcoal & Neon-Lime Glow) */}
      {/* ---------------------------------------------------- */}
      {/* ---------------------------------------------------- */}
      {/* FLOATING CHAT BUTTON (Bottom-Right, Dark Charcoal & Restrained Neon-Lime Glow) */}
      {/* ---------------------------------------------------- */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-50"
      >
        <motion.button
          whileHover={{ y: -2, scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={toggleChat}
          aria-label="Chat with META RESOLVE"
          id="floating-chat-widget-btn"
          className="relative group w-14 h-14 sm:w-15 sm:h-15 rounded-full bg-[#121A18] hover:bg-[#16221E] border-2 border-[#B7FF35]/60 hover:border-[#B7FF35] text-[#B7FF35] flex items-center justify-center shadow-[0_4px_24px_rgba(183,255,53,0.22)] hover:shadow-[0_4px_32px_rgba(183,255,53,0.4)] transition-colors duration-200 cursor-pointer backdrop-blur-md"
        >
          {isOpen ? (
            <X className="w-6 h-6 stroke-[2.5]" />
          ) : (
            <MessageSquare className="w-6 h-6 stroke-[2.2] fill-[#B7FF35]/15" />
          )}

          {/* Crisp Online Status Dot (Restrained, No distracting endless ping) */}
          {!isOpen && (
            <span className="absolute top-0 right-0 w-3.5 h-3.5 rounded-full bg-[#B7FF35] border-2 border-[#090D0D] shadow-sm pointer-events-none" />
          )}

          {/* Unread Message Pill Alert */}
          {hasUnreadReply && !isOpen && (
            <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-[#B7FF35] text-[#090D0D] text-[9px] font-mono font-bold uppercase tracking-wider shadow-md whitespace-nowrap">
              New Reply
            </span>
          )}

          {/* Floating Tooltip Label */}
          <div className="absolute bottom-full right-0 mb-3 hidden group-hover:block pointer-events-none transition-all">
            <div className="bg-[#121816]/95 backdrop-blur-md text-[#F2F5EF] text-[11px] font-mono font-semibold px-3.5 py-2 rounded-xl border border-[#B7FF35]/40 shadow-2xl whitespace-nowrap flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#B7FF35]" />
              <span>Chat with META RESOLVE</span>
            </div>
          </div>
        </motion.button>
      </motion.div>

      {/* ---------------------------------------------------- */}
      {/* CHAT PANEL MODAL / DRAWER */}
      {/* ---------------------------------------------------- */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
            className="fixed bottom-22 right-4 sm:bottom-24 sm:right-6 z-50 w-[92vw] sm:w-[410px] max-h-[82vh] h-[610px] bg-[#0E1514] border border-[#B7FF35]/40 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden backdrop-blur-xl"
            id="meta-resolve-chat-panel"
          >
            {/* Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-[#121A17] via-[#15221E] to-[#0E1614] border-b border-white/[0.08] flex items-center justify-between shrink-0 relative">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#182621] border border-[#B7FF35]/40 flex items-center justify-center text-[#B7FF35] shadow-md shadow-[#B7FF35]/15 shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-[#F2F5EF] tracking-tight flex items-center gap-1.5">
                    <span>Chat with META RESOLVE</span>
                  </h3>
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#8C9891]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#B7FF35] animate-pulse" />
                    <span>Specialist Casework Queue Active</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {activeConversation && (
                  <button
                    onClick={handleStartNewCase}
                    title="Start New Inquiry"
                    className="p-1.5 text-[#8C9891] hover:text-[#B7FF35] hover:bg-white/5 rounded-lg transition-colors cursor-pointer text-xs"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                )}

                <button
                  onClick={toggleChat}
                  className="p-1.5 text-[#8C9891] hover:text-[#F2F5EF] hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                  aria-label="Close Chat"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Top ambient highlight */}
              <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-[#B7FF35]/50 to-transparent" />
            </div>

            {/* Conversation Mode vs Initial Inquiry Form */}
            {activeConversation ? (
              /* ACTIVE CONVERSATION MESSAGES VIEW */
              <div className="flex-1 flex flex-col min-h-0 bg-[#0A0F0E]">
                {/* Case Reference & Status Bar */}
                <div className="px-4 py-2 bg-[#121917] border-b border-white/[0.06] flex items-center justify-between text-[11px] font-mono">
                  <div className="flex items-center gap-1.5 text-[#D1DDD6]">
                    <span className="text-[#8C9891]">Case Ref:</span>
                    <strong className="text-[#B7FF35] font-bold">{activeConversation.id}</strong>
                  </div>

                  <span className="px-2 py-0.5 rounded-full bg-[#182621] border border-[#B7FF35]/30 text-[#B7FF35] text-[10px] uppercase font-bold">
                    {activeConversation.status.replace('_', ' ')}
                  </span>
                </div>

                {/* Messages Container */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs sm:text-sm">
                  {/* Case Initial Confirmation Alert */}
                  <div className="p-3 rounded-xl bg-[#14201C] border border-[#B7FF35]/20 text-[11px] text-[#C4D0C9] space-y-1">
                    <div className="flex items-center gap-1.5 text-[#B7FF35] font-mono font-bold uppercase">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Case Reference Established</span>
                    </div>
                    <p>
                      Your inquiry has been routed to META RESOLVE senior recovery specialists. Keep this window open or return at any time; your conversation history is saved.
                    </p>
                  </div>

                  {/* Messages Bubble List */}
                  {activeConversation.messages.map((msg) => {
                    const isVisitor = msg.sender === 'visitor';
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isVisitor ? 'items-end' : 'items-start'}`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 text-[10px] font-mono text-[#8C9891]">
                          {!isVisitor && (
                            <span className="inline-flex items-center gap-1 text-[#B7FF35] font-bold">
                              <Shield className="w-3 h-3 text-[#B7FF35]" />
                              <span>META RESOLVE</span>
                            </span>
                          )}
                          <span>{msg.senderName}</span>
                          <span>•</span>
                          <span>{formatTimestamp(msg.timestamp)}</span>
                        </div>

                        <div
                          className={`max-w-[85%] rounded-2xl p-3.5 text-xs sm:text-[13px] leading-relaxed shadow-md ${
                            isVisitor
                              ? 'bg-[#182622] text-[#F2F5EF] border border-[#B7FF35]/30 rounded-tr-sm'
                              : 'bg-[#111716] text-[#F2F5EF] border border-white/10 rounded-tl-sm'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{msg.text}</p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input Box */}
                <form
                  onSubmit={handleSendMessage}
                  className="p-3 bg-[#111816] border-t border-white/[0.08] flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={replyInput}
                    onChange={(e) => setReplyInput(e.target.value)}
                    placeholder="Type your message to the recovery specialist..."
                    disabled={isSendingMessage}
                    className="flex-1 bg-[#0A0E0D] border border-white/10 focus:border-[#B7FF35] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#F2F5EF] placeholder-[#68736D] outline-none transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={!replyInput.trim() || isSendingMessage}
                    className="w-10 h-10 rounded-xl bg-[#B7FF35] hover:bg-[#C7FF45] text-[#090D0D] disabled:opacity-40 flex items-center justify-center transition-all cursor-pointer shrink-0 shadow-md shadow-[#B7FF35]/20 active:scale-95"
                  >
                    <Send className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </form>
              </div>
            ) : (
              /* INITIAL CASE INTAKE FORM VIEW */
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-[#0A0F0E]">
                <div className="mb-5">
                  <h4 className="text-base font-extrabold text-[#F2F5EF] tracking-tight">
                    Start a Recovery Consultation
                  </h4>
                  <p className="text-xs text-[#8C9891] mt-1 leading-relaxed">
                    Have a question about an account restriction or recovery case? Send us a message, and our team will respond through this chat.
                  </p>
                </div>

                {errorMessage && (
                  <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <form onSubmit={handleStartConversation} className="space-y-4 text-left">
                  {/* Visitor Name */}
                  <div>
                    <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[#A0AAA3] mb-1.5">
                      Your Name <span className="text-[#B7FF35]">*</span>
                    </label>
                    <input
                      type="text"
                      value={visitorName}
                      onChange={(e) => setVisitorName(e.target.value)}
                      placeholder="e.g. Alex Morgan"
                      required
                      className="w-full bg-[#121A18] border border-white/10 focus:border-[#B7FF35] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#F2F5EF] placeholder-[#68736D] outline-none transition-colors"
                    />
                  </div>

                  {/* Visitor Email */}
                  <div>
                    <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[#A0AAA3] mb-1.5">
                      Email Address <span className="text-[#B7FF35]">*</span>
                    </label>
                    <input
                      type="email"
                      value={visitorEmail}
                      onChange={(e) => setVisitorEmail(e.target.value)}
                      placeholder="name@company.com"
                      required
                      className="w-full bg-[#121A18] border border-white/10 focus:border-[#B7FF35] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#F2F5EF] placeholder-[#68736D] outline-none transition-colors"
                    />
                    <span className="text-[10px] text-[#68736D] font-mono block mt-1">
                      Used strictly for official case replies and milestone updates.
                    </span>
                  </div>

                  {/* Platform Selection */}
                  <div>
                    <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[#A0AAA3] mb-1.5">
                      Restricted Platform <span className="text-[#B7FF35]">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {PLATFORM_OPTIONS.map((plat) => {
                        const Icon = plat.icon;
                        const isSelected = selectedPlatform === plat.id;
                        return (
                          <button
                            type="button"
                            key={plat.id}
                            onClick={() => setSelectedPlatform(plat.id)}
                            className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer text-left ${
                              isSelected
                                ? 'bg-[#182621] border-[#B7FF35] text-[#B7FF35] shadow-[0_0_12px_rgba(183,255,53,0.15)]'
                                : 'bg-[#121A18] border-white/10 text-[#A0AAA3] hover:border-white/20 hover:text-white'
                            }`}
                          >
                            <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-[#B7FF35]' : 'text-[#8C9891]'}`} />
                            <span className="truncate">{plat.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Message Input */}
                  <div>
                    <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[#A0AAA3] mb-1.5">
                      Case Details / Issue <span className="text-[#B7FF35]">*</span>
                    </label>
                    <textarea
                      rows={4}
                      value={initialMessage}
                      onChange={(e) => setInitialMessage(e.target.value)}
                      placeholder="Describe what happened: e.g. account suspension, 2FA lockout, business manager disablement, or appeal notice..."
                      required
                      className="w-full bg-[#121A18] border border-white/10 focus:border-[#B7FF35] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#F2F5EF] placeholder-[#68736D] outline-none transition-colors resize-none"
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 rounded-xl bg-[#B7FF35] hover:bg-[#C7FF45] text-[#090D0D] font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(183,255,53,0.3)] hover:shadow-[0_0_30px_rgba(183,255,53,0.5)] active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 mt-2"
                  >
                    {isSubmitting ? (
                      <span>Submitting Case...</span>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Send Message</span>
                      </>
                    )}
                  </button>

                  <div className="pt-2 text-center text-[10px] font-mono text-[#68736D] flex items-center justify-center gap-1.5">
                    <Shield className="w-3 h-3 text-[#B7FF35]" />
                    <span>Confidential Case Review • No Password Required</span>
                  </div>
                </form>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
