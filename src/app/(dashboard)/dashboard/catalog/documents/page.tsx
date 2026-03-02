'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  renderDocumentHtml,
  renderDocumentPdf,
  sendDocumentEmail,
  SendEmailResult,
} from '@/lib/documents/documents-controller';
import { useErrorStore } from '@/stores/error-store';
import { useLoadingStore } from '@/stores/loading-store';
import { useUiStore } from '@/stores/ui-store';

const DEFAULT_TEMPLATE = `<h1>Contrato legal</h1>
<p>Empresa: {empresa}</p>
<p>Cliente: {cliente}</p>
<p>Remitente: {nombre} {apellido}</p>`;

const DEFAULT_VARIABLES_JSON = `{
  "empresa": "Linda Fiestas",
  "cliente": "James",
  "nombre": "James",
  "apellido": "McLaren"
}`;

function parseVariablesJson(input: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new Error('Variables JSON invalido.');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Variables debe ser un objeto JSON.');
  }

  return parsed as Record<string, unknown>;
}

function parseRecipients(input: string): string[] {
  return input
    .split(/[,\n;]/g)
    .map((email) => email.trim())
    .filter((email) => email.length > 0);
}

function triggerBlobDownload(blob: Blob, fileName: string): void {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName || 'document.pdf';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}

