import React, { useState, useRef } from 'react';
import { Send, Mic, Paperclip, X, MicOff, Link, Radio } from 'lucide-react';

const ACCEPTED = 'image/jpeg,image/png,image/gif,image/webp,.pdf,.html,.htm,.txt,.json,.docx,.doc,.csv,.md';

function detectUrl(text) {
  return /https?:\/\/[^\s]+/.test(text);
}

export default function ChatInput({ onSend, isLoading, isListening, onToggleMic, isSpeaking, isLiveVoice, onToggleLive }) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const fileInputRef = useRef(null);

  const hasUrl = detectUrl(text);

  const handleSend = () => {
    if ((!text.trim() && files.length === 0) || isLoading) return;
    onSend(text.trim(), files);
    setText('');
    setFiles([]);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e) => {
    const newFiles = Array.from(e.target.files || []);
    setFiles(prev => [...prev, ...newFiles].slice(0, 4));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (file) => {
    if (file.type.startsWith('image/')) return null; // show thumbnail
    if (file.name.match(/\.pdf$/i)) return '📄';
    if (file.name.match(/\.html?$/i)) return '🌐';
    if (file.name.match(/\.json$/i)) return '{}';
    if (file.name.match(/\.docx?$/i)) return '📝';
    if (file.name.match(/\.csv$/i)) return '📊';
    if (file.name.match(/\.md$/i)) return '#';
    return '📎';
  };

  return (
    <div className="border-t border-cyan-900/30 bg-[#050a0f]/90 backdrop-blur-md p-3 sm:p-4">
      {/* File previews */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3 px-1">
          {files.map((file, i) => {
            const icon = getFileIcon(file);
            return (
              <div key={i} className="relative group">
                {!icon ? (
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="w-16 h-16 object-cover rounded-lg border border-cyan-800/40"
                  />
                ) : (
                  <div className="w-16 h-16 flex flex-col items-center justify-center rounded-lg border border-cyan-800/40 bg-cyan-900/20 gap-1">
                    <span className="text-lg">{icon}</span>
                    <span className="text-[8px] font-mono text-cyan-400/70 text-center px-1 truncate w-full text-center">
                      {file.name.split('.').pop().toUpperCase()}
                    </span>
                  </div>
                )}
                <button
                  onClick={() => removeFile(i)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            );
          })}
          <span className="self-end text-[10px] font-mono text-cyan-600/40">{files.length}/4</span>
        </div>
      )}

      {/* URL detected indicator */}
      {hasUrl && !isLoading && (
        <div className="flex items-center gap-2 mb-2 px-1">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-cyan-700/30 bg-cyan-900/10">
            <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
            <span className="text-[10px] font-mono text-cyan-400/80">Link detectado — JARVIS irá escanear o conteúdo</span>
          </div>
        </div>
      )}

      {/* Processing indicator */}
      {isLoading && (files.length > 0 || hasUrl) && (
        <div className="flex items-center gap-2 mb-2 px-1">
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-cyan-600/30 bg-cyan-900/10">
            <div className="relative w-4 h-4">
              <div className="absolute inset-0 border border-cyan-400/30 rounded-full" />
              <div className="absolute inset-0 border-t border-cyan-400 rounded-full animate-spin" />
              <div className="absolute inset-1 border border-cyan-400/20 rounded-full" />
            </div>
            <span className="text-[10px] font-mono text-cyan-400/80 animate-pulse">
              {files.length > 0 ? 'PROCESSANDO ARQUIVO...' : 'ESCANEANDO LINK...'}
            </span>
          </div>
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* File upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED}
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={files.length >= 4}
          title="Anexar arquivo (imagens, PDF, HTML, JSON, DOCX, TXT, CSV)"
          className="flex-shrink-0 p-2.5 rounded-xl border border-cyan-800/30 hover:border-cyan-500/50 hover:bg-cyan-500/10 
            transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Paperclip className="w-4 h-4 text-cyan-400/60" />
        </button>

        {/* Text input */}
        <div className="flex-1 relative">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Awaiting command override..."
            rows={1}
            className="w-full bg-[#0a1520] border border-cyan-800/30 rounded-xl px-4 py-2.5 text-sm text-cyan-50
              placeholder:text-cyan-700/40 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20
              resize-none font-mono transition-all duration-300"
            style={{ minHeight: '42px', maxHeight: '120px' }}
          />
        </div>

        {/* Mic button */}
        <button
          onClick={onToggleMic}
          className={`flex-shrink-0 p-2.5 rounded-xl border transition-all duration-300 ${
            isListening
              ? 'border-red-500/50 bg-red-500/20 animate-pulse'
              : 'border-cyan-800/30 hover:border-cyan-500/50 hover:bg-cyan-500/10'
          }`}
        >
          {isListening ? (
            <MicOff className="w-4 h-4 text-red-400" />
          ) : (
            <Mic className="w-4 h-4 text-cyan-400/60" />
          )}
        </button>

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={(!text.trim() && files.length === 0) || isLoading}
          className="flex-shrink-0 p-2.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 
            hover:border-cyan-400/50 transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed
            animate-pulse-glow"
        >
          <Send className="w-4 h-4 text-cyan-400" />
        </button>
      </div>

      {/* Status indicators */}
      <div className="flex items-center gap-3 mt-2 px-1">
        {isListening && (
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[10px] font-mono text-red-400/70">ESCUTANDO...</span>
          </div>
        )}
        {isSpeaking && (
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[10px] font-mono text-cyan-400/70">FALANDO...</span>
          </div>
        )}
      </div>
    </div>
  );
}