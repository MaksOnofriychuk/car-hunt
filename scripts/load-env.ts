// Підвантажує .env і .env.local для скриптів, що запускаються поза Next
// (tsx scripts/*.ts). Порядок як у Next: спершу .env, потім .env.local — те,
// що в локальному файлі, головніше.
// Імпортувати ПЕРШИМ — до будь-чого, що читає process.env на верхньому рівні модуля.
for (const file of ['.env', '.env.local']) {
  try {
    process.loadEnvFile(file)
  } catch {
    // Файлу нема — значить змінні вже в оточенні (CI / Vercel).
  }
}
