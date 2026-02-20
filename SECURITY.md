# 🔐 Security Update

## Application Security Status: SECURE & CONTROLLED ✅

---

## 1. Cross-Site Scripting (XSS) Protection

The application meets modern security standards against XSS attacks with the following implementations:

- **React Automatic Escaping**  
  All rendered data is automatically escaped by React, ensuring that malicious scripts are displayed as plain text instead of being executed.

- **No Usage of `dangerouslySetInnerHTML`**  
  The project does not use this API, which is one of the most common XSS attack vectors in React applications.

- **Content Security Policy (CSP)**  
  A strict CSP is implemented in `index.html` to restrict external script sources and prevent malicious code injection.

- **Supabase Token Management**  
  Session tokens are managed by Supabase (standard SPA practice using LocalStorage). As long as no XSS vulnerability exists, tokens remain secure.

---

## 2. Brute Force Protection

Authentication is handled by Supabase Auth, which includes strong backend protection:

- **Automatic Rate Limiting**  
  Supabase limits repeated login attempts from the same IP or account within a short period.

- **Secure Password Hashing**  
  Passwords are stored using strong hashing algorithms (Bcrypt / Argon2).

- **Improved UI Feedback**  
  The `AuthControl.tsx` file has been updated to specifically handle the **"Too Many Requests"** error, providing clearer feedback to users when rate limiting occurs.

---

# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 2.0.x   | ✅ |
| 1.2.x   | ✅ |
| 1.1.x   | ❌ |

---

## Reporting a Vulnerability

If you discover a security vulnerability within this project, please contact the project maintainer via email.  
All security vulnerabilities will be addressed promptly and with high priority.

---

# Security Best Practices for Deployment

## 1. Environment Variables

- **NEVER** commit `.env` files containing real secret keys to version control.
- Use the `VITE_` prefix only for variables that are safe to expose to the client browser.
- Keep `SUPABASE_SERVICE_ROLE_KEY` strictly on your backend server or secure local environment.

---

## 2. Mapbox Token Restrictions

- Log in to your Mapbox dashboard.
- Navigate to the **Tokens** section.
- Add **URL Restrictions** to your public token (`pk...`).
- Include your production domain and localhost to prevent token abuse and quota theft.

---

## 3. Supabase Row Level Security (RLS)

- Ensure RLS is enabled on all database tables.
- Restrict `INSERT`, `UPDATE`, and `DELETE` operations to authenticated users only.
- Use `auth.uid()`-based policies to enforce data ownership.

Example:

```sql
-- Allow public read access
CREATE POLICY "Public maps are viewable by everyone"
ON maps FOR SELECT USING (true);

-- Allow users to insert their own maps
CREATE POLICY "Users can insert their own maps"
ON maps FOR INSERT
WITH CHECK (auth.uid() = user_id);