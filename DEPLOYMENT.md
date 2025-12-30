# Deployment Guide - Alumni Portal

## Fixing 502 Bad Gateway Error for Large Exports

### Problem
When exporting large datasets, nginx returns a 502 Bad Gateway error because it times out before the export completes.

### Solution 1: Update Nginx Configuration (Recommended)

1. **Locate your nginx configuration file:**
   ```bash
   # Usually located at:
   /etc/nginx/sites-available/portal-alumni
   # or
   /etc/nginx/conf.d/portal-alumni.conf
   ```

2. **Add or update the following settings in your nginx config:**
   ```nginx
   # Increase timeouts for long-running exports
   proxy_connect_timeout 900s;
   proxy_send_timeout 900s;
   proxy_read_timeout 900s;
   send_timeout 900s;

   # Disable buffering for streaming responses
   proxy_buffering off;
   proxy_request_buffering off;

   # Specific location block for export endpoint
   location /api/alumni/export {
       proxy_pass http://localhost:3000;  # Adjust port if needed
       proxy_http_version 1.1;
       proxy_set_header Host $host;
       
       # Extended timeouts (15 minutes)
       proxy_connect_timeout 900s;
       proxy_send_timeout 900s;
       proxy_read_timeout 900s;
       send_timeout 900s;
       
       # Disable buffering
       proxy_buffering off;
       proxy_request_buffering off;
   }
   ```

3. **Test nginx configuration:**
   ```bash
   sudo nginx -t
   ```

4. **Reload nginx:**
   ```bash
   sudo systemctl reload nginx
   # or
   sudo service nginx reload
   ```

### Solution 2: Check PM2 Configuration

Ensure PM2 is configured with appropriate timeouts:

```bash
# Check PM2 process
pm2 list

# If using ecosystem file, ensure no timeout limits
# Or restart with:
pm2 restart all --update-env
```

### Solution 3: Database Connection Pool Settings

Ensure your database connection pool allows long-running queries. Check your `.env.production` or database configuration.

### Verification

After applying the nginx configuration:
1. Test the export with a small dataset first
2. Gradually test with larger datasets
3. Monitor nginx error logs: `sudo tail -f /var/log/nginx/error.log`
4. Monitor PM2 logs: `pm2 logs`

### Troubleshooting

If issues persist:
- Check nginx error logs: `sudo tail -f /var/log/nginx/error.log`
- Check PM2 logs: `pm2 logs`
- Check Next.js logs in PM2
- Verify the Next.js app is running on the correct port
- Ensure firewall allows connections between nginx and the app

