# Email Configuration Guide

The Alumni Portal now sends automatic confirmation emails when users apply for:
- Alumni Chapters
- Alumni Talk (Mentorship)
- Alumni Association
- Success Stories

## Environment Variables

Add the following environment variables to your `.env.local` file:

```env
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_PASS=your-app-password  # Alternative variable name

# Email From Address
FROM_EMAIL=noreply@uol.edu.pk
FROM_NAME="UOL Alumni Portal"
```

## Gmail Setup

If using Gmail, you'll need to:

1. **Enable 2-Factor Authentication** on your Google account
2. **Create an App Password**:
   - Go to Google Account → Security → 2-Step Verification
   - Scroll down to "App passwords"
   - Create a new app password for "Mail"
   - Use this password in `SMTP_PASSWORD`

3. **Configuration for Gmail**:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-email@gmail.com
   SMTP_PASSWORD=your-16-character-app-password
   ```

## Other Email Providers

### Outlook/Office 365
```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@outlook.com
SMTP_PASSWORD=your-password
```

### SendGrid
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key
```

### Custom SMTP
```env
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@yourdomain.com
SMTP_PASSWORD=your-password
```

## Testing Email Configuration

The email service will:
- Log a warning if SMTP is not configured (application will continue to work)
- Send emails asynchronously (won't block the API response)
- Log errors but not fail the application if email sending fails

Check your server logs for email sending status:
- `[Email] SMTP server is ready to send emails` - Configuration is correct
- `[Email] Email sent successfully: <message-id>` - Email was sent
- `[Email] Failed to send email: <error>` - Email sending failed (check SMTP config)

## Development Mode

For development, you can:
1. Use a service like [Mailtrap](https://mailtrap.io/) for testing
2. Leave SMTP unconfigured - emails will be logged but not sent
3. Use Gmail with an app password

## Production Checklist

- [ ] Configure SMTP environment variables
- [ ] Test email sending with a real application
- [ ] Verify emails are delivered successfully
- [ ] Check spam folder if emails aren't received
- [ ] Set up proper FROM_EMAIL domain (SPF/DKIM records recommended)

