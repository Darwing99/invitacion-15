import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { collection, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import ApexCharts from 'apexcharts';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { db } from '../firebase';

const ACCESS_CODE = 'Garely25';
const SESSION_KEY = 'inv_auth';
const CACHE_KEY   = 'inv_data_v1';

const GUEST_SHEET_CSV =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSfHAfCK2YsqN_2MhjTE1n7x5YRQJLuhY6ZtyjisadXW30rV_4UmnauPcWEQvzlkG-0_fzUMDJtNYFy/pub?output=csv';

const RESPONSES_SHEET_CSV =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ0xwrqpz1POpk9ykVPvjiv_IasuP-8AxHo70brbCzFlZoDb876LBH60xAkjl0iNlAbh4WF6J3CnGVh/pub?gid=1486628533&single=true&output=csv';

interface GuestRow {
  nombre: string;
  telefono: string;
  invitadosPermitidos: number;
}

interface Confirmacion {
  telefono: string;
  nombre: string;
  asistencia: 'si' | 'no';
  invitados: number;
}

export interface InvitadoStatus {
  nombre: string;
  telefono: string;
  invitadosPermitidos: number;
  asistira: 'si' | 'no' | 'pendiente';
  invitadosConfirmados: number;
}

interface Cache {
  invitados: InvitadoStatus[];
  timestamp: number;
}

@Component({
  selector: 'app-invitados',
  imports: [CommonModule, FormsModule],
  templateUrl: './invitados.html',
  styleUrl: './invitados.scss',
})
export class Invitados implements OnInit, OnDestroy {
  @ViewChild('donutEl')  donutEl!:  ElementRef;
  @ViewChild('radialEl') radialEl!: ElementRef;

  autenticado = false;
  codigoInput = '';
  codigoError = false;

  loading = false;
  actualizando = false;
  generandoPdf = false;
  error = '';
  invitados: InvitadoStatus[] = [];
  ultimaActualizacion: Date | null = null;
  filtro: 'todos' | 'si' | 'no' | 'pendiente' = 'todos';

  // Valores animados para los contadores
  displayGrupos      = 0;
  displayPersonasMax = 0;
  displayAsistiran   = 0;
  displayNo          = 0;
  displayPendientes  = 0;

  get invitadosFiltrados() {
    if (this.filtro === 'todos') return this.invitados;
    // Los anfitriones (invitadosPermitidos === 0) solo aparecen en "Todos"
    return this.invitados.filter(i => i.invitadosPermitidos > 0 && i.asistira === this.filtro);
  }

  setFiltro(f: typeof this.filtro) {
    this.filtro = f;
  }

  async imprimir() {
    if (this.generandoPdf) return;
    this.generandoPdf = true;

    // Ocultar elementos que no van en el PDF
    const ocultar = document.querySelectorAll<HTMLElement>('.inv-actions, .inv-filters');
    ocultar.forEach(el => el.style.display = 'none');

    // Ampliar el body para captura completa
    const bodyPrev = document.body.style.maxWidth;
    document.body.style.maxWidth = 'none';

    const pagina = document.querySelector<HTMLElement>('.inv-page')!;

    try {
      const canvas = await html2canvas(pagina, {
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: 1100,
        backgroundColor: '#fff8fa',
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf     = new jsPDF('p', 'mm', 'a4');
      const pdfW    = pdf.internal.pageSize.getWidth();
      const pdfH    = pdf.internal.pageSize.getHeight();
      const imgH    = (canvas.height * pdfW) / canvas.width;

      let offset = 0;
      let remaining = imgH;

      while (remaining > 0) {
        if (offset > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, -offset, pdfW, imgH);
        offset    += pdfH;
        remaining -= pdfH;
      }

      pdf.save('invitados-ivana-2026.pdf');
    } finally {
      ocultar.forEach(el => el.style.display = '');
      document.body.style.maxWidth = bodyPrev;
      this.generandoPdf = false;
    }
  }

  private donutChart:  ApexCharts | null = null;
  private radialChart: ApexCharts | null = null;

  // Solo invitados reales (excluye anfitriones con invitadosPermitidos === 0)
  get invitadosReales()   { return this.invitados.filter(i => i.invitadosPermitidos > 0); }

  get totalGrupos()       { return this.invitadosReales.length; }
  get totalPersonasMax()  { return this.invitadosReales.reduce((s, i) => s + i.invitadosPermitidos, 0); }
  get personasAsistiran() {
    return this.invitadosReales.filter(i => i.asistira === 'si').reduce((s, i) => s + i.invitadosConfirmados, 0);
  }
  get gruposConfirmadosSi() { return this.invitadosReales.filter(i => i.asistira === 'si').length; }
  get gruposConfirmadosNo() { return this.invitadosReales.filter(i => i.asistira === 'no').length; }
  get pendientes()          { return this.invitadosReales.filter(i => i.asistira === 'pendiente').length; }
  get pctRespuesta() {
    if (!this.totalGrupos) return 0;
    return Math.round(((this.gruposConfirmadosSi + this.gruposConfirmadosNo) / this.totalGrupos) * 100);
  }

  ngOnInit() {
    document.body.classList.add('invitados-body');
    this.autenticado = sessionStorage.getItem(SESSION_KEY) === '1';
    if (this.autenticado) this.cargar();
  }

  ngOnDestroy() {
    document.body.classList.remove('invitados-body');
    this.donutChart?.destroy();
    this.radialChart?.destroy();
  }

  verificarCodigo() {
    if (this.codigoInput === ACCESS_CODE) {
      sessionStorage.setItem(SESSION_KEY, '1');
      this.autenticado = true;
      this.codigoError = false;
      this.cargar();
    } else {
      this.codigoError = true;
      this.codigoInput = '';
    }
  }

  async cargar() {
    const cache = this.leerCache();
    if (cache) {
      this.invitados = cache.invitados;
      this.ultimaActualizacion = new Date(cache.timestamp);
      this.renderCharts();
      this.refrescarSilencioso();
    } else {
      this.loading = true;
      await this.fetchYProcesar();
      this.loading = false;
    }
  }

  private async refrescarSilencioso() {
    this.actualizando = true;
    await this.fetchYProcesar();
    this.actualizando = false;
  }

  private async fetchYProcesar() {
    try {
      const digitos = (s: string) => s.replace(/\D/g, '');

      const [guestCsv, firestoreConf, respCsv] = await Promise.all([
        this.fetchCsv(GUEST_SHEET_CSV),
        this.fetchFirestore(),
        this.fetchCsv(RESPONSES_SHEET_CSV).catch(() => ''),
      ]);

      const guests  = this.parseGuestCsv(guestCsv);
      const csvConf = respCsv ? this.parseRespCsv(respCsv) : [];

      const firestorePhones = new Set(firestoreConf.map(r => digitos(r.telefono)));
      const soloEnCsv = csvConf.filter(r => !firestorePhones.has(digitos(r.telefono)));
      if (soloEnCsv.length > 0) this.migrarAFirestore(soloEnCsv);

      const respMap = new Map<string, Confirmacion>();
      for (const r of [...csvConf, ...firestoreConf]) {
        respMap.set(digitos(r.telefono), r);
      }

      this.invitados = guests.map(g => {
        const resp = respMap.get(digitos(g.telefono));
        return {
          nombre: g.nombre,
          telefono: g.telefono,
          invitadosPermitidos: g.invitadosPermitidos,
          asistira: resp ? resp.asistencia : 'pendiente',
          invitadosConfirmados: resp ? resp.invitados : 0,
        };
      });

      this.ultimaActualizacion = new Date();
      this.guardarCache();
      this.error = '';
      this.renderCharts();
      this.animateNumbers();
    } catch {
      if (!this.invitados.length) {
        this.error = 'No se pudieron cargar los datos. Intenta de nuevo.';
      }
    }
  }

  private renderCharts() {
    setTimeout(() => {
      this.renderDonut();
      this.renderRadial();
    }, 50);
  }

  private animateNumbers() {
    this.countUp(v => this.displayGrupos      = v, this.totalGrupos);
    this.countUp(v => this.displayPersonasMax = v, this.totalPersonasMax);
    this.countUp(v => this.displayAsistiran   = v, this.personasAsistiran);
    this.countUp(v => this.displayNo          = v, this.gruposConfirmadosNo);
    this.countUp(v => this.displayPendientes  = v, this.pendientes);
  }

  private countUp(setter: (v: number) => void, target: number, duration = 900) {
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setter(Math.round(target * eased));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  private renderDonut() {
    if (!this.donutEl?.nativeElement) return;

    const opts: ApexCharts.ApexOptions = {
      chart: { type: 'donut', height: 260, background: 'transparent', toolbar: { show: false } },
      series: [this.gruposConfirmadosSi, this.gruposConfirmadosNo, this.pendientes],
      labels: ['Asistirán', 'No asistirán', 'Pendientes'],
      colors: ['#66bb6a', '#ef5350', '#b0bec5'],
      legend: { position: 'bottom', fontFamily: 'Cormorant Garamond, serif', fontSize: '13px' },
      dataLabels: { style: { fontFamily: 'Cormorant Garamond, serif', fontSize: '13px' } },
      plotOptions: { pie: { donut: { size: '65%', labels: {
        show: true,
        total: {
          show: true,
          label: 'Familias',
          fontFamily: 'Cormorant Garamond, serif',
          fontSize: '12px',
          color: '#9e9e9e',
          formatter: () => String(this.totalGrupos),
        },
      }}}},
      stroke: { width: 2, colors: ['#fff8fa'] },
      theme: { mode: 'light' },
    };

    if (this.donutChart) {
      this.donutChart.updateOptions(opts, true, true);
    } else {
      this.donutChart = new ApexCharts(this.donutEl.nativeElement, opts);
      this.donutChart.render();
    }
  }

  private renderRadial() {
    if (!this.radialEl?.nativeElement) return;

    const pctCapacidad = this.totalPersonasMax
      ? Math.round((this.personasAsistiran / this.totalPersonasMax) * 100)
      : 0;

    const opts: ApexCharts.ApexOptions = {
      chart: { type: 'radialBar', height: 260, background: 'transparent', toolbar: { show: false } },
      series: [this.pctRespuesta, pctCapacidad],
      labels: ['Respondieron', 'Capacidad'],
      colors: ['#c05070', '#9575cd'],
      plotOptions: { radialBar: {
        hollow: { size: '30%' },
        dataLabels: {
          name:  { fontFamily: 'Cormorant Garamond, serif', fontSize: '12px' },
          value: { fontFamily: 'Cormorant Garamond, serif', fontSize: '18px', fontWeight: '700',
                   formatter: (v: number) => v + '%' },
          total: {
            show: true,
            label: 'Asistirán',
            fontFamily: 'Cormorant Garamond, serif',
            fontSize: '12px',
            color: '#9e9e9e',
            formatter: () => this.personasAsistiran + ' personas',
          },
        },
      }},
      legend: { show: true, position: 'bottom', fontFamily: 'Cormorant Garamond, serif', fontSize: '13px' },
      theme: { mode: 'light' },
    };

    if (this.radialChart) {
      this.radialChart.updateOptions(opts, true, true);
    } else {
      this.radialChart = new ApexCharts(this.radialEl.nativeElement, opts);
      this.radialChart.render();
    }
  }

  private async fetchFirestore(): Promise<Confirmacion[]> {
    const snap = await getDocs(collection(db, 'confirmaciones'));
    return snap.docs.map(d => {
      const data = d.data();
      return {
        telefono:   data['telefono']   ?? '',
        nombre:     data['nombre']     ?? '',
        asistencia: data['asistencia'] === 'si' ? 'si' : 'no',
        invitados:  data['invitados']  ?? 1,
      };
    });
  }

  private async migrarAFirestore(confirmaciones: Confirmacion[]) {
    for (const conf of confirmaciones) {
      try {
        const docId = conf.telefono.replace(/\D/g, '');
        await setDoc(doc(collection(db, 'confirmaciones'), docId), {
          nombre:     conf.nombre,
          telefono:   conf.telefono,
          invitados:  conf.invitados,
          asistencia: conf.asistencia,
          timestamp:  serverTimestamp(),
          migrado:    true,
        });
      } catch (e) {
        console.error('[Invitados] Error al migrar:', e);
      }
    }
  }

  private leerCache(): Cache | null {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as Cache;
    } catch {
      return null;
    }
  }

  private guardarCache() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        invitados: this.invitados,
        timestamp: Date.now(),
      }));
    } catch {}
  }

  private async fetchCsv(url: string): Promise<string> {
    const res = await fetch(url);
    return res.text();
  }

  private parseGuestCsv(csv: string): GuestRow[] {
    const lines = csv.trim().split(/\r?\n/).slice(1);
    return lines
      .filter(l => l.trim())
      .map(line => {
        const cols =
          line.match(/(".*?"|[^,]+)/g)?.map(c =>
            c.trim().replace(/^"|"$/g, '').trim()
          ) ?? [];
        return {
          telefono: cols[0] ?? '',
          nombre: cols[1] ?? '',
          invitadosPermitidos: cols[2]?.trim() ? parseInt(cols[2], 10) : 1,
        };
      })
      .filter(g => g.telefono);
  }

  private parseRespCsv(csv: string): Confirmacion[] {
    const lines = csv.trim().split(/\r?\n/).slice(1);
    return lines
      .filter(l => l.trim())
      .map(line => {
        const cols =
          line.match(/(".*?"|[^,]+)/g)?.map(c =>
            c.trim().replace(/^"|"$/g, '').trim()
          ) ?? [];
        const [, nombre, telefono, inv, asistira] = cols;
        return {
          telefono:   telefono ?? '',
          nombre:     nombre ?? '',
          asistencia: asistira?.toLowerCase().startsWith('s') ? 'si' : 'no',
          invitados:  inv?.trim() ? parseInt(inv, 10) : 1,
        } as Confirmacion;
      })
      .filter(r => r.telefono);
  }
}