export default function DocumentsCatalogPage() {
  const pushNotification = useUiStore((state) => state.pushNotification);
  const reportError = useErrorStore((state) => state.reportError);
  const clearErrors = useErrorStore((state) => state.clearErrors);
  const startLoading = useLoadingStore((state) => state.startLoading);
  const stopLoading = useLoadingStore((state) => state.stopLoading);

  const [templateHtml, setTemplateHtml] = useState(DEFAULT_TEMPLATE);
  const [variablesJson, setVariablesJson] = useState(DEFAULT_VARIABLES_JSON);
  const [renderedHtml, setRenderedHtml] = useState('');
  const [replacedKeys, setReplacedKeys] = useState<string[]>([]);
  const [pdfFileName, setPdfFileName] = useState('contrato-lindafiestas.pdf');
  const [pdfTitle, setPdfTitle] = useState('Contrato LindaFiestas');
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');
  const [pdfSuggestedName, setPdfSuggestedName] = useState('document.pdf');
  const [emailToInput, setEmailToInput] = useState('cliente@correo.com');
  const [emailSubject, setEmailSubject] = useState('Contrato de servicios - LindaFiestas');
  const [emailAttachPdf, setEmailAttachPdf] = useState(true);
  const [emailAttachmentFileName, setEmailAttachmentFileName] = useState('contrato-lindafiestas.pdf');
  const [emailTitle, setEmailTitle] = useState('Contrato LindaFiestas');
  const [emailResult, setEmailResult] = useState<SendEmailResult | null>(null);
  const [isRenderingHtml, setIsRenderingHtml] = useState(false);
  const [isRenderingPdf, setIsRenderingPdf] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  useEffect(() => {
    return () => {
      if (pdfPreviewUrl) {
        window.URL.revokeObjectURL(pdfPreviewUrl);
      }
    };
  }, [pdfPreviewUrl]);

  const recipientsPreview = useMemo(() => parseRecipients(emailToInput), [emailToInput]);

  const handleRenderHtml = async () => {
    if (isRenderingHtml) {
      return;
    }

    clearErrors();
    setIsRenderingHtml(true);
    startLoading('documents.render-html');

    try {
      const variables = parseVariablesJson(variablesJson);
      const result = await renderDocumentHtml({
        templateHtml,
        variables,
      });

      setRenderedHtml(result.html);
      setReplacedKeys(result.replacedKeys);
      pushNotification({
        type: 'success',
        title: 'Preview HTML generado',
        message: `${result.replacedKeys.length} placeholders reemplazados`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo renderizar HTML.';
      reportError({
        source: 'api',
        message,
        details: 'POST /documents/render-html',
      });
      pushNotification({
        type: 'error',
        title: 'Error render-html',
        message,
      });
    } finally {
      stopLoading('documents.render-html');
      setIsRenderingHtml(false);
    }
  };

  const handleRenderPdf = async () => {
    if (isRenderingPdf) {
      return;
    }

    clearErrors();
    setIsRenderingPdf(true);
    startLoading('documents.render-pdf');

    try {
      const variables = parseVariablesJson(variablesJson);
      const result = await renderDocumentPdf({
        templateHtml,
        variables,
        fileName: pdfFileName.trim() || undefined,
        title: pdfTitle.trim() || undefined,
      });

      if (pdfPreviewUrl) {
        window.URL.revokeObjectURL(pdfPreviewUrl);
      }

      const objectUrl = window.URL.createObjectURL(result.blob);
      setPdfPreviewUrl(objectUrl);
      setPdfSuggestedName(result.fileName || pdfFileName || 'document.pdf');

      pushNotification({
        type: 'success',
        title: 'PDF generado',
        message: result.fileName || 'document.pdf',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo renderizar PDF.';
      reportError({
        source: 'api',
        message,
        details: 'POST /documents/render-pdf',
      });
      pushNotification({
        type: 'error',
        title: 'Error render-pdf',
        message,
      });
    } finally {
      stopLoading('documents.render-pdf');
      setIsRenderingPdf(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (isRenderingPdf) {
      return;
    }

    clearErrors();
    setIsRenderingPdf(true);
    startLoading('documents.render-pdf-download');

    try {
      const variables = parseVariablesJson(variablesJson);
      const result = await renderDocumentPdf({
        templateHtml,
        variables,
        fileName: pdfFileName.trim() || undefined,
        title: pdfTitle.trim() || undefined,
      });

      triggerBlobDownload(result.blob, result.fileName || pdfFileName || 'document.pdf');
      pushNotification({
        type: 'success',
        title: 'PDF descargado',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo descargar PDF.';
      reportError({
        source: 'api',
        message,
        details: 'POST /documents/render-pdf (download)',
      });
      pushNotification({
        type: 'error',
        title: 'Error al descargar PDF',
        message,
      });
    } finally {
      stopLoading('documents.render-pdf-download');
      setIsRenderingPdf(false);
    }
  };

  const handleSendEmail = async () => {
    if (isSendingEmail) {
      return;
    }

    clearErrors();
    setIsSendingEmail(true);
    startLoading('documents.send-email');

    try {
      const variables = parseVariablesJson(variablesJson);
      const recipients = parseRecipients(emailToInput);

      if (recipients.length === 0) {
        throw new Error('Debes ingresar al menos un correo destino.');
      }

      const result = await sendDocumentEmail({
        to: recipients,
        subject: emailSubject.trim(),
        templateHtml,
        variables,
        attachPdf: emailAttachPdf,
        attachmentFileName: emailAttachPdf ? emailAttachmentFileName.trim() || undefined : undefined,
        title: emailTitle.trim() || undefined,
      });

      setEmailResult(result);
      pushNotification({
        type: 'success',
        title: 'Correo enviado',
        message: result.messageId || 'messageId no retornado',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo enviar correo.';
      reportError({
        source: 'api',
        message,
        details: 'POST /documents/send-email',
      });
      pushNotification({
        type: 'error',
        title: 'Error send-email',
        message,
      });
    } finally {
      stopLoading('documents.send-email');
      setIsSendingEmail(false);
    }
  };

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold text-slate-900">Documentos legales</h2>
        <p className="mt-1 text-sm text-slate-600">
          Renderiza HTML con placeholders, genera PDF y envia correo con adjunto opcional.
        </p>
      </header>

      <article className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-semibold text-slate-900">Plantilla y variables</h3>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <label className="space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Template HTML</span>
            <textarea
              value={templateHtml}
              onChange={(event) => setTemplateHtml(event.target.value)}
              className="h-64 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs outline-none ring-brand-500 focus:ring-2"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Variables JSON</span>
            <textarea
              value={variablesJson}
              onChange={(event) => setVariablesJson(event.target.value)}
              className="h-64 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs outline-none ring-brand-500 focus:ring-2"
            />
          </label>
        </div>
      </article>

      <article className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-slate-900">Render HTML (preview)</h3>
          <button
            type="button"
            onClick={() => {
              void handleRenderHtml();
            }}
            disabled={isRenderingHtml}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRenderingHtml ? 'Renderizando...' : 'Render HTML'}
          </button>
        </div>
        {replacedKeys.length > 0 ? (
          <p className="mt-2 text-xs text-slate-600">Replaced keys: {replacedKeys.join(', ')}</p>
        ) : null}
        {renderedHtml ? (
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">HTML resultante</p>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap text-xs text-slate-700">{renderedHtml}</pre>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Vista previa</p>
              <iframe title="HTML preview" srcDoc={renderedHtml} className="h-72 w-full rounded border border-slate-200" />
            </div>
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
            Aun no hay preview. Ejecuta <strong>Render HTML</strong>.
          </div>
        )}
      </article>

      <article className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-semibold text-slate-900">Render PDF</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">fileName</span>
            <input
              value={pdfFileName}
              onChange={(event) => setPdfFileName(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">title</span>
            <input
              value={pdfTitle}
              onChange={(event) => setPdfTitle(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              void handleRenderPdf();
            }}
            disabled={isRenderingPdf}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRenderingPdf ? 'Procesando...' : 'Generar preview PDF'}
          </button>
          <button
            type="button"
            onClick={() => {
              void handleDownloadPdf();
            }}
            disabled={isRenderingPdf}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Descargar PDF
          </button>
        </div>
        {pdfPreviewUrl ? (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-slate-500">Archivo sugerido: {pdfSuggestedName}</p>
            <iframe title="PDF preview" src={pdfPreviewUrl} className="h-[560px] w-full rounded-lg border border-slate-200" />
          </div>
        ) : null}
      </article>

      <article className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-semibold text-slate-900">Enviar correo</h3>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <label className="space-y-1 lg:col-span-2">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">
              Destinatarios (coma, punto y coma o salto de linea)
            </span>
            <textarea
              value={emailToInput}
              onChange={(event) => setEmailToInput(event.target.value)}
              className="h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
            />
          </label>
          <label className="space-y-1 lg:col-span-2">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Subject</span>
            <input
              value={emailSubject}
              onChange={(event) => setEmailSubject(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
            />
          </label>
          <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={emailAttachPdf}
              onChange={(event) => setEmailAttachPdf(event.target.checked)}
            />
            Adjuntar PDF
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">attachmentFileName</span>
            <input
              value={emailAttachmentFileName}
              onChange={(event) => setEmailAttachmentFileName(event.target.value)}
              disabled={!emailAttachPdf}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2 disabled:bg-slate-100"
            />
          </label>
          <label className="space-y-1 lg:col-span-2">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">title PDF</span>
            <input
              value={emailTitle}
              onChange={(event) => setEmailTitle(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void handleSendEmail();
            }}
            disabled={isSendingEmail}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSendingEmail ? 'Enviando...' : 'Enviar email'}
          </button>
          <p className="text-xs text-slate-500">{recipientsPreview.length} destinatario(s)</p>
        </div>

        {emailResult ? (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            <p>
              <strong>messageId:</strong> {emailResult.messageId || '-'}
            </p>
            <p>
              <strong>accepted:</strong> {(emailResult.accepted ?? []).join(', ') || '-'}
            </p>
            <p>
              <strong>rejected:</strong> {(emailResult.rejected ?? []).join(', ') || '-'}
            </p>
            <p>
              <strong>replacedKeys:</strong> {(emailResult.replacedKeys ?? []).join(', ') || '-'}
            </p>
            <p>
              <strong>attachedPdf:</strong> {emailResult.attachedPdf ? 'true' : 'false'}
            </p>
          </div>
        ) : null}
      </article>
    </section>
  );
}
