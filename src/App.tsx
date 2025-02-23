import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp, ArrowDown, Send, Bot, X, Trash2 } from 'lucide-react';
import { chatDb, type Message } from './lib/db';

interface CurrentUser {
  id: string;
  name: string;
  avatar: string;
}

// AI Agent configuration
const AI_AGENT = {
  id: 'ai-agent',
  name: 'AI Assistant',
  avatar: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=100&h=100&fit=crop'
};

// Avatar options for users
const AVATAR_OPTIONS = [
  {
    url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop',
    label: 'デフォルト'
  },
  {
    url: 'https://images.unsplash.com/photo-1544725176-7c40e5a71c5e?w=100&h=100&fit=crop',
    label: 'アニメ風'
  },
  {
    url: 'https://images.unsplash.com/photo-1511367461989-f85a21fda167?w=100&h=100&fit=crop',
    label: 'モノクロ'
  },
  {
    url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
    label: '女性'
  },
  {
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
    label: '男性'
  }
];

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

async function generateAIResponse(prompt: string): Promise<string> {
  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${import.meta.env.VITE_GOOGLE_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }]
      })
    });

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error('Error generating AI response:', error);
    return 'Sorry, I encountered an error while processing your request.';
  }
}

function LoginModal({ onLogin }: { onLogin: (user: CurrentUser) => void }) {
  const [name, setName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_OPTIONS[0].url);
  const [customAvatar, setCustomAvatar] = useState('');
  const [useCustomAvatar, setUseCustomAvatar] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onLogin({
        id: crypto.randomUUID(),
        name: name.trim(),
        avatar: useCustomAvatar ? customAvatar.trim() || AVATAR_OPTIONS[0].url : selectedAvatar
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md animate-slideIn">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">ログイン</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              名前
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="名前を入力してください"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-4">
              アバターを選択
            </label>
            <div className="grid grid-cols-5 gap-4 mb-8">
              {AVATAR_OPTIONS.map((avatar, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => {
                    setSelectedAvatar(avatar.url);
                    setUseCustomAvatar(false);
                  }}
                  className="relative group flex flex-col items-center"
                >
                  <div className={`w-10 h-10 rounded-full overflow-hidden ${
                    selectedAvatar === avatar.url && !useCustomAvatar
                      ? 'ring-2 ring-blue-500'
                      : 'ring-1 ring-transparent hover:ring-blue-300'
                  } transition-all duration-200`}>
                    <img
                      src={avatar.url}
                      alt={avatar.label}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="mt-1 text-xs text-gray-600 bg-white px-2 py-0.5 rounded-full shadow-sm whitespace-nowrap">
                    {avatar.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center mb-2">
              <input
                type="checkbox"
                id="useCustomAvatar"
                checked={useCustomAvatar}
                onChange={(e) => setUseCustomAvatar(e.target.checked)}
                className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
              />
              <label htmlFor="useCustomAvatar" className="ml-2 text-sm text-gray-700">
                カスタムアバターを使用
              </label>
            </div>
            {useCustomAvatar && (
              <input
                type="url"
                value={customAvatar}
                onChange={(e) => setCustomAvatar(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="画像URLを入力してください"
              />
            )}
          </div>

          <button
            type="submit"
            className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
          >
            チャットを始める
          </button>
        </form>
      </div>
    </div>
  );
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      const container = chatContainerRef.current;
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    // Initialize database
    chatDb.init().then(() => {
      setMessages(chatDb.getMessages());
      setIsLoading(false);
      // Initial scroll to bottom after loading messages
      requestAnimationFrame(scrollToBottom);
    });

    // Subscribe to changes
    const unsubscribe = chatDb.subscribe((newMessages, isNewMessage) => {
      setMessages(newMessages);
      // If it's a new message, scroll to bottom
      if (isNewMessage) {
        requestAnimationFrame(scrollToBottom);
      }
    });

    return unsubscribe;
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() && currentUser) {
      await chatDb.insertMessage({
        user_id: currentUser.id,
        user_name: currentUser.name,
        user_avatar: currentUser.avatar,
        text: newMessage.trim()
      });
      setNewMessage('');
    }
  };

  const handleAIGenerate = async () => {
    if (!currentUser || isGenerating || !newMessage.trim()) return;

    setIsGenerating(true);
    const userMessage = newMessage.trim();
    
    // First, send the user's message
    await chatDb.insertMessage({
      user_id: currentUser.id,
      user_name: currentUser.name,
      user_avatar: currentUser.avatar,
      text: userMessage
    });
    
    try {
      const aiResponse = await generateAIResponse(userMessage);
      
      await chatDb.insertMessage({
        user_id: AI_AGENT.id,
        user_name: AI_AGENT.name,
        user_avatar: AI_AGENT.avatar,
        text: aiResponse
      });
    } catch (error) {
      console.error('Error generating AI response:', error);
    } finally {
      setIsGenerating(false);
      setNewMessage('');
    }
  };

  const handleClear = () => {
    setNewMessage('');
  };

  const handleClearAllMessages = () => {
    chatDb.clearMessages();
    setShowClearConfirm(false);
  };

  const scrollToTop = () => {
    chatContainerRef.current?.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const scrollTop = target.scrollTop;
    const scrollHeight = target.scrollHeight;
    const clientHeight = target.clientHeight;
    
    // Show scroll-to-top button when scrolled down more than 300px
    setShowScrollTop(scrollTop > 300);
    
    // Show scroll-to-bottom button when not at the bottom
    // Using a threshold of 100px from the bottom
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    setShowScrollBottom(distanceFromBottom > 100);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      handleAIGenerate();
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setMessages([]);
    setNewMessage('');
    setIsGenerating(false);
    setShowClearConfirm(false);
    setShowScrollTop(false);
    setShowScrollBottom(false);
  };

  if (!currentUser) {
    return <LoginModal onLogin={setCurrentUser} />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  const isMessageEmpty = !newMessage.trim();

  return (
    <div className="fixed inset-0 flex flex-col bg-gray-100">
      {/* Floating header */}
      <div className="bg-white/95 backdrop-blur-sm shadow-md p-4 z-20">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">Chat App</h1>
          <div className="flex items-center space-x-2">
            <span className="text-gray-600">{currentUser.name}</span>
            <button
              onClick={handleLogout}
              className="rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 hover:opacity-80 transition-opacity"
              title="ログアウト"
            >
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-8 h-8 rounded-full object-cover"
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  img.src = AVATAR_OPTIONS[0].url;
                }}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full max-w-4xl mx-auto">
          <div 
            ref={chatContainerRef}
            onScroll={handleScroll}
            className="h-full overflow-y-auto p-4"
          >
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className="flex items-start space-x-3 animate-slideIn"
                >
                  <img
                    src={message.user_avatar}
                    alt={message.user_name}
                    className="w-10 h-10 rounded-full object-cover"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      img.src = AVATAR_OPTIONS[0].url;
                    }}
                  />
                  <div>
                    <p className="font-medium text-gray-800">{message.user_name}</p>
                    <div className="mt-1 bg-white rounded-lg px-4 py-2 shadow-sm">
                      {message.text}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Fixed input at bottom */}
      <div className="bg-white border-t shadow-[0_-2px_10px_rgba(0,0,0,0.1)] p-4 z-20">
        <form onSubmit={handleSend} className="max-w-4xl mx-auto flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="メッセージを入力..."
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
            />
            {newMessage && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={isMessageEmpty}
            title="Enter"
            className={`bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors ${
              isMessageEmpty ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'
            }`}
          >
            <Send className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleAIGenerate}
            disabled={isGenerating || !newMessage.trim()}
            title="Ctrl + Enter"
            className={`bg-purple-500 text-white px-4 py-2 rounded-lg transition-colors ${
              isGenerating || !newMessage.trim() ? 'opacity-50 cursor-not-allowed' : 'hover:bg-purple-600'
            }`}
          >
            <Bot className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </form>
      </div>

      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-24 right-6 bg-gray-800 text-white p-3 rounded-full shadow-lg hover:bg-gray-700 transition-colors animate-fadeIn"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}

      {showScrollBottom && (
        <button
          onClick={scrollToBottom}
          className="fixed bottom-24 right-16 bg-gray-800 text-white p-3 rounded-full shadow-lg hover:bg-gray-700 transition-colors animate-fadeIn"
        >
          <ArrowDown className="w-5 h-5" />
        </button>
      )}

      {/* Clear All Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-30">
          <div className="bg-white rounded-lg p-6 w-full max-w-md animate-slideIn">
            <h2 className="text-xl font-bold text-gray-800 mb-4">全てのメッセージを削除</h2>
            <p className="text-gray-600 mb-6">本当に全てのメッセージを削除しますか？この操作は取り消せません。</p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleClearAllMessages}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;