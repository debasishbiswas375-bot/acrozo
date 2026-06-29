"""
Account Management Hub - FastAPI Backend
Author: debasish biswas
Tech Stack: Python, FastAPI, PostgreSQL, Pydantic
# Google OAuth enabled - credentials loaded and fixed
# Default signup plan now always uses is_default from plans table (not settings)
# Added detailed logging for signup and login debugging
# Fixed logging configuration to ensure logs appear
# Added print statements for debugging
# FIXED: Added await conn.commit() to signup and register endpoints
"""

import os
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "zaiz.env"), override=True)
import jwt
import bcrypt
import logging
import json
import uuid
import random
import base64
import requests
import hashlib
import hmac
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, HTTPException, Depends, status, Response, File, UploadFile, Request, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import psycopg
from psycopg import AsyncConnection
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'python-scripts'))
import asyncio
from io import BytesIO
import google.generativeai as genai
import re

GEMINI_API_KEY = os.getenv("GOOGLE_API_KEY", "")
GEMINI_API_KEY_1 = os.getenv("GOOGLE_API_KEY1", os.getenv("GOOGLE_API_KEY_1", ""))
GEMINI_API_KEY_2 = os.getenv("GOOGLE_API_KEY2", os.getenv("GOOGLE_API_KEY_2", ""))
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
GEMINI_MODEL_NAME = os.getenv("GEMINI_MODEL_NAME", "gemini-3.1-flash-lite")
CONCURRENT_WORKERS = int(os.getenv("CONCURRENT_WORKERS", "10"))
try:
    from huggingface_hub import HfFileSystem
    try:
        from huggingface_hub import batch_bucket_files
    except ImportError:
        # Older huggingface_hub versions don't have batch_bucket_files
        batch_bucket_files = None  # type: ignore
    HF_HUB_AVAILABLE = True
except ImportError:
    HfFileSystem = None  # type: ignore
    batch_bucket_files = None  # type: ignore
    HF_HUB_AVAILABLE = False

# On Windows, the default ProactorEventLoop is incompatible with psycopg async.
# Switch to the SelectorEventLoop policy when running on Windows so async
# database connections work correctly during local development.
if sys.platform.startswith("win"):
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    except AttributeError:
        # Older Python versions may not have WindowsSelectorEventLoopPolicy
        pass

# HF Bucket Storage Configuration
# All files are stored directly in the deba3666/zaiz HF bucket.
# No local disk is used — works cleanly on Render (no persistent disk needed).
HF_SPACE_URL = os.getenv("HF_SPACE_URL", "https://deba3666-zaiz.hf.space").rstrip("/")
HF_TOKEN     = os.getenv("HF_TOKEN", "")
HF_BUCKET_ID = os.getenv("HF_BUCKET_ID", "deba3666/zaiz")   # namespace/bucket-name

# MinerU API Configuration
MINERU_API_KEY = os.getenv("MINERU_API_KEY", "")
MINERU_BASE_URL = "https://mineru.net/api/v4"

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

# ─── Pydantic Models ──────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    identifier: str
    password: str
    rememberMe: bool = False

class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str

class SignupRequest(BaseModel):
    username: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    password: str
    address_line: Optional[str] = None
    pincode: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    captcha_id: Optional[str] = None
    captcha_answer: Optional[str] = None

class PaymentRequest(BaseModel):
    plan_id: int
    payment_method: Optional[str] = "phonepe"

class PaymentResponse(BaseModel):
    order_id: int
    payment_url: str
    plan_name: str
    amount: float
    currency: str = "INR"
    demo_mode: Optional[bool] = False
    message: Optional[str] = None

class UpdatePlanRequest(BaseModel):
    plan: str
    credits: Optional[int] = None
    expires_at: Optional[str] = None

class ForgotPasswordRequest(BaseModel):
    email: str

class VerifyRegisterOTPRequest(BaseModel):
    email: str
    otp: str

class ResetPasswordRequest(BaseModel):
    email: str
    token: str
    new_password: str

class SendVerifyEmailOTPRequest(BaseModel):
    email: str
    username: str

class VerifyEmailOTPRequest(BaseModel):
    email: str
    otp: str

class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address_line: Optional[str] = None
    pincode: Optional[str] = None

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class AdminResetPasswordRequest(BaseModel):
    newPassword: str

class FeedbackRequest(BaseModel):
    message: str

# ─── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(title="Account Management Hub API", version="1.0.0")

# Define your specific frontend origins
origins = [
    "https://zaiz.onrender.com",
    "https://zaiz.isroot.in",
    "http://localhost:5173",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Config (all from zaiz.env) ────────────────────────────────────────

DATABASE_URL = os.getenv("DATABASE_URL")
# FIX: Use SECRET_KEY from zaiz.env
SECRET_KEY   = os.getenv("SECRET_KEY", "Deba9002043666")
JWT_SECRET   = os.getenv("SECRET_KEY", os.getenv("JWT_SECRET", "Deba9002043666"))
ALGORITHM     = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60   # 1-hour default sessions
REMEMBER_ME_EXPIRE_MINUTES = 60 * 24 * 7   # 7-day tokens for remember me

ADMIN_EMAIL    = os.getenv("ADMIN_EMAIL",    "debasish.biswas375@gmail.com")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "deba9002")
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "deba1234")

PHONEPE_CLIENT_ID     = os.getenv("PHONEPE_CLIENT_ID",     "").strip()
PHONEPE_CLIENT_SECRET = os.getenv("PHONEPE_CLIENT_SECRET", "").strip()
PHONEPE_ENV           = os.getenv("PHONEPE_ENV",            "SANDBOX").strip()

# Decodes base64-encoded secret keys automatically (standard for deployment env configs)
if PHONEPE_CLIENT_SECRET:
    try:
        import base64
        decoded = base64.b64decode(PHONEPE_CLIENT_SECRET).decode("utf-8")
        if len(decoded) == 36 and decoded.count("-") == 4:
            logger.info("Auto-decoded base64 PhonePe Client Secret to UUID format")
            PHONEPE_CLIENT_SECRET = decoded
    except Exception:
        pass

logger.info(f"PhonePe Credentials Loaded - CLIENT_ID: {PHONEPE_CLIENT_ID[:10] if PHONEPE_CLIENT_ID else 'NOT SET'}..., SECRET: {'SET' if PHONEPE_CLIENT_SECRET else 'NOT SET'}, ENV: {PHONEPE_ENV}")
PHONEPE_BASE_URL      = (
    "https://api.phonepe.com/apis/hermes"
    if PHONEPE_ENV == "PRODUCTION"
    else "https://api-preprod.phonepe.com/apis/pg-sandbox"
)

