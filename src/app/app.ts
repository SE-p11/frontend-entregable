import { Component } from '@angular/core';
import { InformeForm } from './informe-form/informe-form';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [InformeForm],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  isDarkMode = false;
  accentColor = '#007bff';

  toggleDarkMode(): void {
    this.isDarkMode = !this.isDarkMode;
  }

  changeAccentColor(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.accentColor = input.value;
    document.documentElement.style.setProperty('--primary-color', this.accentColor);
  }
}
