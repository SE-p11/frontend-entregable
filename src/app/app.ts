import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

export interface FileItem {
  id: string;
  file: File;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})

export class App {
  selectedFiles: FileItem[] = [];
  accentColor: string = '#007bff';
  isDarkMode: boolean = false;

  constructor(private http: HttpClient) {}

  changeAccentColor(event: any): void {
    this.accentColor = event.target.value;
    document.documentElement.style.setProperty('--primary-color', this.accentColor);
  }

  toggleDarkMode(): void {
    this.isDarkMode = !this.isDarkMode;
  }

  onFileSelected(event: any): void {
    if (event.target.files) {
      const files: FileList = event.target.files;
      for (let i = 0; i < files.length; i++) {
        const file = files.item(i);
        if (file) {
          this.selectedFiles.push({
            id: Math.random().toString(36).substring(2, 9),
            file: file
          });
        }
      }
      event.target.value = '';
    }
  }

  removeFile(id: string): void {
    this.selectedFiles = this.selectedFiles.filter(f => f.id !== id);
  }

  moveFile(index: number, direction: 'up' | 'down'): void {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex >= 0 && newIndex < this.selectedFiles.length) {
      const temp = this.selectedFiles[index];
      this.selectedFiles[index] = this.selectedFiles[newIndex];
      this.selectedFiles[newIndex] = temp;
    }
  }

  getFormattedSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Agrega esta propiedad dentro de la clase App
  isProcessing: boolean = false;

  combineAndDownload(): void {
    if (this.selectedFiles.length === 0) return;

    this.isProcessing = true; // Activa estado de carga

    const formData = new FormData();
    this.selectedFiles.forEach(item => {
      formData.append('files', item.file);
    });

    this.http.post('http://localhost:8080/api/pdf/merge', formData, { responseType: 'blob' })
      .subscribe({
        next: (blob: Blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'documento_combinado.pdf';
          a.click();
          window.URL.revokeObjectURL(url);
          this.isProcessing = false; // Desactiva estado de carga
        },
        error: (err) => {
          console.error('Error al unificar archivos:', err);
          alert('Ocurrió un error en el servidor al procesar los documentos.');
          this.isProcessing = false; // Desactiva estado de carga
        }
      });
  }
}
