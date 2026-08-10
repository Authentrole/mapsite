import {
  Component,
  Input,
  OnInit,
  OnChanges,
  SimpleChanges,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from '@progress/kendo-angular-buttons';
import { IconModule } from '@progress/kendo-angular-icons';

import { PlateResult } from '../../../../core/models/search-result.model';
import { SearchService } from '../../../../core/services/search.service';

@Component({
  selector: 'app-datasource',
  standalone: true,
  imports: [CommonModule, ButtonModule, IconModule],
  templateUrl: './datasource.component.html',
  styleUrls: ['./datasource.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DatasourceComponent implements OnInit, OnChanges {
  @Input() results: PlateResult[] | null = [];

  rawResults: PlateResult[] = [];
  contentTypes: string[] = [];
  activeContentType: string | null = null;
  filtered: PlateResult[] = [];
  contentTypeCounts: Record<string, number> = {};

  private palette = [
    '#4a47a3', // indigo
    '#007bff', // blue
    '#28a745', // green
    '#d9730d', // orange
    '#6f42c1', // purple
    '#14a3a3', // teal
    '#d63384', // pink
    '#8d6e63', // brown
    '#c59d19', // gold
    '#566573', // slate
  ];
  private colorCache: Record<string, string> = {};

  constructor(private searchService: SearchService) {}

  ngOnInit(): void {
    this.rawResults = Array.isArray(this.results) ? this.results : [];
    this.buildData();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['results']) {
      this.rawResults = Array.isArray(this.results) ? this.results : [];
      this.buildData();
    }
  }

  private buildData() {
    // Limit to top 5 plates, same cap the reference app applies.
    this.rawResults = this.rawResults.slice(0, 5);

    const counts: Record<string, number> = {};
    this.rawResults.forEach((r) => {
      const ct = r.facilityType || 'Unknown';
      counts[ct] = (counts[ct] || 0) + 1;
    });
    this.contentTypeCounts = counts;
    this.contentTypes = Object.keys(counts).sort();
    this.applyFilter();
  }

  setContentType(ct: string | null) {
    this.activeContentType = ct === this.activeContentType ? null : ct;
    this.applyFilter();
  }

  private applyFilter() {
    if (!this.activeContentType) {
      this.filtered = [...this.rawResults];
    } else {
      this.filtered = this.rawResults.filter((r) => (r.facilityType || 'Unknown') === this.activeContentType);
    }
  }

  open(item: PlateResult) {
    window.open(this.searchService.pdfUrl(item.plateId), '_blank');
  }

  thumbUrl(item: PlateResult): string {
    const best = item.pages?.[0];
    return this.searchService.cropUrl(item.plateId, best?.page ?? 1, best?.bbox ?? null);
  }

  bestPage(item: PlateResult) {
    return item.pages?.[0];
  }

  trackByPlate(_: number, item: PlateResult) {
    return item.plateId;
  }

  getContentTypeColor(ct: string | undefined): string {
    const key = ct || 'Unknown';
    if (this.colorCache[key]) return this.colorCache[key];
    let h = 0;
    for (let i = 0; i < key.length; i++) {
      h = (h * 31 + key.charCodeAt(i)) >>> 0;
    }
    const color = this.palette[h % this.palette.length];
    this.colorCache[key] = color;
    return color;
  }

  getTagStyles(ct: string) {
    const base = this.getContentTypeColor(ct);
    const active = ct === this.activeContentType;
    if (active) {
      return { 'background-color': base, border: '1px solid ' + base, color: '#fff' };
    }
    return { 'background-color': this.hexToRgba(base, 0.12), border: '1px solid ' + base, color: base };
  }

  getCardAccentStyle(item: PlateResult) {
    const c = this.getContentTypeColor(item.facilityType);
    return { 'border-left-color': c };
  }

  private hexToRgba(hex: string, alpha: number) {
    const raw = hex.replace('#', '');
    const full = raw.length === 3 ? raw.split('').map((ch) => ch + ch).join('') : raw;
    const bigint = parseInt(full, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}
