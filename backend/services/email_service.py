"""
Email service — Gmail SMTP for sending assessment invitations,
interview confirmations, rejection notices, and HR notifications.
"""

from __future__ import annotations

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from backend.config import settings

logger = logging.getLogger(__name__)


def send_email(recipient_email: str, subject: str, body: str) -> bool:
    """
    Send an email using Gmail SMTP and standard libraries.
    Accepts recipient_email, subject, and body to keep compatible with existing Celery tasks.
    """
    from backend.firebase_admin_init import MOCK_MODE
    if MOCK_MODE or not settings.is_email_configured:
        logger.warning(f"[EMAIL MOCK] Sending email to: {recipient_email} | Subject: '{subject}'")
        body_text = body.replace("<br>", "\n").replace("<p>", "\n").strip()
        import re
        body_clean = re.sub('<[^<]+?>', '', body_text)
        preview = "\n".join([line.strip() for line in body_clean.split("\n") if line.strip()][:15])
        logger.warning(f"[EMAIL MOCK] Content:\n---\n{preview}\n---")
        
        # Extract and print all URLs so they are clickable and copyable in mock mode
        urls = re.findall(r'href=["\'](https?://[^"\']+)["\']', body)
        if urls:
            logger.warning(f"[EMAIL MOCK] Extracted Links:")
            for url in urls:
                logger.warning(f"  - {url}")
        return True

    # Setup the MIME message
    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = settings.email_user
    msg['To'] = recipient_email

    # Check if the body contains HTML tags to send as html
    if "<html>" in body or "<body" in body or "<p>" in body or "<br>" in body:
        part = MIMEText(body, 'html')
    else:
        part = MIMEText(body, 'plain')
    msg.attach(part)

    try:
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(settings.email_user, settings.email_pass)
            server.sendmail(settings.email_user, recipient_email, msg.as_string())
        logger.info(f"Email sent successfully to {recipient_email} via Gmail SMTP")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {recipient_email} via Gmail SMTP: {e}")
        return False


def _send_email(to_email: str, subject: str, html_body: str) -> bool:
    """Wrapper to maintain backward compatibility with existing functions."""
    return send_email(recipient_email=to_email, subject=subject, body=html_body)



