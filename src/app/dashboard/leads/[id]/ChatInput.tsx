"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Arquivo = {
  file: File;
  preview: string | null;
  tipo: "image" | "video" | "audio" | "document";
};

function tipoArquivo(mime: string): Arquivo["tipo"] {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "document";
}

const ICONES: Record<Arquivo["tipo"], string> = {
  image: "🖼",
  video: "🎬",
  audio: "🎵",
  document: "📄",
};

export default function ChatInput({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [texto, setTexto] = useState("");
  const [arquivo, setArquivo] = useState<Arquivo | null>(null);
  const [caption, setCaption] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const tipo = tipoArquivo(file.type);
    let preview: string | null = null;
    if (tipo === "image") {
      preview = URL.createObjectURL(file);
    }
    setArquivo({ file, preview, tipo });
    setTexto("");
    setErro(null);
  }

  function removerArquivo() {
    if (arquivo?.preview) URL.revokeObjectURL(arquivo.preview);
    setArquivo(null);
    setCaption("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function enviar() {
    if (!texto.trim() && !arquivo) return;
    setErro(null);
    setEnviando(true);

    const form = new FormData();
    form.append("lead_id", leadId);
    if (arquivo) {
      form.append("file", arquivo.file);
      if (caption.trim()) form.append("caption", caption.trim());
    } else {
      form.append("texto", texto.trim());
    }

    try {
      const res = await fetch("/api/admin/enviar-mensagem", { method: "POST", body: form });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setErro(data.error ?? "Erro ao enviar mensagem");
        return;
      }
      setTexto("");
      removerArquivo();
      startTransition(() => router.refresh());
    } catch {
      setErro("Erro de conexão. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  }

  return (
    <div className="chat-input-wrap">
      {/* Preview do arquivo */}
      {arquivo && (
        <div className="chat-preview">
          {arquivo.tipo === "image" && arquivo.preview && (
            <img src={arquivo.preview} alt="preview" className="preview-img" />
          )}
          {arquivo.tipo !== "image" && (
            <div className="preview-file">
              <span className="preview-icon">{ICONES[arquivo.tipo]}</span>
              <span className="preview-name">{arquivo.file.name}</span>
            </div>
          )}
          <button className="preview-remove" onClick={removerArquivo} title="Remover">×</button>
          {(arquivo.tipo === "image" || arquivo.tipo === "video" || arquivo.tipo === "document") && (
            <input
              className="preview-caption"
              placeholder="Legenda (opcional)…"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
          )}
        </div>
      )}

      {erro && <div className="chat-erro">{erro}</div>}

      {/* Barra de input */}
      <div className="chat-bar">
        {/* Botão de anexo */}
        <label className="attach-btn" title="Anexar arquivo">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,audio/*,application/pdf,.pdf,.doc,.docx,.xls,.xlsx"
            onChange={handleFile}
            style={{ display: "none" }}
          />
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
          </svg>
        </label>

        {/* Textarea */}
        {!arquivo && (
          <textarea
            className="chat-textarea"
            placeholder="Digite uma mensagem… (Enter para enviar)"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={enviando}
          />
        )}
        {arquivo && !texto && (
          <div className="chat-file-placeholder">
            {ICONES[arquivo.tipo]} {arquivo.file.name}
          </div>
        )}

        {/* Botão enviar */}
        <button
          className="send-btn"
          onClick={enviar}
          disabled={enviando || isPending || (!texto.trim() && !arquivo)}
          title="Enviar"
        >
          {enviando || isPending ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}>
              <path d="M21 12a9 9 0 11-6.219-8.56"/>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
