# Privacy Policy


Welcome to the **Encrypted Chat App**. Your privacy and the security of your data are our highest priorities. This Privacy Policy explains how we handle your information when you use our application.

---

## 1. Information We Collect

### 1.1 Account Information
When you create an account, we collect:
- **Email Address:** Used for authentication and account communication (managed via Supabase Auth).
- **Username & Display Name:** To identify you to other users within the app.
- **Password:** Stored securely as a cryptographic hash (never as plaintext so that anyone including us cannot access your password).
- **Avatar:** An optional profile picture you may choose to upload.

### 1.2 Communication Data (End-to-End Encrypted)
- **Message Content:** All messages sent between users are **end-to-end encrypted (E2EE)** using Web Crypto (ECDH + AES-GCM). This means plaintext content is never accessible to us or any third parties; it is only readable by you and the recipient.
- **Local Persistence:** Encrypted message payloads are stored in your browser's `localStorage` for cross-session access so that your messages are on your device only and not even our servers can access them.

### 1.3 Metadata (Non-Encrypted)
To enable real-time features, we process the following metadata:
- **Transmission Info:** Sender ID, recipient ID, and message timestamps.
- **Connection Graph:** Friend requests (sent/received) and your list of accepted contacts.
- **Presence Status:** Real-time online visibility (Active/Idle/Offline).

### 1.4 Technical Data
- **Session Data:** Authentication tokens used to keep you signed in.
- **Device Information:** For managing active sessions and push notifications (via OneSignal).

---

## 2. How We Use Information

We use the collected data to:
- Provide and maintain the real-time chat service.
- Securely authenticate your identity.
- Notify you of new incoming messages or friend requests.
- Manage your presence status to inform your contacts.

**We do not sell your personal information to third parties.**

---

## 3. Data Control & Deletion

### 3.1 User-Driven Deletion
You have direct control over your data:
- **Clear Chat History:** You can clear chat history for individual conversations at any time.
- **Clear Contacts:** You can remove contacts from your list in real-time.

### 3.2 Automated Account Deletion (Inactivity)
You can schedule your account for permanent deletion via the Profile Settings:
- You may choose a grace period of **7, 30, or 90 days**.
- If you remain inactive (no login) for that duration, your account and all associated profile data will be **permanently deleted**.
- **Auto-Cancellation:** Logging back into your account during the grace period will automatically cancel the deletion schedule.


---

## 4. Security Measures

- **Encryption:** We use industry-standard Web Crypto APIs for client-side encryption.
- **Row Level Security (RLS):** Our database (Supabase) enforces strict RLS policies to ensure users can only access data they are authorized to view.
- **Hashed Passwords:** We do not store plaintext passwords.

---

## 5. Children's Privacy

Our service is not intended for individuals under the age of 13. We do not knowingly collect personal information from children. If you become aware that a child has provided us with personal data, please contact us for deletion.

---

## 6. Changes to This Policy

We may update this Privacy Policy from time to time. We recommend reviewing this page periodically for any changes. Continued use of the service after changes are posted constitutes acceptance of the updated policy.

---

## 7. Contact Us

If you have any questions or concerns about this Privacy Policy, please contact the  administrator.
