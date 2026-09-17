# CourseKart

A full-stack e-learning platform where students can browse and purchase courses, track their learning progress, and rate/review courses — while instructors can create courses, manage content, and track earnings through an analytics dashboard.

Built on the MERN stack, with the database layer migrated from MongoDB/Mongoose to **Supabase (PostgreSQL)**.

---

## Features

**For Students**
- Sign up / login with email OTP verification
- Browse courses by category, view detailed course pages (curriculum, ratings, instructor info)
- Secure checkout and payments via Razorpay
- Enroll in courses and track lecture-by-lecture progress
- Rate and review purchased courses
- Manage profile, password, and view purchase history

**For Instructors**
- Create, edit, and delete courses with sections and sub-sections (video lectures)
- Upload course thumbnails and lecture videos (via Cloudinary)
- Instructor dashboard with enrollment stats and revenue charts
- Manage course status (draft / published)

**Platform**
- JWT-based authentication with role-based access control (Student / Instructor / Admin)
- Email notifications (OTP, password reset, payment confirmation, course enrollment)
- Forgot password / reset password flow
- Responsive UI with Tailwind CSS

---

## Tech Stack

**Frontend**
- React 18 + Vite
- Redux Toolkit (state management)
- React Router v6
- Tailwind CSS
- Axios
- Chart.js (instructor analytics)
- React Hook Form

**Backend**
- Node.js + Express
- Supabase (PostgreSQL) — database
- JWT + bcrypt — authentication
- Cloudinary — media storage (thumbnails, videos)
- Nodemailer — transactional emails
- Razorpay — payment gateway

---

## Architecture & Flow

```
┌─────────────┐        REST API (JSON)        ┌──────────────┐
│   Frontend   │ ───────────────────────────▶ │   Backend     │
│ React + Vite │ ◀─────────────────────────── │ Express.js    │
└─────────────┘        JWT in headers          └──────┬───────┘
                                                       │
                        ┌──────────────────────────────┼──────────────────────────┐
                        ▼                              ▼                          ▼
                ┌───────────────┐            ┌─────────────────┐        ┌────────────────┐
                │   Supabase     │            │   Cloudinary     │        │   Razorpay      │
                │  (PostgreSQL)  │            │ (images/videos)  │        │   (payments)    │
                └───────────────┘            └─────────────────┘        └────────────────┘
```

**Request flow (example — a student buying a course):**
1. Student logs in → backend verifies credentials against Supabase, issues a JWT.
2. Student browses `Catalog` → frontend calls `GET /api/v1/course/getAllCourses` / `showAllCategories`.
3. On checkout, frontend calls `POST /api/v1/payment/capturePayment` → backend creates a Razorpay order.
4. Razorpay checkout completes → frontend calls `POST /api/v1/payment/verifyPayment` → backend verifies the signature, enrolls the student in the course (writes to Supabase), and triggers a confirmation email.
5. Student can now access the course under **Dashboard → Enrolled Courses**, and progress updates are saved via `POST /api/v1/course/updateCourseProgress` as lectures are completed.

**Auth flow:**
1. `POST /api/v1/auth/sendotp` — generates and emails an OTP, stored temporarily in Supabase.
2. `POST /api/v1/auth/signup` — verifies the OTP, hashes the password (bcrypt), creates the user + profile rows.
3. `POST /api/v1/auth/login` — verifies credentials, returns a signed JWT (also set as an httpOnly cookie).
4. Protected routes use the `auth` middleware to verify the JWT, and `isStudent` / `isInstructor` / `isAdmin` middleware to enforce role-based access.

---

## Project Structure

```
courseKart/
├── backend/
│   ├── config/          # Supabase, Cloudinary, Razorpay client setup
│   ├── controllers/     # Route handlers (auth, course, payments, profile, ...)
│   ├── middleware/       # JWT auth & role-based access guards
│   ├── routes/           # Express route definitions
│   ├── mail/templates/    # HTML email templates
│   ├── utils/             # Helpers (image upload, mail sender, Supabase row → DTO transform)
│   └── server.js          # App entry point
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── common/     # Shared UI (navbar, footer, buttons, ...)
    │   │   └── core/        # Feature-specific components (Auth, Dashboard, Catalog, ViewCourse, ...)
    │   ├── pages/           # Route-level pages (Home, Login, Signup, Dashboard, CourseDetails, ...)
    │   ├── services/        # API call layer (axios)
    │   ├── slices/          # Redux Toolkit slices
    │   └── reducer/         # Root reducer
    └── vite.config.js
```

---

## Getting Started (Local Setup)

### Prerequisites
- Node.js (v18+)
- A [Supabase](https://supabase.com) project (URL + service role/secret key)
- Cloudinary, Razorpay, and SMTP (email) accounts for full functionality

### 1. Clone the repo
```bash
git clone <your-repo-url>
cd courseKart
```

### 2. Backend setup
```bash
cd backend
npm install
```
Create a `.env` file in `backend/` with:
```
PORT=5000
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_KEY=your_supabase_secret_key   # must be the secret/service_role key, not the publishable/anon key (RLS will block writes otherwise)
JWT_SECRET=your_jwt_secret
CLOUD_NAME=your_cloudinary_cloud_name
API_KEY=your_cloudinary_api_key
API_SECRET=your_cloudinary_api_secret
FOLDER_NAME=your_cloudinary_folder
MAIL_HOST=your_smtp_host
MAIL_USER=your_smtp_user
MAIL_PASS=your_smtp_password
RAZORPAY_KEY=your_razorpay_key
RAZORPAY_SECRET=your_razorpay_secret
FRONTEND_URL=http://localhost:5173
```
Run the server:
```bash
npm run dev
```

### 3. Frontend setup
```bash
cd frontend
npm install
```
Create a `.env` file in `frontend/` with:
```
VITE_APP_BASE_URL=http://localhost:5000/api/v1
VITE_APP_RAZORPAY_KEY=your_razorpay_key
```
Run the dev server:
```bash
npm run dev
```
Frontend runs on `http://localhost:5173`, backend on `http://localhost:5000`.

---

## Deployment

- **Frontend** → deploy the `frontend/` directory on [Vercel](https://vercel.com) (build command `npm run build`, output `dist`).
- **Backend** → deploy the `backend/` directory on [Render](https://render.com) (build command `npm install`, start command `npm start`).
- Set the environment variables listed above on each platform's dashboard.
- After deploying, update `VITE_APP_BASE_URL` (frontend) to point to the live backend URL, and `FRONTEND_URL` (backend) to point to the live frontend URL so CORS and email links work correctly.

---

## License
See [LICENSE](./LICENSE).
