# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.0.x   | :white_check_mark: |
| 1.2.x   | :white_check_mark: |
| 1.1.x   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability within this project, please send an e-mail to the project maintainer. All security vulnerabilities will be promptly addressed.

## Security Best Practices for Deployment

### 1. Environment Variables
- **NEVER** commit `.env` files containing real secret keys (like `SUPABASE_SERVICE_ROLE_KEY`) to version control.
- Use `VITE_` prefix only for variables that are safe to expose to the client browser (e.g., Mapbox Public Token, Supabase Anon Key).
- Keep `SUPABASE_SERVICE_ROLE_KEY` strictly on your backend server or local machine for administrative scripts.

### 2. Mapbox Token Restrictions
- Log in to your [Mapbox Account](https://account.mapbox.com/).
- Navigate to the **Tokens** section.
- Edit your public token (`pk....`) and add **URL Restrictions**.
- Add your production domain (e.g., `https://landscape360.jcdigital.co.id`) and localhost (`http://localhost:5173`) to the allowed list.
- This prevents others from stealing your token and using your quota.

### 3. Supabase Row Level Security (RLS)
- Ensure RLS is **enabled** on all tables in your Supabase database.
- Create policies that restrict `INSERT`, `UPDATE`, and `DELETE` operations to authenticated users only.
- Example Policy:
  ```sql
  -- Allow anyone to read public maps
  CREATE POLICY "Public maps are viewable by everyone" ON maps FOR SELECT USING ( true );

  -- Allow users to insert their own maps
  CREATE POLICY "Users can insert their own maps" ON maps FOR INSERT WITH CHECK ( auth.uid() = user_id );
  ```

### 4. Content Security Policy (CSP)
- This project includes a strict CSP in `index.html` to prevent XSS attacks.
- If you add new external services (e.g., a new analytics tool or image host), you must update the `meta` tag in `index.html` to allow the new domain.

### 5. Dependency Management
- Regularly run `npm audit` to check for vulnerable dependencies.
- Update packages using `npm update` to keep security patches current.
