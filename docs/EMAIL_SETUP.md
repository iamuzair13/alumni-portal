# Email Configuration Guide

The Alumni Portal now sends automatic confirmation emails when users apply for:
- Alumni Chapters
- Alumni Talk (Mentorship)
- Alumni Association
- Success Stories
- **Scholarship / Fee Discount Applications** (includes PDF attachment)

## Quick Setup

1. **Create a `.env.local` file** in the root directory of the project (if it doesn't exist)
2. **Add the SMTP configuration** variables below
3. **Restart your development server** after adding the variables

## Environment Variables

Add the following environment variables to your `.env.local` file:

```env
# SMTP Configuration (Required for sending emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
# Alternative variable names (also supported):
# SMTP_PASS=your-app-password
# SMTP_EMAIL=your-email@gmail.com

# Email From Address (Optional - defaults to SMTP_USER)
FROM_EMAIL=noreply@uol.edu.pk
FROM_NAME="UOL Alumni Portal"
```

**Note**: The `.env.local` file is already in `.gitignore` and will not be committed to the repository.

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

### Check Server Logs

After configuring SMTP, restart your server and check the console logs:

**✅ Success indicators:**
- `[Email] SMTP server is ready to send emails` - Configuration is correct
- `[Scholarship API] SMTP connection verified successfully` - Connection test passed
- `[Scholarship API] Email sent successfully!` - Email was sent
- `[Scholarship API] Message ID: <id>` - Email delivery confirmed

**❌ Error indicators:**
- `[Scholarship API] SMTP not configured. Missing SMTP_USER or SMTP_PASS` - Variables not set
- `[Scholarship API] SMTP connection verification failed` - Connection issue
- `[Scholarship API] Failed to send email:` - Check the error message for details

### Common Error Messages

1. **"Invalid login"** or **"Authentication failed"**
   - Check `SMTP_USER` and `SMTP_PASSWORD` are correct
   - For Gmail: Make sure you're using an App Password, not your regular password

2. **"ECONNREFUSED"** or **"ETIMEDOUT"**
   - Check `SMTP_HOST` and `SMTP_PORT` are correct
   - Verify your firewall/network allows SMTP connections

3. **"ENOTFOUND"**
   - The SMTP host address is incorrect
   - Check `SMTP_HOST` spelling

### Frontend Feedback

The application will show different messages based on email status:
- ✅ **Green success**: Email sent successfully
- ⚠️ **Yellow warning**: Application received but email delivery failed
- ℹ️ **Blue info**: Application received (SMTP not configured)

Check the toast notifications after submitting a scholarship application to see the email status.

## Development Mode

For development, you can:
1. Use a service like [Mailtrap](https://mailtrap.io/) for testing
2. Leave SMTP unconfigured - emails will be logged but not sent
3. Use Gmail with an app password

## Troubleshooting

### Emails Not Being Received

1. **Check spam/junk folder** - Emails might be filtered
2. **Verify SMTP configuration** - Check server logs for errors
3. **Test with a simple email** - Try sending to a different email address
4. **Check email provider limits** - Some providers have daily sending limits
5. **Verify recipient email** - Ensure the alumni email in the database is correct

### For Scholarship Applications

The scholarship application form will:
- Generate a PDF document automatically
- Attach it to the email
- Send to the alumni's email address (from `personalemail`, `universityemail`, or `officialemail`)

If emails aren't being sent:
1. Check the server console logs for detailed error messages
2. Verify the alumni has a valid email in the database
3. Ensure SMTP is properly configured (see above)

## Production Checklist

- [ ] Configure SMTP environment variables in production environment
- [ ] Test email sending with a real application
- [ ] Verify emails are delivered successfully (check spam folder)
- [ ] Set up proper FROM_EMAIL domain (SPF/DKIM records recommended for better deliverability)
- [ ] Monitor email sending logs for errors
- [ ] Set up email service monitoring/alerts if needed

