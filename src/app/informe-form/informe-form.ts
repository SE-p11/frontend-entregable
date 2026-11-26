import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { TEXTOS } from './textos-defecto';

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
    // títulos de sección y textos largos (editables). Valores originales de la plantilla.
    ...TEXTOS,
  };

  /** Secciones del informe cuyos títulos y textos se pueden editar. */
  secciones: { nombre: string; titulo: string; bloques: { campo: string; etiqueta: string; filas: number }[] }[] = [
    { nombre: 'Encabezado del informe', titulo: 'encabezado', bloques: [] },
    { nombre: '1. Comentarios', titulo: 'tComentarios', bloques: [
        { campo: 'txtComentarios', etiqueta: 'Texto', filas: 9 } ] },
    { nombre: '2. Ensayos estándares', titulo: 'tEnsayos', bloques: [
        { campo: 'txtEnsayosIntro', etiqueta: 'Texto introductorio', filas: 3 },
        { campo: 'txtEnsayosNormas', etiqueta: 'Lista de normas (una por línea)', filas: 5 } ] },
    { nombre: '2.1 Ubicación', titulo: 'tUbicacion', bloques: [] },
    { nombre: '2.1.1 Granulometría y humedad', titulo: 'tGranulometria', bloques: [
        { campo: 'txtGranulometria', etiqueta: 'Texto de granulometría', filas: 4 },
        { campo: 'txtClasificacion', etiqueta: 'Clasificación de suelos', filas: 6 },
        { campo: 'txtGradacion', etiqueta: 'Gradación de los materiales', filas: 9 },
        { campo: 'txtCurva', etiqueta: 'Curva granulométrica', filas: 5 } ] },
    { nombre: '2.1.2 Límite líquido y plástico', titulo: 'tLimites', bloques: [
        { campo: 'txtLimites', etiqueta: 'Límites de consistencia', filas: 9 },
        { campo: 'txtIndiceGrupo', etiqueta: 'Índice de grupo', filas: 4 } ] },
    { nombre: '2.1.3 Proctor modificado', titulo: 'tProctor', bloques: [
        { campo: 'txtProctor', etiqueta: 'Texto', filas: 10 } ] },
    { nombre: '2.1.4 Manipuleo y colocación', titulo: 'tManipuleo', bloques: [
        { campo: 'txtManipuleo', etiqueta: 'Texto (las viñetas se escriben con "• ")', filas: 16 } ] },
    { nombre: '3. Conclusiones y recomendaciones', titulo: 'tConclusiones', bloques: [
        { campo: 'txtConclusionesIntro', etiqueta: 'Texto antes de las tablas', filas: 6 },
        { campo: 'conclusion', etiqueta: 'Conclusión', filas: 4 },
        { campo: 'recomendacion', etiqueta: 'Recomendación', filas: 4 } ] },
  ];

  tiposProyecto = ['Cantera', 'Casa', 'Puente', 'Carretera', 'Otro'];
  gradaciones = ['A-1', 'A-2', 'C', 'D', 'E', 'F'];

  imagenes: Record<CampoImagen, Img | null> = { portada: null, mapa: null, curva: null };
  anexo: Img[] = [];
  panel: FotoPanel[] = [];

  cargando = signal(false);
  mensaje = signal('');
  error = signal('');

  constructor(private http: HttpClient) {}

  // ------------------------------------------------------------ textos editables

  valor(campo: string): string {
    return (this.datos as Record<string, string>)[campo] ?? '';
  }

  poner(campo: string, v: string): void {
    (this.datos as Record<string, string>)[campo] = v;
  }

  restaurarTextos(): void {
    if (confirm('¿Volver a los textos originales? Se perderán los cambios que hiciste en los textos.')) {
      Object.assign(this.datos, TEXTOS);
    }
  }

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
    // Todos los textos viajan en UN solo campo ("datos"): con tantos campos sueltos más las fotos,
    // el multipart superaba el máximo de partes que acepta Tomcat (50).
    const texto = new URLSearchParams();
    Object.entries(this.datos).forEach(([k, v]) => texto.append(k, v ?? ''));
    texto.append('formato', formato);
    this.panel.forEach((p, i) => texto.append('panelDesc' + i, p.descripcion));

    const fd = new FormData();
    fd.append('datos', texto.toString());

    (Object.keys(this.imagenes) as CampoImagen[]).forEach((k) => {
      const img = this.imagenes[k];
      if (img) fd.append(k, img.file, img.file.name);
    });
    this.anexo.forEach((a) => fd.append('anexo', a.file, a.file.name));
    this.panel.forEach((p) => fd.append('panel', p.file, p.file.name));

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
