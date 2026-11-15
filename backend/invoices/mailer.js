// Email adapter (SCRUM-36). The SMTP server comes from backend/.env (see config.js):
// in development a local test mailbox such as Mailpit; tests pass a fake mailer instead.
// Nothing here logs addresses, attachments or SMTP credentials.
const nodemailer = require("nodemailer");

class MailError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// smtp: { host, port, secure, user, password, from } or null when no mail server is set up.
// Returns { configured, send({ to, subject, text, attachments }) }.
function createMailer(smtp) {
  if (!smtp) {
    return {
      configured: false,
      async send() {
        throw new MailError("MAIL_NOT_CONFIGURED", "No SMTP server is configured (SMTP_HOST is empty).");
      },
    };
  }
  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.user ? { user: smtp.user, pass: smtp.password } : undefined,
    logger: false,
    debug: false,
  });
  return {
    configured: true,
    async send({ to, subject, text, attachments }) {
      await transport.sendMail({ from: smtp.from, to, subject, text, attachments });
    },
  };
}

module.exports = { createMailer, MailError };