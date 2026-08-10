import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ChangeDetectorRef,
  ViewChild,
  ElementRef,
  Output,
  EventEmitter,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TextBoxModule } from '@progress/kendo-angular-inputs';
import { ButtonModule } from '@progress/kendo-angular-buttons';
import { LoaderModule } from '@progress/kendo-angular-indicators';

import { SearchService } from '../../../../core/services/search.service';
import { PlateResult, SearchResponse } from '../../../../core/models/search-result.model';

declare const webkitSpeechRecognition: any;

interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  isTyping?: boolean;
  renderedHtml?: SafeHtml;
}

@Component({
  selector: 'app-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule, TextBoxModule, ButtonModule, LoaderModule],
  templateUrl: './assistant.component.html',
  styleUrls: ['./assistant.component.css'],
})
export class AssistantComponent implements OnInit, OnDestroy, AfterViewInit {
  private readonly LOCAL_STORAGE_KEY = 'egis-ai-search-messages';

  query = '';
  messages: ChatMessage[] = [];
  isLoading = false;
  aiAvailable = false;
  aiModel = '';

  @Output() searchResults = new EventEmitter<PlateResult[]>();
  @Output() messagesChange = new EventEmitter<ChatMessage[]>();

  @ViewChild('chatHistory') private chatHistoryRef?: ElementRef<HTMLDivElement>;
  private pendingScroll = false;

  // Feedback storage (visual only -- no feedback endpoint on the Tier-3 demo API)
  messageFeedback: Record<string, 'positive' | 'negative'> = {};

  isMobile = window.innerWidth <= 768;

  // ---- Voice / Speech Recognition ----
  speechSupported = false;
  lastSpeechError: string | null = null;
  isRecording = false;
  isStarting = false;
  interimTranscript = '';
  private recognition: any;

  constructor(
    private searchService: SearchService,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer,
  ) {}

