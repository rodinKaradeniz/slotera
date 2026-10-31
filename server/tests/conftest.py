import os

# Tests run on the config defaults and never open the developer's server/.env, which may hold
# real keys. The two overrides below keep a stray environment from reporting to the real
# Sentry project or sending email through Resend.
os.environ["SLOTERA_ENV_FILE"] = ""
os.environ["SLOTERA_SENTRY_DSN"] = ""
os.environ["SLOTERA_EMAIL_PROVIDER"] = "console"
