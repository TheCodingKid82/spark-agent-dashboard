'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Send, Eye, MessageCircle } from 'lucide-react';
import type { Agent } from '@/types/agent';

interface ChatMessage {
  id: string;
  timestamp: number;
  from: string;
  to: string;
  content: string;
  type?: 'text' | 'task' | 'report' | 'escalation';
  read?: boolean;
}

interface Conversation {
  id: string;
  participants: string[];
  lastMessage: ChatMessage;
  unreadCount: number;
  updatedAt: number;
}

interface ChatPanelProps {
  agents: Agent[];
  isOpen: boolean;
  onClose: () => void;
  initialChatId?: string | null;
  currentUserId: string;
}

export default function ChatPanel({ agents, isOpen, onClose, initialChatId, currentUserId }: ChatPanelProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [viewMode, setViewMode] = useState<'conversations' | 'observer'>('conversations');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load data when panel opens
  useEffect(() => {
    if (isOpen) {
      loadConversations();
      if (initialChatId) {
        setSelectedConv(initialChatId);
        setViewMode('conversations');
      }
    }
  }, [isOpen, initialChatId]);

  // Poll for updates while open
  useEffect(() => {
    if (!isOpen) return;
    
    const interval = setInterval(() => {
      loadConversations();
      if (selectedConv || viewMode === 'observer') {
        loadMessages();
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [isOpen, selectedConv, viewMode]);

  // Load messages when conversation changes
  useEffect(() => {
    if (selectedConv || viewMode === 'observer') {
      loadMessages();
    }
  }, [selectedConv, viewMode]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadConversations() {
    try {
      const res = await fetch('/api/chat/conversations');
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch (e) {
      console.error('Failed to load conversations:', e);
    }
  }

  async function loadMessages() {
    setLoading(true);
    try {
      let url = '/api/chat/messages?';
      if (viewMode === 'observer') {
        url += 'all=true&limit=200';
      } else if (selectedConv === 'team-chat') {
        // Load all broadcast messages
        url += 'broadcast=true&limit=100';
      } else if (selectedConv) {
        // Handle both formats: "dm-andrew-atlas" and "andrew:atlas"
        let parts: string[];
        if (selectedConv.startsWith('dm-')) {
          parts = selectedConv.replace('dm-', '').split('-');
        } else {
          parts = selectedConv.split(':');
        }
        if (parts.length >= 2) {
          url += `participant1=${parts[0]}&participant2=${parts[1]}&limit=100`;
        } else {
          return;
        }
      } else {
        return;
      }
      
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (e) {
      console.error('Failed to load messages:', e);
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage() {
    if (!newMessage.trim() || !selectedConv) return;
    
    // Handle team chat (broadcast to all agents)
    const isTeamChat = selectedConv === 'team-chat';
    
    // Extract recipient from conversation ID
    let recipient: string;
    if (isTeamChat) {
      recipient = 'broadcast';
    } else {
      // Handle both formats: "dm-andrew-atlas" and "andrew:atlas"
      let parts: string[];
      if (selectedConv.startsWith('dm-')) {
        parts = selectedConv.replace('dm-', '').split('-');
      } else {
        parts = selectedConv.split(':');
      }
      const found = parts.find(p => p !== currentUserId);
      if (!found) return;
      recipient = found;
    }

    setSending(true);
    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: currentUserId,
          to: recipient,
          content: newMessage,
        }),
      });
      
      const data = await res.json();
      if (data.success) {
        setNewMessage('');
        // Optimistically add message
        const newMsg: ChatMessage = {
          id: data.messageId || `temp-${Date.now()}`,
          timestamp: Date.now(),
          from: currentUserId,
          to: recipient,
          content: newMessage,
          type: 'text',
        };
        setMessages(prev => [...prev, newMsg]);
        
        // If agent responded (direct DM), add that too
        if (data.agentResponse) {
          const responseMsg: ChatMessage = {
            id: `resp-${Date.now()}`,
            timestamp: Date.now() + 1,
            from: recipient,
            to: currentUserId,
            content: data.agentResponse,
            type: 'text',
          };
          setTimeout(() => {
            setMessages(prev => [...prev, responseMsg]);
          }, 500);
        }
        
        // If team chat responses, add each agent's response
        if (data.teamResponses && data.teamResponses.length > 0) {
          const agentIdByName = (name: string) => {
            const agent = agents.find(a => a.name === name);
            return agent?.id || name.toLowerCase();
          };
          
          data.teamResponses.forEach((tr: { agent: string; response: string }, i: number) => {
            const responseMsg: ChatMessage = {
              id: `team-resp-${Date.now()}-${i}`,
              timestamp: Date.now() + 100 + (i * 100),
              from: agentIdByName(tr.agent),
              to: 'broadcast',
              content: tr.response,
              type: 'text',
            };
            setTimeout(() => {
              setMessages(prev => [...prev, responseMsg]);
            }, 500 + (i * 300)); // Stagger responses
          });
        }
      } else {
        alert('Failed to send: ' + (data.error || 'Unknown error'));
      }
    } catch (e) {
      console.error('Send error:', e);
      alert('Failed to send message');
    } finally {
      setSending(false);
    }
  }

  const getAgentName = useCallback((id: string): string => {
    if (id === 'andrew') return 'Andrew';
    if (id === currentUserId) return 'You';
    const agent = agents.find(a => a.id === id);
    return agent?.name || id;
  }, [agents, currentUserId]);

  const getAgentEmoji = useCallback((id: string): string => {
    if (id === 'andrew') return '👑';
    const agent = agents.find(a => a.id === id);
    return agent?.emoji || '🤖';
  }, [agents]);

  function formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  function startChatWith(agentId: string) {
    const parts = [currentUserId, agentId].sort();
    setSelectedConv(`dm-${parts[0]}-${parts[1]}`);
    setViewMode('conversations');
  }

  if (!isOpen) return null;

  const selectedRecipient = selectedConv
    ? (selectedConv.startsWith('dm-')
        ? selectedConv.replace('dm-', '').split('-')
        : selectedConv.split(':')
      ).find(p => p !== currentUserId)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[900px] h-[700px] bg-[#0d0d12] rounded-xl shadow-2xl border border-gray-800 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-[#12121a]">
          <div className="flex items-center gap-3">
            <MessageCircle className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold text-white">Agent Communications</h2>
          </div>
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex rounded-lg overflow-hidden border border-gray-700">
              <button
                onClick={() => setViewMode('conversations')}
                className={`px-3 py-1.5 text-sm flex items-center gap-1.5 ${
                  viewMode === 'conversations'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                <MessageCircle className="w-4 h-4" />
                Chats
              </button>
              <button
                onClick={() => { setViewMode('observer'); setSelectedConv(null); }}
                className={`px-3 py-1.5 text-sm flex items-center gap-1.5 ${
                  viewMode === 'observer'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                <Eye className="w-4 h-4" />
                Observer
              </button>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-800 rounded-lg">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-64 border-r border-gray-800 flex flex-col bg-[#0a0a0f]">
            {/* Team Chat - All Hands */}
            <div className="p-3 border-b border-gray-800">
              <button
                onClick={() => { setSelectedConv('team-chat'); setViewMode('conversations'); }}
                className={`w-full px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${
                  selectedConv === 'team-chat'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gradient-to-r from-indigo-600/20 to-purple-600/20 hover:from-indigo-600/30 hover:to-purple-600/30 text-indigo-300 border border-indigo-500/30'
                }`}
              >
                <span className="text-lg">🏛️</span>
                <div className="text-left">
                  <div className="font-medium">Team Chat</div>
                  <div className="text-xs opacity-70">Message all agents at once</div>
                </div>
              </button>
            </div>

            {/* Agent Quick Start */}
            <div className="p-3 border-b border-gray-800">
              <div className="text-xs text-gray-500 mb-2">Direct message:</div>
              <div className="flex flex-wrap gap-1.5">
                {agents.filter(a => a.id !== currentUserId).map(agent => (
                  <button
                    key={agent.id}
                    onClick={() => startChatWith(agent.id)}
                    className={`px-2 py-1 rounded text-xs flex items-center gap-1 transition-colors ${
                      agent.status === 'online'
                        ? 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                        : 'bg-gray-900 text-gray-500'
                    }`}
                    title={agent.purpose}
                  >
                    <span>{agent.emoji}</span>
                    <span>{agent.name}</span>
                    {agent.status === 'online' && (
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto">
              {conversations.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">
                  No conversations yet.<br />
                  Click an agent above to start.
                </div>
              ) : (
                conversations.map(conv => {
                  const otherParticipant = conv.participants.find(p => p !== currentUserId);
                  return (
                    <button
                      key={conv.id}
                      onClick={() => { setSelectedConv(conv.id); setViewMode('conversations'); }}
                      className={`w-full p-3 text-left hover:bg-gray-800/50 border-b border-gray-800/50 transition-colors ${
                        selectedConv === conv.id ? 'bg-gray-800/70' : ''
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-medium text-white text-sm flex items-center gap-1.5">
                          <span>{getAgentEmoji(otherParticipant || '')}</span>
                          {conv.participants.map(p => getAgentName(p)).join(' ↔ ')}
                        </span>
                        {conv.unreadCount > 0 && (
                          <span className="bg-indigo-500 text-white text-xs px-1.5 rounded-full">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 truncate mt-1">
                        {conv.lastMessage.content.slice(0, 40)}...
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {formatTime(conv.updatedAt)}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Chat Area */}
          <div className="flex-1 flex flex-col bg-[#0d0d12]">
            {/* Chat Header */}
            <div className="px-4 py-3 border-b border-gray-800 bg-[#12121a]">
              <h3 className="font-medium text-white flex items-center gap-2">
                {viewMode === 'observer' ? (
                  <>
                    <Eye className="w-4 h-4 text-indigo-400" />
                    Observer Mode - All Agent Communications
                  </>
                ) : selectedConv === 'team-chat' ? (
                  <>
                    <span>🏛️</span>
                    Team Chat - All Agents
                  </>
                ) : selectedRecipient ? (
                  <>
                    <span>{getAgentEmoji(selectedRecipient)}</span>
                    Chat with {getAgentName(selectedRecipient)}
                  </>
                ) : (
                  'Select a conversation'
                )}
              </h3>
              {viewMode === 'observer' && (
                <p className="text-xs text-gray-500 mt-0.5">
                  See all agent-to-agent messages (they don&apos;t know you&apos;re watching)
                </p>
              )}
              {selectedConv === 'team-chat' && (
                <p className="text-xs text-gray-500 mt-0.5">
                  Your message will be sent to all agents simultaneously
                </p>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loading && messages.length === 0 ? (
                <div className="text-center text-gray-500 py-8">Loading...</div>
              ) : messages.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  {viewMode === 'observer'
                    ? 'No agent-to-agent messages yet'
                    : 'No messages yet. Send one to start the conversation.'}
                </div>
              ) : (
                messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.from === currentUserId ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[70%] rounded-xl px-4 py-2.5 ${
                        msg.from === currentUserId
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-800 text-gray-100'
                      }`}
                    >
                      {/* Show sender info in observer mode or team chat */}
                      {(viewMode === 'observer' || selectedConv === 'team-chat') && msg.from !== currentUserId && (
                        <div className="text-xs opacity-70 mb-1 flex items-center gap-1">
                          <span>{getAgentEmoji(msg.from)}</span>
                          <span className="font-medium">{getAgentName(msg.from)}</span>
                          {viewMode === 'observer' && <span>→ {getAgentName(msg.to)}</span>}
                        </div>
                      )}
                      <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                      <div className="text-xs opacity-50 mt-1.5">{formatTime(msg.timestamp)}</div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            {viewMode === 'conversations' && (selectedRecipient || selectedConv === 'team-chat') && (
              <div className="p-4 border-t border-gray-800 bg-[#12121a]">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    placeholder={selectedConv === 'team-chat' ? 'Message all agents...' : `Message ${getAgentName(selectedRecipient || '')}...`}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                    disabled={sending}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={sending || !newMessage.trim()}
                    className={`px-4 py-2.5 ${selectedConv === 'team-chat' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500' : 'bg-indigo-600 hover:bg-indigo-500'} disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-xl flex items-center gap-2 transition-colors`}
                  >
                    <Send className="w-4 h-4" />
                    {sending ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