  ngOnInit(): void {
    this.searchService.aiStatus().subscribe({
      next: (status) => {
        this.aiAvailable = !!status.available;
        this.aiModel = status.model || '';
        this.cdr.detectChanges();
      },
      error: () => {
        this.aiAvailable = false;
      },
    });

    this.setupRecognition();

    const saved = localStorage.getItem(this.LOCAL_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          this.messages = parsed
            .filter((msg: any) => !msg.isTyping)
            .map((msg: any) => {
              const base = { ...msg, timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date() };
              if (msg.sender === 'assistant') {
                return { ...base, renderedHtml: this.renderMarkdown(msg.text) };
              }
              return base;
            });
          this.messagesChange.emit(this.messages);
        }
      } catch {}
    }
    this.scheduleScroll();

    window.addEventListener('resize', this.onResize);
  }

  ngAfterViewInit(): void {
    this.scheduleScroll();
  }

  ngOnDestroy(): void {
    if (this.recognition && this.isRecording) {
      try {
        this.recognition.stop();
      } catch {}
    }
    window.removeEventListener('resize', this.onResize);
  }

  private onResize = () => {
    this.isMobile = window.innerWidth <= 768;
  };

  // -------- Chat Logic --------
  send(): void {
    const trimmed = this.query.trim();
    if (!trimmed || this.isLoading) return;

    this.messages.push({
      id: this.genMsgId(),
      sender: 'user',
      text: trimmed,
      timestamp: new Date(),
    });
    this.saveMessagesToLocalStorage();
    this.scheduleScroll();

    this.messages.push({
      id: 'typing',
      sender: 'assistant',
      text: 'AI is typing...',
      timestamp: new Date(),
      isTyping: true,
    });
    this.scheduleScroll();

    this.query = '';
    this.isLoading = true;
    this.cdr.detectChanges();

    const request$ = this.aiAvailable
      ? this.searchService.aiSearch(trimmed)
      : this.searchService.keywordSearch(trimmed);

    request$.subscribe({
      next: (resp: SearchResponse) => {
        this.isLoading = false;
        this.messages = this.messages.filter((m) => m.id !== 'typing');
        if (resp?.error) {
          this.addErrorMessage(resp.error);
          this.searchResults.emit([]);
        } else {
          this.addAssistantMessage(this.buildAssistantText(resp));
          this.searchResults.emit(Array.isArray(resp.results) ? resp.results : []);
        }
        this.cdr.detectChanges();
        this.scheduleScroll();
      },
      error: () => {
        this.isLoading = false;
        this.messages = this.messages.filter((m) => m.id !== 'typing');
        this.addErrorMessage('I could not reach the search server.');
        this.searchResults.emit([]);
        this.cdr.detectChanges();
        this.scheduleScroll();
      },
    });

    this.messagesChange.emit(this.messages);
  }

  private buildAssistantText(resp: SearchResponse): string {
    if (resp.summary) return resp.summary;
    const count = resp.results?.length ?? 0;
    const totalPages = (resp.results || []).reduce((n, h) => n + (h.pages?.length || 0), 0);
    const fuzzyNote = resp.fuzzy ? ' (fuzzy match — no exact hit found)' : '';
    return `Found ${count} plate(s) for "${resp.query}" across ${totalPages} matching page(s)${fuzzyNote}.`;
  }

  private addErrorMessage(msg: string) {
    this.addAssistantMessage(`I apologize, but ${msg}`);
  }

  private addAssistantMessage(raw: string) {
    this.messages.push({
      id: this.genMsgId(),
      sender: 'assistant',
      text: raw,
      renderedHtml: this.renderMarkdown(raw || ''),
      timestamp: new Date(),
    });
    this.saveMessagesToLocalStorage();
    setTimeout(() => this.attachCodeCopyHandlers(), 0);
    this.scheduleScroll();
    this.messagesChange.emit(this.messages);
  }

  clearChat(): void {
    this.messages = [];
    this.saveMessagesToLocalStorage();
    this.messageFeedback = {};
    this.searchResults.emit([]);
    this.messagesChange.emit(this.messages);
    this.scheduleScroll();
  }

  onKeyPress(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.send();
    }
  }

  trackByMessageId(_: number, m: ChatMessage) {
    return m.id;
  }

  // -------- Feedback (visual only) --------
  provideFeedback(msg: ChatMessage, fb: 'positive' | 'negative'): void {
    this.messageFeedback[msg.id] = fb;
  }

  hasFeedback(id: string) {
    return id in this.messageFeedback;
  }

  getFeedback(id: string) {
    return this.messageFeedback[id];
  }

  private saveMessagesToLocalStorage(): void {
    try {
      localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(this.messages));
    } catch {}
  }

  private genMsgId(): string {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    const randomPart = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return `msg_${Date.now()}_${randomPart}`;
  }

  // -------- Markdown rendering (safe subset -> sanitized HTML) --------
  private renderMarkdown(src: string): SafeHtml {
    let text = src.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const codeBlocks: string[] = [];
    text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (_m, lang, code) => {
      const idx = codeBlocks.length;
      const language = (lang || 'text').toLowerCase();
      const cleaned = code.replace(/\n+$/, '');
      codeBlocks.push(
        `<div class="md-code-block"><button class="copy-btn" data-copy title="Copy code">Copy</button><pre class="md-code"><code class="language-${language}">${cleaned}</code></pre></div>`,
      );
      return `@@CODEBLOCK_${idx}@@`;
    });

    text = text.replace(/^>\s?(.*)$/gm, '<blockquote>$1</blockquote>');
    text = text.replace(/<\/blockquote>\n<blockquote>/g, '<br/>');

    text = text.replace(/^######\s*(.+)$/gm, '<h6>$1</h6>');
    text = text.replace(/^#####\s*(.+)$/gm, '<h5>$1</h5>');
    text = text.replace(/^####\s*(.+)$/gm, '<h4>$1</h4>');
    text = text.replace(/^###\s*(.+)$/gm, '<h3>$1</h3>');
    text = text.replace(/^##\s*(.+)$/gm, '<h2>$1</h2>');
    text = text.replace(/^#\s*(.+)$/gm, '<h1>$1</h1>');

    text = text.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>');
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*(?!\s)([^*]+)\*/g, '<em>$1</em>');

    text = text.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    text = text.replace(/^---+$|^___+$|^\*\*\*+$/gm, '<hr/>');

    text = text.replace(/(?:^\d+\.\s+.+(?:\n|$))+?/gm, (block) => {
      const items = block
        .trim()
        .split(/\n/)
        .filter((l) => /^\d+\.\s+/.test(l))
        .map((l) => '<li>' + l.replace(/^\d+\.\s+/, '') + '</li>');
      return items.length ? '<ol>' + items.join('') + '</ol>' : block;
    });
    text = text.replace(/(?:^(?:[-*+] )[^\n]+(?:\n|$))+?/gm, (block) => {
      const items = block
        .trim()
        .split(/\n/)
        .filter((l) => /^(?:[-*+])\s+/.test(l))
        .map((l) => '<li>' + l.replace(/^(?:[-*+])\s+/, '') + '</li>');
      return items.length ? '<ul>' + items.join('') + '</ul>' : block;
    });
    text = text.replace(/<\/ul>\n<ul>/g, '');
    text = text.replace(/<\/ol>\n<ol>/g, '');

    text = text.replace(/\n/g, '<br/>');
    text = text.replace(/<\/ul>(?:<br\/>){3,}/g, '</ul><br/><br/>');
    text = text.replace(/<\/ul><br\/>\s*<ul>/g, '');

    text = text.replace(/@@CODEBLOCK_(\d+)@@/g, (_m, i) => codeBlocks[Number(i)] || '');

    return this.sanitizer.bypassSecurityTrustHtml(text);
  }

  private attachCodeCopyHandlers() {
    const container = document.querySelector('.chat-history');
    if (!container) return;
    const buttons = container.querySelectorAll<HTMLButtonElement>('button.copy-btn[data-copy]');
    buttons.forEach((btn) => {
      if ((btn as any)._mdCopyBound) return;
      (btn as any)._mdCopyBound = true;
      btn.addEventListener('click', () => {
        const pre = btn.parentElement?.querySelector('pre.md-code code');
        const codeText = pre?.textContent || '';
        navigator.clipboard
          .writeText(codeText)
          .then(() => {
            const original = btn.textContent;
            btn.textContent = 'Copied!';
            btn.classList.add('copied');
            setTimeout(() => {
              btn.textContent = original || 'Copy';
              btn.classList.remove('copied');
            }, 1800);
          })
          .catch(() => {
            btn.textContent = 'Failed';
            setTimeout(() => (btn.textContent = 'Copy'), 1500);
          });
      });
    });
  }

  // -------- Voice Recognition --------
  private setupRecognition(): void {
    const Impl = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Impl) {
      this.speechSupported = false;
      this.lastSpeechError = 'Speech API not supported (Chrome / Edge required).';
      return;
    }
    this.speechSupported = true;
    this.recognition = new Impl();
    this.recognition.lang = 'en-US';
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;
    this.recognition.continuous = false;

    this.recognition.onstart = () => {
      this.isRecording = true;
      this.interimTranscript = '';
      this.cdr.detectChanges();
    };

    this.recognition.onresult = (event: any) => {
      let finalText = '';
      this.interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else this.interimTranscript += r[0].transcript;
      }
      this.query = (finalText + ' ' + this.interimTranscript).trim();
      this.cdr.detectChanges();
    };

    this.recognition.onerror = (e: any) => {
      if (e?.error === 'not-allowed') {
        this.lastSpeechError = 'Mic blocked or denied. Reset site permission and reload.';
      } else if (e?.error === 'audio-capture') {
        this.lastSpeechError = 'No audio input device detected.';
      } else if (e?.error === 'no-speech') {
        this.lastSpeechError = 'No speech detected.';
      } else {
        this.lastSpeechError = e?.error || 'Speech error.';
      }
      this.stopVoiceInput();
    };

    this.recognition.onend = () => {
      if (this.isRecording) this.stopVoiceInput();
    };
  }

  toggleMic(): void {
    if (!this.speechSupported || !this.recognition) {
      this.lastSpeechError = 'Voice not supported.';
      return;
    }
    if (this.isRecording) {
      this.stopVoiceInput();
    } else {
      this.beginVoiceWithPermission();
    }
  }

  private async beginVoiceWithPermission(): Promise<void> {
    if (this.isStarting || this.isRecording) return;
    this.isStarting = true;
    this.lastSpeechError = '';
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      try {
        this.recognition?.start();
      } catch {}
    } catch (err: any) {
      const name = err?.name;
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        this.lastSpeechError = 'Microphone access denied. Check browser site permission & reload.';
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        this.lastSpeechError = 'No microphone device found.';
      } else if (name === 'NotReadableError') {
        this.lastSpeechError = 'Mic in use by another application.';
      } else if (name === 'SecurityError') {
        this.lastSpeechError = 'Insecure context: use HTTPS or localhost.';
      } else {
        this.lastSpeechError = 'Microphone permission denied (browser or OS).';
      }
    } finally {
      this.isStarting = false;
      this.cdr.detectChanges();
    }
  }

  private stopVoiceInput(): void {
    try {
      this.recognition?.stop();
    } catch {}
    this.isRecording = false;
    this.interimTranscript = '';
    this.cdr.detectChanges();
  }

  // ---- Auto Scroll Helpers ----
  private scheduleScroll(): void {
    if (this.pendingScroll) return;
    this.pendingScroll = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.scrollToBottom();
      });
    });
  }

  private scrollToBottom(): void {
    this.pendingScroll = false;
    const el = this.chatHistoryRef?.nativeElement;
    if (!el) return;
    try {
      el.scrollTop = el.scrollHeight;
    } catch {}
  }
}
