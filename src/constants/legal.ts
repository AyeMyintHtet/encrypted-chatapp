export const PRIVACY_POLICY = `
<h1 class="text-xl md:text-2xl font-bold mb-4">Privacy Policy</h1>
<p class="mb-4">Welcome to the <strong>Encrypted Chat App</strong>. Your privacy and the security of your data are our highest priorities. This Privacy Policy explains how we handle your information when you use our application.</p>

<hr class="my-6 border-t border-gray-700 opacity-20" />

<h2 class="text-lg md:text-xl font-semibold mt-6 mb-3">1. Information We Collect</h2>

<h3 class="font-bold mt-4 mb-2">1.1 Account Information</h3>
<p class="mb-2">When you create an account, we collect:</p>
<ul class="list-disc pl-5 mb-4 space-y-1">
  <li><strong>Email Address:</strong> Used for authentication and account communication (managed via Supabase Auth).</li>
  <li><strong>Username & Display Name:</strong> To identify you to other users within the app.</li>
  <li><strong>Password:</strong> Stored securely as a cryptographic hash (never as plaintext so that anyone including us cannot access your password).</li>
  <li><strong>Avatar:</strong> An optional profile picture you may choose to upload.</li>
</ul>

<h3 class="font-bold mt-4 mb-2">1.2 Communication Data (End-to-End Encrypted)</h3>
<ul class="list-disc pl-5 mb-4 space-y-1">
  <li><strong>Message Content:</strong> All messages sent between users are <strong>end-to-end encrypted (E2EE)</strong> using Web Crypto (ECDH + AES-GCM). This means plaintext content is never accessible to us or any third parties; it is only readable by you and the recipient.</li>
  <li><strong>Local Persistence:</strong> Encrypted message payloads are stored in your browser's <code>localStorage</code> for cross-session access so that your messages are on your device only and not even our servers can access them.</li>
</ul>

<h3 class="font-bold mt-4 mb-2">1.3 Metadata (Non-Encrypted)</h3>
<p class="mb-2">To enable real-time features, we process the following metadata:</p>
<ul class="list-disc pl-5 mb-4 space-y-1">
  <li><strong>Transmission Info:</strong> Sender ID, recipient ID, and message timestamps.</li>
  <li><strong>Connection Graph:</strong> Friend requests (sent/received) and your list of accepted contacts.</li>
  <li><strong>Presence Status:</strong> Real-time online visibility (Active/Idle/Offline).</li>
</ul>

<h3 class="font-bold mt-4 mb-2">1.4 Technical Data</h3>
<ul class="list-disc pl-5 mb-4 space-y-1">
  <li><strong>Session Data:</strong> Authentication tokens used to keep you signed in.</li>
  <li><strong>Device Information:</strong> For managing active sessions and push notifications (via OneSignal).</li>
</ul>

<hr class="my-6 border-t border-gray-700 opacity-20" />

<h2 class="text-lg md:text-xl font-semibold mt-6 mb-3">2. How We Use Information</h2>
<p class="mb-3">We use the collected data to:</p>
<ul class="list-disc pl-5 mb-4 space-y-1">
  <li>Provide and maintain the real-time chat service.</li>
  <li>Securely authenticate your identity.</li>
  <li>Notify you of new incoming messages or friend requests.</li>
  <li>Manage your presence status to inform your contacts.</li>
</ul>
<p class="mt-4 font-semibold">We do not sell your personal information to third parties.</p>

<hr class="my-6 border-t border-gray-700 opacity-20" />

<h2 class="text-lg md:text-xl font-semibold mt-6 mb-3">3. Data Control & Deletion</h2>

<h3 class="font-bold mt-4 mb-2">3.1 User-Driven Deletion</h3>
<p class="mb-2">You have direct control over your data:</p>
<ul class="list-disc pl-5 mb-4 space-y-1">
  <li><strong>Clear Chat History:</strong> You can clear chat history for individual conversations at any time.</li>
  <li><strong>Clear Contacts:</strong> You can remove contacts from your list in real-time.</li>
</ul>

<h3 class="font-bold mt-4 mb-2">3.2 Automated Account Deletion (Inactivity)</h3>
<p class="mb-2">You can schedule your account for permanent deletion via the Profile Settings:</p>
<ul class="list-disc pl-5 mb-4 space-y-1">
  <li>You may choose a grace period of <strong>7, 30, or 90 days</strong>.</li>
  <li>If you remain inactive (no login) for that duration, your account and all associated profile data will be <strong>permanently deleted</strong>.</li>
  <li><strong>Auto-Cancellation:</strong> Logging back into your account during the grace period will automatically cancel the deletion schedule.</li>
</ul>

<hr class="my-6 border-t border-gray-700 opacity-20" />

<h2 class="text-lg md:text-xl font-semibold mt-6 mb-3">4. Security Measures</h2>
<ul class="list-disc pl-5 mb-4 space-y-1">
  <li><strong>Encryption:</strong> We use industry-standard Web Crypto APIs for client-side encryption.</li>
  <li><strong>Row Level Security (RLS):</strong> Our database (Supabase) enforces strict RLS policies to ensure users can only access data they are authorized to view.</li>
  <li><strong>Hashed Passwords:</strong> We do not store plaintext passwords.</li>
</ul>

<hr class="my-6 border-t border-gray-700 opacity-20" />

<h2 class="text-lg md:text-xl font-semibold mt-6 mb-3">5. Children's Privacy</h2>
<p class="mb-4">Our service is not intended for individuals under the age of 13. We do not knowingly collect personal information from children. If you become aware that a child has provided us with personal data, please contact us for deletion.</p>

<hr class="my-6 border-t border-gray-700 opacity-20" />

<h2 class="text-lg md:text-xl font-semibold mt-6 mb-3">6. Changes to This Policy</h2>
<p class="mb-4">We may update this Privacy Policy from time to time. We recommend reviewing this page periodically for any changes. Continued use of the service after changes are posted constitutes acceptance of the updated policy.</p>

<hr class="my-6 border-t border-gray-700 opacity-20" />

<h2 class="text-lg md:text-xl font-semibold mt-6 mb-3">7. Contact Us</h2>
<p class="mb-4">If you have any questions or concerns about this Privacy Policy, please contact the administrator.</p>
`;

