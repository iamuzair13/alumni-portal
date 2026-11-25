
module.exports = {
  apps: [
    {
      name: "alumni-portal",
      script: "npm",
      args: "start",
      max_restarts: 10,          // give up after 10 crashes...
      min_uptime: "10s",         // ...counted only if it dies within 10s of boot
      exp_backoff_restart_delay: 100,  // 100ms → 200 → 400 → ... backoff
      max_memory_restart: "750M",      // restart if it leaks past this
      autorestart: true,
    },
  ],
};