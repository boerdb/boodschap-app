/** PM2 — Boodschappenlijst PWA op poort 3008 */
module.exports = {
  apps: [
    {
      name: "boodschap-app",
      cwd: "/var/www/boodschap-app",
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
        PORT: 3008,
        TZ: "Europe/Amsterdam",
        APP_TIMEZONE: "Europe/Amsterdam",
      },
    },
  ],
};
