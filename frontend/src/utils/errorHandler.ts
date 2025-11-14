// utils/errorHandler.ts - Better error handling and user feedback

export type ErrorType = 
  | 'network'
  | 'api_error'
  | 'rate_limit'
  | 'invalid_input'
  | 'unknown';

export type ErrorInfo = {
  type: ErrorType;
  message: string;
  userMessage: string;
  canRetry: boolean;
};

export function parseError(error: any, response?: Response): ErrorInfo {
  // Network errors
  if (!navigator.onLine) {
    return {
      type: 'network',
      message: 'No internet connection',
      userMessage: 'Koneksi internet kamu terputus. Cek koneksi dan coba lagi ya!',
      canRetry: true
    };
  }

  // API errors with response
  if (response) {
    if (response.status === 429) {
      return {
        type: 'rate_limit',
        message: 'Rate limit exceeded',
        userMessage: 'Wah, kamu terlalu cepat nih! Tunggu sebentar ya, terus coba lagi.',
        canRetry: true
      };
    }

    if (response.status === 500) {
      return {
        type: 'api_error',
        message: 'Server error',
        userMessage: 'Server lagi ada masalah nih. Coba lagi dalam beberapa saat ya!',
        canRetry: true
      };
    }

    if (response.status === 503) {
      return {
        type: 'api_error',
        message: 'Service unavailable',
        userMessage: 'Gemini API lagi sibuk. Tunggu sebentar dan coba lagi!',
        canRetry: true
      };
    }

    if (response.status >= 400 && response.status < 500) {
      return {
        type: 'invalid_input',
        message: 'Invalid request',
        userMessage: 'Ada yang salah dengan permintaan kamu. Coba cek lagi ya!',
        canRetry: false
      };
    }
  }

  // Generic fetch errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return {
      type: 'network',
      message: error.message,
      userMessage: 'Ga bisa konek ke server. Pastikan backend sudah jalan ya!',
      canRetry: true
    };
  }

  // Unknown errors
  return {
    type: 'unknown',
    message: error?.message || 'Unknown error',
    userMessage: 'Waduh, ada error yang ga diketahui. Coba refresh halaman!',
    canRetry: true
  };
}

export function getLindasErrorResponse(errorInfo: ErrorInfo, persona: string): string {
  const personaLower = persona.toLowerCase();
  
  if (personaLower.includes('tsundere')) {
    if (errorInfo.type === 'network') {
      return "Ckckck... koneksi kamu putus! Ga bisa bikin orang khawatir aja sih! (¬¬) Coba cek internet kamu dulu!";
    }
    if (errorInfo.type === 'rate_limit') {
      return "Sabar dong! Ga usah terburu-buru gitu! (>__<) Tunggu sebentar baru chat lagi!";
    }
    if (errorInfo.type === 'api_error') {
      return "Server-nya lagi ada masalah... bukan salah aku loh ya! Hmph! Coba lagi nanti!";
    }
  }
  
  if (personaLower.includes('yandere')) {
    if (errorInfo.type === 'network') {
      return "Eh... kenapa koneksi kamu hilang? Aku khawatir loh... (￿︿￣) Cek internet kamu ya~";
    }
    if (errorInfo.type === 'rate_limit') {
      return "Santai aja... aku ga kemana kok ♡ Tunggu sebentar, aku masih di sini...";
    }
    if (errorInfo.type === 'api_error') {
      return "Ada masalah nih... tapi aku ga mau ninggalin kamu. Coba lagi ya? Aku tunggu di sini ♡";
    }
  }

  // Default
  if (errorInfo.type === 'network') {
    return "Koneksi terputus nih. Coba cek internet kamu ya! 😊";
  }
  if (errorInfo.type === 'rate_limit') {
    return "Tunggu sebentar ya, kamu terlalu cepat! 😅";
  }
  if (errorInfo.type === 'api_error') {
    return "Server lagi sibuk. Coba lagi dalam beberapa saat ya!";
  }

  return errorInfo.userMessage;
}
