import { Routes } from '@angular/router';
import { AiSearchComponent } from './pages/ai-search/ai-search.component';

export const routes: Routes = [
  { path: '', component: AiSearchComponent },
  { path: '**', redirectTo: '' },
];
