import { createContext, useContext, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import * as chatQ from '../queries/chatQueries';
import { api } from '../services/api';

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const { user, supabase } = useAuth();
  const [chats, setChats] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [currentChatName, setCurrentChatName] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const userId = user?.id;

  const refreshChats = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await chatQ.loadChats(supabase, userId);
      setChats(data);
    } catch (err) {
      console.error('Failed to load chats:', err);
    }
  }, [supabase, userId]);

  const selectChat = useCallback(async (chatId) => {
    if (!userId) return;
    setCurrentChatId(chatId);
    const chat = chats.find(c => c.id === chatId);
    setCurrentChatName(chat?.name || 'Chat');
    try {
      const msgs = await chatQ.loadMessages(supabase, userId, chatId);
      setMessages(msgs);
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  }, [supabase, userId, chats]);

  const createNewChat = useCallback(async (name) => {
    if (!userId) return null;
    try {
      const chat = await chatQ.createChat(supabase, userId, name);
      setCurrentChatId(chat.id);
      setCurrentChatName(chat.name);
      setMessages([]);
      await refreshChats();
      return chat;
    } catch (err) {
      console.error('Failed to create chat:', err);
      return null;
    }
  }, [supabase, userId, refreshChats]);

  const removeChat = useCallback(async (chatId) => {
    if (!userId) return;
    try {
      await chatQ.deleteChat(supabase, userId, chatId);
      if (currentChatId === chatId) {
        setCurrentChatId(null);
        setCurrentChatName(null);
        setMessages([]);
      }
      await refreshChats();
    } catch (err) {
      console.error('Failed to delete chat:', err);
    }
  }, [supabase, userId, currentChatId, refreshChats]);

  const sendMessage = useCallback(async (text, settings = {}, imageData = null) => {
    if (!userId || isSending) return;
    setIsSending(true);

    try {
      // Auto-create chat if none
      let chatId = currentChatId;
      if (!chatId) {
        const name = text ? text.substring(0, 30) + (text.length > 30 ? '...' : '') : 'Image Analysis';
        const chat = await chatQ.createChat(supabase, userId, name || 'New Chat');
        chatId = chat.id;
        setCurrentChatId(chat.id);
        setCurrentChatName(chat.name);
        await refreshChats();
      }

      // Save user message
      const userMsg = await chatQ.saveMessage(supabase, userId, chatId, text || 'Please analyze this image', 'user', imageData);
      setMessages(prev => [...prev, userMsg]);

      // Call API
      let response;
      if (imageData || settings.imageMode) {
        const res = await fetch(`/api/image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: text || 'Please analyze this image',
            userId,
            mode: settings.imageModeType || 'normal',
            imageData: imageData || undefined,
          }),
        });
        response = await res.json();
      } else {
        const history = await chatQ.getConversationHistory(supabase, userId, chatId);
        const res = await fetch(`/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            history,
            userId,
            simpleLanguage: settings.simpleLanguage || false,
            mode: settings.chatMode || 'fast',
            mood: settings.mood || 'friendly',
            errorFreeMode: settings.errorFreeMode ?? true,
            systemPrompt: settings.systemPrompt || '',
          }),
        });
        response = await res.json();
      }

      // Save assistant response
      const aiContent = response.response || response.error || 'No response';
      const aiMsg = await chatQ.saveMessage(supabase, userId, chatId, aiContent, 'assistant');
      setMessages(prev => [...prev, aiMsg]);

      // Extract memory in background
      api.post('/memory/extract', { userId, message: text }).catch(() => {});

      return aiContent;
    } catch (err) {
      console.error('Send failed:', err);
      const errMsg = { id: Date.now(), content: 'Failed to get response. Please try again.', role: 'assistant', created_at: new Date().toISOString() };
      setMessages(prev => [...prev, errMsg]);
      return null;
    } finally {
      setIsSending(false);
    }
  }, [userId, supabase, currentChatId, isSending, refreshChats]);

  const value = {
    chats, currentChatId, currentChatName, messages, isLoading, isSending,
    refreshChats, selectChat, createNewChat, removeChat, sendMessage,
    setCurrentChatId, setCurrentChatName, setMessages,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used within a ChatProvider');
  return context;
}
