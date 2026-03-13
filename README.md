# 💬 Encrypted Chat App

A real-time, peer-to-peer chat application built with **Next.js 16**, **Supabase**, and **Tailwind CSS v4**. Features include user authentication, friend connections, live messaging via Supabase Broadcast, and real-time presence tracking.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Authentication** | Email/password signup & login with username support |
| **User Search** | Search users by username and send connection requests |
| **Friend Requests** | Real-time pending request notifications with accept/decline |
| **Contacts List** | View accepted contacts with live presence indicators |
| **Real-time Chat** | Instant messaging via Supabase Broadcast channels |
| **Presence System** | Active / Idle / Offline status, updated in real-time |
| **Idle Detection** | Auto-transitions to "Idle" after 1 minute of inactivity |
| **Offline UI** | Message input disabled when peer is offline |
| **Chat Management** | Clear all chat history per conversation |
| **Contact Management** | Clear all contacts (reflected in real-time for both users) |
| **Local Persistence** | Messages stored in `localStorage` for offline access |

---

## 🛠 Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router)
- **Backend/Auth:** [Supabase](https://supabase.com/) (Auth, Database, Realtime)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/)
- **Language:** TypeScript
- **Runtime:** React 19

---

## 📁 Project Structure

```
src/
├── app/
│   ├── auth/callback/route.ts   # OAuth callback handler
│   ├── chat/[username]/page.tsx  # Chat page (real-time messaging)
│   ├── dashboard/page.tsx        # Dashboard (search, requests, contacts)
│   ├── login/page.tsx            # Login page
│   ├── signup/page.tsx           # Multi-step signup page
│   ├── page.tsx                  # Home (redirects based on auth)
│   ├── layout.tsx                # Root layout
│   └── globals.css               # Global styles
├── components/
│   ├── ContactsList.tsx          # Accepted contacts with presence
│   ├── PendingRequests.tsx       # Incoming friend requests
│   └── SearchUsers.tsx           # User search & connect
├── hooks/
│   ├── useLocalChat.ts           # localStorage chat persistence
│   └── usePresence.ts            # Supabase Presence hook
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # Browser Supabase client
│   │   └── server.ts             # Server Supabase client
│   └── types.ts                  # Shared TypeScript types
└── proxy.ts                      # Route protection middleware
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- A [Supabase](https://supabase.com/) project

### 1. Clone the Repository

```bash
git clone https://github.com/AyeMyintHtet/encrypted-chatapp.git
cd encrypted-chatapp
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Set Up the Database

Run the following SQL in the **Supabase SQL Editor**:

```sql
-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Connections table (friend requests)
CREATE TABLE IF NOT EXISTS connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (requester_id, receiver_id)
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;

-- Profiles RLS policies
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- Connections RLS policies
CREATE POLICY "Users can view own connections"
  ON connections FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can create connections"
  ON connections FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Users can update own connections"
  ON connections FOR UPDATE
  USING (auth.uid() = requester_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can delete own connections"
  ON connections FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = receiver_id);

-- Auto-create profile on signup via trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, username)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.id::text)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Enable Realtime for connections
ALTER PUBLICATION supabase_realtime ADD TABLE connections;
ALTER TABLE connections REPLICA IDENTITY FULL;
```

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📖 How to Use

### Sign Up
1. Go to `/signup`
2. Enter your email → click **Continue**
3. Fill in your name, username, and password → click **Create Account**

### Log In
1. Go to `/login`
2. Enter your **email or username** and password → click **Sign In**

### Search & Connect
1. On the **Dashboard**, type a username in the search bar
2. Click **Connect** to send a friend request
3. The other user will see the request in **Pending Requests** (real-time)

### Accept / Decline Requests
1. Incoming requests appear under **Pending Requests**
2. Click **Accept** to add as a contact, or **Decline** to dismiss

### Chat
1. Click on a contact to open the chat page
2. Type a message and press **Enter** or click the send button
3. Messages are delivered in real-time via Supabase Broadcast

### Presence Status
| Status | When |
|--------|------|
| 🟢 **Active** | User is currently in the chat page |
| 🟡 **Idle** | User is in chat but inactive for 1+ minute |
| 🔴 **Offline** | User is on the dashboard or has closed the app |

> When a peer is offline, the message input is disabled with a banner notification.

### Clear Data
- **Clear All Chat** — Button appears in the chat header when messages exist
- **Clear All Contacts** — Button appears in the contacts section when contacts exist (changes reflect in real-time for both users)

---

## 🚢 Deployment

Deploy to [Vercel](https://vercel.com/) with one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new?utm_medium=default-template&filter=next.js)

Make sure to add your environment variables in the Vercel project settings.

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
