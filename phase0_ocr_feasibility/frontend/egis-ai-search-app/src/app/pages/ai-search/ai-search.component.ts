import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AssistantComponent } from './components/assistant/assistant.component';
import { DatasourceComponent } from './components/datasource/datasource.component';
import { PlateResult } from '../../core/models/search-result.model';

@Component({
  selector: 'app-ai-search',
  standalone: true,
  imports: [CommonModule, AssistantComponent, DatasourceComponent],
  templateUrl: './ai-search.component.html',
  styleUrls: ['./ai-search.component.scss'],
})
export class AiSearchComponent {
  private readonly LOCAL_STORAGE_KEY = 'egis-ai-search-datasource';

  latestResults: PlateResult[] = [];
  messages: any[] = [];
  isMobile = false;
  isMobileCollapsed = true;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.checkMobile();
    const saved = localStorage.getItem(this.LOCAL_STORAGE_KEY);
    if (saved) {
      try {
        this.latestResults = JSON.parse(saved);
      } catch {}
    }
    window.addEventListener('resize', () => this.checkMobile());
  }

  ngOnDestroy() {
    window.removeEventListener('resize', () => this.checkMobile());
  }

  checkMobile() {
    const wasMobile = this.isMobile;
    this.isMobile = window.innerWidth <= 768;
    if (!this.isMobile) {
      this.isMobileCollapsed = false;
    } else if (!wasMobile && this.isMobile) {
      this.isMobileCollapsed = true;
    }
  }

  toggleMobileDatasource() {
    this.isMobileCollapsed = !this.isMobileCollapsed;
    this.cdr.detectChanges();
  }

  onSearchResults(results: PlateResult[]) {
    this.latestResults = results || [];
    try {
      localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(this.latestResults));
    } catch {}
    this.cdr.detectChanges();
  }

  onMessagesChange(msgs: any[]) {
    this.messages = msgs;
  }

  refreshMobile() {
    this.latestResults = [];
    try {
      localStorage.removeItem(this.LOCAL_STORAGE_KEY);
    } catch {}
    this.messages = [];
  }
}
