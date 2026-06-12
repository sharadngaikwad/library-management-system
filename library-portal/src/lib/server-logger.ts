const isProduction = process.env.NODE_ENV === 'production';

export const serverLogger = {
  info: (message: string, ...meta: any[]) => {
    console.log(`[INFO] [${new Date().toISOString()}] ${message}`, ...meta);
  },
  warn: (message: string, ...meta: any[]) => {
    console.warn(`[WARN] [${new Date().toISOString()}] ${message}`, ...meta);
  },
  error: (message: string, error?: any, ...meta: any[]) => {
    console.error(
      `[ERROR] [${new Date().toISOString()}] ${message}`, 
      error?.stack || error?.message || error || '', 
      ...meta
    );
  },
  debug: (message: string, ...meta: any[]) => {
    if (!isProduction) {
      console.log(`[DEBUG] [${new Date().toISOString()}] ${message}`, ...meta);
    }
  }
};