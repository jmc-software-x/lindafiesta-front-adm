import { extractErrorMessage } from '@/lib/common/api-response';

export interface RenderHtmlInput {
  templateHtml: string;
  variables: Record<string, unknown>;
}

export interface RenderHtmlResult {
  html: string;
  replacedKeys: string[];
}

export interface RenderPdfInput {
  templateHtml: string;
  variables: Record<string, unknown>;
  fileName?: string;
  title?: string;
}

export interface RenderPdfResult {
  blob: Blob;
  fileName: string;
}

export interface SendEmailInput {
  to: string[];
  subject: string;
  templateHtml: string;
  variables: Record<string, unknown>;
  attachPdf?: boolean;
  attachmentFileName?: string;
  title?: string;
}

export interface SendEmailResult {
  messageId?: string;
  accepted?: string[];
  rejected?: string[];
  replacedKeys?: string[];
  attachedPdf?: boolean;
}

function parseFileNameFromContentDisposition(headerValue: string | null): string {
  if (!headerValue) {
    return 'document.pdf';
  }

  const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]).replace(/["']/g, '');
    } catch {
      return utf8Match[1].replace(/["']/g, '');
    }
  }

  const basicMatch = headerValue.match(/filename="?([^";]+)"?/i);
  if (basicMatch?.[1]) {
    return basicMatch[1].trim();
  }

  return 'document.pdf';
}

export async function renderDocumentHtml(input: RenderHtmlInput): Promise<RenderHtmlResult> {
  const response = await fetch('/api/documents/render-html', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const body = (await response.json()) as unknown;
  if (!response.ok) {
    throw new Error(extractErrorMessage(body, 'No se pudo renderizar HTML.'));
  }

  const payload = body as Partial<RenderHtmlResult>;
  if (typeof payload.html !== 'string') {
    throw new Error('Respuesta invalida al renderizar HTML.');
  }

  return {
    html: payload.html,
    replacedKeys: Array.isArray(payload.replacedKeys)
      ? payload.replacedKeys.filter((key): key is string => typeof key === 'string')
      : [],
  };
}

export async function renderDocumentPdf(input: RenderPdfInput): Promise<RenderPdfResult> {
  const response = await fetch('/api/documents/render-pdf', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errorBody = (await response.json()) as unknown;
    throw new Error(extractErrorMessage(errorBody, 'No se pudo renderizar PDF.'));
  }

  const blob = await response.blob();
  const fileName = parseFileNameFromContentDisposition(response.headers.get('content-disposition'));

  return {
    blob,
    fileName,
  };
}

export async function sendDocumentEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const response = await fetch('/api/documents/send-email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const body = (await response.json()) as unknown;
  if (!response.ok) {
    throw new Error(extractErrorMessage(body, 'No se pudo enviar correo.'));
  }

  const payload = body as SendEmailResult;
  return {
    messageId: payload.messageId,
    accepted: Array.isArray(payload.accepted)
      ? payload.accepted.filter((email): email is string => typeof email === 'string')
      : [],
    rejected: Array.isArray(payload.rejected)
      ? payload.rejected.filter((email): email is string => typeof email === 'string')
      : [],
    replacedKeys: Array.isArray(payload.replacedKeys)
      ? payload.replacedKeys.filter((key): key is string => typeof key === 'string')
      : [],
    attachedPdf: Boolean(payload.attachedPdf),
  };
}
