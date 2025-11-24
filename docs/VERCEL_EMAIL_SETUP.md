# Vercel Email Configuration Guide

This guide helps you troubleshoot email issues when deploying to Vercel.

## Environment Variables on Vercel

Make sure you've added **all** of these environment variables in your Vercel project settings:

### Required Variables

1. **SMTP_USER** - Your SMTP username (e.g., your Gmail address)
2. **SMTP_PASSWORD** or **SMTP_PASS** - Your SMTP password (Gmail App Password)
3. **SMTP_HOST** - SMTP server hostname (default: `smtp.gmail.com`)
4. **SMTP_PORT** - SMTP server port (default: `587`)
5. **SMTP_SECURE** - Use secure connection (default: `false` for port 587, `true` for port 465)

### Optional Variables

- **FROM_EMAIL** - Email address to send from (defaults to SMTP_USER)
- **FROM_NAME** - Display name for emails (default: "UOL Alumni Portal")

## How to Add Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Click on **Settings** → **Environment Variables**
3. Add each variable:
   - **Name**: `SMTP_USER`
   - **Value**: `your-email@gmail.com`
   - **Environment**: Select all (Production, Preview, Development)
4. Repeat for all required variables
5. **Important**: After adding variables, you must **redeploy** your application for changes to take effect

## Testing SMTP Configuration

### Option 1: Use the Test Endpoint

After deploying, visit:
```
https://your-domain.vercel.app/api/test-email
```

This will return a JSON response showing:
- Whether SMTP is configured
- Connection status
- Configuration details (without sensitive data)

**Example successful response:**
```json
{
  "ok": true,
  "message": "SMTP configuration is valid and connection successful",
  "details": {
    "host": "smtp.gmail.com",
    "port": 587,
    "secure": false,
    "from": "your-email@gmail.com"
  }
}
```

**Example error response:**
```json
{
  "ok": false,
  "message": "SMTP not configured",
  "details": {
    "SMTP_USER": "NOT SET",
    "SMTP_PASS": "NOT SET",
    "SMTP_HOST": "smtp.gmail.com",
    "SMTP_PORT": 587
  }
}
```

### Option 2: Check Vercel Logs

1. Go to your Vercel project dashboard
2. Click on **Deployments** → Select your latest deployment
3. Click on **Functions** tab
4. Look for logs starting with `[Email]` or `[Scholarship API]`

## Common Issues and Solutions

### Issue 1: "SMTP not configured"

**Symptoms:**
- Error message: "SMTP not configured"
- Test endpoint shows `SMTP_USER: "NOT SET"` or `SMTP_PASS: "NOT SET"`

**Solution:**
1. Verify environment variables are set in Vercel dashboard
2. Make sure variable names match exactly (case-sensitive)
3. **Redeploy** your application after adding variables
4. Check that variables are set for the correct environment (Production/Preview/Development)

### Issue 2: "SMTP verification failed"

**Symptoms:**
- Error message: "SMTP verification failed"
- Connection timeout or authentication errors

**Solutions:**
1. **For Gmail:**
   - Make sure you're using an **App Password**, not your regular password
   - Enable 2-Step Verification on your Google account
   - Generate a new App Password if needed

2. **Check SMTP settings:**
   - Verify `SMTP_HOST` is correct for your email provider
   - Verify `SMTP_PORT` matches your provider's requirements
   - For Gmail: Port 587 with `SMTP_SECURE=false` OR Port 465 with `SMTP_SECURE=true`

3. **Firewall/Network:**
   - Some corporate networks block SMTP ports
   - Vercel's servers should have access, but verify your email provider allows connections from Vercel's IPs

### Issue 3: Emails sent but not received

**Solutions:**
1. Check spam/junk folder
2. Verify recipient email address is correct
3. Check email provider's sending limits
4. Verify `FROM_EMAIL` domain has proper SPF/DKIM records (for better deliverability)

### Issue 4: Environment variables not updating

**Symptoms:**
- Variables are set in Vercel but still showing as "NOT SET"

**Solution:**
1. **Redeploy** your application after adding/updating variables
2. Vercel caches environment variables, so changes require a new deployment
3. You can trigger a redeploy by:
   - Pushing a new commit
   - Going to Deployments → Click "..." → "Redeploy"

## Gmail App Password Setup

If using Gmail, follow these steps:

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable **2-Step Verification** (if not already enabled)
3. Go to **App passwords** section
4. Create a new app password:
   - Select "Mail" as the app
   - Select "Other (Custom name)" as device
   - Enter a name like "Vercel Alumni Portal"
   - Click "Generate"
5. Copy the 16-character password (no spaces)
6. Add it to Vercel as `SMTP_PASSWORD` environment variable

## Verification Checklist

Before reporting issues, verify:

- [ ] All environment variables are set in Vercel dashboard
- [ ] Variables are set for the correct environment (Production/Preview/Development)
- [ ] Application has been redeployed after adding variables
- [ ] Test endpoint (`/api/test-email`) shows `ok: true`
- [ ] Vercel logs show `[Email] SMTP server is ready to send emails`
- [ ] Using App Password for Gmail (not regular password)
- [ ] SMTP_HOST and SMTP_PORT are correct for your email provider

## Debugging Steps

1. **Check test endpoint:**
   ```
   GET https://your-domain.vercel.app/api/test-email
   ```

2. **Check Vercel logs:**
   - Look for `[Email]` or `[Scholarship API]` log entries
   - Check for error messages

3. **Test with a simple form submission:**
   - Submit a scholarship application
   - Check the response for `emailSent` and `emailError` fields
   - Check Vercel function logs for detailed error messages

4. **Verify environment variables:**
   - Use Vercel CLI: `vercel env ls`
   - Or check in Vercel dashboard

## Support

If issues persist:
1. Check Vercel function logs for detailed error messages
2. Test SMTP configuration using the test endpoint
3. Verify all environment variables are correctly set
4. Ensure you've redeployed after adding variables

