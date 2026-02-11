const isDev = import.meta.env.DEV;

type LogArgs = unknown[];

export const logger = {
  debug: (...args: LogArgs) => {
    if (isDev) {
      console.debug(...args);
    }
  },
  info: (...args: LogArgs) => {
    console.info(...args);
  },
  warn: (...args: LogArgs) => {
    console.warn(...args);
  },
  error: (...args: LogArgs) => {
    console.error(...args);
  },
};
