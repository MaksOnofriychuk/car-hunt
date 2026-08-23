// Підвантажує .env.local для скриптів, що запускаються поза Next (tsx scripts/*.ts).
// Імпортувати ПЕРШИМ — до будь-чого, що читає process.env на верхньому рівні модуля.
try {
  process.loadEnvFile('.env.local')
} catch {
  // Файлу нема — значить змінні вже в оточенні (CI / Vercel).
}
