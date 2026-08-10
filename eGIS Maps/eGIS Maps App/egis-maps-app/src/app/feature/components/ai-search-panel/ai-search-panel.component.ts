import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { IndicatorsModule } from '@progress/kendo-angular-indicators';
import { AiSearchResponse, AiSearchResultPlate, AiSearchService } from '../../../shared/services/ai-search.service';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  results?: AiSearchResultPlate[];
  totalFound?: number;
  retrieval?: 'semantic' | 'keyword' | 'rejected';
  isError?: boolean;
  feedback?: 'up' | 'down' | null;
}

@Component({
  selector: 'app-ai-search-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonsModule, IndicatorsModule],
  templateUrl: './ai-search-panel.component.html',
  styleUrl: './ai-search-panel.component.scss',
})
export class AiSearchPanelComponent implements OnChanges {
  @Input() visible: boolean = false;
  @Input() query: string = '';
  @Output() closed = new EventEmitter<void>();

  messages: ChatMessage[] = [];
  followUpText: string = '';
  isBusy: boolean = false;
  baseUrl: string = '';

  constructor(private aiSearchService: AiSearchService) {
    this.aiSearchService.baseUrl().subscribe((url) => (this.baseUrl = url));
  }

  ngOnChanges(changes: SimpleChanges): void {
    // A new query from the top search bar always starts a fresh conversation,
    // whether the panel was already open or not.
    if (changes['query'] && this.query?.trim()) {
      this.startNewChat();
      this.ask(this.query.trim());
    }
  }

  startNewChat(): void {
    this.messages = [];
    this.followUpText = '';
  }

  ask(question: string): void {
    if (!question) {
      return;
    }
    this.messages.push({
      role: 'user',
      text: question,
      timestamp: this.now(),
    });
    this.isBusy = true;

    this.aiSearchService.search(question).subscribe({
      next: (response: AiSearchResponse) => {
        this.isBusy = false;
        if (response?.error) {
          this.messages.push({
            role: 'assistant',
            text: response.error,
            timestamp: this.now(),
            isError: true,
          });
          return;
        }
        this.messages.push({
          role: 'assistant',
          text: response.summary,
          timestamp: this.now(),
          results: response.results,
          totalFound: response.totalFound,
          retrieval: response.retrieval,
        });
      },
      error: () => {
        this.isBusy = false;
        this.messages.push({
          role: 'assistant',
          text: 'Sorry, the AI Search service is unavailable right now. Please try again later.',
          timestamp: this.now(),
          isError: true,
        });
      },
    });
  }

  sendFollowUp(): void {
    const question = this.followUpText.trim();
    if (!question) {
      return;
    }
    this.followUpText = '';
    this.ask(question);
  }

  onFollowUpKeyPress(event: any): void {
    const keycode = event.keyCode ? event.keyCode : event.which;
    if (keycode == 13) {
      this.sendFollowUp();
    }
  }

  giveFeedback(msg: ChatMessage, value: 'up' | 'down'): void {
    msg.feedback = value;
  }

  cropUrl(plateId: string, page: any): string {
    return this.aiSearchService.cropUrl(this.baseUrl, plateId, page);
  }

  pdfUrl(plateId: string): string {
    return this.aiSearchService.pdfUrl(this.baseUrl, plateId);
  }

  hasBbox(page: any): boolean {
    return Array.isArray(page?.bbox) && page.bbox.length === 4;
  }

  close(): void {
    this.closed.emit();
  }

  private now(): string {
    return new Date().toLocaleString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: '2-digit',
      hour: 'numeric',
      minute: '2-digit',
    });
  }
}