export const TERMS_CONDITIONS = `
<h1 class="text-xl md:text-2xl font-bold mb-4">Terms and Conditions</h1>
<p class="mb-4">Welcome to the <strong>Encrypted Chat App</strong>. By using our application, you agree to comply with and be bound by the following terms. Please read them carefully.</p>

<hr class="my-6 border-t border-gray-700 opacity-20" />

<h2 class="text-lg md:text-xl font-semibold mt-6 mb-3">1. Acceptance of Terms</h2>
<p class="mb-4">By creating an account or using the app, you agree to these Terms and Conditions. If you do not agree, you must not use the application.</p>

<h2 class="text-lg md:text-xl font-semibold mt-6 mb-3">2. User Accounts & Security</h2>
<ul class="list-disc pl-5 mb-4 space-y-1">
  <li><strong>Responsibility:</strong> You are responsible for maintaining the confidentiality of your account credentials (email, username, and password).</li>
  <li><strong>Prohibited Conduct:</strong> You agree not to use the application for any illegal activities, harassment, or to distribute harmful content.</li>
  <li><strong>Account Protection:</strong> You must notify us immediately of any unauthorized use of your account.</li>
</ul>

<h2 class="text-lg md:text-xl font-semibold mt-6 mb-3">3. End-to-End Encryption (E2EE) & Data Loss</h2>
<ul class="list-disc pl-5 mb-4 space-y-1">
  <li><strong>Encryption Model:</strong> Our application utilizes client-side end-to-end encryption. Message contents are encrypted on your device and can only be decrypted by the intended recipient.</li>
  <li><strong>No Recovery:</strong> Because we do not store your private keys or your plaintext messages, <strong>we cannot recover your chat history</strong> if you clear your <code>localStorage</code> or lose access to your device.</li>
  <li><strong>Metadata:</strong> You acknowledge that while message content is encrypted, certain metadata (sender/recipient IDs, timestamps, presence status) is necessary for the operation of the service and is not encrypted.</li>
</ul>

<h2 class="text-lg md:text-xl font-semibold mt-6 mb-3">4. Account Deletion & Inactivity</h2>
<ul class="list-disc pl-5 mb-4 space-y-1">
  <li><strong>User-Scheduled Deletion:</strong> You have the option to schedule your account for deletion after a period of inactivity (7, 30, or 90 days).</li>
  <li><strong>Automatic Purge:</strong> If the selected inactivity period expires without a login, your account, profile, and all associated data will be <strong>permanently and irretrievably deleted</strong>.</li>
  <li><strong>Cancellation:</strong> Logging back into your account before the grace period expires will automatically cancel the scheduled deletion.</li>
</ul>

<h2 class="text-lg md:text-xl font-semibold mt-6 mb-3">5. Service Availability & Third Parties</h2>
<ul class="list-disc pl-5 mb-4 space-y-1">
  <li><strong>Infrastructure:</strong> The service relies on third-party providers, including Supabase (Backend/Realtime) and Vercel (Hosting). We are not responsible for service interruptions caused by these providers.</li>
  <li><strong>Modifications:</strong> We reserve the right to modify or discontinue the service (or any part thereof) with or without notice at any time.</li>
</ul>

<h2 class="text-lg md:text-xl font-semibold mt-6 mb-3">6. Limitation of Liability</h2>
<p class="mb-4">The Encrypted Chat App is provided "as is" without any warranties. In no event shall the administrators or contributors be liable for any damages arising out of the use or inability to use the service, including the loss of encrypted data.</p>

<h2 class="text-lg md:text-xl font-semibold mt-6 mb-3">7. Governing Law</h2>
<p class="mb-4">These terms are governed by the laws of the jurisdiction in which the service administrator operates, without regard to its conflict of law provisions.</p>

<h2 class="text-lg md:text-xl font-semibold mt-6 mb-3">8. Changes to Terms</h2>
<p class="mb-4">We reserve the right to update these Terms and Conditions at any time. Continued use of the app after such changes constitutes your acceptance of the new terms.</p>

<hr class="my-6 border-t border-gray-700 opacity-20" />

<h2 class="text-lg md:text-xl font-semibold mt-6 mb-3">9. Contact</h2>
<p class="mb-4">For any questions regarding these Terms, please contact the administrator.</p>
`;