# Google OAuth Configuration
GOOGLE_CLIENT_ID     = os.getenv("GOOGLE_CLIENT_ID",     "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI  = os.getenv("GOOGLE_REDIRECT_URI",  "http://localhost:5173/auth/google/callback")
logger.info(f"Google OAuth Configured - CLIENT_ID: {GOOGLE_CLIENT_ID[:10] if GOOGLE_CLIENT_ID else 'NOT SET'}..., SECRET: {'SET' if GOOGLE_CLIENT_SECRET else 'NOT SET'}")

_captcha_store: Dict[str, str] = {}

# ─── Brevo (Sendinblue) Email Configuration ───────────────────────────────────
BREVO_API_KEY  = os.getenv("BREVO_API_KEY", "")
BREVO_SENDER_EMAIL = os.getenv("BREVO_SENDER_EMAIL", "no-reply@zaiz.in")
BREVO_SENDER_NAME  = os.getenv("BREVO_SENDER_NAME", "ZaiZ")

def send_brevo_email(to_email: str, to_name: str, subject: str, html_content: str) -> bool:
    """Send a transactional email via Brevo API. Returns True on success."""
    if not BREVO_API_KEY or BREVO_API_KEY == "PASTE_YOUR_FULL_BREVO_API_KEY_HERE":
        logger.warning("[BREVO] BREVO_API_KEY not set or still placeholder – skipping email send")
        return False
    url = "https://api.brevo.com/v3/smtp/email"
    headers = {
        "accept": "application/json",
        "api-key": BREVO_API_KEY,
        "content-type": "application/json",
    }
    payload = {
        "sender": {"name": BREVO_SENDER_NAME, "email": BREVO_SENDER_EMAIL},
        "to": [{"email": to_email, "name": to_name}],
        "subject": subject,
        "htmlContent": html_content
    }
    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=10)
        if resp.status_code in (200, 201):
            logger.info(f"[BREVO] ✅ Email sent to {to_email} | subject: {subject}")
            return True
        else:
            logger.error(f"[BREVO] ❌ Failed {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        logger.error(f"[BREVO] ❌ Exception sending email: {e}")
        return False

# ─── ZaiZ Email Template Helpers ─────────────────────────────────────────────
_ZAIZ_SITE  = os.getenv("FRONTEND_URL", "https://zaiz.in")
_ZAIZ_DARK  = "#1a1a2e"
_ZAIZ_TEXT  = "#4a4a68"
_ZAIZ_MUTED = "#9898b0"
_ZAIZ_ACCENT = "#6c63ff"

def _zaiz_otp_block(otp: str) -> str:
    """Returns a styled OTP display block for email templates."""
    return (
        f'<div style="margin:24px 0;text-align:center;">'
        f'<span style="display:inline-block;padding:14px 36px;background:#f0eeff;'
        f'border-radius:12px;font-size:32px;font-weight:800;letter-spacing:10px;'
        f'color:{_ZAIZ_ACCENT};font-family:monospace;">{otp}</span>'
        f'</div>'
    )

def _zaiz_cta(label: str, url: str) -> str:
    """Returns a styled call-to-action button for email templates."""
    return (
        f'<div style="margin:24px 0;text-align:center;">'
        f'<a href="{url}" style="display:inline-block;padding:12px 32px;'
        f'background:{_ZAIZ_ACCENT};color:#ffffff;text-decoration:none;'
        f'border-radius:8px;font-size:15px;font-weight:600;">{label}</a>'
        f'</div>'
    )

_ZAIZ_LOGO_IMG = (
    '<a href="https://zaiz.eu.cc" target="_blank" style="text-decoration:none;display:block;">'
    + '<img src="https://zaiz.eu.cc/mail-logo.jpg" alt="ZaiZ" width="100%" style="display:block;border:0;width:100%;max-width:520px;" />'
    + '</a>'
)

_ZAIZ_EMAIL_STYLES = """
  <style>
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
    table,td{mso-table-lspace:0pt;mso-table-rspace:0pt;}
    img{-ms-interpolation-mode:bicubic;border:0;outline:none;text-decoration:none;}
    body{margin:0;padding:0;background-color:#f9fafb;}
    @media only screen and (max-width:600px){
      .email-container{width:100%!important;}
      .otp-block{font-size:32px!important;letter-spacing:6px!important;}
    }
  </style>"""

def _zaiz_email_wrapper(preheader: str, body_html: str) -> str:
    """Full branded email shell used by all 4 template helpers."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <title>ZaiZ</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  {_ZAIZ_EMAIL_STYLES}
</head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#f9fafb;">{preheader}&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f9fafb;padding:32px 16px;">
    <tr><td align="center">
      <table class="email-container" role="presentation" width="520" cellspacing="0" cellpadding="0"
             style="max-width:520px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;
                    box-shadow:0 4px 24px rgba(0,0,0,0.07);border:1px solid #e5e7eb;">
        <tr>
          <td style="background:#ffffff;padding:0;text-align:left;border-bottom:1px solid #e5e7eb;">
            {_ZAIZ_LOGO_IMG}
          </td>
        </tr>
        <tr><td style="padding:36px 32px 28px;">{body_html}</td></tr>
        <tr><td style="padding:0 32px;"><hr style="border:none;border-top:1px solid #e5e7eb;margin:0;"/></td></tr>
        <tr>
          <td style="padding:24px 32px;text-align:center;">
            <p style="margin:0 0 6px;font-size:12px;color:#6b7280;">
              Questions? Reply to this email or contact
              <a href="mailto:support@zaiz.eu.cc" style="color:#4a6cf7;text-decoration:none;">support@zaiz.eu.cc</a>
            </p>
            <p style="margin:0;font-size:11px;color:#9ca3af;">
              &copy; 2025 ZaiZ &mdash; Smart Accounting Tools for India<br/>
              <a href="https://zaiz.eu.cc/privacy" style="color:#9ca3af;text-decoration:underline;">Privacy Policy</a>
              &nbsp;&middot;&nbsp;
              <a href="https://zaiz.eu.cc/terms" style="color:#9ca3af;text-decoration:underline;">Terms of Service</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""

def _zaiz_otp_html(otp: str) -> str:
    """Renders the styled OTP code box used in all OTP emails."""
    return f"""<div style="margin:28px 0;background:#f9fafb;border:1px dashed #e5e7eb;
                border-radius:10px;text-align:center;padding:28px 20px;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;
                  color:#6b7280;margin-bottom:12px;font-weight:600;">Your one-time code</div>
      <div class="otp-block"
           style="font-size:42px;font-weight:800;letter-spacing:10px;color:#0f172a;
                  font-family:'Courier New',monospace;">{otp}</div>
    </div>"""

def _zaiz_cta_html(label: str, url: str) -> str:
    """Renders a branded CTA button."""
    return f"""<div style="text-align:center;margin-top:28px;">
      <a href="{url}" target="_blank"
         style="display:inline-block;background:#4a6cf7;color:#ffffff;
                font-weight:600;font-size:15px;padding:13px 32px;border-radius:8px;
                text-decoration:none;letter-spacing:0.2px;">{label}</a>
    </div>"""

# ── Keep _zaiz_email / _zaiz_otp_block / _zaiz_cta as thin wrappers so the
#    existing call sites in main.py continue to work without any changes. ──────

def _zaiz_otp_block(otp: str) -> str:
    return _zaiz_otp_html(otp)

def _zaiz_cta(label: str, url: str) -> str:
    return _zaiz_cta_html(label, url)

def _zaiz_email(preview_text: str, body_html: str) -> str:
    """Generic wrapper — delegates to the full branded shell."""
    return _zaiz_email_wrapper(preview_text, body_html)

# ── Dedicated per-flow template functions ────────────────────────────────────

def email_register_otp(username: str, otp: str) -> str:
    """Email 1 — Registration OTP."""
    body = f"""
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">
        Welcome to ZaiZ! &#127881;
      </h2>
      <p style="margin:0 0 6px;font-size:15px;color:#374151;">
        Hi <strong>{username}</strong>,
      </p>
      <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
        Thanks for signing up. To complete your registration, enter the
        one-time password below. It expires in <strong>10&nbsp;minutes</strong>.
      </p>
      {_zaiz_otp_html(otp)}
      <p style="margin:20px 0 0;font-size:13px;color:#6b7280;line-height:1.6;">
        &#128274;&nbsp; For your security, never share this code with anyone.<br/>
        If you did not create a ZaiZ account, you can safely ignore this email.
      </p>
      {_zaiz_cta_html("Go to ZaiZ", "https://zaiz.eu.cc")}"""
    return _zaiz_email_wrapper(
        f"Your ZaiZ registration code is {otp} — valid for 10 minutes.",
        body
    )

def email_verify_email_otp(username: str, otp: str) -> str:
    """Email 2 — Email address verification OTP."""
    body = f"""
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">
        Verify your email address
      </h2>
      <p style="margin:0 0 6px;font-size:15px;color:#374151;">
        Hi <strong>{username}</strong>,
      </p>
      <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
        Use the code below to verify your email address on ZaiZ.
        This code expires in <strong>10&nbsp;minutes</strong>.
      </p>
      {_zaiz_otp_html(otp)}
      <p style="margin:20px 0 0;font-size:13px;color:#6b7280;line-height:1.6;">
        &#128274;&nbsp; Never share this code. ZaiZ staff will never ask for it.<br/>
        If you did not request this, please ignore this email.
      </p>
      {_zaiz_cta_html("Open ZaiZ", "https://zaiz.eu.cc")}"""
    return _zaiz_email_wrapper(
        f"Your ZaiZ email verification code: {otp}",
        body
    )

def email_password_reset_otp(username: str, otp: str) -> str:
    """Email 3 — Password reset OTP."""
    body = f"""
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">
        Password reset request
      </h2>
      <p style="margin:0 0 6px;font-size:15px;color:#374151;">
        Hi <strong>{username}</strong>,
      </p>
      <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
        We received a request to reset your ZaiZ password. Enter the
        code below to proceed. It expires in <strong>15&nbsp;minutes</strong>.
      </p>
      {_zaiz_otp_html(otp)}
      <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;
                  padding:14px 18px;margin-top:20px;">
        <p style="margin:0;font-size:13px;color:#92400e;line-height:1.6;">
          &#9888;&#65039; If you did <strong>not</strong> request a password reset, your account
          is safe. No action is needed — simply ignore this email.
        </p>
      </div>
"""
    return _zaiz_email_wrapper(
        "Your ZaiZ password reset code — valid for 15 minutes.",
        body
    )

def email_admin_broadcast(username: str, subject: str, body_lines: list) -> str:
    """Email 4 — Admin broadcast / announcement."""
    paragraphs = "".join(
        f'<p style="margin:0 0 14px;font-size:15px;color:#374151;line-height:1.7;">{line}</p>'
        for line in body_lines
    )
    body = f"""
      <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#0f172a;">{subject}</h2>
      <p style="margin:0 0 20px;font-size:15px;color:#374151;">
        Hi <strong>{username}</strong>,
      </p>
      {paragraphs}
      {_zaiz_cta_html("Visit ZaiZ", "https://zaiz.eu.cc")}"""
    return _zaiz_email_wrapper(subject, body)

# ── Debug: test Brevo email (remove in production) ───────────────────────────
@app.get("/api/test-email")
async def test_email(to: str = "debasish.biswas375@gmail.com"):
    """Quick smoke-test: GET /api/test-email?to=your@email.com"""
    key_preview = BREVO_API_KEY[:20] + "..." if BREVO_API_KEY else "(NOT SET)"
    if not BREVO_API_KEY:
        return {"ok": False, "error": "BREVO_API_KEY is not set in zaiz.env", "key_preview": key_preview, "sender": BREVO_SENDER_EMAIL}
    sent = send_brevo_email(to, "ZaiZ User", "ZaiZ Email Test", "<p>If you see this, Brevo is working! 🎉</p>")
    return {"ok": sent, "key_preview": key_preview, "sender": BREVO_SENDER_EMAIL, "to": to}

# NOTE: test_history endpoint moved to after get_current_user is defined (see below)

# In-memory OTP stores (keyed by email)
# Structure: { email: { "otp": str, "expires_at": datetime, "username": str } }
_register_otp_store: Dict[str, Dict] = {}
# Structure: { email: { "token": str, "expires_at": datetime } }
_password_reset_store: Dict[str, Dict] = {}
# Structure: { email: { "otp": str, "expires_at": datetime, "username": str } }
_email_verify_otp_store: Dict[str, Dict] = {}

# ─── DB helpers ───────────────────────────────────────────────────────────────

async def get_db_connection():
    if not DATABASE_URL:
        logger.error("DATABASE_URL environment variable is not set!")
        raise RuntimeError("DATABASE_URL is not configured. Set it in Render environment variables.")
    try:
        conn = await AsyncConnection.connect(DATABASE_URL, row_factory=dict_row)
        return conn
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        raise RuntimeError(f"Could not connect to database: {e}")

async def record_activity(user_id: int, activity_type: str, description: str, amount: Optional[float] = None, credits_changed: Optional[int] = None, conn=None):
    should_close = False
    if conn is None:
        conn = await get_db_connection()
        should_close = True
    try:
        await conn.execute(
            """INSERT INTO account_activity (user_id, activity_type, description, amount, credits_changed)
               VALUES (%s, %s, %s, %s, %s)""",
            (user_id, activity_type, description, amount, credits_changed)
        )
        if should_close:
            await conn.commit()
    except Exception as e:
        logger.warning(f"Failed to record activity for user {user_id}: {e}")
    finally:
        if should_close:
            await conn.close()

# ─── JWT helpers ──────────────────────────────────────────────────────────────

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expires_at = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode["exp"] = expires_at
    to_encode.setdefault("jti", uuid.uuid4().hex)
    return jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM)

def _decode_token_meta(token: str):
    """Return (jti, expires_at_datetime) from an access token."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        exp = payload.get("exp")
        return payload.get("jti"), datetime.utcfromtimestamp(exp) if exp else None
    except Exception:
        return None, None

async def record_session(conn, user_id: int, token: str, request: Optional[Request] = None):
    """Persist a session row and update last_login_at."""
    jti, exp = _decode_token_meta(token)
    if not jti or not exp:
        return
    user_agent = (request.headers.get("user-agent") if request else "") or ""
    ip = (request.client.host if request and request.client else "") or ""
    try:
        await conn.execute(
            """INSERT INTO user_sessions (user_id, jti, user_agent, ip, expires_at)
               VALUES (%s, %s, %s, %s, %s)
               ON CONFLICT (jti) DO NOTHING""",
            (user_id, jti, user_agent[:500], ip[:64], exp),
        )
        await conn.execute(
            "UPDATE users SET last_login_at = NOW() WHERE id = %s", (user_id,)
        )
        await conn.commit()
    except Exception as e:
        logger.warning(f"record_session failed: {e}")
        try: await conn.rollback()
        except: pass

def verify_token(token: str):
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        return None

# ─── Auth dependency ──────────────────────────────────────────────────────────

async def save_conversion_history(user_id: int, conversion_type: str, input_file_name: str,
                                 output_file_name: str = None, output_file_url: str = None,
                                 status: str = "completed", file_size: str = None):
    """Save conversion history to database"""
    conn = await get_db_connection()
    try:
        await conn.execute("""
            INSERT INTO conversion_history
            (user_id, conversion_type, input_file_name, output_file_name, output_file_url, status, file_size)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (user_id, conversion_type, input_file_name, output_file_name, output_file_url, status, file_size))
        await conn.commit()
        logger.info(f"Conversion history saved: {conversion_type} for user {user_id}")
    except Exception as e:
        logger.warning(f"Failed to save conversion history: {e}")
        try: await conn.rollback()
        except: pass
    finally:
        await conn.close()

def _upload_to_bucket_sync(file_content: bytes, file_path: str):
    """Synchronous HF bucket upload via HfFileSystem.
    Writes directly to the HF bucket — no local disk involved.
    """
    if HfFileSystem is None:
        raise RuntimeError("HfFileSystem not available — install huggingface_hub")
    if not HF_TOKEN:
        raise RuntimeError("HF_TOKEN is not set — cannot upload to bucket")
    fs = HfFileSystem(token=HF_TOKEN)
    bucket_path = f"hf://buckets/{HF_BUCKET_ID}/{file_path}"
    with fs.open(bucket_path, "wb") as fh:
        fh.write(file_content)
    logger.info(f"[HF] ✅ Uploaded to bucket: {bucket_path}")


def _read_from_bucket_sync(file_path: str) -> bytes:
    """Synchronous HF bucket read via HfFileSystem."""
    if HfFileSystem is None:
        raise RuntimeError("HfFileSystem not available — install huggingface_hub")
    if not HF_TOKEN:
        raise RuntimeError("HF_TOKEN is not set — cannot read from bucket")
    fs = HfFileSystem(token=HF_TOKEN)
    bucket_path = f"hf://buckets/{HF_BUCKET_ID}/{file_path}"
    with fs.open(bucket_path, "rb") as fh:
        return fh.read()


async def upload_to_hf_storage(file_content: bytes, file_path: str, content_type: str = "application/octet-stream") -> str:
    """Upload file directly to HF bucket and return a backend-proxied URL.
    No local disk writes — works on Render without any persistent disk.
    Raises RuntimeError if HF_TOKEN is not configured.
    """
    if not HF_TOKEN or not HF_HUB_AVAILABLE or HfFileSystem is None:
        raise RuntimeError(
            "HF_TOKEN is not configured. Set it in your environment variables to enable file storage."
        )
    await asyncio.to_thread(_upload_to_bucket_sync, file_content, file_path)
    logger.info(f"[HF] ✅ Bucket upload OK [{HF_BUCKET_ID}]: {file_path}")
    public_url = f"/api/bucket/files/{file_path}"
    return public_url


# Keep old name as alias for backwards-compat
async def upload_to_supabase_storage(file_content: bytes, file_path: str, content_type: str = "application/octet-stream") -> str:
    return await upload_to_hf_storage(file_content, file_path, content_type)


async def cleanup_old_hf_files(user_id: int, keep_last: int = 3):
    """Delete old bucket files for a user, keeping only the last N.
    Operates directly on the HF bucket — no local disk access.
    """
    if not HF_TOKEN or not HF_HUB_AVAILABLE or HfFileSystem is None:
        return
    try:
        def _list_and_delete():
            fs = HfFileSystem(token=HF_TOKEN)
            prefix = f"hf://buckets/{HF_BUCKET_ID}/{user_id}/"
            try:
                entries = fs.ls(prefix, detail=True)
            except FileNotFoundError:
                return  # no files yet for this user
            # Sort by last modified, newest first
            entries_sorted = sorted(entries, key=lambda e: e.get("last_modified", 0), reverse=True)
            to_delete = entries_sorted[keep_last:]
            for entry in to_delete:
                try:
                    fs.rm(entry["name"])
                    logger.info(f"[HF] Deleted old bucket file: {entry['name']}")
                except Exception as e:
                    logger.warning(f"[HF] Failed to delete {entry['name']}: {e}")
        await asyncio.to_thread(_list_and_delete)
    except Exception as e:
        logger.warning(f"[HF] cleanup_old_hf_files error: {e}")


# Keep old name as alias
async def cleanup_old_xml_files(user_id: int, keep_last: int = 3):
    return await cleanup_old_hf_files(user_id, keep_last)

async def get_current_user_optional(credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer(auto_error=False))):
    """Optional authentication - returns None if not authenticated"""
    if not credentials:
        return None
    try:
        payload = verify_token(credentials.credentials)
        if not payload:
            return None
        username = payload.get("sub")
        if not username:
            return None
        conn = await get_db_connection()
        try:
            cursor = await conn.execute("SELECT id, username, is_admin FROM users WHERE LOWER(username)=LOWER(%s)", (username,))
            user = await cursor.fetchone()
            if not user:
                return None
            return {"username": user["username"], "user_id": user["id"], "is_admin": user["is_admin"]}
        finally:
            await conn.close()
    except:
        return None

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer())):
    exc = HTTPException(status_code=401, detail="Could not validate credentials",
                        headers={"WWW-Authenticate": "Bearer"})
    payload = verify_token(credentials.credentials)
    if not payload:
        raise exc
    username = payload.get("sub")
    jti = payload.get("jti")
    if not username:
        raise exc
    conn = await get_db_connection()
    try:
        cursor = await conn.execute("SELECT id, username, is_admin FROM users WHERE LOWER(username)=LOWER(%s)", (username,))
        user = await cursor.fetchone()
        if not user:
            raise exc
        if jti:
            try:
                cur2 = await conn.execute(
                    "SELECT revoked FROM user_sessions WHERE jti=%s AND user_id=%s",
                    (jti, user["id"]),
                )
                srow = await cur2.fetchone()
                if srow and srow["revoked"]:
                    raise HTTPException(status_code=401, detail="Session was revoked")
                if srow:
                    await conn.execute(
                        "UPDATE user_sessions SET last_seen_at=NOW() WHERE jti=%s", (jti,)
                    )
                    await conn.commit()
            except HTTPException:
                raise
            except Exception as e:
                logger.warning(f"session check failed: {e}")
                try: await conn.rollback()
                except: pass
        return {"username": user["username"], "user_id": user["id"], "is_admin": user["is_admin"], "jti": jti}
    finally:
        await conn.close()

def require_admin(cu: dict):
    logger.info(f"Admin check - User: {cu.get('username')}, is_admin: {cu.get('is_admin')}")
    if not cu.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

@app.get("/api/test-history")
async def test_history(cu: dict = Depends(get_current_user)):
    """Debug: test that conversion_history INSERT + commit works for the logged-in user."""
    conn = await get_db_connection()
    result = {}
    try:
        # 1. Check table exists
        cur = await conn.execute(
            "SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_name='conversion_history'"
        )
        row = await cur.fetchone()
        result["table_exists"] = (row["cnt"] > 0) if row else False

        # 2. Insert a test record
        await conn.execute("""
            INSERT INTO conversion_history
            (user_id, conversion_type, input_file_name, output_file_name, output_file_url, status, file_size)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (cu["user_id"], "DEBUG_TEST", "test.pdf", "test_out.xlsx", None, "completed", "1 KB"))
        await conn.commit()
        result["insert_ok"] = True

        # 3. Read it back
        cur2 = await conn.execute(
            "SELECT id, conversion_type, created_at FROM conversion_history WHERE user_id=%s ORDER BY created_at DESC LIMIT 5",
            (cu["user_id"],)
        )
        rows = await cur2.fetchall()
        result["recent_rows"] = [{"id": r["id"], "type": r["conversion_type"], "at": str(r["created_at"])} for r in rows]
        result["success"] = True
    except Exception as e:
        result["error"] = str(e)
        result["success"] = False
        try: await conn.rollback()
        except: pass
    finally:
        await conn.close()
    return result

@app.post("/api/admin/make-admin/{username}")
async def make_admin(username: str, cu: dict = Depends(get_current_user)):
    """Temporarily make a user an admin (for debugging)"""
    require_admin(cu)
    conn = await get_db_connection()
    try:
        await conn.execute("UPDATE users SET is_admin=TRUE WHERE LOWER(username)=LOWER(%s)", (username,))
        await conn.commit()
        return {"success": True, "message": f"User {username} is now an admin"}
    except Exception as e:
        logger.error(f"Failed to make user admin: {e}")
        raise HTTPException(500, str(e))
    finally:
        await conn.close()

# ─── Notification helper ──────────────────────────────────────────────────────

async def send_notification(conn, user_id: int, message: str):
    try:
        await conn.execute(
            "INSERT INTO notifications (user_id, message, is_read, created_at) VALUES (%s,%s,false,NOW())",
            (user_id, message),
        )
    except Exception as e:
        logger.warning(f"Notification failed: {e}")

# ─── DB init ──────────────────────────────────────────────────────────────────

async def init_database():
    conn = await get_db_connection()
    try:
        # Create users table
        try:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(50) NOT NULL UNIQUE,
                    full_name VARCHAR(150),
                    email VARCHAR(100) UNIQUE,
                    phone VARCHAR(20) UNIQUE,
                    password_hash VARCHAR(255) NOT NULL,
                    plan VARCHAR(50) NOT NULL DEFAULT 'Free',
                    credits INTEGER NOT NULL DEFAULT 0,
                    plan_expiry TIMESTAMP,
                    address_line TEXT,
                    pincode VARCHAR(10),
                    city VARCHAR(100),
                    district VARCHAR(100),
                    state VARCHAR(100),
                    country VARCHAR(100),
                    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
                    avatar_url TEXT,
                    avatar_changed BOOLEAN NOT NULL DEFAULT FALSE,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
            """)
            await conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT")
            await conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_changed BOOLEAN NOT NULL DEFAULT FALSE")
            await conn.commit()
        except Exception as e:
            logger.warning(f"Users table creation failed: {e}")
            try: await conn.rollback()
            except: pass

        # Create plans table
        try:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS plans (
                    id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL UNIQUE,
                    price NUMERIC(10,2) NOT NULL DEFAULT 0, credits INTEGER NOT NULL DEFAULT 0,
                    duration_days INTEGER NOT NULL DEFAULT 30, features JSONB NOT NULL DEFAULT '[]',
                    is_active BOOLEAN NOT NULL DEFAULT TRUE,
                    is_default BOOLEAN NOT NULL DEFAULT FALSE,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
            """)
            await conn.commit()
        except Exception as e:
            logger.warning(f"Plans table creation failed: {e}")
            try: await conn.rollback()
            except: pass

        # ── Migrations: add missing columns to existing tables ──────────────
        migrations = [
            ("ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE",
             "Added is_default to plans"),
            ("ALTER TABLE plans ADD COLUMN IF NOT EXISTS expiry DATE",
             "Added expiry to plans"),
            ("ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT",
             "Added full_name to users"),
            ("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20)",
             "Added phone to users"),
            ("ALTER TABLE users ADD COLUMN IF NOT EXISTS address_line TEXT",
             "Added address_line to users"),
            ("ALTER TABLE users ADD COLUMN IF NOT EXISTS pincode VARCHAR(10)",
             "Added pincode to users"),
            ("ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(100)",
             "Added city to users"),
            ("ALTER TABLE users ADD COLUMN IF NOT EXISTS district VARCHAR(100)",
             "Added district to users"),
            ("ALTER TABLE users ADD COLUMN IF NOT EXISTS state VARCHAR(100)",
             "Added state to users"),
            ("ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(100)",
             "Added country to users"),
            ("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP",
             "Added last_login_at to users"),
            ("""CREATE TABLE IF NOT EXISTS user_sessions (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    jti VARCHAR(64) NOT NULL UNIQUE,
                    user_agent TEXT,
                    ip VARCHAR(64),
                    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    last_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    expires_at TIMESTAMP NOT NULL,
                    revoked BOOLEAN NOT NULL DEFAULT FALSE
                )""", "Created user_sessions table"),
            ("CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id)",
             "Indexed user_sessions.user_id"),
        ]
        for sql, desc in migrations:
            try:
                await conn.execute(sql)
                await conn.commit()
                logger.info(f"Migration OK: {desc}")
            except Exception as e:
                logger.warning(f"Migration skipped ({desc}): {e}")
                try: await conn.rollback()
                except: pass

        # Create orders table
        try:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS orders (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    plan_id INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
                    status VARCHAR(20) NOT NULL DEFAULT 'pending', amount NUMERIC(10,2) NOT NULL DEFAULT 0,
                    merchant_transaction_id VARCHAR(100), phonepe_transaction_id VARCHAR(100),
                    created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP
                )
            """)
            await conn.commit()
        except Exception as e:
            logger.warning(f"Orders table creation failed: {e}")
            try: await conn.rollback()
            except: pass

        # Create notifications table
        try:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS notifications (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    message TEXT NOT NULL, is_read BOOLEAN NOT NULL DEFAULT FALSE,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
            """)
            await conn.commit()
        except Exception as e:
            logger.warning(f"Notifications table creation failed: {e}")
            try: await conn.rollback()
            except: pass

        # Create settings table
        try:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS settings (key VARCHAR(100) PRIMARY KEY, value TEXT NOT NULL)
            """)
            await conn.commit()
        except Exception as e:
            logger.warning(f"Settings table creation failed: {e}")
            try: await conn.rollback()
            except: pass

        # Seed default credit pricing settings (only if not already set)
        try:
            for key, val in [
                ("credit_cost_manual_voucher", "0.05"),
                ("credit_cost_ai_statement",   "0.1"),
                ("credit_cost_pdf_page",       "0.1"),
            ]:
                await conn.execute(
                    "INSERT INTO settings (key,value) VALUES (%s,%s) ON CONFLICT (key) DO NOTHING",
                    (key, val)

                )
            await conn.commit()
        except Exception as e:
            logger.warning(f"Credit pricing seed failed: {e}")
            try: await conn.rollback()
            except: pass

        # Create announcements table
        try:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS announcements (
                    id SERIAL PRIMARY KEY,
                    title VARCHAR(200) NOT NULL DEFAULT 'Announcement',
                    message TEXT NOT NULL,
                    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
            """)
            await conn.commit()
        except Exception as e:
            logger.warning(f"Announcements table creation failed: {e}")
            try: await conn.rollback()
            except: pass

        # Create recent_updates table
        try:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS recent_updates (
                    id SERIAL PRIMARY KEY,
                    title VARCHAR(200) NOT NULL,
                    description TEXT NOT NULL DEFAULT '',
                    badge VARCHAR(50) NOT NULL DEFAULT 'New',
                    badge_color VARCHAR(30) NOT NULL DEFAULT 'green',
                    is_active BOOLEAN NOT NULL DEFAULT TRUE,
                    sort_order INTEGER NOT NULL DEFAULT 0,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
            """)
            await conn.commit()
        except Exception as e:
            logger.warning(f"Recent updates table creation failed: {e}")
            try: await conn.rollback()
            except: pass

        # Create conversion_history table
        try:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS conversion_history (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    conversion_type VARCHAR(50) NOT NULL,
                    input_file_name VARCHAR(255) NOT NULL,
                    output_file_name VARCHAR(255),
                    output_file_url TEXT,
                    status VARCHAR(20) NOT NULL DEFAULT 'completed',
                    file_size VARCHAR(20),
                    created_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
            """)
            await conn.commit()
        except Exception as e:
            logger.warning(f"Conversion history table creation failed: {e}")
            try: await conn.rollback()
            except: pass

        # Create account_activity table
        try:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS account_activity (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    activity_type VARCHAR(50) NOT NULL,
                    description TEXT NOT NULL,
                    amount NUMERIC(10,2),
                    credits_changed INTEGER,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
            """)
            await conn.commit()
        except Exception as e:
            logger.warning(f"Account activity table creation failed: {e}")
            try: await conn.rollback()
            except: pass

        # Insert default plans
        try:
            await conn.execute("""
                INSERT INTO plans (name,price,credits,duration_days,features,is_active)
                VALUES ('Free',0,100,30,'["Basic access","100 credits/month"]',TRUE)
                ON CONFLICT (name) DO NOTHING
            """)
            
            await conn.execute("""
                INSERT INTO plans (name,price,credits,duration_days,features,is_active)
                VALUES ('Professional',29.99,1000,365,'["Advanced features","1000 credits/year","Priority support","API access"]',TRUE)
                ON CONFLICT (name) DO NOTHING
            """)
            
            await conn.execute("""
                INSERT INTO plans (name,price,credits,duration_days,features,is_active)
                VALUES ('Enterprise',99.99,5000,365,'["All features","5000 credits/year","Dedicated support","Custom integrations","White-label"]',TRUE)
                ON CONFLICT (name) DO NOTHING
            """)
            
            await conn.execute("""
                INSERT INTO plans (name,price,credits,duration_days,features,is_active)
                VALUES ('Unlimited',0,999999999,99999,'["Unlimited credits","No expiry","Admin Assigned Only"]',TRUE)
                ON CONFLICT (name) DO NOTHING
            """)
            
            await conn.execute("""
                INSERT INTO plans (name,price,credits,duration_days,features,is_active)
                VALUES ('unlimited',0,999999999,99999,'["Unlimited credits","No expiry","Admin Assigned Only"]',TRUE)
                ON CONFLICT (name) DO NOTHING
            """)
        except Exception as e:
            logger.warning(f"Default plans insertion failed: {e}")
            try: await conn.rollback()
            except: pass

        # Insert default setting - safely handles missing is_default column
        try:
            default_plan_name = "Free"
            try:
                cursor = await conn.execute("SELECT name FROM plans WHERE is_default=true LIMIT 1")
                row = await cursor.fetchone()
                if row: default_plan_name = row["name"]
            except Exception:
                pass  # is_default column may not exist yet on old DBs
            await conn.execute("""
                INSERT INTO settings (key,value) VALUES ('default_signup_plan',%s) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value
            """, (default_plan_name,))
            logger.info(f"Default signup plan set to: {default_plan_name}")
        except Exception as e:
            logger.warning(f"Default setting insertion failed: {e}")
            try: await conn.rollback()
            except: pass


        # Seed admin user
        try:
            h = bcrypt.hashpw(ADMIN_PASSWORD.encode(), bcrypt.gensalt()).decode()
            await conn.execute("""
                INSERT INTO users (username,email,password_hash,is_admin,plan,credits)
                VALUES (%s,%s,%s,TRUE,'Free',0)
                ON CONFLICT (username) DO NOTHING
            """, (ADMIN_USERNAME, ADMIN_EMAIL, h))
            await conn.execute(
                "UPDATE users SET is_admin=TRUE WHERE email=%s", (ADMIN_EMAIL,)
            )
            await conn.commit()
        except Exception as e:
            logger.warning(f"Admin user seeding failed: {e}")
            try: await conn.rollback()
            except: pass

        logger.info("✅ Database initialised")
    except Exception as e:
        logger.error(f"❌ DB init failed: {e}")
        raise
    finally:
        await conn.close()


async def _get_default_plan_name(conn) -> str:
    """Safely get the default signup plan name, works even if is_default column is missing."""
    # Try is_default column first
    try:
        cursor = await conn.execute("SELECT name FROM plans WHERE is_default=true LIMIT 1")
        row = await cursor.fetchone()
        if row:
            return row["name"]
    except Exception:
        pass
    # Fall back to settings table
    try:
        cursor = await conn.execute("SELECT value FROM settings WHERE key='default_signup_plan' LIMIT 1")
        row = await cursor.fetchone()
        if row:
            return row["value"]
    except Exception:
        pass
    # Final fallback
    try:
        cursor = await conn.execute("SELECT name FROM plans WHERE is_active=true ORDER BY price ASC LIMIT 1")
        row = await cursor.fetchone()
        if row:
            return row["name"]
    except Exception:
        pass
    return "Free"

# ══════════════════════════════════════════════════════════════════════════════
# ROUTES
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/health")
@app.get("/api/healthz")
async def health():
    return {"status": "ok", "message": "Account Management Hub API", "version": "1.0.0"}

# ── Auth ──────────────────────────────────────────────────────────────────────

@app.post("/api/auth/login")
async def login(data: LoginRequest, request: Request):
    logger.info(f"[LOGIN] Login attempt for identifier: {data.identifier}")
    conn = await get_db_connection()
    try:
        cursor = await conn.execute(
            "SELECT * FROM users WHERE LOWER(username)=LOWER(%s) OR LOWER(email)=LOWER(%s) OR phone=%s", (data.identifier, data.identifier, data.identifier)
        )
        row = await cursor.fetchone()
        logger.info(f"[LOGIN] User found: {bool(row)}")
        if not row:
            logger.warning(f"[LOGIN] User not found for identifier: {data.identifier}")
            raise HTTPException(status_code=401, detail="Invalid username or password")
        if not bcrypt.checkpw(data.password.encode(), row["password_hash"].encode()):
            logger.warning(f"[LOGIN] Invalid password for user: {row['username']}")
            raise HTTPException(status_code=401, detail="Invalid username or password")
        logger.info(f"[LOGIN] Login successful for user: {row['username']}")
        # Use 30-minute session by default, 7-day if rememberMe is checked
        expire_minutes = REMEMBER_ME_EXPIRE_MINUTES if data.rememberMe else ACCESS_TOKEN_EXPIRE_MINUTES
        token = create_access_token({"sub": row["username"]}, timedelta(minutes=expire_minutes))
        await record_session(conn, row["id"], token, request)
        return {"token": token, "token_type": "bearer", "username": row["username"], "is_admin": row["is_admin"]}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[LOGIN] Unexpected error: {e}")
        import traceback
        logger.error(f"[LOGIN] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        await conn.close()

@app.post("/api/auth/refresh")
async def refresh_token(request: Request, cu: dict = Depends(get_current_user)):
    """Issue a new access token for the currently authenticated user and revoke the old session."""
    token = create_access_token({"sub": cu["username"]})
    conn = await get_db_connection()
    try:
        if cu.get("jti"):
            try:
                await conn.execute(
                    "UPDATE user_sessions SET revoked=TRUE WHERE jti=%s", (cu["jti"],)
                )
                await conn.commit()
            except Exception:
                try: await conn.rollback()
                except: pass
        await record_session(conn, cu["user_id"], token, request)
    finally:
        await conn.close()
    return {"token": token, "token_type": "bearer", "username": cu["username"], "is_admin": cu.get("is_admin", False)}

@app.get("/api/auth/security-info")
async def security_info(cu: dict = Depends(get_current_user)):
    """Return security overview: last login + active sessions."""
    conn = await get_db_connection()
    try:
        cur = await conn.execute(
            "SELECT last_login_at, created_at FROM users WHERE id=%s", (cu["user_id"],)
        )
        urow = await cur.fetchone() or {}
        cur = await conn.execute(
            """SELECT id, jti, user_agent, ip, created_at, last_seen_at, expires_at
               FROM user_sessions
               WHERE user_id=%s AND revoked=FALSE AND expires_at > NOW()
               ORDER BY last_seen_at DESC""",
            (cu["user_id"],),
        )
        sessions = []
        for r in await cur.fetchall():
            sessions.append({
                "id": r["id"],
                "user_agent": r["user_agent"] or "",
                "ip": r["ip"] or "",
                "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                "last_seen_at": r["last_seen_at"].isoformat() if r["last_seen_at"] else None,
                "expires_at": r["expires_at"].isoformat() if r["expires_at"] else None,
                "current": r["jti"] == cu.get("jti"),
            })
        return {
            "last_login_at": urow.get("last_login_at").isoformat() if urow.get("last_login_at") else None,
            "account_created_at": urow.get("created_at").isoformat() if urow.get("created_at") else None,
            "active_sessions": sessions,
        }
    finally:
        await conn.close()

@app.delete("/api/auth/sessions/{session_id}")
async def revoke_session(session_id: int, cu: dict = Depends(get_current_user)):
    """Revoke a single active session belonging to the current user."""
    conn = await get_db_connection()
    try:
        cur = await conn.execute(
            "UPDATE user_sessions SET revoked=TRUE WHERE id=%s AND user_id=%s",
            (session_id, cu["user_id"]),
        )
        await conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Session not found")
        return {"success": True}
    finally:
        await conn.close()

@app.post("/api/auth/sessions/revoke-others")
async def revoke_other_sessions(cu: dict = Depends(get_current_user)):
    """Revoke every session for the current user except the current one."""
    conn = await get_db_connection()
    try:
        await conn.execute(
            "UPDATE user_sessions SET revoked=TRUE WHERE user_id=%s AND jti<>%s AND revoked=FALSE",
            (cu["user_id"], cu.get("jti") or ""),
        )
        await conn.commit()
        return {"success": True}
    finally:
        await conn.close()

@app.post("/api/auth/register")
async def register(data: RegisterRequest):
    """Step 1 of registration: send OTP to email for verification."""
    conn = await get_db_connection()
    try:
        # Check for duplicate username/email before sending OTP
        cursor = await conn.execute("SELECT id FROM users WHERE LOWER(username)=LOWER(%s) OR LOWER(email)=LOWER(%s)", (data.username, data.email))
        existing = await cursor.fetchone()
        if existing:
            raise HTTPException(400, "Username or email already registered")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[REGISTER] Pre-check error: {e}")
        raise HTTPException(500, str(e))
    finally:
        await conn.close()

    # Generate a 6-digit OTP valid for 10 minutes
    otp = str(random.randint(100000, 999999))
    _register_otp_store[data.email] = {
        "otp": otp,
        "expires_at": datetime.utcnow() + timedelta(minutes=10),
        "username": data.username,
        "password": data.password,
    }

    html = email_register_otp(data.username, otp)
    sent = send_brevo_email(data.email, data.username, "Your ZaiZ registration OTP", html)
    if not sent:
        raise HTTPException(500, "Failed to send OTP email. Please try again.")

    return {"success": True, "message": "OTP sent to your email. Please verify to complete registration."}

@app.post("/api/auth/verify-otp")
async def verify_register_otp(data: VerifyRegisterOTPRequest):
    """Step 2 of registration: verify OTP and create the account."""
    record = _register_otp_store.get(data.email)
    if not record:
        raise HTTPException(400, "No OTP found for this email. Please register again.")
    if datetime.utcnow() > record["expires_at"]:
        _register_otp_store.pop(data.email, None)
        raise HTTPException(400, "OTP has expired. Please register again.")
    if record["otp"] != data.otp.strip():
        raise HTTPException(400, "Invalid OTP. Please check and try again.")

    # OTP is valid – create the account now
    _register_otp_store.pop(data.email, None)
    username = record["username"]
    password = record["password"]

    conn = await get_db_connection()
    try:
        default_plan_name = await _get_default_plan_name(conn)
        cursor = await conn.execute("SELECT * FROM plans WHERE name=%s", (default_plan_name,))
        plan_row = await cursor.fetchone()
        credits = plan_row["credits"] if plan_row else 0
        expiry  = datetime.utcnow() + timedelta(days=plan_row["duration_days"]) if plan_row and plan_row["duration_days"] else None
        h = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        await conn.execute(
            "INSERT INTO users (username,email,password_hash,plan,credits,plan_expiry) VALUES (%s,%s,%s,%s,%s,%s)",
            (username.lower().strip(), data.email, h, default_plan_name, credits, expiry),
        )
        cursor = await conn.execute("SELECT id FROM users WHERE LOWER(username)=LOWER(%s)", (username,))
        user_row = await cursor.fetchone()
        if user_row:
            await record_activity(user_row["id"], "account_created", "Account created", conn=conn)
            if credits > 0:
                await record_activity(user_row["id"], "credits_added", f"Welcome credits added: {credits} credits", credits_changed=credits, conn=conn)
        await conn.commit()
        token = create_access_token({"sub": username})
        logger.info(f"[REGISTER] Account created after OTP verification: {username}")
        return {"token": token, "token_type": "bearer", "username": username, "is_admin": False}
    except psycopg.errors.UniqueViolation as e:
        msg = str(e)
        if "username" in msg: raise HTTPException(400, "Username already taken")
        if "email"    in msg: raise HTTPException(400, "Email already registered")
        raise HTTPException(400, "Account already exists")
    except Exception as e:
        logger.error(f"[REGISTER] Account creation error after OTP: {e}")
        raise HTTPException(500, str(e))
    finally:
        await conn.close()


@app.post("/api/auth/send-verify-email-otp")
async def send_verify_email_otp(data: SendVerifyEmailOTPRequest):
    """Send an email verification OTP to a newly registered user."""
    otp = str(random.randint(100000, 999999))
    _email_verify_otp_store[data.email] = {
        "otp": otp,
        "expires_at": datetime.utcnow() + timedelta(minutes=10),
        "username": data.username,
    }
    html = email_verify_email_otp(data.username, otp)
    sent = send_brevo_email(data.email, data.username, "Verify your ZaiZ email address", html)
    if not sent:
        raise HTTPException(500, "Failed to send verification email. Please try again.")
    return {"success": True, "message": "Verification OTP sent to your email."}


@app.post("/api/auth/verify-email-otp")
async def verify_email_otp(data: VerifyEmailOTPRequest):
    """Verify email OTP sent after signup."""
    record = _email_verify_otp_store.get(data.email)
    if not record:
        raise HTTPException(400, "No verification OTP found for this email. Please request a new one.")
    if datetime.utcnow() > record["expires_at"]:
        _email_verify_otp_store.pop(data.email, None)
        raise HTTPException(400, "OTP has expired. Please request a new one.")
    if record["otp"] != data.otp.strip():
        raise HTTPException(400, "Invalid OTP. Please check and try again.")
    _email_verify_otp_store.pop(data.email, None)
    # Mark email as verified in DB
    conn = await get_db_connection()
    try:
        await conn.execute(
            "UPDATE users SET email_verified=TRUE WHERE email=%s",
            (data.email,)
        )
        await conn.commit()
    except Exception:
        # email_verified column may not exist yet — not fatal
        pass
    finally:
        await conn.close()
    logger.info(f"[EMAIL_VERIFY] Email verified: {data.email}")
    return {"success": True, "message": "Email verified successfully."}


@app.post("/api/signup")
async def signup(data: SignupRequest):
    print(f"[SIGNUP] Signup request received for username: {data.username}, email: {data.email}")
    logger.info(f"[SIGNUP] Signup request received for username: {data.username}, email: {data.email}")
    if data.captcha_id and data.captcha_answer:
        expected = _captcha_store.get(data.captcha_id)
        if expected is None or data.captcha_answer.strip() != expected:
            logger.warning(f"[SIGNUP] Captcha failed for username: {data.username}")
            raise HTTPException(status_code=400, detail="Incorrect captcha answer")
        _captcha_store.pop(data.captcha_id, None)
    conn = await get_db_connection()
    try:
        # Safely get default plan (handles missing is_default column)
        default_plan_name = await _get_default_plan_name(conn)
        logger.info(f"[SIGNUP] Default plan name: {default_plan_name}")
        cursor = await conn.execute("SELECT * FROM plans WHERE name=%s", (default_plan_name,))
        plan_row = await cursor.fetchone()
        logger.info(f"[SIGNUP] Plan lookup result: {plan_row}")
        credits = plan_row["credits"] if plan_row else 0
        expiry  = datetime.utcnow() + timedelta(days=plan_row["duration_days"]) if plan_row and plan_row["duration_days"] else None
        logger.info(f"[SIGNUP] Final assignment - Plan: {default_plan_name}, Credits: {credits}, Expiry: {expiry}")
        h = bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode()
        await conn.execute(
            """INSERT INTO users
               (username,full_name,email,phone,password_hash,plan,credits,plan_expiry,address_line,pincode,city,district,state,country)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (data.username.lower().strip(), data.full_name, data.email or None, data.phone or None, h,
            default_plan_name, credits, expiry, data.address_line, data.pincode,
            data.city, data.district, data.state, data.country),
        )
        # Get the new user's ID and log signup activities
        cursor = await conn.execute("SELECT id FROM users WHERE LOWER(username)=LOWER(%s)", (data.username,))
        user_row = await cursor.fetchone()
        if user_row:
            await record_activity(user_row["id"], "account_created", "Account created", conn=conn)
            if credits > 0:
                await record_activity(user_row["id"], "credits_added", f"Welcome credits added: {credits} credits", credits_changed=credits, conn=conn)
        await conn.commit()
        logger.info(f"[SIGNUP] User created successfully: {data.username}")
        return {"success": True, "message": "Account created successfully"}
    except psycopg.errors.UniqueViolation as e:
        msg = str(e)
        logger.warning(f"[SIGNUP] UniqueViolation error: {msg}")
        if "username" in msg: raise HTTPException(400, "Username already taken")
        if "email"    in msg: raise HTTPException(400, "Email already registered")
        if "phone"    in msg: raise HTTPException(400, "Phone already registered")
        raise HTTPException(400, "Account already exists")
    except Exception as e:
        logger.error(f"[SIGNUP] Unexpected error: {e}")
        import traceback
        logger.error(f"[SIGNUP] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        await conn.close()

@app.get("/api/captcha")
async def get_captcha():
    a, b = random.randint(1, 20), random.randint(1, 20)
    cid = str(uuid.uuid4())
    _captcha_store[cid] = str(a + b)
    return {"id": cid, "question": f"What is {a} + {b}?"}

# ── Google OAuth ───────────────────────────────────────────────────────────────

def _get_frontend_origin(request: Request) -> str:
    """
    Derive the frontend base URL from the incoming request.
    Priority:
      1. FRONTEND_URL env var (explicit override — set this on Render)
      2. Origin / Referer header sent by the browser
      3. Fall back to GOOGLE_REDIRECT_URI env var
      4. Last resort: localhost:5173
    """
    # 1. Explicit env override — always wins
    env_frontend = os.getenv("FRONTEND_URL", "").rstrip("/")
    if env_frontend:
        return env_frontend

    # 2. Use the Origin header the browser sends with the fetch()
    origin = request.headers.get("origin", "").rstrip("/")
    if origin and origin not in ("null", ""):
        return origin

    # 3. Fall back to Referer (strip path)
    referer = request.headers.get("referer", "")
    if referer:
        from urllib.parse import urlparse
        p = urlparse(referer)
        if p.scheme and p.netloc:
            return f"{p.scheme}://{p.netloc}"

    # 4. Strip /callback suffix from GOOGLE_REDIRECT_URI if set
    env_redirect = os.getenv("GOOGLE_REDIRECT_URI", "")
    if env_redirect and "localhost" not in env_redirect:
        from urllib.parse import urlparse
        p = urlparse(env_redirect)
        if p.scheme and p.netloc:
            return f"{p.scheme}://{p.netloc}"

    return "http://localhost:5173"


def _fetch_url_sync(url: str, timeout: int = 10):
    """Synchronous helper – run inside asyncio.to_thread to avoid blocking."""
    response = requests.get(url, timeout=timeout)
    response.raise_for_status()
    return response.content, response.headers.get("content-type", "image/png")


async def upload_user_avatar_from_url(username: str, picture_url: str) -> Optional[str]:
    """Download user avatar from Google URL and save to HF bucket storage."""
    if not picture_url:
        return None
    try:
        logger.info(f"Downloading Google avatar from: {picture_url}")
        # Run blocking HTTP call in a thread so the async event loop is not blocked
        file_content, content_type = await asyncio.to_thread(_fetch_url_sync, picture_url)

        # Determine file extension from content-type
        ext = "png"
        if "jpeg" in content_type or "jpg" in content_type:
            ext = "jpg"
        elif "webp" in content_type:
            ext = "webp"

        file_path = f"avatars/{username}.{ext}"
        public_url = await upload_to_hf_storage(file_content, file_path, content_type)
        if public_url:
            logger.info(f"Successfully saved user avatar to HF storage: {public_url}")
        return public_url
    except Exception as e:
        logger.error(f"Failed to sync Google avatar: {e}")
        return None


def _is_google_avatar_url(url: Optional[str]) -> bool:
    """Return True if the URL is a raw Google-hosted image (not yet stored in HF)."""
    if not url:
        return False
    return "googleusercontent.com" in url or "googleapis.com" in url


@app.get("/api/auth/google")
async def google_auth(request: Request):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(500, "Google OAuth not configured")
    state = str(uuid.uuid4())
    # Always derive the redirect URI from the actual request origin
    # so it works on localhost, Render, and any custom domain without
    # changing any environment variable.
    frontend_origin = _get_frontend_origin(request)
    redirect_uri = f"{frontend_origin}/auth/google/callback"
    logger.info(f"Google OAuth - frontend_origin: {frontend_origin}, redirect_uri: {redirect_uri}")
    google_auth_url = (
        f"https://accounts.google.com/o/oauth2/auth?"
        f"client_id={GOOGLE_CLIENT_ID}&"
        f"redirect_uri={redirect_uri}&"
        f"response_type=code&"
        f"scope=openid%20email%20profile&"
        f"state={state}"
    )
    return {"auth_url": google_auth_url, "state": state, "redirect_uri": redirect_uri}

@app.get("/api/auth/google/callback")
async def google_callback(code: str, state: str, request: Request):
    logger.info(f"Google callback received - code: {code[:20] if code else 'None'}..., state: {state}")
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        logger.error("Google OAuth not configured")
        raise HTTPException(500, "Google OAuth not configured")

    # Reconstruct the same redirect_uri that was used in the auth request.
    # Google requires this to match exactly.
    frontend_origin = _get_frontend_origin(request)
    dynamic_redirect_uri = f"{frontend_origin}/auth/google/callback"
    logger.info(f"Google callback - using redirect_uri: {dynamic_redirect_uri}")

    # Exchange code for tokens
    token_url = "https://oauth2.googleapis.com/token"
    token_data = {
        "code": code,
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "redirect_uri": dynamic_redirect_uri,
        "grant_type": "authorization_code"
    }
    
    try:
        logger.info(f"Exchanging code for tokens - redirect_uri: {dynamic_redirect_uri}")
        token_response = requests.post(token_url, data=token_data)
        logger.info(f"Token exchange response status: {token_response.status_code}")
        logger.info(f"Token exchange response: {token_response.text[:500]}")
        token_response.raise_for_status()
        tokens = token_response.json()
        
        # Get user info from Google
        userinfo_url = "https://www.googleapis.com/oauth2/v3/userinfo"
        logger.info(f"Fetching user info from Google")
        userinfo_response = requests.get(
            userinfo_url,
            headers={"Authorization": f"Bearer {tokens['access_token']}"}
        )
        logger.info(f"User info response status: {userinfo_response.status_code}")
        userinfo_response.raise_for_status()
        user_info = userinfo_response.json()
        logger.info(f"User info retrieved: {user_info}")
        
        # Check if user exists by email
        conn = await get_db_connection()
        try:
            cursor = await conn.execute("SELECT * FROM users WHERE email=%s", (user_info.get("email"),))
            existing_user = await cursor.fetchone()
            
            if existing_user:
                # User exists, log them in
                logger.info(f"Existing user found: {existing_user['username']}")
                avatar_url = existing_user.get("avatar_url")
                avatar_changed = existing_user.get("avatar_changed", False)
                # Upload to HF only if: no avatar yet, AND user hasn't manually set their own avatar
                if user_info.get("picture") and not avatar_url and not avatar_changed:
                    new_avatar_url = await upload_user_avatar_from_url(existing_user["username"], user_info["picture"])
                    if new_avatar_url:
                        avatar_url = new_avatar_url
                        await conn.execute("UPDATE users SET avatar_url=%s WHERE id=%s", (avatar_url, existing_user["id"]))
                        await conn.commit()
                        logger.info(f"Updated avatar for existing user {existing_user['username']} → {avatar_url}")
                token = create_access_token({"sub": existing_user["username"]})
                return {
                    "token": token,
                    "token_type": "bearer",
                    "username": existing_user["username"],
                    "email": existing_user["email"],
                    "is_admin": existing_user["is_admin"],
                    "avatar_url": avatar_url,
                    "existing_user": True
                }
            else:
                # Create new user
                logger.info(f"Creating new user from Google OAuth")
                # Use full email as username, replacing @ with _ to make it valid
                username = user_info.get("email", "").replace("@", "_").replace(".", "_").lower().strip()
                logger.info(f"Generated username from email: {username}")
                h = bcrypt.hashpw(os.urandom(16), bcrypt.gensalt()).decode()
                
                # Assign default plan
                # Safely get default plan (handles missing is_default column)
                default_plan_name = await _get_default_plan_name(conn)
                logger.info(f"[GOOGLE] Default plan name: {default_plan_name}")
                cursor = await conn.execute("SELECT * FROM plans WHERE name=%s", (default_plan_name,))
                plan_row = await cursor.fetchone()
                logger.info(f"[GOOGLE] Plan lookup result: {plan_row}")
                credits = plan_row["credits"] if plan_row else 0
                expiry = datetime.utcnow() + timedelta(days=plan_row["duration_days"]) if plan_row and plan_row["duration_days"] else None
                logger.info(f"[GOOGLE] Final assignment - Plan: {default_plan_name}, Credits: {credits}, Expiry: {expiry}")
                
                avatar_url = None
                if user_info.get("picture"):
                    avatar_url = await upload_user_avatar_from_url(username, user_info["picture"])
                
                try:
                    await conn.execute(
                        """INSERT INTO users
                           (username,full_name,email,password_hash,plan,credits,plan_expiry,avatar_url)
                           VALUES (%s,%s,%s,%s,%s,%s,%s,%s)""",
                        (username, user_info.get("name", ""), user_info.get("email"), h,
                        default_plan_name, credits, expiry, avatar_url),
                    )
                    # Get the new user's ID and log signup activities
                    cursor = await conn.execute("SELECT id FROM users WHERE LOWER(username)=LOWER(%s)", (username,))
                    user_row = await cursor.fetchone()
                    if user_row:
                        await record_activity(user_row["id"], "account_created", "Account created via Google Login", conn=conn)
                        if credits > 0:
                            await record_activity(user_row["id"], "credits_added", f"Welcome credits added: {credits} credits", credits_changed=credits, conn=conn)
                    await conn.commit()
                    token = create_access_token({"sub": username})
                    logger.info(f"New user created successfully: {username}")
                    return {
                        "token": token,
                        "token_type": "bearer",
                        "username": username,
                        "email": user_info.get("email"),
                        "is_admin": False,
                        "avatar_url": avatar_url,
                        "existing_user": False
                    }
                except Exception as insert_error:
                    # If insert fails due to duplicate email, try to find the existing user
                    logger.error(f"Insert failed: {insert_error}, checking for existing user")
                    cursor = await conn.execute("SELECT * FROM users WHERE email=%s", (user_info.get("email"),))
                    existing_user = await cursor.fetchone()
                    if existing_user:
                        logger.info(f"Existing user found after insert error: {existing_user['username']}")
                        avatar_url = existing_user.get("avatar_url")
                        avatar_changed = existing_user.get("avatar_changed", False)
                        # Only upload if no avatar yet AND user hasn't manually set their own
                        if user_info.get("picture") and not avatar_url and not avatar_changed:
                            new_avatar_url = await upload_user_avatar_from_url(existing_user["username"], user_info["picture"])
                            if new_avatar_url:
                                avatar_url = new_avatar_url
                                await conn.execute("UPDATE users SET avatar_url=%s WHERE id=%s", (avatar_url, existing_user["id"]))
                                await conn.commit()
                        token = create_access_token({"sub": existing_user["username"]})
                        return {
                            "token": token,
                            "token_type": "bearer",
                            "username": existing_user["username"],
                            "email": existing_user["email"],
                            "is_admin": existing_user["is_admin"],
                            "avatar_url": avatar_url,
                            "existing_user": True
                        }
                    else:
                        raise insert_error
        finally:
            await conn.close()
            
    except Exception as e:
        logger.error(f"Google OAuth error: {e}")
        import traceback
        logger.error(f"Google OAuth traceback: {traceback.format_exc()}")
        raise HTTPException(500, f"Google authentication failed: {str(e)}")

# ── Facebook OAuth ─────────────────────────────────────────────────────────────

FACEBOOK_APP_ID     = os.getenv("FACEBOOK_APP_ID",     "")
FACEBOOK_APP_SECRET = os.getenv("FACEBOOK_APP_SECRET", "")
logger.info(f"Facebook OAuth Configured - APP_ID: {FACEBOOK_APP_ID[:6] if FACEBOOK_APP_ID else 'NOT SET'}..., SECRET: {'SET' if FACEBOOK_APP_SECRET else 'NOT SET'}")

@app.get("/api/auth/facebook")
async def facebook_auth(request: Request):
    if not FACEBOOK_APP_ID:
        raise HTTPException(500, "Facebook OAuth not configured")
    state = str(uuid.uuid4())
    frontend_origin = _get_frontend_origin(request)
    redirect_uri = f"{frontend_origin}/auth/facebook/callback"
    fb_auth_url = (
        f"https://www.facebook.com/v19.0/dialog/oauth?"
        f"client_id={FACEBOOK_APP_ID}&"
        f"redirect_uri={redirect_uri}&"
        f"scope=email,public_profile&"
        f"state={state}&"
        f"response_type=code"
    )
    return {"auth_url": fb_auth_url, "state": state, "redirect_uri": redirect_uri}

@app.get("/api/auth/facebook/callback")
async def facebook_callback(code: str, state: str, request: Request):
    if not FACEBOOK_APP_ID or not FACEBOOK_APP_SECRET:
        raise HTTPException(500, "Facebook OAuth not configured")

    frontend_origin = _get_frontend_origin(request)
    redirect_uri = f"{frontend_origin}/auth/facebook/callback"

    # Exchange code for access token
    token_url = "https://graph.facebook.com/v19.0/oauth/access_token"
    try:
        token_response = requests.get(token_url, params={
            "client_id": FACEBOOK_APP_ID,
            "client_secret": FACEBOOK_APP_SECRET,
            "redirect_uri": redirect_uri,
            "code": code,
        })
        token_response.raise_for_status()
        token_data = token_response.json()
        access_token = token_data.get("access_token")
        if not access_token:
            raise ValueError(f"No access_token in Facebook response: {token_data}")

        # Get user info from Facebook Graph API
        userinfo_response = requests.get(
            "https://graph.facebook.com/v19.0/me",
            params={"fields": "id,name,email,picture.type(large)", "access_token": access_token},
        )
        userinfo_response.raise_for_status()
        user_info = userinfo_response.json()
        logger.info(f"Facebook user info: {user_info}")

        email = user_info.get("email")
        name  = user_info.get("name", "")
        fb_id = user_info.get("id", "")
        picture_url = user_info.get("picture", {}).get("data", {}).get("url")

        # Facebook doesn't always return email (privacy settings). Fall back to fb_id@facebook.com
        if not email:
            email = f"{fb_id}@facebook.com"
            logger.warning(f"Facebook did not return email for user {fb_id}, using synthetic email")

        conn = await get_db_connection()
        try:
            cursor = await conn.execute("SELECT * FROM users WHERE email=%s", (email,))
            existing_user = await cursor.fetchone()

            if existing_user:
                logger.info(f"Existing user found via Facebook: {existing_user['username']}")
                avatar_url = existing_user.get("avatar_url")
                avatar_changed = existing_user.get("avatar_changed", False)
                # Only fetch avatar if none stored and user hasn't manually set one
                if picture_url and not avatar_url and not avatar_changed:
                    new_avatar_url = await upload_user_avatar_from_url(existing_user["username"], picture_url)
                    if new_avatar_url:
                        avatar_url = new_avatar_url
                        await conn.execute("UPDATE users SET avatar_url=%s WHERE id=%s", (avatar_url, existing_user["id"]))
                        await conn.commit()
                token = create_access_token({"sub": existing_user["username"]})
                return {
                    "token": token,
                    "token_type": "bearer",
                    "username": existing_user["username"],
                    "email": existing_user["email"],
                    "is_admin": existing_user["is_admin"],
                    "avatar_url": avatar_url,
                    "existing_user": True,
                }
            else:
                # New user — derive username from name or fb_id
                username = name.lower().replace(" ", "_") if name else f"fb_{fb_id}"
                # Ensure uniqueness
                base_username = username
                suffix = 1
                while True:
                    cur = await conn.execute("SELECT id FROM users WHERE LOWER(username)=LOWER(%s)", (username,))
                    if not await cur.fetchone():
                        break
                    username = f"{base_username}_{suffix}"
                    suffix += 1

                h = bcrypt.hashpw(os.urandom(16), bcrypt.gensalt()).decode()
                default_plan_name = await _get_default_plan_name(conn)
                cursor = await conn.execute("SELECT * FROM plans WHERE name=%s", (default_plan_name,))
                plan_row = await cursor.fetchone()
                credits = plan_row["credits"] if plan_row else 0
                expiry = datetime.utcnow() + timedelta(days=plan_row["duration_days"]) if plan_row and plan_row["duration_days"] else None

                avatar_url = None
                if picture_url:
                    avatar_url = await upload_user_avatar_from_url(username, picture_url)

                await conn.execute(
                    """INSERT INTO users
                       (username,full_name,email,password_hash,plan,credits,plan_expiry,avatar_url)
                       VALUES (%s,%s,%s,%s,%s,%s,%s,%s)""",
                    (username, name, email, h, default_plan_name, credits, expiry, avatar_url),
                )
                cur2 = await conn.execute("SELECT id FROM users WHERE LOWER(username)=LOWER(%s)", (username,))
                user_row = await cur2.fetchone()
                if user_row:
                    await record_activity(user_row["id"], "account_created", "Account created via Facebook Login", conn=conn)
                    if credits > 0:
                        await record_activity(user_row["id"], "credits_added", f"Welcome credits added: {credits} credits", credits_changed=credits, conn=conn)
                await conn.commit()
                token = create_access_token({"sub": username})
                logger.info(f"New user created via Facebook: {username}")
                return {
                    "token": token,
                    "token_type": "bearer",
                    "username": username,
                    "email": email,
                    "is_admin": False,
                    "avatar_url": avatar_url,
                    "existing_user": False,
                }
        finally:
            await conn.close()

    except Exception as e:
        logger.error(f"Facebook OAuth error: {e}")
        import traceback
        logger.error(f"Facebook OAuth traceback: {traceback.format_exc()}")
        raise HTTPException(500, f"Facebook authentication failed: {str(e)}")

@app.post("/api/feedback")
async def submit_feedback(data: FeedbackRequest, request: Request):
    conn = await get_db_connection()
    try:
        # Get user if authenticated
        user_id = None
        token = request.headers.get("authorization", "").replace("Bearer ", "")
        if token:
            try:
                payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
                username = payload.get("sub")
                if username:
                    cursor = await conn.execute("SELECT id FROM users WHERE LOWER(username)=LOWER(%s)", (username,))
                    user_row = await cursor.fetchone()
                    if user_row:
                        user_id = user_row["id"]
            except:
                pass  # Invalid token, continue as anonymous

        # Get client info
        client_host = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")

        # Try to create feedback table if it doesn't exist
        try:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS feedback (
                    id SERIAL PRIMARY KEY,
                    message TEXT NOT NULL,
                    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    ip_address VARCHAR(50),
                    user_agent TEXT,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
            """)
        except:
            pass  # Table may already exist or creation failed

        # Insert feedback
        try:
            await conn.execute(
                """INSERT INTO feedback (message, user_id, ip_address, user_agent)
                   VALUES (%s,%s,%s,%s)""",
                (data.message, user_id, client_host, user_agent)
            )
        except Exception as insert_error:
            # If insert fails, log it but still return success
            logger.error(f"Feedback insert failed (table may not exist): {insert_error}")
            # For now, just log to file as fallback
            logger.info(f"Feedback (fallback): {data.message} from user {user_id}")

        return {"success": True, "message": "Feedback submitted successfully"}
    except Exception as e:
        logger.error(f"Feedback submission error: {e}")
        raise HTTPException(500, str(e))
    finally: await conn.close()

@app.post("/api/lookup-pincode")
async def lookup_pincode(data: dict):
    pin = data.get("pincode", "")
    logger.info(f"Pincode lookup request for: {pin}")
    if len(pin) != 6 or not pin.isdigit():
        logger.warning(f"Invalid pincode format: {pin}")
        raise HTTPException(400, "Invalid pincode")
    try:
        r = requests.get(f"https://api.postalpincode.in/pincode/{pin}", timeout=5)
        logger.info(f"Pincode API response status: {r.status_code}")
        res = r.json()
        logger.info(f"Pincode API response: {res}")
        if res and res[0]["Status"] == "Success":
            po = res[0]["PostOffice"][0]
            result = {"city": po.get("Name",""), "district": po.get("District",""),
                    "state": po.get("State",""), "country": po.get("Country","India")}
            logger.info(f"Pincode lookup success: {result}")
            return result
        else:
            logger.warning(f"Pincode API returned unsuccessful status: {res[0]['Status'] if res else 'No response'}")
    except Exception as e:
        logger.error(f"Pincode lookup error: {e}")
    raise HTTPException(404, "Pincode not found")

@app.post("/api/forgot-password")
async def forgot_password(req: ForgotPasswordRequest):
    """Send a password-reset OTP token to the user's email via Brevo."""
    conn = await get_db_connection()
    try:
        cursor = await conn.execute(
            "SELECT username, email FROM users WHERE email=%s", (req.email,)
        )
        user = await cursor.fetchone()
    except Exception as e:
        logger.error(f"[FORGOT_PASSWORD] DB error: {e}")
        raise HTTPException(500, "Internal server error")
    finally:
        await conn.close()

    # Always return success to prevent email enumeration
    if not user:
        return {"success": True, "message": "If that email is registered, a reset link will be sent."}

    # Generate a secure 6-digit OTP valid for 15 minutes
    otp = str(random.randint(100000, 999999))
    reset_token = str(uuid.uuid4())   # opaque token stored server-side
    _password_reset_store[req.email] = {
        "token": reset_token,
        "otp": otp,
        "expires_at": datetime.utcnow() + timedelta(minutes=15),
        "username": user["username"],
    }

    username = user["username"]
    html = email_password_reset_otp(username, otp)
    sent = send_brevo_email(req.email, username, "Your ZaiZ password reset OTP", html)
    if not sent:
        raise HTTPException(500, "Failed to send reset email. Please try again.")

    return {"success": True, "message": "Password reset OTP sent to your email."}


@app.post("/api/reset-password")
async def reset_password(req: ResetPasswordRequest):
    """Verify the reset OTP and update the user's password."""
    record = _password_reset_store.get(req.email)
    if not record:
        raise HTTPException(400, "No password reset was requested for this email.")
    if datetime.utcnow() > record["expires_at"]:
        _password_reset_store.pop(req.email, None)
        raise HTTPException(400, "OTP has expired. Please request a new one.")
    if record["otp"] != req.token.strip():
        raise HTTPException(400, "Invalid OTP. Please check and try again.")

    _password_reset_store.pop(req.email, None)

    new_hash = bcrypt.hashpw(req.new_password.encode(), bcrypt.gensalt()).decode()
    conn = await get_db_connection()
    try:
        await conn.execute(
            "UPDATE users SET password_hash=%s WHERE email=%s", (new_hash, req.email)
        )
        await conn.commit()
        logger.info(f"[RESET_PASSWORD] Password updated for {req.email}")
        return {"success": True, "message": "Password updated successfully. You can now log in."}
    except Exception as e:
        logger.error(f"[RESET_PASSWORD] DB error: {e}")
        raise HTTPException(500, "Failed to update password. Please try again.")
    finally:
        await conn.close()

# ── User / Profile ────────────────────────────────────────────────────────────

@app.get("/api/profile")
async def get_profile(cu: dict = Depends(get_current_user)):
    conn = await get_db_connection()
    try:
        cursor = await conn.execute(
            "SELECT id,username,full_name,email,phone,plan,credits,plan_expiry,address_line,pincode,city,state,is_admin,avatar_url,created_at FROM users WHERE LOWER(username)=LOWER(%s)",
            (cu["username"],),
        )
        row = await cursor.fetchone()
        if not row: raise HTTPException(404, "User not found")
        return dict(row)
    except HTTPException: raise
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()


@app.get("/api/account/activity")
async def get_account_activity(cu: dict = Depends(get_current_user)):
    conn = await get_db_connection()
    try:
        cursor = await conn.execute(
            """SELECT id, activity_type, description, amount, credits_changed, created_at
               FROM account_activity
               WHERE user_id=%s
               ORDER BY created_at DESC
               LIMIT 50""",
            (cu["user_id"],)
        )
        rows = await cursor.fetchall()
        activities = []
        for r in rows:
            activities.append({
                "id": r["id"],
                "activity_type": r["activity_type"],
                "description": r["description"],
                "amount": float(r["amount"]) if r["amount"] is not None else None,
                "credits_changed": r["credits_changed"],
                "created_at": r["created_at"].isoformat()
            })
        
        if not activities:
            # Fallback to dynamically synthesized activities for existing users
            cursor = await conn.execute("SELECT created_at, plan, credits FROM users WHERE id=%s", (cu["user_id"],))
            urow = await cursor.fetchone()
            if urow:
                activities.append({
                    "id": -1,
                    "activity_type": "account_created",
                    "description": "Account created",
                    "amount": None,
                    "credits_changed": None,
                    "created_at": urow["created_at"].isoformat()
                })
                if urow["credits"] > 0:
                    activities.append({
                        "id": -2,
                        "activity_type": "credits_added",
                        "description": f"Welcome credits added: {urow['credits']} credits",
                        "amount": None,
                        "credits_changed": urow["credits"],
                        "created_at": urow["created_at"].isoformat()
                    })
            
            cursor = await conn.execute(
                """SELECT o.id, o.amount, o.created_at, p.name AS plan_name, p.credits AS pcredits
                   FROM orders o
                   JOIN plans p ON o.plan_id = p.id
                   WHERE o.user_id=%s AND o.status='completed'
                   ORDER BY o.created_at DESC""",
                (cu["user_id"],)
            )
            orows = await cursor.fetchall()
            for o in orows:
                activities.append({
                    "id": o["id"],
                    "activity_type": "purchase",
                    "description": f"Purchased {o['plan_name']} plan for ₹{o['amount']}",
                    "amount": float(o['amount']),
                    "credits_changed": o['pcredits'],
                    "created_at": o['created_at'].isoformat()
                })
            
            activities.sort(key=lambda x: x["created_at"], reverse=True)
            
        return activities
    except Exception as e:
        logger.error(f"Error fetching account activity: {e}")
        raise HTTPException(500, str(e))
    finally:
        await conn.close()

@app.post("/api/profile/avatar")
async def upload_avatar(file: UploadFile = File(...), cu: dict = Depends(get_current_user)):
    """Upload a new profile avatar – stored in HF bucket under avatars/{username}.{ext}"""
    allowed_types = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    content_type = file.content_type or "image/png"
    if content_type not in allowed_types:
        raise HTTPException(400, "Only JPEG, PNG, WebP, or GIF images are allowed")
    max_size = 5 * 1024 * 1024  # 5 MB
    file_content = await file.read()
    if len(file_content) > max_size:
        raise HTTPException(400, "Image must be smaller than 5 MB")
    ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif"}.get(content_type, "png")
    file_path = f"avatars/{cu['username']}.{ext}"
    public_url = await upload_to_hf_storage(file_content, file_path, content_type)
    if not public_url:
        raise HTTPException(500, "Failed to upload avatar")
    conn = await get_db_connection()
    try:
        await conn.execute("UPDATE users SET avatar_url=%s, avatar_changed=TRUE WHERE LOWER(username)=LOWER(%s)", (public_url, cu["username"]))
        await conn.commit()
        return {"success": True, "avatar_url": public_url}
    except Exception as e:
        raise HTTPException(500, str(e))
    finally:
        await conn.close()

@app.delete("/api/profile/avatar")
async def delete_avatar(cu: dict = Depends(get_current_user)):
    """Remove the profile avatar – clears the HF bucket file and DB record."""
    conn = await get_db_connection()
    try:
        # Get current avatar path
        cursor = await conn.execute("SELECT avatar_url FROM users WHERE LOWER(username)=LOWER(%s)", (cu["username"],))
        row = await cursor.fetchone()
        if row and row["avatar_url"]:
            # Try to delete from HF bucket (best-effort; non-fatal if it fails)
            try:
                url = row["avatar_url"]
                marker = "/api/bucket/files/"
                if marker in url:
                    rel = url.split(marker, 1)[1]
                    if HF_TOKEN and HF_HUB_AVAILABLE and batch_bucket_files is not None:
                        await asyncio.to_thread(
                            lambda: batch_bucket_files(HF_BUCKET_ID, delete=[rel], token=HF_TOKEN)
                        )
            except Exception as del_err:
                logger.warning(f"Avatar file deletion error: {del_err}")
        # avatar_changed=TRUE tells Google/Facebook login NOT to re-import the social photo
        await conn.execute("UPDATE users SET avatar_url=NULL, avatar_changed=TRUE WHERE LOWER(username)=LOWER(%s)", (cu["username"],))
        await conn.commit()
        return {"success": True}
    except Exception as e:
        raise HTTPException(500, str(e))
    finally:
        await conn.close()

@app.patch("/api/profile")
async def update_profile(update: UpdateProfileRequest, cu: dict = Depends(get_current_user)):
    conn = await get_db_connection()
    try:
        fields, vals = [], []
        for f in ["full_name","email","phone","address_line","pincode"]:
            v = getattr(update, f)
            if v is not None:
                fields.append(f"{f}=%s"); vals.append(v)
        if not fields: raise HTTPException(400, "Nothing to update")
        vals.append(cu["username"])
        await conn.execute(f"UPDATE users SET {','.join(fields)} WHERE LOWER(username)=LOWER(%s)", tuple(vals))
        return {"success": True}
    except HTTPException: raise
    except psycopg.errors.UniqueViolation: raise HTTPException(400, "Email or phone already in use")
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

@app.patch("/api/change-password")
async def change_password(req: ChangePasswordRequest, cu: dict = Depends(get_current_user)):
    conn = await get_db_connection()
    try:
        cursor = await conn.execute("SELECT password_hash FROM users WHERE LOWER(username)=LOWER(%s)", (cu["username"],))
        row = await cursor.fetchone()
        if not row or not bcrypt.checkpw(req.current_password.encode(), row["password_hash"].encode()):
            raise HTTPException(401, "Current password is incorrect")
        nh = bcrypt.hashpw(req.new_password.encode(), bcrypt.gensalt()).decode()
        await conn.execute("UPDATE users SET password_hash=%s WHERE LOWER(username)=LOWER(%s)", (nh, cu["username"]))
        return {"success": True}
    except HTTPException: raise
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

@app.get("/api/conversion-history")
async def get_conversion_history(cu: dict = Depends(get_current_user)):
    conn = await get_db_connection()
    try:
        cursor = await conn.execute("""
            SELECT id, conversion_type, input_file_name, output_file_name, output_file_url,
                   status, file_size, created_at
            FROM conversion_history
            WHERE user_id=%s
            ORDER BY created_at DESC
            LIMIT 50
        """, (cu["user_id"],))
        rows = await cursor.fetchall()
        return [
            {
                "id": row["id"],
                "type": row["conversion_type"],
                "fileName": row["input_file_name"],
                "outputFileName": row["output_file_name"],
                "outputFileUrl": row["output_file_url"],
                "date": (row["created_at"].replace(tzinfo=__import__('datetime').timezone.utc).astimezone(__import__('datetime').timezone(__import__('datetime').timedelta(hours=5, minutes=30)))).strftime("%Y-%m-%d %H:%M") if row["created_at"] else None,
                "status": row["status"],
                "size": row["file_size"]
            }
            for row in rows
        ]
    except HTTPException: raise
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

@app.get("/api/my-plan")
async def get_my_plan(cu: dict = Depends(get_current_user)):
    conn = await get_db_connection()
    try:
        # First try simple user query
        cursor = await conn.execute("""
            SELECT u.username,u.full_name,u.email,u.phone,u.plan,u.credits,u.plan_expiry,
                   u.address_line,u.pincode,u.city,u.state
            FROM users u WHERE LOWER(u.username)=LOWER(%s)
        """, (cu["username"],))
        row = await cursor.fetchone()
        if not row: raise HTTPException(404, "User not found")

        # Format expiry as dd-mm-yyyy for dashboard
        expiry_fmt = None
        expiry_iso = None
        if row["plan_expiry"]:
            d = row["plan_expiry"]
            expiry_fmt = f"{d.day:02d}-{d.month:02d}-{d.year}"
            expiry_iso = d.isoformat()

        # Get notifications count (with error handling)
        notif_count = 0
        try:
            cursor = await conn.execute(
                "SELECT COUNT(*) AS c FROM notifications WHERE user_id=%s AND is_read=FALSE", (cu["user_id"],)
            )
            n_row = await cursor.fetchone()
            notif_count = (n_row["c"] if n_row else 0) or 0
        except Exception as notif_error:
            logger.warning(f"Notifications query failed: {notif_error}")
            notif_count = 0

        # Try to get plan details separately
        plan_details = {"name": row["plan"], "price": 0, "duration_days": 30, "features": []}
        try:
            cursor = await conn.execute("SELECT * FROM plans WHERE name=%s", (row["plan"],))
            plan_row = await cursor.fetchone()
            if plan_row:
                feats = plan_row.get("features")
                if isinstance(feats, str):
                    try: feats = json.loads(feats)
                    except: feats = []
                elif feats is None:
                    feats = []
                plan_details = {
                    "name": plan_row["name"],
                    "price": float(plan_row.get("price") or 0),
                    "duration_days": plan_row.get("duration_days") or 30,
                    "features": feats,
                }
        except Exception as plan_error:
            print(f"Error fetching plan details: {plan_error}")
            # Use default plan details if plan fetch fails

        return {
            "username": row["username"], "full_name": row["full_name"],
            "email": row["email"], "phone": row["phone"],
            "plan": row["plan"], "credits": row["credits"],
            "expiry": expiry_fmt,
            "expiry_iso": expiry_iso,
            "address_line": row["address_line"], "pincode": row["pincode"],
            "city": row["city"], "state": row["state"],
            "notifications_count": notif_count or 0, "active": True,
            "plan_details": plan_details,
        }
    except HTTPException: raise
    except Exception as e:
        print(f"Error in /api/my-plan: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(500, str(e))
    finally: await conn.close()

@app.patch("/api/user/plan")
async def user_update_plan(req: UpdatePlanRequest, cu: dict = Depends(get_current_user)):
    conn = await get_db_connection()
    try:
        expiry = datetime.fromisoformat(req.expires_at.replace("Z","+00:00")) if req.expires_at else None
        await conn.execute(
            "UPDATE users SET plan=%s, plan_expiry=%s, credits=COALESCE(%s,credits) WHERE LOWER(username)=LOWER(%s)",
            (req.plan, expiry, req.credits, cu["username"]),
        )
        await send_notification(conn, cu["user_id"], f"Plan updated to {req.plan}.")
        return {"success": True}
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

# ── Notifications ─────────────────────────────────────────────────────────────

@app.get("/api/notifications")
async def get_notifications(cu: dict = Depends(get_current_user)):
    conn = await get_db_connection()
    try:
        cursor = await conn.execute("SELECT * FROM notifications WHERE user_id=%s ORDER BY created_at DESC LIMIT 20", (cu["user_id"],))
        rows = await cursor.fetchall()
        return {"notifications": [dict(r) for r in rows]}
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

@app.patch("/api/notifications/{nid}/read")
async def mark_read(nid: int, cu: dict = Depends(get_current_user)):
    conn = await get_db_connection()
    try:
        await conn.execute("UPDATE notifications SET is_read=TRUE WHERE id=%s AND user_id=%s", (nid, cu["user_id"]))
        await conn.commit()
        return {"message": "Marked as read"}
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

@app.patch("/api/notifications/read-all")
async def mark_all_read(cu: dict = Depends(get_current_user)):
    conn = await get_db_connection()
    try:
        cur = await conn.execute("UPDATE notifications SET is_read=TRUE WHERE user_id=%s AND is_read=FALSE RETURNING id", (cu["user_id"],))
        updated_count = len(await cur.fetchall())
        await conn.commit()
        return {"message": "All marked as read", "updated": f"{updated_count} notifications"}
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

@app.delete("/api/notifications/clear-all")
async def clear_all_notifications(cu: dict = Depends(get_current_user)):
    conn = await get_db_connection()
    try:
        cur = await conn.execute("DELETE FROM notifications WHERE user_id=%s RETURNING id", (cu["user_id"],))
        deleted_count = len(await cur.fetchall())
        await conn.commit()
        return {"message": "All notifications cleared", "deleted": deleted_count}
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()


# ── Public plans ──────────────────────────────────────────────────────────────

@app.get("/api/plans")
async def get_plans():
    conn = await get_db_connection()
    try:
        cursor = await conn.execute("SELECT * FROM plans WHERE is_active=TRUE ORDER BY price")
        rows = await cursor.fetchall()
        plans = []
        for r in rows:
            # With dict_row, rows are already dict-like
            p = dict(r)
            if isinstance(p.get("features"), str):
                try: p["features"] = json.loads(p["features"])
                except: p["features"] = []
            plans.append(p)
        return plans
    except Exception as e:
        print(f"Error fetching plans: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(500, str(e))
    finally: await conn.close()

# ── Payment ───────────────────────────────────────────────────────────────────

async def get_phonepe_v2_token() -> Optional[str]:
    client_id = os.getenv("PHONEPE_CLIENT_ID", "").strip()
    client_secret = os.getenv("PHONEPE_CLIENT_SECRET", "").strip()
    env = os.getenv("PHONEPE_ENV", "SANDBOX").strip()
    
    token_url = (
        "https://api.phonepe.com/apis/identity-manager/v1/oauth/token"
        if env == "PRODUCTION"
        else "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token"
    )
    token_payload = {
        "client_id": client_id,
        "client_version": "1",
        "client_secret": client_secret,
        "grant_type": "client_credentials"
    }
    try:
        resp = requests.post(token_url, data=token_payload, headers={"Content-Type": "application/x-www-form-urlencoded"}, timeout=15)
        if resp.status_code == 200:
            return resp.json().get("access_token")
        else:
            logger.error(f"PhonePe V2 token generation failed ({resp.status_code}): {resp.text}")
            return None
    except Exception as e:
        logger.error(f"PhonePe V2 token generation exception: {e}")
        return None

@app.post("/api/payment/create")
async def create_payment(req: PaymentRequest, request: Request, cu: dict = Depends(get_current_user)):
    conn = await get_db_connection()
    try:
        cursor = await conn.execute("SELECT * FROM plans WHERE id=%s", (req.plan_id,))
        plan_row = await cursor.fetchone()
        if not plan_row: raise HTTPException(404, "Plan not found")
        cursor = await conn.execute("SELECT id FROM users WHERE LOWER(username)=LOWER(%s)", (cu["username"],))
        user_row = await cursor.fetchone()
        if not user_row: raise HTTPException(404, "User not found")
        mt_id = f"MT_{datetime.now().strftime('%Y%m%d%H%M%S')}_{str(uuid.uuid4())[:8].upper()}"
        cursor = await conn.execute(
            "INSERT INTO orders (user_id,plan_id,status,amount,merchant_transaction_id,created_at) VALUES (%s,%s,'pending',%s,%s,NOW()) RETURNING *",
            (user_row["id"], req.plan_id, plan_row["price"], mt_id),
        )
        order_row = await cursor.fetchone()
        await conn.commit()
        base_url     = str(request.base_url).rstrip("/")
        # Detect the correct client origin from Referer header to prevent origin mismatch during localhost/127.0.0.1 redirect
        referer = request.headers.get("referer", "")
        if referer:
            from urllib.parse import urlparse
            parsed_referer = urlparse(referer)
            frontend_url = f"{parsed_referer.scheme}://{parsed_referer.netloc}"
        else:
            frontend_url = os.getenv("FRONTEND_URL", base_url.replace(":8000", ":5173"))
        callback_url = f"{frontend_url}/purchase/success?payment_id={mt_id}&order_id={order_row['id']}"

        if PHONEPE_CLIENT_ID and PHONEPE_CLIENT_SECRET:
            is_v2 = "_" in PHONEPE_CLIENT_ID
            if is_v2:
                try:
                    token = await get_phonepe_v2_token()
                    if token:
                        checkout_url = (
                            "https://api.phonepe.com/apis/pg/checkout/v2/pay"
                            if PHONEPE_ENV == "PRODUCTION"
                            else "https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/pay"
                        )
                        amount_paise = int(float(plan_row["price"]) * 100)
                        pay_payload = {
                            "merchantOrderId": mt_id,
                            "amount": amount_paise,
                            "expireAfter": 1200,
                            "paymentFlow": {
                                "type": "PG_CHECKOUT",
                                "message": f"ZaiZ {plan_row['name']} Subscription",
                                "merchantUrls": {
                                    "redirectUrl": callback_url
                                }
                            }
                        }
                        headers = {
                            "Content-Type": "application/json",
                            "Authorization": f"O-Bearer {token}"
                        }
                        resp = requests.post(checkout_url, json=pay_payload, headers=headers, timeout=15)
                        if resp.status_code == 200:
                            rj = resp.json()
                            url = rj.get("redirectUrl")
                            if url:
                                return PaymentResponse(order_id=order_row["id"], payment_url=url,
                                                       plan_name=plan_row["name"], amount=float(plan_row["price"]),
                                                       demo_mode=False, message="Redirecting to secure gateway")
                        logger.warning(f"PhonePe V2 response: {resp.status_code} - {resp.text}")
                except Exception as pe:
                    logger.error(f"PhonePe V2 call error: {pe}")
            else:
                try:
                    amount_paise = int(float(plan_row["price"]) * 100)
                    payload = {
                        "merchantId": PHONEPE_CLIENT_ID,
                        "merchantTransactionId": mt_id,
                        "merchantUserId": f"USER_{user_row['id']}",
                        "amount": amount_paise,
                        "redirectUrl": callback_url,
                        "redirectMode": "REDIRECT",
                        "callbackUrl": f"{base_url}/api/payment/phonepe-callback",
                        "paymentInstrument": {"type": "PAY_PAGE"},
                    }
                    pb64 = base64.b64encode(json.dumps(payload).encode()).decode()
                    sha  = hashlib.sha256((pb64 + "/pg/v1/pay" + PHONEPE_CLIENT_SECRET).encode()).hexdigest()
                    resp = requests.post(
                        f"{PHONEPE_BASE_URL}/pg/v1/pay",
                        json={"request": pb64},
                        headers={"Content-Type":"application/json","X-VERIFY":sha+"###1"},
                        timeout=15,
                    )
                    rj = resp.json()
                    url = rj.get("data",{}).get("instrumentResponse",{}).get("redirectInfo",{}).get("url")
                    if rj.get("success") and url:
                        return PaymentResponse(order_id=order_row["id"], payment_url=url,
                                               plan_name=plan_row["name"], amount=float(plan_row["price"]),
                                               demo_mode=False, message="Redirecting to secure gateway")
                    logger.warning(f"PhonePe V1 response: {rj}")
                except Exception as pe:
                    logger.error(f"PhonePe V1 call error: {pe}")

        demo_url = f"{frontend_url}/payment/mock"
        return PaymentResponse(order_id=order_row["id"], payment_url=demo_url,
                               plan_name=plan_row["name"], amount=float(plan_row["price"]),
                               demo_mode=True,
                               message="Demo mode – set gateway credentials for live payments")
    except HTTPException: raise
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

@app.post("/api/payment/phonepe-callback")
async def phonepe_callback(request: Request):
    try:
        if not PHONEPE_CLIENT_SECRET:
            logger.warning("PhonePe callback received but PHONEPE_CLIENT_SECRET not configured")
            return {"success": False}
        body    = await request.json()
        rb64    = body.get("response","")
        xverify = request.headers.get("X-VERIFY","")
        expected = hashlib.sha256((rb64+PHONEPE_CLIENT_SECRET).encode()).hexdigest()+"###1"
        if not hmac.compare_digest(xverify, expected):
            raise HTTPException(400, "Invalid checksum")
        data  = json.loads(base64.b64decode(rb64).decode())
        mt_id = data.get("data",{}).get("merchantTransactionId")
        code  = data.get("code","")
        conn  = await get_db_connection()
        try:
            cursor = await conn.execute("SELECT * FROM orders WHERE merchant_transaction_id=%s", (mt_id,))
            order = await cursor.fetchone()
            if not order: return {"success": False}
            if code == "PAYMENT_SUCCESS":
                await conn.execute("UPDATE orders SET status='completed',updated_at=NOW() WHERE id=%s", (order["id"],))
                cursor = await conn.execute("SELECT * FROM plans WHERE id=%s", (order["plan_id"],))
                plan = await cursor.fetchone()
                if plan:
                    # Stack expiry if same plan is still active; otherwise start from now
                    ucursor = await conn.execute(
                        "SELECT plan, plan_expiry FROM users WHERE id=%s", (order["user_id"],)
                    )
                    urow = await ucursor.fetchone()
                    base_dt = datetime.utcnow()
                    if urow and urow["plan"] == plan["name"] and urow["plan_expiry"] and urow["plan_expiry"] > base_dt:
                        base_dt = urow["plan_expiry"]
                    exp = base_dt + timedelta(days=plan["duration_days"])
                    await conn.execute(
                        "UPDATE users SET credits=credits+%s,plan=%s,plan_expiry=%s WHERE id=%s",
                        (plan["credits"], plan["name"], exp, order["user_id"]),
                    )
                    await record_activity(
                        order["user_id"], 
                        "purchase", 
                        f"Purchased {plan['name']} plan for ₹{order['amount']}", 
                        amount=float(order["amount"]),
                        conn=conn
                    )
                    await record_activity(
                        order["user_id"], 
                        "plan_upgrade", 
                        f"Plan upgraded to {plan['name']}", 
                        conn=conn
                    )
                    await record_activity(
                        order["user_id"], 
                        "credits_added", 
                        f"Credits added: {plan['credits']} credits", 
                        credits_changed=int(plan["credits"]),
                        conn=conn
                    )
                    await record_activity(
                        order["user_id"], 
                        "expiry_update", 
                        f"Plan expiry updated to {exp.strftime('%Y-%m-%d %H:%M:%S')}", 
                        conn=conn
                    )
                    await send_notification(conn, order["user_id"], f"Payment successful! {plan['name']} plan activated.")
            else:
                await conn.execute("UPDATE orders SET status='failed',updated_at=NOW() WHERE id=%s", (order["id"],))
            await conn.commit()
        finally:
            await conn.close()
        return {"success": True}
    except HTTPException: raise
    except Exception as e:
        logger.error(f"PhonePe callback: {e}"); return {"success": False}

class CompletePaymentRequest(BaseModel):
    order_id: int

@app.post("/api/payment/complete")
async def complete_payment(request: CompletePaymentRequest):
    conn = await get_db_connection()
    try:
        cursor = await conn.execute("SELECT * FROM orders WHERE id=%s", (request.order_id,))
        order_row = await cursor.fetchone()
        if not order_row:
            raise HTTPException(404, "Order not found")

        is_completed = False
        if PHONEPE_CLIENT_ID and PHONEPE_CLIENT_SECRET and not order_row["merchant_transaction_id"].startswith("DEMO_"):
            is_v2 = "_" in PHONEPE_CLIENT_ID
            if is_v2:
                try:
                    token = await get_phonepe_v2_token()
                    if token:
                        status_url = (
                            f"https://api.phonepe.com/apis/pg/checkout/v2/order/{order_row['merchant_transaction_id']}/status"
                            if PHONEPE_ENV == "PRODUCTION"
                            else f"https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/order/{order_row['merchant_transaction_id']}/status"
                        )
                        headers = {
                            "Content-Type": "application/json",
                            "Authorization": f"O-Bearer {token}"
                        }
                        resp = requests.get(status_url, headers=headers, timeout=15)
                        if resp.status_code == 200:
                            rj = resp.json()
                            state = rj.get("state")
                            if state == "COMPLETED":
                                is_completed = True
                            else:
                                logger.warning(f"PhonePe V2 order status not completed: {rj}")
                        else:
                            logger.error(f"PhonePe V2 status API failed ({resp.status_code}): {resp.text}")
                except Exception as e:
                    logger.error(f"PhonePe V2 status verification error: {e}")
            else:
                is_completed = True
        else:
            is_completed = True

        if not is_completed:
            raise HTTPException(400, "Payment verification pending or failed on secure gateway")

        # Double processing prevention check
        if order_row["status"] == "completed":
            cursor = await conn.execute(
                "SELECT o.*,p.name AS plan_name,p.credits AS pcredits FROM orders o JOIN plans p ON o.plan_id=p.id WHERE o.id=%s", (request.order_id,)
            )
            row = await cursor.fetchone()
            return {"success":True,"order":{"id":row["id"],"plan_name":row["plan_name"],"amount":float(row["amount"]),"credits":row["pcredits"]}}

        await conn.execute("UPDATE orders SET status='completed',updated_at=NOW() WHERE id=%s", (request.order_id,))
        cursor = await conn.execute(
            "SELECT o.*,p.name AS plan_name,p.credits AS pcredits,p.duration_days FROM orders o JOIN plans p ON o.plan_id=p.id WHERE o.id=%s", (request.order_id,)
        )
        row = await cursor.fetchone()
        if not row: raise HTTPException(404, "Order not found")
        # Stack expiry if user already has the same active plan; otherwise start from now
        ucursor = await conn.execute(
            "SELECT plan, plan_expiry FROM users WHERE id=%s", (row["user_id"],)
        )
        urow = await ucursor.fetchone()
        base_dt = datetime.utcnow()
        if urow and urow["plan"] == row["plan_name"] and urow["plan_expiry"] and urow["plan_expiry"] > base_dt:
            base_dt = urow["plan_expiry"]
        exp = base_dt + timedelta(days=row["duration_days"])
        await conn.execute("UPDATE users SET credits=credits+%s,plan=%s,plan_expiry=%s WHERE id=%s",
                           (row["pcredits"], row["plan_name"], exp, row["user_id"]))
        await record_activity(
            row["user_id"], 
            "purchase", 
            f"Purchased {row['plan_name']} plan for ₹{row['amount']}", 
            amount=float(row["amount"]),
            conn=conn
        )
        await record_activity(
            row["user_id"], 
            "plan_upgrade", 
            f"Plan upgraded to {row['plan_name']}", 
            conn=conn
        )
        await record_activity(
            row["user_id"], 
            "credits_added", 
            f"Credits added: {row['pcredits']} credits", 
            credits_changed=int(row["pcredits"]),
            conn=conn
        )
        await record_activity(
            row["user_id"], 
            "expiry_update", 
            f"Plan expiry updated to {exp.strftime('%Y-%m-%d %H:%M:%S')}", 
            conn=conn
        )
        await send_notification(conn, row["user_id"], f"Payment confirmed! {row['plan_name']} plan activated.")
        await conn.commit()
        return {"success":True,"order":{"id":row["id"],"plan_name":row["plan_name"],"amount":float(row["amount"]),"credits":row["pcredits"]}}
    except HTTPException: raise
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

# ── Admin ─────────────────────────────────────────────────────────────────────

def _fmt_expiry(val) -> Optional[str]:
    """Format a datetime to dd-mm-yyyy string or None."""
    if not val:
        return None
    d = val
    return f"{d.day:02d}-{d.month:02d}-{d.year}"

def _parse_expiry(s: str) -> Optional[datetime]:
    """Accept ISO or dd-mm-yyyy from admin UI."""
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z","+00:00"))
    except ValueError:
        pass
    try:
        return datetime.strptime(s, "%d-%m-%Y")
    except ValueError:
        return None


@app.get("/api/admin/debug")
async def admin_debug(cu: dict = Depends(get_current_user)):
    """Diagnostic endpoint - shows DB connection status, table counts, and env config."""
    require_admin(cu)
    conn = await get_db_connection()
    try:
        # Check user deba specifically
        cursor = await conn.execute("""
            SELECT u.id, u.username, u.plan, u.credits, u.plan_expiry
            FROM users u WHERE LOWER(u.username)=LOWER(%s)
        """, ("deba",))
        deba_row = await cursor.fetchone()
        
        result = {
            "deba_user": dict(deba_row) if deba_row else None,
            "database_url_set": bool(DATABASE_URL),
            "database_url_preview": (DATABASE_URL[:40] + "...") if DATABASE_URL else "NOT SET",
            "current_user": cu.get("username"),
            "is_admin": cu.get("is_admin"),
            "db_connection": "ok"
        }
        await conn.close()
        return result
    except Exception as e:
        await conn.close()
        raise HTTPException(500, f"Debug error: {e}")

@app.get("/api/admin/users")
async def admin_users(cu: dict = Depends(get_current_user)):
    require_admin(cu)
    conn = await get_db_connection()
    try:
        cursor = await conn.execute(
            "SELECT id,username,full_name,email,phone,address_line,pincode,city,district,state,country,plan,credits,plan_expiry AS expiry,is_admin,created_at FROM users ORDER BY created_at DESC"
        )
        rows = await cursor.fetchall()
        result = []
        for r in rows:
            result.append({
                "id": r["id"],
                "username": r["username"],
                "full_name": r["full_name"],
                "email": r["email"],
                "phone": r["phone"],
                "address_line": r["address_line"],
                "pincode": r["pincode"],
                "city": r["city"],
                "district": r["district"],
                "state": r["state"],
                "country": r["country"],
                "plan": r["plan"],
                "credits": r["credits"],
                "expiry": r["expiry"].isoformat() if r["expiry"] else None,
                "is_admin": r["is_admin"],
                "created_at": r["created_at"].isoformat() if r["created_at"] else None
            })
        return {"users": result}
    except Exception as e:
        logger.error(f"Admin users error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to load users: {str(e)}")
    finally: await conn.close()

@app.get("/api/admin/plans")
async def admin_plans(cu: dict = Depends(get_current_user)):
    require_admin(cu)
    conn = await get_db_connection()
    try:
        cursor = await conn.execute("SELECT * FROM plans ORDER BY price")
        rows = await cursor.fetchall()
        result = []
        for r in rows:
            # features is JSONB - psycopg3 returns it as a Python list already
            features = r["features"]
            if isinstance(features, str):
                try: features = json.loads(features)
                except: features = []
            if features is None:
                features = []
            result.append({
                "id": r["id"],
                "name": r["name"],
                "price": float(r["price"]) if r["price"] is not None else 0.0,
                "credits": r["credits"],
                "duration_days": r["duration_days"],
                "features": features,
                "expiry": r["expiry"].isoformat() if r.get("expiry") else None,
                "is_active": r["is_active"],
                "is_default": r.get("is_default", False),
                "created_at": r["created_at"].isoformat() if r["created_at"] else None
            })
        return {"plans": result}
    except Exception as e:
        logger.error(f"Admin plans error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to load plans: {str(e)}")
    finally: await conn.close()

@app.get("/api/admin/settings")
async def admin_settings(cu: dict = Depends(get_current_user)):
    require_admin(cu)
    conn = await get_db_connection()
    try:
        cursor = await conn.execute("SELECT key,value FROM settings")
        rows = await cursor.fetchall()
        return {r["key"]: r["value"] for r in rows}
    except Exception as e:
        logger.error(f"Admin settings error: {e}")
        raise HTTPException(500, str(e))
    finally: await conn.close()

@app.get("/api/admin/dashboard/stats")
async def admin_stats(cu: dict = Depends(get_current_user)):
    require_admin(cu)
    conn = await get_db_connection()
    try:
        # Get users count
        try:
            cursor = await conn.execute("SELECT COUNT(*) AS c FROM users")
            row = await cursor.fetchone()
            uc = (row["c"] if row else 0) or 0
        except Exception as e:
            logger.error(f"Error getting users count: {e}")
            uc = 0

        # Get active plans count
        try:
            cursor = await conn.execute("SELECT COUNT(*) AS c FROM plans WHERE is_active=TRUE")
            row = await cursor.fetchone()
            pc = (row["c"] if row else 0) or 0
        except Exception as e:
            logger.error(f"Error getting plans count: {e}")
            pc = 0

        # Get orders count (may not exist)
        try:
            cursor = await conn.execute("SELECT COUNT(*) AS c FROM orders")
            row = await cursor.fetchone()
            oc = (row["c"] if row else 0) or 0
        except Exception as e:
            logger.error(f"Error getting orders count (table may not exist): {e}")
            oc = 0

        # Total revenue (completed orders)
        try:
            cursor = await conn.execute(
                "SELECT COALESCE(SUM(amount),0) AS s FROM orders WHERE status='completed'"
            )
            row = await cursor.fetchone()
            total_revenue = float(row["s"]) if row and row["s"] is not None else 0.0
        except Exception as e:
            logger.error(f"Error getting total revenue: {e}")
            total_revenue = 0.0

        # Revenue this calendar month
        try:
            cursor = await conn.execute(
                "SELECT COALESCE(SUM(amount),0) AS s FROM orders "
                "WHERE status='completed' AND date_trunc('month', created_at) = date_trunc('month', NOW())"
            )
            row = await cursor.fetchone()
            revenue_this_month = float(row["s"]) if row and row["s"] is not None else 0.0
        except Exception as e:
            logger.error(f"Error getting monthly revenue: {e}")
            revenue_this_month = 0.0

        return {
            "users": uc,
            "plans": pc,
            "orders": oc,
            "totalRevenue": total_revenue,
            "revenueThisMonth": revenue_this_month,
        }
    except Exception as e:
        logger.error(f"Admin stats error: {e}", exc_info=True)
        return {"users": 0, "plans": 0, "orders": 0}
    finally:
        await conn.close()

@app.patch("/api/admin/users/{uid}/credits")
async def admin_update_credits(uid: int, data: dict, cu: dict = Depends(get_current_user)):
    require_admin(cu)
    conn = await get_db_connection()
    try:
        credits_new = data.get("credits")
        await conn.execute("UPDATE users SET credits=%s WHERE id=%s", (credits_new, uid))
        await record_activity(
            uid, 
            "credits_updated", 
            f"Credits updated to {credits_new} credits by admin", 
            credits_changed=int(credits_new), 
            conn=conn
        )
        await conn.commit()
        cursor = await conn.execute("SELECT id,username,email,credits,plan,is_admin FROM users WHERE id=%s", (uid,))
        user = await cursor.fetchone()
        if not user: raise HTTPException(404, "User not found")
        await send_notification(conn, uid, f"Credits updated to {credits_new} by admin.")
        await conn.commit()
        return {"user": dict(user)}
    except HTTPException: raise
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

@app.patch("/api/admin/users/{uid}/plan")
async def admin_update_user_plan(uid: int, data: dict, cu: dict = Depends(get_current_user)):
    require_admin(cu)
    conn = await get_db_connection()
    try:
        exp = _parse_expiry(data.get("expiry",""))
        logger.info(f"Admin plan update - User ID: {uid}, Plan: {data.get('plan')}, Expiry input: {data.get('expiry')}, Parsed expiry: {exp}")
        
        # Get plan details to apply credits and features
        plan_name = data.get("plan")
        if plan_name:
            cursor = await conn.execute("SELECT * FROM plans WHERE name=%s AND is_active=TRUE", (plan_name,))
            plan = await cursor.fetchone()
            
            if plan:
                # If no expiry provided, set to plan duration from now (except for Unlimited plan)
                if plan_name.lower() == "unlimited":
                    exp = None
                elif not exp:
                    exp = datetime.utcnow() + timedelta(days=plan["duration_days"])
                    logger.info(f"No expiry provided, setting to {plan['duration_days']} days from now: {exp}")
                
                # Update user with plan details including credits
                if plan_name.lower() == "unlimited":
                    await conn.execute(
                        "UPDATE users SET plan=%s,plan_expiry=%s,credits=%s WHERE id=%s",
                        (plan_name, exp, plan["credits"], uid)
                    )
                else:
                    await conn.execute(
                        "UPDATE users SET plan=%s,plan_expiry=COALESCE(%s,plan_expiry),credits=%s WHERE id=%s",
                        (plan_name, exp, plan["credits"], uid)
                    )
                await record_activity(uid, "plan_upgrade", f"Plan updated to {plan_name} by admin", conn=conn)
                await record_activity(uid, "credits_added", f"Credits updated to {plan['credits']} credits by admin", credits_changed=int(plan['credits']), conn=conn)
                if exp:
                    await record_activity(uid, "expiry_update", f"Plan expiry set to {exp.strftime('%Y-%m-%d %H:%M:%S')} by admin", conn=conn)
                else:
                    await record_activity(uid, "expiry_update", "Plan expiry cleared by admin for Unlimited plan", conn=conn)
                logger.info(f"Updated user {uid} with plan {plan_name}, credits {plan['credits']}, expiry {exp}")
            else:
                # If plan not found, just update the plan name and expiry
                await conn.execute(
                    "UPDATE users SET plan=%s,plan_expiry=COALESCE(%s,plan_expiry) WHERE id=%s",
                    (plan_name, exp, uid)
                )
                await record_activity(uid, "plan_upgrade", f"Plan updated to {plan_name} by admin", conn=conn)
                if exp:
                    await record_activity(uid, "expiry_update", f"Plan expiry set to {exp.strftime('%Y-%m-%d %H:%M:%S')} by admin", conn=conn)
                logger.info(f"Updated user {uid} with plan {plan_name} (not found in plans table), expiry {exp}")
        else:
            # Just update expiry if no plan provided
            await conn.execute(
                "UPDATE users SET plan_expiry=COALESCE(%s,plan_expiry) WHERE id=%s",
                (exp, uid)
            )
            if exp:
                await record_activity(uid, "expiry_update", f"Plan expiry updated to {exp.strftime('%Y-%m-%d %H:%M:%S')} by admin", conn=conn)
            logger.info(f"Updated user {uid} expiry only: {exp}")
        
        await conn.commit()
        cursor = await conn.execute("SELECT id,username,email,credits,plan,is_admin FROM users WHERE id=%s", (uid,))
        user = await cursor.fetchone()
        if not user: raise HTTPException(404, "User not found")
        await send_notification(conn, uid, f"Plan updated to {data.get('plan')} by admin.")
        await conn.commit()
        return {"user": dict(user)}
    except HTTPException: raise
    except Exception as e: 
        logger.error(f"Admin plan update error: {e}")
        raise HTTPException(500, str(e))
    finally: await conn.close()

@app.patch("/api/admin/users/{uid}/expiry")
async def admin_update_expiry(uid: int, data: dict, cu: dict = Depends(get_current_user)):
    require_admin(cu)
    conn = await get_db_connection()
    try:
        exp = _parse_expiry(data.get("expiry",""))
        await conn.execute("UPDATE users SET plan_expiry=%s WHERE id=%s", (exp, uid))
        if exp:
            await record_activity(uid, "expiry_update", f"Plan expiry updated to {exp.strftime('%Y-%m-%d %H:%M:%S')} by admin", conn=conn)
        else:
            await record_activity(uid, "expiry_update", "Plan expiry cleared by admin", conn=conn)
        await conn.commit()
        cursor = await conn.execute(
            "SELECT id,username,email,credits,plan,plan_expiry AS expiry,is_admin FROM users WHERE id=%s", (uid,)
        )
        user = await cursor.fetchone()
        if not user: raise HTTPException(404, "User not found")
        u = dict(user)
        u["expiry"] = _fmt_expiry(u.get("expiry"))
        return {"user": u}
    except HTTPException: raise
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

@app.patch("/api/admin/users/{uid}/reset-password")
async def admin_reset_password(uid: int, req: AdminResetPasswordRequest, cu: dict = Depends(get_current_user)):
    require_admin(cu)
    conn = await get_db_connection()
    try:
        nh = bcrypt.hashpw(req.newPassword.encode(), bcrypt.gensalt()).decode()
        cursor = await conn.execute("UPDATE users SET password_hash=%s WHERE id=%s", (nh, uid))
        if cursor.rowcount == 0: raise HTTPException(404, "User not found")
        await conn.commit()
        cursor = await conn.execute("SELECT id,username,email,plan FROM users WHERE id=%s", (uid,))
        user = await cursor.fetchone()
        await send_notification(conn, uid, "Your password has been reset by admin.")
        await conn.commit()
        return {"success":True,"message":"Password reset","user":dict(user)}
    except HTTPException: raise
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

@app.patch("/api/admin/settings")
async def admin_update_setting(data: dict, cu: dict = Depends(get_current_user)):
    require_admin(cu)
    conn = await get_db_connection()
    try:
        k, v = data.get("key"), data.get("value")
        if not k or v is None: raise HTTPException(400, "key and value required")
        await conn.execute("INSERT INTO settings (key,value) VALUES (%s,%s) ON CONFLICT (key) DO UPDATE SET value=%s", (k, str(v), str(v)))
        await conn.commit()
        return {"success":True,"key":k,"value":str(v)}
    except HTTPException: raise
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

@app.post("/api/admin/plans")
async def admin_create_plan(data: dict, cu: dict = Depends(get_current_user)):
    require_admin(cu)
    conn = await get_db_connection()
    try:
        cursor = await conn.execute(
            "INSERT INTO plans (name,price,credits,duration_days,features,is_active) VALUES (%s,%s,%s,%s,%s,%s) RETURNING *",
            (data.get("name"), data.get("price",0), data.get("credits",0),
            data.get("duration_days",30), json.dumps(data.get("features",[])), data.get("is_active",True)),
        )
        row = await cursor.fetchone()
        await conn.commit()
        p = dict(row)
        if isinstance(p.get("features"),str):
            try: p["features"]=json.loads(p["features"])
            except: p["features"]=[]
        return {"plan": p}
    except psycopg.errors.UniqueViolation: raise HTTPException(400, "Plan name already exists")
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

@app.patch("/api/admin/plans/{pid}")
async def admin_update_plan_by_id(pid: int, data: dict, cu: dict = Depends(get_current_user)):
    require_admin(cu)
    conn = await get_db_connection()
    try:
        fields, vals = [], []
        for f in ["name","price","credits","duration_days","is_active"]:
            if f in data:
                fields.append(f"{f}=%s"); vals.append(data[f])
        if "features" in data:
            fields.append(f"features=%s"); vals.append(json.dumps(data["features"]))
        if not fields: raise HTTPException(400, "Nothing to update")
        vals.append(pid)
        await conn.execute(f"UPDATE plans SET {','.join(fields)} WHERE id=%s", tuple(vals))
        await conn.commit()
        cursor = await conn.execute("SELECT * FROM plans WHERE id=%s", (pid,))
        row = await cursor.fetchone()
        if not row: raise HTTPException(404, "Plan not found")
        p = dict(row)
        if isinstance(p.get("features"),str):
            try: p["features"]=json.loads(p["features"])
            except: p["features"]=[]
        return {"plan": p}
    except HTTPException: raise
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

@app.delete("/api/admin/plans/{pid}")
async def admin_delete_plan(pid: int, cu: dict = Depends(get_current_user)):
    require_admin(cu)
    conn = await get_db_connection()
    try:
        cursor = await conn.execute("DELETE FROM plans WHERE id=%s", (pid,))
        if cursor.rowcount == 0: raise HTTPException(404, "Plan not found")
        await conn.commit()
        return {"message": "Plan deleted"}
    except HTTPException: raise
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

@app.post("/api/admin/notifications")
@app.post("/api/admin/notify")
async def admin_notify(data: dict, cu: dict = Depends(get_current_user)):
    require_admin(cu)
    conn = await get_db_connection()
    try:
        uid = data.get("user_id")
        msg = (data.get("message") or "").strip()
        as_announcement = bool(data.get("as_announcement"))
        broadcast = bool(data.get("broadcast")) or uid in (None, "", 0)
        title = (data.get("title") or "Announcement").strip()
        if not msg:
            raise HTTPException(400, "message required")
        if not broadcast and not uid:
            raise HTTPException(400, "user_id or broadcast required")

        # Save as announcement (visible on admin dashboard)
        if as_announcement:
            try:
                await conn.execute(
                    "INSERT INTO announcements (title,message,created_by,created_at) VALUES (%s,%s,%s,NOW())",
                    (title, msg, cu.get("user_id")),
                )
            except Exception as e:
                logger.warning(f"Announcement insert failed: {e}")

        # Send notification(s)
        if broadcast:
            await conn.execute(
                "INSERT INTO notifications (user_id,message,is_read,created_at) "
                "SELECT id,%s,false,NOW() FROM users",
                (msg,),
            )
        else:
            await conn.execute(
                "INSERT INTO notifications (user_id,message,is_read,created_at) VALUES (%s,%s,false,NOW())",
                (uid, msg),
            )
        await conn.commit()

        # ── Optional Brevo email ────────────────────────────────
        email_results = {"sent": 0, "failed": 0}
        if data.get("send_email"):
            subject = (data.get("email_subject") or title or "Message from ZaiZ").strip()
            _lines = [line for line in msg.replace("\r\n", "\n").split("\n") if line.strip()]

            if broadcast:
                cursor = await conn.execute("SELECT full_name, email FROM users WHERE email IS NOT NULL AND email != ''")
                recipients = await cursor.fetchall()
            else:
                cursor = await conn.execute("SELECT full_name, email FROM users WHERE id=%s AND email IS NOT NULL AND email != ''", (uid,))
                recipients = await cursor.fetchall()

            for r in recipients:
                try:
                    uname = r["full_name"] or r["email"]
                    html_body = email_admin_broadcast(uname, subject, _lines)
                    ok = await asyncio.to_thread(
                        send_brevo_email, r["email"], uname, subject, html_body
                    )
                    if ok:
                        email_results["sent"] += 1
                    else:
                        email_results["failed"] += 1
                except Exception as mail_err:
                    logger.warning(f"Email send failed for {r['email']}: {mail_err}")
                    email_results["failed"] += 1

        return {"success": True, "message": "Sent", "broadcast": broadcast, "as_announcement": as_announcement, "email": email_results}
    except HTTPException: raise
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

@app.get("/api/admin/announcements")
async def admin_list_announcements(cu: dict = Depends(get_current_user)):
    require_admin(cu)
    conn = await get_db_connection()
    try:
        cursor = await conn.execute(
            "SELECT a.id, a.title, a.message, a.created_at, u.username AS created_by "
            "FROM announcements a LEFT JOIN users u ON u.id = a.created_by "
            "ORDER BY a.created_at DESC LIMIT 200"
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]
    except Exception as e:
        logger.error(f"List announcements failed: {e}")
        return []
    finally: await conn.close()

@app.delete("/api/admin/announcements/{aid}")
async def admin_delete_announcement(aid: int, cu: dict = Depends(get_current_user)):
    require_admin(cu)
    conn = await get_db_connection()
    try:
        await conn.execute("DELETE FROM announcements WHERE id=%s", (aid,))
        await conn.commit()
        return {"success": True}
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

@app.get("/api/announcements")
async def list_announcements(cu: dict = Depends(get_current_user)):
    conn = await get_db_connection()
    try:
        cursor = await conn.execute(
            "SELECT id, title, message, created_at "
            "FROM announcements "
            "ORDER BY created_at DESC LIMIT 5"
        )
        rows = await cursor.fetchall()
        return [{**dict(r), "created_at": r["created_at"].isoformat() if r["created_at"] else ""} for r in rows]
    except Exception as e:
        logger.error(f"List announcements failed: {e}")
        return []
    finally: await conn.close()


# ── Recent Updates (admin-managed, shown in user dashboard) ───────────────────

class RecentUpdateCreate(BaseModel):
    title: str
    description: str = ""
    badge: str = "New"
    badge_color: str = "green"  # green | blue | purple | orange | red
    sort_order: int = 0
    is_active: bool = True

class RecentUpdateUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    badge: Optional[str] = None
    badge_color: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None

@app.get("/api/updates")
async def get_updates(cu: dict = Depends(get_current_user)):
    """Public endpoint — returns active updates for user dashboard."""
    conn = await get_db_connection()
    try:
        cursor = await conn.execute(
            "SELECT id, title, description, badge, badge_color, created_at "
            "FROM recent_updates WHERE is_active=TRUE "
            "ORDER BY sort_order ASC, created_at DESC LIMIT 10"
        )
        rows = await cursor.fetchall()
        return [{**dict(r), "created_at": r["created_at"].isoformat() if r["created_at"] else ""} for r in rows]
    except Exception as e:
        logger.error(f"Get updates failed: {e}")
        return []
    finally: await conn.close()

@app.get("/api/admin/updates")
async def admin_list_updates(cu: dict = Depends(get_current_user)):
    """Admin: list all updates (active + inactive)."""
    require_admin(cu)
    conn = await get_db_connection()
    try:
        cursor = await conn.execute(
            "SELECT id, title, description, badge, badge_color, is_active, sort_order, created_at, updated_at "
            "FROM recent_updates ORDER BY sort_order ASC, created_at DESC"
        )
        rows = await cursor.fetchall()
        return [{**dict(r),
                 "created_at": r["created_at"].isoformat() if r["created_at"] else "",
                 "updated_at": r["updated_at"].isoformat() if r["updated_at"] else ""} for r in rows]
    except Exception as e:
        logger.error(f"Admin list updates failed: {e}")
        return []
    finally: await conn.close()

@app.post("/api/admin/updates")
async def admin_create_update(data: RecentUpdateCreate, cu: dict = Depends(get_current_user)):
    """Admin: create a new dashboard update entry."""
    require_admin(cu)
    conn = await get_db_connection()
    try:
        cursor = await conn.execute(
            """INSERT INTO recent_updates (title, description, badge, badge_color, sort_order, is_active)
               VALUES (%s, %s, %s, %s, %s, %s) RETURNING id""",
            (data.title, data.description, data.badge, data.badge_color, data.sort_order, data.is_active)
        )
        row = await cursor.fetchone()
        await conn.commit()
        return {"success": True, "id": row["id"]}
    except Exception as e:
        raise HTTPException(500, str(e))
    finally: await conn.close()

@app.patch("/api/admin/updates/{uid}")
async def admin_update_update(uid: int, data: RecentUpdateUpdate, cu: dict = Depends(get_current_user)):
    """Admin: edit an existing dashboard update entry."""
    require_admin(cu)
    conn = await get_db_connection()
    try:
        fields = {k: v for k, v in data.model_dump().items() if v is not None}
        if not fields:
            raise HTTPException(400, "No fields to update")
        set_clause = ", ".join(f"{k}=%s" for k in fields)
        set_clause += ", updated_at=NOW()"
        values = list(fields.values()) + [uid]
        await conn.execute(f"UPDATE recent_updates SET {set_clause} WHERE id=%s", values)
        await conn.commit()
        return {"success": True}
    except HTTPException: raise
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

@app.delete("/api/admin/updates/{uid}")
async def admin_delete_update(uid: int, cu: dict = Depends(get_current_user)):
    """Admin: delete a dashboard update entry."""
    require_admin(cu)
    conn = await get_db_connection()
    try:
        await conn.execute("DELETE FROM recent_updates WHERE id=%s", (uid,))
        await conn.commit()
        return {"success": True}
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()


@app.get("/api/admin/dashboard/plan-distribution")
async def admin_plan_dist(cu: dict = Depends(get_current_user)):
    require_admin(cu)
    conn = await get_db_connection()
    try:
        cursor = await conn.execute("""
            SELECT p.name AS plan_name,COUNT(u.id) AS user_count,p.credits,p.duration_days
            FROM plans p LEFT JOIN users u ON u.plan=p.name WHERE p.is_active=true
            GROUP BY p.id,p.name,p.credits,p.duration_days ORDER BY user_count DESC
        """)
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]
    except Exception as e:
        logger.error(f"Admin plan distribution error: {e}")
        raise HTTPException(500, str(e))
    finally: await conn.close()

@app.get("/api/admin/dashboard/monthly-data")
async def admin_monthly(cu: dict = Depends(get_current_user)):
    require_admin(cu)
    conn = await get_db_connection()
    try:
        cursor = await conn.execute("""
            SELECT DATE_TRUNC('month',created_at) AS month,
                   COUNT(*) AS user_signups,
                   COUNT(CASE WHEN is_admin THEN 1 END) AS admin_signups
            FROM users WHERE created_at>=NOW()-INTERVAL '12 months'
            GROUP BY 1 ORDER BY 1 DESC LIMIT 12
        """)
        rows = await cursor.fetchall()
        return [{"month": r["month"].strftime("%Y-%m") if r["month"] else "",
                 "user_signups":r["user_signups"],"admin_signups":r["admin_signups"]} for r in rows]
    except Exception as e:
        logger.error(f"Admin monthly data error: {e}")
        raise HTTPException(500, str(e))
    finally: await conn.close()

@app.get("/api/admin/dashboard/recent-activity")
async def admin_recent(cu: dict = Depends(get_current_user)):
    require_admin(cu)
    conn = await get_db_connection()
    try:
        cursor = await conn.execute("""
            SELECT username,email,plan,created_at,
                   CASE WHEN is_admin THEN 'Admin Registration' ELSE 'User Registration' END AS activity_type
            FROM users ORDER BY created_at DESC LIMIT 10
        """)
        rows = await cursor.fetchall()
        return [{**dict(r),"created_at":r["created_at"].isoformat() if r["created_at"] else ""} for r in rows]
    except Exception as e:
        logger.error(f"Admin recent activity error: {e}")
        raise HTTPException(500, str(e))
    finally: await conn.close()

# ── Tally / Tools ─────────────────────────────────────────────────────────────

@app.post("/api/tally/generate-xml")
async def generate_tally_xml(excel_file: UploadFile = File(...), cu: dict = Depends(get_current_user)):
    import pandas as pd, tempfile, os as _os
    if not excel_file.filename.lower().endswith((".xls",".xlsx",".xlsm")):
        raise HTTPException(400, "Only Excel files allowed")

    content = await excel_file.read()
    file_size = f"{len(content) / 1024 / 1024:.2f} MB"

    suffix = ".xls" if excel_file.filename.lower().endswith(".xls") else ".xlsx"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(content); tmp_path = tmp.name
    try:
        # Load the sheet. Based on the working script, it uses 'Sheet1'
        df = pd.read_excel(tmp_path, sheet_name='Sheet1')

        # Strict filter to only keep rows where the Date (Index 5) is a number (YYYYMMDD)
        # This automatically skips all header rows containing </DATE>, </VOUCHERTYPENAME>, etc.
        vouchers = df[df.iloc[:, 5].astype(str).str.match(r'^\d{8}(\.0)?$')].copy()

        xml_lines = [
            '<ENVELOPE>',
            '  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>',
            '  <BODY>',
            '    <IMPORTDATA>',
            '      <REQUESTDESC>',
            '        <REPORTNAME>Vouchers</REPORTNAME>',
            '        <STATICVARIABLES><SVCURRENTCOMPANY/></STATICVARIABLES>',
            '      </REQUESTDESC>',
            '      <REQUESTDATA>'
        ]

        for _, row in vouchers.iterrows():
            # Data Extraction and cleaning
            vch_date = str(int(float(row.iloc[5])))
            vch_type = str(row.iloc[7])
            narration = str(row.iloc[9]) if pd.notna(row.iloc[9]) else ""
            guid = str(row.iloc[10])
            alterid = str(int(float(row.iloc[11]))) if pd.notna(row.iloc[11]) and str(row.iloc[11]).replace('.0','').isdigit() else ""

            # Ledger Names directly from Transactions.xls
            l1_name = str(row.iloc[15])
            l1_amt = str(row.iloc[16])
            l1_is_pos = str(row.iloc[14])

            l2_name = str(row.iloc[34])
            l2_amt = str(row.iloc[35])
            l2_is_pos = str(row.iloc[33])

            # Exact nested structure from the working tally.xml
            msg = '        <TALLYMESSAGE xmlns:UDF="TallyUDF">\n'
            msg += f'          <VOUCHER REMOTEID="{guid}" VCHTYPE="{vch_type}" ACTION="Create">\n'
            msg += f'            <DATE>{vch_date}</DATE>\n'
            msg += f'            <EFFECTIVEDATE>{vch_date}</EFFECTIVEDATE>\n'
            msg += f'            <VOUCHERTYPENAME>{vch_type}</VOUCHERTYPENAME>\n'
            msg += f'            <VOUCHERNUMBER>0</VOUCHERNUMBER>\n'
            msg += f'            <NARRATION>{narration}</NARRATION>\n'
            msg += f'            <GUID>{guid}</GUID>\n'
            msg += f'            <ALTERID>{alterid}</ALTERID>\n'
            msg += '            <ALLLEDGERENTRIES.LIST>\n'
            msg += f'              <LEDGERNAME>{l1_name}</LEDGERNAME>\n'
            msg += f'              <ISDEEMEDPOSITIVE>{l1_is_pos}</ISDEEMEDPOSITIVE>\n'
            msg += f'              <AMOUNT>{l1_amt}</AMOUNT>\n'
            msg += '            </ALLLEDGERENTRIES.LIST>\n'
            msg += '            <ALLLEDGERENTRIES.LIST>\n'
            msg += f'              <LEDGERNAME>{l2_name}</LEDGERNAME>\n'
            msg += f'              <ISDEEMEDPOSITIVE>{l2_is_pos}</ISDEEMEDPOSITIVE>\n'
            msg += f'              <AMOUNT>{l2_amt}</AMOUNT>\n'
            msg += '            </ALLLEDGERENTRIES.LIST>\n'
            msg += '          </VOUCHER>\n'
            msg += '        </TALLYMESSAGE>'
            xml_lines.append(msg)

        xml_lines.extend(['      </REQUESTDATA>', '    </IMPORTDATA>', '  </BODY>', '</ENVELOPE>'])

        # Save conversion history
        await save_conversion_history(
            user_id=cu["user_id"],
            conversion_type="Tally XML Generator",
            input_file_name=excel_file.filename,
            output_file_name="tally_import.xml",
            status="completed",
            file_size=file_size
        )

        return Response(content="\n".join(xml_lines), media_type="application/xml",
                        headers={"Content-Disposition":"attachment; filename=tally_import.xml"})
    except Exception as e: raise HTTPException(500, str(e))
    finally: _os.unlink(tmp_path)

@app.get("/api/sample-files/download-sample")
async def download_sample():
    import pandas as pd, io
    df = pd.DataFrame({
        "Date":["20240101","20240102","20240103"],
        "Voucher Type":["Payment","Receipt","Journal"],
        "GUID":["GUID001","GUID002","GUID003"],
        "Narration":["Sample payment","Sample receipt","Sample journal"],
        "Account":["Cash Account","Bank Account","Expense Account"],
        "Amount":[1000,2000,1500],
    })
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as w: df.to_excel(w, index=False, sheet_name="Voucher Data")
    buf.seek(0)
    return Response(content=buf.getvalue(),
                    media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition":"attachment; filename=Bank_Sample.xlsx"})


# ── AI-powered Bank Statement → Tally Ledger Mapping ─────────────────────────

class SmartParseRequest(BaseModel):
    raw_text: str
    ledgers: list
    bank_ledger: str = "Bank Account"


@app.post("/api/tally/smart-parse")
async def tally_smart_parse(req: SmartParseRequest, cu: dict = Depends(get_current_user)):
    """Deprecated: Groq integration removed. Use Gemini-based or PDF endpoints instead."""
    raise HTTPException(501, "Groq integration removed. Use Gemini-based endpoints or upload a PDF for extraction.")


@app.post("/api/convert-xml")
async def convert_to_xml(file: UploadFile = File(...), cu: dict = Depends(get_current_user)):
    """Convert file to XML and store in Supabase"""
    import tempfile, os as _os, uuid
    try:
        if not file.filename:
            raise HTTPException(400, "No file provided")

        content = await file.read()
        file_size = f"{len(content) / 1024 / 1024:.2f} MB"

        # Simple conversion - wrap content in XML tags
        # You can customize this based on your specific conversion requirements
        xml_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<converted_data>
    <metadata>
        <filename>{file.filename}</filename>
        <converted_at>{datetime.now().isoformat()}</converted_at>
        <user_id>{cu['user_id']}</user_id>
    </metadata>
    <content>
        {content.decode('utf-8', errors='replace')}
    </content>
</converted_data>"""

        # Generate unique filename
        unique_id = str(uuid.uuid4())
        file_path = f"{cu['user_id']}/{unique_id}_{file.filename}.xml"

        # Upload to Supabase
        supabase_url = await upload_to_supabase_storage(
            xml_content.encode('utf-8'),
            file_path,
            "text/xml"
        )

        # Cleanup old files (keep only last 3)
        await cleanup_old_xml_files(cu["user_id"], keep_last=3)

        return {
            "success": True,
            "message": "File converted to XML successfully",
            "download_url": supabase_url,
            "filename": f"{unique_id}_{file.filename}.xml"
        }

    except Exception as e:
        logger.error(f"XML conversion error: {e}")
        raise HTTPException(500, str(e))


def get_pdf_page_count_bytes(pdf_bytes: bytes) -> int:
    import pypdf
    import io
    try:
        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        return len(reader.pages)
    except Exception as e:
        logger.error(f"Error parsing PDF page count from bytes: {e}")
        return 1


async def check_and_deduct_pdf_credits(user_id: int, pdf_bytes: bytes, tool_name: str) -> float:
    """Checks user's credits and deducts credits for a PDF conversion tool based on page count.
    If the user has 'unlimited' plan, does not charge credits.
    Returns the cost charged (0 if unlimited).
    Raises HTTPException 402 if credits are insufficient.
    """
    page_count = get_pdf_page_count_bytes(pdf_bytes)
    import math
    conn = await get_db_connection()
    try:
        # Get credit cost setting
        cost_cur = await conn.execute("SELECT value FROM settings WHERE key='credit_cost_pdf_page'")
        row = await cost_cur.fetchone()
        cost_per_page = float(row["value"]) if row else 1.0

        total_cost = round(cost_per_page * page_count, 4)
        deducted = max(1, math.ceil(total_cost))

        # Read user credits and plan
        user_cur = await conn.execute("SELECT credits, plan FROM users WHERE id=%s", (user_id,))
        urow = await user_cur.fetchone()
        user_credits = float(urow["credits"]) if urow else 0
        user_plan = urow["plan"] if urow else "Free"

        if user_plan.lower() == "unlimited":
            return 0.0

        if user_credits < deducted:
            raise HTTPException(
                status_code=402,
                detail=f"Insufficient credits. This operation requires {deducted} credits ({page_count} pages @ {cost_per_page} credits/page), but you only have {user_credits} credits. Please upgrade your plan."
            )

        await conn.execute(
            "UPDATE users SET credits = GREATEST(0, credits - %s) WHERE id = %s",
            (deducted, user_id)
        )
        # Record activity
        await record_activity(
            user_id,
            "credits_removed",
            f"Credits deducted for {tool_name} ({page_count} pages): {deducted} credits",
            credits_changed=-deducted,
            conn=conn
        )
        await conn.commit()
        return float(deducted)
    finally:
        await conn.close()


# ── MinerU Proxy Routes ───────────────────────────────────────────────────────
# These routes proxy MinerU API calls from the backend so the API key is never
# exposed to the browser and OSS/CDN CORS restrictions are handled server-side.

@app.post("/api/mineru/request-upload")
async def mineru_request_upload(
    data: dict,
    cu: dict = Depends(get_current_user_optional),
):
    """Step 1: Get a pre-signed upload URL + batch_id from MinerU.
    Uses optional auth so unauthenticated callers receive a clean 401
    instead of FastAPI's default 403 (which HTTPBearer raises when the
    Authorization header is entirely absent).
    """
    if cu is None:
        raise HTTPException(
            status_code=401,
            detail="Authentication required. Please log in to use the PDF converter.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not MINERU_API_KEY:
        raise HTTPException(500, "MINERU_API_KEY is not configured on the server.")
    file_name = data.get("file_name", "document.pdf")
    payload = {
        "files": [{"name": file_name, "data_id": str(uuid.uuid4())}],
        "model_version": "vlm",
    }
    try:
        resp = requests.post(
            f"{MINERU_BASE_URL}/file-urls/batch",
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {MINERU_API_KEY}"},
            json=payload,
            timeout=30,
        )
        resp.raise_for_status()
        body = resp.json()
        if body.get("code") != 0:
            raise HTTPException(502, f"MinerU error: {body.get('msg')}")
        return {
            "batch_id": body["data"]["batch_id"],
            "upload_url": body["data"]["file_urls"][0],
        }
    except requests.RequestException as e:
        raise HTTPException(502, f"Failed to contact MinerU: {e}")


@app.put("/api/mineru/upload-to-oss")
async def mineru_upload_to_oss(
    oss_url: str,
    file: UploadFile = File(...),
    cu: dict = Depends(get_current_user_optional)
):
    """Step 2: Upload PDF to Alibaba OSS via server-side proxy (avoids browser CORS)."""
    if cu is None:
        raise HTTPException(status_code=401, detail="Authentication required.", headers={"WWW-Authenticate": "Bearer"})
    content = await file.read()
    # Check and deduct credits for PDF Extractor
    await check_and_deduct_pdf_credits(cu["user_id"], content, "ZaiZ PDF Extractor")
    file_size_str = f"{len(content) / 1024:.1f} KB"
    filename = file.filename or "document.pdf"
    try:
        resp = requests.put(
            oss_url,
            data=content,
            timeout=120,
        )
        if not (200 <= resp.status_code < 300):
            await save_conversion_history(
                user_id=cu["user_id"],
                conversion_type="ZaiZ PDF Extractor",
                input_file_name=filename,
                output_file_name=None,
                status="failed",
                file_size=file_size_str
            )
            raise HTTPException(502, f"OSS upload failed: HTTP {resp.status_code} — {resp.text[:300]}")
        await save_conversion_history(
            user_id=cu["user_id"],
            conversion_type="ZaiZ PDF Extractor",
            input_file_name=filename,
            output_file_name=filename.replace(".pdf", ".xlsx"),
            status="downloaded",
            file_size=file_size_str
        )
        return {"success": True}
    except Exception as e:
        if not isinstance(e, HTTPException):
            await save_conversion_history(
                user_id=cu["user_id"],
                conversion_type="ZaiZ PDF Extractor",
                input_file_name=filename,
                output_file_name=None,
                status="failed",
                file_size=file_size_str
            )
            raise HTTPException(502, f"OSS upload error: {e}")
        raise e


@app.get("/api/mineru/status/{batch_id}")
async def mineru_poll_status(batch_id: str, cu: dict = Depends(get_current_user_optional)):
    """Step 3: Poll MinerU batch status — returns state, progress, and zip_url when done."""
    if cu is None:
        raise HTTPException(status_code=401, detail="Authentication required.", headers={"WWW-Authenticate": "Bearer"})
    if not MINERU_API_KEY:
        raise HTTPException(500, "MINERU_API_KEY is not configured on the server.")
    try:
        resp = requests.get(
            f"{MINERU_BASE_URL}/extract-results/batch/{batch_id}",
            headers={"Authorization": f"Bearer {MINERU_API_KEY}"},
            timeout=15,
        )
        resp.raise_for_status()
        body = resp.json()
        if body.get("code") != 0:
            raise HTTPException(502, f"MinerU error: {body.get('msg')}")
        results = body["data"].get("extract_result", [])
        item = results[0] if results else {}
        state = item.get("state", "running")
        prog = item.get("extract_progress", {})
        return {
            "state": state,
            "extracted_pages": prog.get("extracted_pages", 0),
            "total_pages": prog.get("total_pages", 0),
            "zip_url": item.get("full_zip_url") if state == "done" else None,
            "err_msg": item.get("err_msg") if state == "failed" else None,
        }
    except requests.RequestException as e:
        raise HTTPException(502, f"Failed to poll MinerU: {e}")


@app.get("/api/mineru/download-zip")
async def mineru_download_zip(zip_url: str, cu: dict = Depends(get_current_user_optional)):
    """Step 4: Download MinerU result zip server-side and stream it back (bypasses CDN CORS)."""
    if cu is None:
        raise HTTPException(status_code=401, detail="Authentication required.", headers={"WWW-Authenticate": "Bearer"})
    try:
        resp = requests.get(zip_url, timeout=180)
        if not resp.ok:
            raise HTTPException(502, f"Failed to download MinerU zip: HTTP {resp.status_code}")
        return Response(
            content=resp.content,
            media_type="application/zip",
            headers={"Content-Disposition": "attachment; filename=mineru-result.zip"},
        )
    except requests.RequestException as e:
        raise HTTPException(502, f"Zip download error: {e}")


# ── Adobe PDF to Excel Converter ──────────────────────────────────────────────

# adobe section replaced — zaiz HF Space now uploads to HF bucket and returns URL directly



# ── Adobe PDF → Excel / Word  (proxied to zaiz HF Space) ───────────────────
# Browser sends PDF to Render → Render forwards to zaiz HF Space
# zaiz HF Space converts + uploads result to HF bucket → returns URL
# Browser downloads directly from HF bucket (zero download bandwidth on Render)

ADOBE_TASKS: dict = {}

async def _call_zaiz_convert(file_bytes: bytes, filename: str,
                               format_type: str, user_id: int) -> dict:
    """Forward PDF to zaiz HF Space, get back {url, filename, size} or raise."""
    if not HF_SPACE_URL:
        raise RuntimeError("HF_SPACE_URL not configured")
    form = _aiohttp.FormData()
    form.add_field("file", file_bytes, filename=filename, content_type="application/pdf")
    form.add_field("format_type", format_type)
    form.add_field("user_id", str(user_id))
    headers = {"Authorization": f"Bearer {HF_TOKEN}"} if HF_TOKEN else {}
    async with _aiohttp.ClientSession() as session:
        async with session.post(
            f"{HF_SPACE_URL}/convert",
            data=form,
            headers=headers,
            timeout=_aiohttp.ClientTimeout(total=180),
        ) as resp:
            if resp.status != 200:
                text = await resp.text()
                raise RuntimeError(f"zaiz returned {resp.status}: {text[:200]}")
            
            content_type = resp.headers.get("Content-Type", "")
            if "application/json" in content_type:
                result = await resp.json()
            else:
                # The response is the converted binary file directly (e.g. xlsx or docx)
                resp_bytes = await resp.read()
                
                # Determine output filename
                output_filename = None
                disp = resp.headers.get("Content-Disposition", "")
                if "filename=" in disp:
                    import re
                    match = re.search(r'filename=["\']?([^"\';]+)["\']?', disp)
                    if match:
                        output_filename = match.group(1)
                
                if not output_filename:
                    ext = ".xlsx" if format_type == "excel" else ".docx"
                    output_filename = os.path.splitext(filename)[0] + ext
                
                # Upload the binary file to HF storage
                import time
                safe_filename = output_filename.replace(" ", "_").replace("/", "_")
                hf_path = f"{user_id}/adobe_converted/{int(time.time())}_{safe_filename}"
                url = await upload_to_hf_storage(resp_bytes, hf_path, content_type=content_type)
                
                result = {
                    "success": True,
                    "url": url,
                    "filename": output_filename,
                    "size": f"{len(resp_bytes)/1024:.1f} KB"
                }
    return result  # {"success": True, "url": "/api/bucket/files/...", "filename": "...", "size": "..."}


@app.post("/api/adobe-pdf-to-excel")
async def adobe_pdf_to_excel(
    file: UploadFile = File(...),
    cu: dict = Depends(get_current_user),
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are allowed.")
    content = await file.read()
    await check_and_deduct_pdf_credits(cu["user_id"], content, "ZaiZ PDF to Excel")
    file_size_str = f"{len(content)/1024:.1f} KB"
    task_id = str(uuid.uuid4())
    ADOBE_TASKS[task_id] = {
        "status": "processing", "error": None,
        "input_filename": file.filename,
        "output_filename": os.path.splitext(file.filename)[0] + ".xlsx",
        "format_type": "excel", "file_size_str": file_size_str,
        "user_id": cu["user_id"], "url": None, "created_at": __import__("time").time(),
    }
    async def _run():
        try:
            result = await _call_zaiz_convert(content, file.filename, "excel", cu["user_id"])
            ADOBE_TASKS[task_id]["url"]    = result.get("url")
            ADOBE_TASKS[task_id]["status"] = "completed"
            await save_conversion_history(
                user_id=cu["user_id"], conversion_type="ZaiZ PDF to Excel",
                input_file_name=file.filename,
                output_file_name=result.get("filename"),
                output_file_url=result.get("url"),
                status="completed", file_size=file_size_str,
            )
        except Exception as e:
            ADOBE_TASKS[task_id]["status"] = "failed"
            ADOBE_TASKS[task_id]["error"]  = str(e)
            logger.error(f"[Adobe Excel] task {task_id} failed: {e}")
    asyncio.create_task(_run())
    return {"success": True, "task_id": task_id, "message": "Conversion started"}


@app.post("/api/adobe-pdf-to-word")
async def adobe_pdf_to_word(
    file: UploadFile = File(...),
    cu: dict = Depends(get_current_user),
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are allowed.")
    content = await file.read()
    await check_and_deduct_pdf_credits(cu["user_id"], content, "ZaiZ PDF to Word")
    file_size_str = f"{len(content)/1024:.1f} KB"
    task_id = str(uuid.uuid4())
    ADOBE_TASKS[task_id] = {
        "status": "processing", "error": None,
        "input_filename": file.filename,
        "output_filename": os.path.splitext(file.filename)[0] + ".docx",
        "format_type": "word", "file_size_str": file_size_str,
        "user_id": cu["user_id"], "url": None, "created_at": __import__("time").time(),
    }
    async def _run():
        try:
            result = await _call_zaiz_convert(content, file.filename, "word", cu["user_id"])
            ADOBE_TASKS[task_id]["url"]    = result.get("url")
            ADOBE_TASKS[task_id]["status"] = "completed"
            await save_conversion_history(
                user_id=cu["user_id"], conversion_type="ZaiZ PDF to Word",
                input_file_name=file.filename,
                output_file_name=result.get("filename"),
                output_file_url=result.get("url"),
                status="completed", file_size=file_size_str,
            )
        except Exception as e:
            ADOBE_TASKS[task_id]["status"] = "failed"
            ADOBE_TASKS[task_id]["error"]  = str(e)
            logger.error(f"[Adobe Word] task {task_id} failed: {e}")
    asyncio.create_task(_run())
    return {"success": True, "task_id": task_id, "message": "Conversion started"}


@app.get("/api/adobe/status/{task_id}")
async def get_adobe_task_status(task_id: str, cu: dict = Depends(get_current_user)):
    task = ADOBE_TASKS.get(task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    if task["user_id"] != cu["user_id"]:
        raise HTTPException(403, "Access denied")
    return {
        "task_id":  task_id,
        "status":   task["status"],
        "error":    task["error"],
        "filename": task["output_filename"],
        "url":      task.get("url"),   # HF bucket URL — browser downloads directly
    }


@app.get("/api/adobe/download/{task_id}")
async def download_adobe_task_result(task_id: str, cu: dict = Depends(get_current_user)):
    """Legacy endpoint — now just returns the HF bucket URL for direct browser download."""
    task = ADOBE_TASKS.get(task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    if task["user_id"] != cu["user_id"]:
        raise HTTPException(403, "Access denied")
    if task["status"] != "completed":
        raise HTTPException(400, f"Task not complete: {task['status']}")
    url = task.get("url")
    if not url:
        raise HTTPException(410, "Download URL not available")
    return {"url": url, "filename": task["output_filename"]}


# ── Bank PDF → Tally XML  (proxied to HF Space: acrozo) ──────────────────────

HF_TALLY_ENGINE_URL = os.getenv("HF_TALLY_ENGINE_URL", "")
_HF_TOKEN           = os.getenv("HF_TOKEN", "")

def _hf_headers():
    return {"Authorization": f"Bearer {_HF_TOKEN}"} if _HF_TOKEN else {}

_PLACEHOLDER = {}
# ── Proxy endpoints (all heavy work on HF Space) ─────────────────────────────

import aiohttp as _aiohttp

@app.post("/api/tally/pdf-smart-convert")
async def pdf_tally_smart_convert(
    file: UploadFile = File(...),
    ledgers: str = Form(""),
    bank_ledger: str = Form("Bank Account"),
    company: str = Form(""),
    cu: dict = Depends(get_current_user),
):
    if not HF_TALLY_ENGINE_URL:
        raise HTTPException(503, "Tally engine not configured")
    ext = file.filename.lower().rsplit(".", 1)[-1] if "." in file.filename else ""
    if ext not in ("pdf", "xlsx", "xls", "csv"):
        raise HTTPException(400, "Supported formats: PDF, Excel, CSV")
    content = await file.read()
    form = _aiohttp.FormData()
    form.add_field("file", content, filename=file.filename, content_type=file.content_type)
    form.add_field("ledgers",     ledgers)
    form.add_field("bank_ledger", bank_ledger)
    form.add_field("company",     company)
    form.add_field("user_id",     str(cu["user_id"]))
    form.add_field("filename",    file.filename)
    form.add_field("file_size",   f"{len(content)/1024:.1f} KB")
    form.add_field("file_ext",    ext)
    try:
        async with _aiohttp.ClientSession() as session:
            async with session.post(
                f"{HF_TALLY_ENGINE_URL}/convert",
                data=form,
                headers=_hf_headers(),
                timeout=_aiohttp.ClientTimeout(total=60),
            ) as resp:
                result = await resp.json()
        return result
    except Exception as e:
        logger.error(f"[Proxy] HF Space /convert error: {e}")
        raise HTTPException(502, "Tally engine unavailable. Please try again.")


@app.get("/api/tally/pdf-smart-convert/status/{task_id}")
async def pdf_tally_status(task_id: str, cu: dict = Depends(get_current_user)):
    if not HF_TALLY_ENGINE_URL:
        raise HTTPException(503, "Tally engine not configured")
    try:
        async with _aiohttp.ClientSession() as session:
            async with session.get(
                f"{HF_TALLY_ENGINE_URL}/status/{task_id}",
                headers=_hf_headers(),
                timeout=_aiohttp.ClientTimeout(total=15),
            ) as resp:
                return await resp.json()
    except Exception as e:
        logger.error(f"[Proxy] HF Space /status error: {e}")
        raise HTTPException(502, "Tally engine unavailable")


@app.get("/api/tally/pdf-smart-convert/result/{task_id}")
async def pdf_tally_result(task_id: str, cu: dict = Depends(get_current_user)):
    if not HF_TALLY_ENGINE_URL:
        raise HTTPException(503, "Tally engine not configured")
    try:
        async with _aiohttp.ClientSession() as session:
            async with session.get(
                f"{HF_TALLY_ENGINE_URL}/result/{task_id}",
                headers=_hf_headers(),
                timeout=_aiohttp.ClientTimeout(total=15),
            ) as resp:
                return await resp.json()
    except Exception as e:
        logger.error(f"[Proxy] HF Space /result error: {e}")
        raise HTTPException(502, "Tally engine unavailable")


@app.get("/api/tally/recent-files")
async def tally_recent_files(cu: dict = Depends(get_current_user)):
    conn = await get_db_connection()
    try:
        cur = await conn.execute(
            """
            SELECT id, input_file_name, output_file_name, output_file_url,
                   status, file_size, created_at
            FROM conversion_history
            WHERE user_id = %s
              AND conversion_type LIKE 'Bank %% to Tally XML'
              AND (output_file_url IS NOT NULL OR status = 'completed')
            ORDER BY created_at DESC
            LIMIT 7
            """,
            (cu["user_id"],)
        )
        rows = await cur.fetchall()
        import datetime as _dt
        return [
            {
                "id":         r["id"],
                "inputFile":  r["input_file_name"],
                "outputFile": r["output_file_name"],
                "url":        r["output_file_url"],
                "status":     r["status"],
                "size":       r["file_size"],
                "date": (
                    r["created_at"]
                    .replace(tzinfo=_dt.timezone.utc)
                    .astimezone(_dt.timezone(_dt.timedelta(hours=5, minutes=30)))
                    .strftime("%d %b %Y, %I:%M %p")
                ) if r["created_at"] else None,
            }
            for r in rows
        ]
    finally:
        await conn.close()


@app.get("/api/bucket/files/{file_path:path}")
async def serve_bucket_file(file_path: str):
    import mimetypes
    if not HF_TOKEN or not HF_HUB_AVAILABLE or HfFileSystem is None:
        raise HTTPException(503, "File storage not configured")
    filename = os.path.basename(file_path) or "download"
    try:
        content = await asyncio.to_thread(_read_from_bucket_sync, file_path)
        mime, _ = mimetypes.guess_type(file_path)
        from fastapi.responses import Response as _FR
        return _FR(
            content=content,
            media_type=mime or "application/octet-stream",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as e:
        logger.error(f"[HF] Bucket read failed for {file_path}: {e}")
        raise HTTPException(404, "File not found")


@app.get("/api/storage/files/{file_path:path}")
async def serve_storage_file_legacy(file_path: str):
    return await serve_bucket_file(file_path)


@app.on_event("startup")
async def startup_event():
    try:
        await init_database()
    except Exception as e:
        logger.warning(f"Database initialization failed (continuing anyway): {e}")
    logger.info("✅ Render backend started (Bank→ERP proxied to HF Space)")

# ==========================================
# SERVE REACT FRONTEND (Must be at the bottom)
# ==========================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "..", "frontend", "dist")

if os.path.exists(FRONTEND_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIR, "assets")), name="assets")

    @app.get("/{catchall:path}")
    def serve_react_app(catchall: str):
        if catchall.startswith("api/"):
            raise HTTPException(status_code=404, detail="API route not found")
        file_path = os.path.join(FRONTEND_DIR, catchall)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT",8000)), reload=True)
