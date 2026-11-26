import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

interface Img {
  file: File;
  url: string;
}

interface FotoPanel extends Img {
  descripcion: string;
}

type CampoImagen = 'portada' | 'mapa' | 'curva';

const API = 'http://localhost:8080/api/informe/generar';

@Component({
  selector: 'app-informe-form',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './informe-form.html',
  styleUrl: './informe-form.css',
})
export class InformeForm {
  /** Todos los textos del informe. Los nombres coinciden con los que lee el InformeController. */
  datos = {
    // portada
    titulo: 'Análisis de cantera para material granular para afirmado',
    dosificacion: '1:9',
    fecha: new Date().toISOString().slice(0, 10),
    obra: '',
    tipoProyecto: 'Cantera',
    nombreProyecto: '',
    solicita: '',
    realizadoPor: '',
    lugar: '',
    distrito: '',
    provincia: '',
    departamento: 'Ayacucho',
    // ubicación de la cantera
    cantDepartamento: 'Ayacucho',
    cantProvincia: '',
    cantDistrito: '',
    cantLugar: '',
    puntoReferencia: '',
    este: '',
    norte: '',
    // granulometría (tabla 1)
    muestra: 'M-1',
    grava: '',
    arena: '',
    finos: '',
    humedad: '',
    d10: '',
    d30: '',
    d60: '',
    cu: '',
    cc: '',
    // clasificación
    aashto: '',
    sucs: '',
    nombreGrupo: '',
    gradacion: 'C',
    zaranda: '2”',
    // plasticidad y proctor
    ll: '',
    lp: '',
    ip: '',
    ig: '0',
    mds: '',
    och: '',
    // conclusión
    conclusion:
      'El material de préstamo (afirmado) de la Cantera analizada, zarandeado por la malla de 2”, ' +
      'cumple la mayoría de los requisitos de calidad como material para afirmado por lo que se ' +
      'recomienda su uso con fines del mantenimiento de dicha vía.',
  };

  tiposProyecto = ['Cantera', 'Casa', 'Puente', 'Carretera', 'Otro'];
  gradaciones = ['A-1', 'A-2', 'C', 'D', 'E', 'F'];

  imagenes: Record<CampoImagen, Img | null> = { portada: null, mapa: null, curva: null };
  anexo: Img[] = [];
  panel: FotoPanel[] = [];

  cargando = signal(false);
  mensaje = signal('');
  error = signal('');

  constructor(private http: HttpClient) {}

  // ------------------------------------------------------------ cálculos

  private num(v: string): number {
    return parseFloat(String(v ?? '').replace(',', '.'));
  }

  private fmt(n: number, dec = 2): string {
    return Number.isFinite(n) ? n.toFixed(dec) : '';
  }

  /** Completa finos, Cu, Cc e IP a partir de los datos escritos (se pueden corregir a mano después). */
  recalcular(): void {
    const d = this.datos;
    const grava = this.num(d.grava);
    const arena = this.num(d.arena);
    if (Number.isFinite(grava) && Number.isFinite(arena)) {
      d.finos = this.fmt(100 - grava - arena);
    }
    const d10 = this.num(d.d10);
    const d30 = this.num(d.d30);
    const d60 = this.num(d.d60);
    if (d10 > 0 && d60 > 0) {
      d.cu = this.fmt(d60 / d10);
      if (d30 > 0) d.cc = this.fmt((d30 * d30) / (d10 * d60));
    }
    const ll = this.num(d.ll);
    const lp = this.num(d.lp);
    if (Number.isFinite(ll) && Number.isFinite(lp)) {
      d.ip = this.fmt(ll - lp);
    }
  }

  // ------------------------------------------------------------ imágenes

  private valida(file: File): boolean {
    if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
      this.error.set(`"${file.name}" no es JPG ni PNG. Convierte la imagen e inténtalo de nuevo.`);
      return false;
    }
    return true;
  }

  onImagen(ev: Event, campo: CampoImagen): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !this.valida(file)) return;
    this.error.set('');
    const previa = this.imagenes[campo];
    if (previa) URL.revokeObjectURL(previa.url);
    this.imagenes[campo] = { file, url: URL.createObjectURL(file) };
  }

  quitarImagen(campo: CampoImagen): void {
    const previa = this.imagenes[campo];
    if (previa) URL.revokeObjectURL(previa.url);
    this.imagenes[campo] = null;
  }

  onAnexo(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    this.error.set('');
    for (const file of files) {
      if (this.valida(file)) this.anexo.push({ file, url: URL.createObjectURL(file) });
    }
  }

  quitarAnexo(i: number): void {
    URL.revokeObjectURL(this.anexo[i].url);
    this.anexo.splice(i, 1);
  }

  onPanel(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    this.error.set('');
    for (const file of files) {
      if (this.valida(file)) {
        this.panel.push({ file, url: URL.createObjectURL(file), descripcion: 'Se muestra ' });
      }
    }
  }

  quitarPanel(i: number): void {
    URL.revokeObjectURL(this.panel[i].url);
    this.panel.splice(i, 1);
  }

  mover(lista: Img[], i: number, delta: number): void {
    const j = i + delta;
    if (j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }

  // ------------------------------------------------------------ envío

  get faltantes(): string[] {
    const f: string[] = [];
    if (!this.datos.titulo.trim()) f.push('Título del informe');
    if (!this.datos.obra.trim()) f.push('Obra');
    if (!this.datos.nombreProyecto.trim()) f.push('Nombre de la cantera / proyecto');
    return f;
  }

  generar(formato: 'pdf' | 'docx'): void {
    if (this.faltantes.length) {
      this.error.set('Falta completar: ' + this.faltantes.join(', '));
      return;
    }
    const fd = new FormData();
    Object.entries(this.datos).forEach(([k, v]) => fd.append(k, v ?? ''));
    fd.append('formato', formato);

    (Object.keys(this.imagenes) as CampoImagen[]).forEach((k) => {
      const img = this.imagenes[k];
      if (img) fd.append(k, img.file, img.file.name);
    });
    this.anexo.forEach((a) => fd.append('anexo', a.file, a.file.name));
    this.panel.forEach((p) => {
      fd.append('panel', p.file, p.file.name);
      fd.append('panelDescripcion', p.descripcion);
    });

    this.error.set('');
    this.mensaje.set('');
    this.cargando.set(true);

    this.http.post(API, fd, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        this.descargar(blob, `Informe_${this.datos.nombreProyecto || 'afirmado'}.${formato}`);
        this.mensaje.set('Informe generado. Revisa tu carpeta de descargas.');
        this.cargando.set(false);
      },
      error: async (e) => {
        let texto = 'No se pudo generar el informe.';
        if (e.error instanceof Blob) {
          const t = await e.error.text();
          if (t && t.length < 300) texto = t;
        }
        this.error.set(texto);
        this.cargando.set(false);
      },
    });
  }

  private descargar(blob: Blob, nombre: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre.replace(/\s+/g, '_');
    a.click();
    URL.revokeObjectURL(url);
  }
}
