module.exports = {
  apps: [
    {
      name: "alumni-portal",
      // Run the Next.js binary directly — avoids npm/cmd quirks under PM2 on Windows.
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      // cwd is resolved relative to where `pm2 start` is invoked; leave it relative
      // so this file works wherever the app is deployed.
      cwd: "./",

      // Single fork instance — Next.js handles concurrency internally.
      // To scale horizontally instead: instances: "max", exec_mode: "cluster".
      instances: 1,
      exec_mode: "fork",

      // Restart behavior
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: "10s",

      // Logs (paths relative to cwd)
      out_file: "./logs/alumni-portal-out.log",
      error_file: "./logs/alumni-portal-error.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",

      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
