export const getErrorMessage = (error: unknown, fallback = "Ocurrió un error") => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
};