def send_assessment_email(
    candidate_name: str,
    candidate_email: str,
    assessment_token: str,
    job_title: str,
    time_limit_minutes: int = 120,
) -> bool:
    """Send assessment invitation email to a candidate."""
    assessment_url = f"{settings.assessment_base_url}/{assessment_token}"

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 0; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 40px 24px; }}
            .card {{ background: linear-gradient(135deg, #1e293b, #334155); border-radius: 16px; padding: 40px; border: 1px solid #475569; }}
            .logo {{ font-size: 24px; font-weight: 700; color: #818cf8; margin-bottom: 24px; }}
            h1 {{ color: #f1f5f9; font-size: 22px; margin: 0 0 16px 0; }}
            p {{ color: #94a3b8; line-height: 1.6; margin: 12px 0; }}
            .highlight {{ color: #818cf8; font-weight: 600; }}
            .btn {{ display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 16px; margin: 24px 0; }}
            .info-box {{ background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 16px; margin: 20px 0; }}
            .info-row {{ display: flex; justify-content: space-between; margin: 8px 0; }}
            .info-label {{ color: #64748b; }}
            .info-value {{ color: #e2e8f0; font-weight: 500; }}
            .footer {{ text-align: center; color: #475569; font-size: 13px; margin-top: 32px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="card">
                <div class="logo">🚀 HR Recruitment</div>
                <h1>Technical Assessment Invitation</h1>
                <p>Hello <span class="highlight">{candidate_name}</span>,</p>
                <p>Congratulations! Your application for <span class="highlight">{job_title}</span> has passed our initial screening. We'd like to invite you to complete a technical assessment.</p>
                <div class="info-box">
                    <div class="info-row">
                        <span class="info-label">Position</span>
                        <span class="info-value">{job_title}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Time Limit</span>
                        <span class="info-value">{time_limit_minutes} minutes</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Sections</span>
                        <span class="info-value">MCQ, Coding, Open-ended</span>
                    </div>
                </div>
                <p>Click the button below to start your assessment:</p>
                <a href="{assessment_url}" class="btn">Start Assessment →</a>
                <p style="font-size: 13px; color: #64748b;">This link is unique to you. Please complete the assessment within 72 hours.</p>
            </div>
            <div class="footer">
                <p>This is an automated email from our HR recruitment system.</p>
            </div>
        </div>
    </body>
    </html>
    """

    return _send_email(
        to_email=candidate_email,
        subject=f"Technical Assessment — {job_title}",
        html_body=html_body,
    )


def send_interview_scheduled_email(
    candidate_name: str,
    candidate_email: str,
    job_title: str,
    interview_datetime: str,
    meeting_link: str = "",
    interviewer_name: str = "Our hiring team",
) -> bool:
    """Send interview confirmation email to a candidate."""
    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 0; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 40px 24px; }}
            .card {{ background: linear-gradient(135deg, #1e293b, #334155); border-radius: 16px; padding: 40px; border: 1px solid #475569; }}
            .logo {{ font-size: 24px; font-weight: 700; color: #34d399; margin-bottom: 24px; }}
            h1 {{ color: #f1f5f9; font-size: 22px; margin: 0 0 16px 0; }}
            p {{ color: #94a3b8; line-height: 1.6; margin: 12px 0; }}
            .highlight {{ color: #34d399; font-weight: 600; }}
            .btn {{ display: inline-block; background: linear-gradient(135deg, #059669, #10b981); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 16px; margin: 24px 0; }}
            .info-box {{ background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 16px; margin: 20px 0; }}
            .info-row {{ display: flex; justify-content: space-between; margin: 8px 0; }}
            .info-label {{ color: #64748b; }}
            .info-value {{ color: #e2e8f0; font-weight: 500; }}
            .footer {{ text-align: center; color: #475569; font-size: 13px; margin-top: 32px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="card">
                <div class="logo">🎉 Interview Scheduled</div>
                <h1>Congratulations, {candidate_name}!</h1>
                <p>Great news! Based on your assessment performance, we'd like to schedule an interview with you for the <span class="highlight">{job_title}</span> position.</p>
                <div class="info-box">
                    <div class="info-row">
                        <span class="info-label">Position</span>
                        <span class="info-value">{job_title}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Date & Time</span>
                        <span class="info-value">{interview_datetime}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Interviewer</span>
                        <span class="info-value">{interviewer_name}</span>
                    </div>
                </div>
                {"<a href='" + meeting_link + "' class='btn'>Join Meeting →</a>" if meeting_link else ""}
                <p>Please confirm your availability by replying to this email. If you need to reschedule, let us know at least 24 hours in advance.</p>
            </div>
            <div class="footer">
                <p>This is an automated email from our HR recruitment system.</p>
            </div>
        </div>
    </body>
    </html>
    """

    return _send_email(
        to_email=candidate_email,
        subject=f"Interview Scheduled — {job_title}",
        html_body=html_body,
    )


def send_rejection_email(
    candidate_name: str,
    candidate_email: str,
    job_title: str,
    reason: str = "after careful evaluation",
) -> bool:
    """Send a professional rejection email to a candidate."""
    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 0; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 40px 24px; }}
            .card {{ background: linear-gradient(135deg, #1e293b, #334155); border-radius: 16px; padding: 40px; border: 1px solid #475569; }}
            h1 {{ color: #f1f5f9; font-size: 22px; margin: 0 0 16px 0; }}
            p {{ color: #94a3b8; line-height: 1.6; margin: 12px 0; }}
            .highlight {{ color: #f59e0b; font-weight: 600; }}
            .footer {{ text-align: center; color: #475569; font-size: 13px; margin-top: 32px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="card">
                <h1>Application Update</h1>
                <p>Dear <span class="highlight">{candidate_name}</span>,</p>
                <p>Thank you for your interest in the <span class="highlight">{job_title}</span> position and for taking the time to apply.</p>
                <p>After careful review {reason}, we have decided to move forward with other candidates whose profiles more closely match our current requirements.</p>
                <p>We genuinely appreciate your effort and encourage you to apply for future openings that match your skills and experience.</p>
                <p>We wish you the very best in your job search and career.</p>
                <p style="margin-top: 24px;">Best regards,<br><span class="highlight">The Hiring Team</span></p>
            </div>
            <div class="footer">
                <p>This is an automated email from our HR recruitment system.</p>
            </div>
        </div>
    </body>
    </html>
    """

    return _send_email(
        to_email=candidate_email,
        subject=f"Application Update — {job_title}",
        html_body=html_body,
    )


def send_hr_notification(
    hr_email: str,
    candidate_name: str,
    job_title: str,
    status: str,
    composite_score: float = 0.0,
) -> bool:
    """Send a notification to HR about a candidate pipeline event."""
    score_section = ""
    if composite_score > 0:
        score_section = f"<p>Composite Score: <span class='score'>{round(composite_score, 1)}</span>/100</p>"
    
    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 0; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 40px 24px; }}
            .card {{ background: linear-gradient(135deg, #1e293b, #334155); border-radius: 16px; padding: 40px; border: 1px solid #475569; }}
            h1 {{ color: #f1f5f9; font-size: 20px; margin: 0 0 16px 0; }}
            p {{ color: #94a3b8; line-height: 1.6; }}
            .badge {{ display: inline-block; background: #6366f1; color: #fff; padding: 6px 16px; border-radius: 20px; font-weight: 600; font-size: 13px; }}
            .score {{ font-size: 36px; font-weight: 700; color: #818cf8; }}
            .footer {{ text-align: center; color: #475569; font-size: 13px; margin-top: 32px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="card">
                <h1>📋 Pipeline Update</h1>
                <p>Candidate <strong style="color: #f1f5f9;">{candidate_name}</strong> for <strong style="color: #f1f5f9;">{job_title}</strong></p>
                <p>Status: <span class="badge">{status}</span></p>
                {score_section}
                <p>View the full details on your <a href="{settings.frontend_url}/dashboard" style="color: #818cf8;">HR Dashboard</a>.</p>
            </div>
            <div class="footer">
                <p>HR Recruitment Pipeline Notification</p>
            </div>
        </div>
    </body>
    </html>
    """

    return _send_email(
        to_email=hr_email,
        subject=f"[HR] {candidate_name} — {status} ({job_title})",
        html_body=html_body,
    )
