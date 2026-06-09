# RepairFund - Multi-User Fund Tracker

A Dockerized web application for tracking shared repair fund contributions with multi-user support, admin controls, and multiple UI themes.

## Features

- **Multi-user authentication** with JWT-based session management
- **Shared fund tracking** — all users see all contributions in real-time
- **Admin controls**:
  - Create and delete user accounts
  - Force password resets on users
  - View all contributions and user list
- **Forced password changes** — admin-reset passwords require immediate change on next login
- **Fund balance tracking** — real-time total of all contributions
- **6 selectable themes** — dark and light options, switched per-browser via the admin panel
- **Responsive design** — works on desktop and mobile browsers

## Quick Start

### Prerequisites
- Docker & Docker Compose

### Running the App

```bash
# Start the containers
docker compose up --build -d

# App will be available at http://localhost:3000
```

### Default Admin Credentials

```
Username: admin
Password: (set via ADMIN_INITIAL_PASS in .env)
```

**Important:** Change this password on first login.

## User Guide

### Login
1. Navigate to `http://localhost:3000`
2. Enter your username and password
3. If your password was reset, you'll be directed to change it

### Dashboard
- **Total Fund Balance** — displays the sum of all contributions
- **Add Contribution** — submit a dollar amount with optional description and date
- **All Contributions** — view all contributions from all users (newest first)
- **Account Info** — view your username and role

### Admin Panel (Admin Users Only)
- **Add New User** — create new user accounts with initial passwords
- **Manage Users** — reset passwords or delete users
- **Appearance** — switch the UI theme (saved per-browser)
- **Password Reset Flow**:
  1. Click "Reset Password" on a user
  2. A temporary password is generated and displayed (show-once)
  3. Share this with the user
  4. User logs in with temp password → forced to change it
  5. User sets their new password → redirected to dashboard

### Logout
Click the "Logout" button in the navbar to end your session.

## Themes

7 selectable themes (dark and light). See [THEMES.md](THEMES.md) for screenshots and details.

## Architecture

### Backend Stack
- **Node.js + Express** — HTTP server and API
- **MariaDB** — persistent data storage
- **JWT** — authentication tokens (stored in httpOnly cookies)
- **bcryptjs** — password hashing

### Frontend Stack
- **HTML5** — semantic markup
- **Bootstrap 5** — responsive components
- **CSS custom properties** — per-theme variable system
- **Vanilla JavaScript** — dynamic interactions

### Database Schema

**users table**
```
id, username, password_hash, role (admin|user), force_password_change, created_at
```

**entries table**
```
id, user_id, amount, description, entry_date, created_at
```

## API Endpoints

### Authentication (Public)
- `POST /api/auth/login` — Login with credentials
- `POST /api/auth/logout` — Logout

### Authentication (Protected)
- `POST /api/auth/change-password` — Change password (forced after admin reset)

### Entries (Protected)
- `GET /api/entries` — Get all contributions (all users)
- `GET /api/entries/summary` — Get total fund balance
- `POST /api/entries` — Create new contribution
- `DELETE /api/entries/:id` — Delete own contribution (admin can delete any)

### Users (Protected - Admin Only)
- `GET /api/users` — List all users
- `POST /api/users` — Create new user
- `DELETE /api/users/:id` — Delete user
- `POST /api/users/:id/reset-password` — Reset user password

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

```env
DB_HOST=db
DB_USER=repair_user
DB_PASS=repair_password_123
DB_NAME=repair_fund
JWT_SECRET=your_jwt_secret_key_change_in_production
ADMIN_INITIAL_PASS=Admin1234!
NODE_ENV=development
```

## Security Notes

- Passwords are hashed with bcryptjs (10 salt rounds)
- JWTs are stored in httpOnly cookies (prevents XSS theft)
- Admin functions are role-gated on the backend
- SQL injection protected via parameterized queries
- CORS restricted to localhost during development

## Troubleshooting

### Port 3000 already in use
```bash
docker compose down
docker compose up
```

### Database connection errors
Check that the MariaDB container is running and healthy:
```bash
docker compose ps
```

### Can't log in
- Verify credentials match `ADMIN_INITIAL_PASS` in `.env`
- Check the browser console for error messages
- Ensure cookies are enabled

## Development

To modify the app:
1. Edit frontend files in `frontend/` (changes are live via volume mount — no rebuild needed)
2. Edit backend files in `backend/` (restart the container to apply changes)
3. Modify the database schema in `backend/db/init.sql` (only applies on a fresh database volume)

To rebuild after backend changes:
```bash
docker compose down
docker compose up --build
```
