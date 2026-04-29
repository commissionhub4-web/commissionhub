import logging
import smtplib
from email.message import EmailMessage

from app.config import Settings


logger = logging.getLogger(__name__)


class SmtpConfigurationError(Exception):
    pass


class SmtpAuthenticationError(Exception):
    pass


class SmtpConnectionError(Exception):
    pass


class SmtpDeliveryError(Exception):
    pass


def send_reset_code_email(*, to_email: str, code: str, settings: Settings) -> None:
    if not settings.smtp_ready:
        raise SmtpConfigurationError("SMTP is not configured. Please set Gmail SMTP credentials in backend .env")

    message = EmailMessage()
    message["Subject"] = "CommissionHub Password Reset Code"
    message["From"] = settings.smtp_sender
    message["To"] = to_email
    message.set_content(
        "\n".join(
            [
                "Hello,",
                "",
                "Your CommissionHub password reset code is:",
                f"{code}",
                "",
                "This code expires in 10 minutes.",
                "If you did not request this, you can ignore this email.",
            ]
        )
    )

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(settings.smtp_username, settings.smtp_password)
            refused_recipients = server.send_message(message)
            if refused_recipients:
                raise SmtpDeliveryError(f"SMTP refused recipient(s): {refused_recipients}")
            logger.info("SMTP accepted password reset email", extra={"to_email": to_email, "from_email": settings.smtp_sender})
    except smtplib.SMTPAuthenticationError as exc:
        raise SmtpAuthenticationError("SMTP authentication failed. Check Gmail address/app password.") from exc
    except (TimeoutError, ConnectionError, OSError, smtplib.SMTPConnectError) as exc:
        raise SmtpConnectionError("Unable to connect to SMTP server.") from exc
    except smtplib.SMTPException as exc:
        raise SmtpDeliveryError(f"SMTP delivery failed: {exc}") from exc
