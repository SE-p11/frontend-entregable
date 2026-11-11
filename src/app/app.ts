import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

export interface FileItem {
  id: string;
  file: File;
}

export interface TemplateSection {
  id: string;
  titulo: string;
  contenido: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App {
  currentMode: 'menu' | 'combinar' | 'plantilla' = 'menu';

  // Datos principales de la plantilla
  templateData = {
    tituloPrincipal: 'Informe Técnico Consolidado',
    autor: '',
    fecha: new Date().toISOString().split('T')[0]
  };

  // 📝 Bloques editables en tiempo real (añadir, editar, eliminar)
  secciones: TemplateSection[] = [
    { id: '1', titulo: '1. Introducción', contenido: 'Escribe aquí la introducción del informe...' },
    { id: '2', titulo: '2. Objetivos', contenido: 'Detalla los objetivos principales...' }
  ];

  selectedFiles: FileItem[] = [];
  accentColor: string = '#007bff';
  isDarkMode: boolean = false;
  isProcessing: boolean = false;

  constructor(private http: HttpClient) {}

  changeAccentColor(event: any): void {
    this.accentColor = event.target.value;
    document.documentElement.style.setProperty('--primary-color', this.accentColor);
  }

  toggleDarkMode(): void {
    this.isDarkMode = !this.isDarkMode;
  }

  // Funciones para gestionar las secciones dinámicas de la plantilla
  agregarSeccion(): void {
    this.secciones.push({
      id: Math.random().toString(36).substring(2, 9),
      titulo: 'Nueva Sección',
      contenido: 'Contenido de la sección...'
    });
  }

  eliminarSeccion(id: string): void {
    this.secciones = this.secciones.filter(s => s.id !== id);
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

  combineAndDownload(): void {
    this.isProcessing = true;
    const formData = new FormData();

    if (this.currentMode === 'plantilla') {
      formData.append('tituloPrincipal', this.templateData.tituloPrincipal);
      formData.append('autor', this.templateData.autor);
      formData.append('fecha', this.templateData.fecha);
      // Enviamos las secciones convertidas a JSON para que el backend las procese
      formData.append('seccionesJson', JSON.stringify(this.secciones));
    } else {
      formData.append('tituloPrincipal', '');
    }

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
          this.isProcessing = false;
        },
        error: (err) => {
          console.error('Error al unificar archivos:', err);
          alert('Ocurrió un error en el servidor al procesar los documentos. Verifica que el backend esté ejecutándose.');
          this.isProcessing = false;
        }
      });
  }
}
