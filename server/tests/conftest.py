import os

# Settings also read the developer's server/.env. Environment variables win over it, so
# tests never report to the real Sentry project or send email through Resend.
os.environ["SLOTERA_SENTRY_DSN"] = ""
os.environ["SLOTERA_EMAIL_PROVIDER"] = "console"
