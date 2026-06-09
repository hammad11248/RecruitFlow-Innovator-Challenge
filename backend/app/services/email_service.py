import os
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from backend.config import settings

logger = logging.getLogger(__name__)

def send_interview_email(recipient_email: str, subject: str, body: str) -> bool:
    """
    Send an interview email using Gmail SMTP and standard libraries.
    """
    email_user = os.getenv("EMAIL_USER") or settings.email_user
    email_pass = os.getenv("EMAIL_PASS") or settings.email_pass
    
    is_configured = bool(
        email_user and email_user.strip() and "your-email" not in email_user and
        email_pass and email_pass.strip() and "your-gmail" not in email_pass
    )

    if not is_configured:
        logger.warning(f"[EMAIL MOCK] Sending interview email to: {recipient_email} | Subject: '{subject}'")
        logger.warning(f"[EMAIL MOCK] Body: {body}")
        return True

    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = email_user
    msg['To'] = recipient_email

    if "<html>" in body or "<body" in body or "<p>" in body or "<br>" in body:
        part = MIMEText(body, 'html')
    else:
        part = MIMEText(body, 'plain')
    msg.attach(part)

    try:
        with smtplib.SMTP("smtp.gmail.com", 587, timeout=10) as server:
            server.starttls()
            server.login(email_user, email_pass)
            server.sendmail(email_user, recipient_email, msg.as_string())
        logger.info(f"Interview email sent successfully to {recipient_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send interview email to {recipient_email}: {e}")
        return False
