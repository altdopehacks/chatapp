import initSqlJs from 'sql.js';

export interface Message {
  id: string;
  text: string;
  user_id: string;
  user_name: string;
  user_avatar: string;
  created_at: string;
}

class ChatDatabase {
  private db: Database | null = null;
  private subscribers: Set<(messages: Message[], isNewMessage?: boolean) => void> = new Set();
  private ws: WebSocket | null = null;

  async init() {
    if (this.db) return;

    const SQL = await initSqlJs({
      locateFile: file => `https://sql.js.org/dist/${file}`
    });
    
    this.db = new SQL.Database();
    
    this.db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        user_name TEXT NOT NULL,
        user_avatar TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);

    // Load saved data from localStorage if it exists
    const savedData = localStorage.getItem('chatData');
    if (savedData) {
      const data = JSON.parse(savedData) as Message[];
      data.forEach(msg => this.insertMessage(msg, false));
    }

    // Initialize WebSocket connection
    this.initWebSocket();
  }

  private initWebSocket() {
    this.ws = new WebSocket('ws://localhost:3000');

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data) as Message;
      this.insertMessage(message, false);
      // Notify subscribers that this is a new message
      this.notifySubscribers(true);
    };

    this.ws.onclose = () => {
      // Attempt to reconnect after a delay
      setTimeout(() => this.initWebSocket(), 2000);
    };
  }

  subscribe(callback: (messages: Message[], isNewMessage?: boolean) => void) {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notifySubscribers(isNewMessage = false) {
    const messages = this.getMessages();
    this.subscribers.forEach(callback => callback(messages, isNewMessage));
    // Save to localStorage
    localStorage.setItem('chatData', JSON.stringify(messages));
  }

  getMessages(): Message[] {
    if (!this.db) return [];
    
    const result = this.db.exec('SELECT * FROM messages ORDER BY created_at ASC');
    if (!result.length) return [];
    
    const columns = result[0].columns;
    return result[0].values.map(row => {
      const message: any = {};
      columns.forEach((col, i) => {
        message[col] = row[i];
      });
      return message as Message;
    });
  }

  insertMessage(message: Omit<Message, 'id' | 'created_at'> | Message, broadcast = true): Message {
    if (!this.db) throw new Error('Database not initialized');

    const newMessage: Message = 'id' in message ? message as Message : {
      ...message,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString()
    };

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO messages (id, user_id, user_name, user_avatar, text, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run([
      newMessage.id,
      newMessage.user_id,
      newMessage.user_name,
      newMessage.user_avatar,
      newMessage.text,
      newMessage.created_at
    ]);
    stmt.free();

    // Broadcast the message to other clients
    if (broadcast && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(newMessage));
    }

    this.notifySubscribers(true);
    return newMessage;
  }

  clearMessages() {
    if (!this.db) throw new Error('Database not initialized');
    
    // Clear the messages table
    this.db.run('DELETE FROM messages');
    
    // Clear localStorage
    localStorage.setItem('chatData', '[]');
    
    // Notify subscribers
    this.notifySubscribers();
  }
}

export const chatDb = new ChatDatabase();