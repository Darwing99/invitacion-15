import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import ApexCharts from 'apexcharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { supabase } from '../supabase';

const ACCESS_CODE = 'Garely25';
const SESSION_KEY = 'inv_auth';
const CACHE_KEY   = 'inv_data_v2';
const CACHE_TTL_MS = 2 * 60 * 1000;

interface SupabaseGuest {
  id: string;
  nombre: string;
  telefono: string;
  invitados_permitidos: number;
  numeros_extras: string[];
}

interface SupabaseConfirmacion {
  telefono: string;
  asistencia: 'si' | 'no';
  invitados: number;
}

export interface InvitadoStatus {
  id: string;
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

interface FormData {
  nombre: string;
  telefono: string;
  invitadosPermitidos: number;
  numerosExtras: string;
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

  // CRUD modal
  mostrarModal = false;
  modoEdicion = false;
  guardando = false;
  eliminando: string | null = null;
  errorModal = '';
  editandoId: string | null = null;
  formData: FormData = { nombre: '', telefono: '', invitadosPermitidos: 1, numerosExtras: '' };

  private donutChart:  ApexCharts | null = null;
  private radialChart: ApexCharts | null = null;

  // ── Getters ──────────────────────────────────────────────

  get invitadosFiltrados() {
    if (this.filtro === 'todos') return this.invitados;
    return this.invitados.filter(i => i.invitadosPermitidos > 0 && i.asistira === this.filtro);
  }

  get invitadosReales()    { return this.invitados.filter(i => i.invitadosPermitidos > 0); }
  get totalGrupos()        { return this.invitadosReales.length; }
  get totalPersonasMax()   { return this.invitadosReales.reduce((s, i) => s + i.invitadosPermitidos, 0); }
  get personasAsistiran()  {
    return this.invitadosReales.filter(i => i.asistira === 'si').reduce((s, i) => s + i.invitadosPermitidos, 0);
  }
  get gruposConfirmadosSi() { return this.invitadosReales.filter(i => i.asistira === 'si').length; }
  get gruposConfirmadosNo() { return this.invitadosReales.filter(i => i.asistira === 'no').length; }
  get pendientes()          { return this.invitadosReales.filter(i => i.asistira === 'pendiente').length; }
  get pctRespuesta() {
    if (!this.totalGrupos) return 0;
    return Math.round(((this.gruposConfirmadosSi + this.gruposConfirmadosNo) / this.totalGrupos) * 100);
  }

  // ── Lifecycle ─────────────────────────────────────────────

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

  // ── Auth ──────────────────────────────────────────────────

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

  // ── Load ──────────────────────────────────────────────────

  async cargar() {
    this.actualizando = true;
    const cache = this.leerCache();

    if (cache) {
      if (!this.invitados.length) {
        this.invitados = cache.invitados;
        this.ultimaActualizacion = new Date(cache.timestamp);
        this.renderCharts();
      }
      // Si el cache es reciente, no re-fetches
      if (Date.now() - cache.timestamp < CACHE_TTL_MS) {
        this.loading = false;
        this.actualizando = false;
        return;
      }
    } else if (!this.invitados.length) {
      this.loading = true;
    }

    await this.fetchDesdeSupabase();
    this.loading = false;
    this.actualizando = false;
    this.renderCharts();
  }

  private async fetchDesdeSupabase() {
    try {
      const digitos = (s: string) => s.replace(/\D/g, '');

      const [guestsRes, confsRes] = await Promise.all([
        supabase.from('invitados').select('id, nombre, telefono, invitados_permitidos, numeros_extras').order('nombre'),
        supabase.from('confirmaciones').select('telefono, asistencia, invitados'),
      ]);

      if (guestsRes.error) throw guestsRes.error;
      if (confsRes.error) throw confsRes.error;

      const guests = (guestsRes.data ?? []) as SupabaseGuest[];
      const confs  = (confsRes.data ?? []) as SupabaseConfirmacion[];

      const confMap = new Map<string, SupabaseConfirmacion>();
      for (const c of confs) confMap.set(digitos(c.telefono), c);

      this.invitados = guests.map(g => {
        const conf = confMap.get(digitos(g.telefono));
        return {
          id:                   g.id,
          nombre:               g.nombre,
          telefono:             g.telefono,
          invitadosPermitidos:  g.invitados_permitidos,
          asistira:             conf ? conf.asistencia : 'pendiente',
          invitadosConfirmados: conf ? conf.invitados  : 0,
        };
      });

      this.ultimaActualizacion = new Date();
      this.guardarCache();
      this.error = '';
    } catch (e: any) {
      console.error('[Invitados] Error Supabase:', e);
      if (!this.invitados.length) {
        this.error = 'No se pudieron cargar los datos. Intenta de nuevo.';
      }
    }
  }

  // ── CRUD ──────────────────────────────────────────────────

  abrirAgregar() {
    this.modoEdicion = false;
    this.editandoId = null;
    this.formData = { nombre: '', telefono: '', invitadosPermitidos: 1, numerosExtras: '' };
    this.errorModal = '';
    this.mostrarModal = true;
  }

  abrirEditar(inv: InvitadoStatus) {
    this.modoEdicion = true;
    this.editandoId = inv.id;
    this.formData = {
      nombre:               inv.nombre,
      telefono:             inv.telefono,
      invitadosPermitidos:  inv.invitadosPermitidos,
      numerosExtras:        '',
    };
    this.errorModal = '';
    this.mostrarModal = true;
  }

  cerrarModal() {
    this.mostrarModal = false;
  }

  async guardarInvitado() {
    const { nombre, telefono, invitadosPermitidos, numerosExtras } = this.formData;
    if (!nombre.trim() || !telefono.trim()) {
      this.errorModal = 'Nombre y teléfono son requeridos.';
      return;
    }
    this.guardando = true;
    this.errorModal = '';

    try {
      const extras = numerosExtras.split(',').map(s => s.trim()).filter(Boolean);
      const payload = {
        nombre:               nombre.trim(),
        telefono:             telefono.trim(),
        invitados_permitidos: invitadosPermitidos,
        numeros_extras:       extras,
      };

      if (this.modoEdicion && this.editandoId) {
        const { error } = await supabase.from('invitados').update(payload).eq('id', this.editandoId);
        if (error) throw error;

        const idx = this.invitados.findIndex(i => i.id === this.editandoId);
        if (idx !== -1) {
          this.invitados[idx] = {
            ...this.invitados[idx],
            nombre:              payload.nombre,
            telefono:            payload.telefono,
            invitadosPermitidos: payload.invitados_permitidos,
          };
        }
      } else {
        const { data, error } = await supabase.from('invitados').insert(payload).select('id').single();
        if (error) throw error;

        this.invitados.push({
          id:                  data['id'],
          nombre:              payload.nombre,
          telefono:            payload.telefono,
          invitadosPermitidos: payload.invitados_permitidos,
          asistira:            'pendiente',
          invitadosConfirmados: 0,
        });
        this.invitados.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      }

      this.guardarCache();
      this.renderCharts();
      this.cerrarModal();
    } catch (e: any) {
      this.errorModal = e.message ?? 'Error al guardar.';
    } finally {
      this.guardando = false;
    }
  }

  async eliminarInvitado(inv: InvitadoStatus) {
    if (!confirm(`¿Eliminar a ${inv.nombre}?`)) return;
    this.eliminando = inv.id;
    try {
      const { error } = await supabase.from('invitados').delete().eq('id', inv.id);
      if (error) throw error;

      this.invitados = this.invitados.filter(i => i.id !== inv.id);
      this.guardarCache();
      this.renderCharts();
    } catch (e: any) {
      this.error = e.message ?? 'Error al eliminar.';
    } finally {
      this.eliminando = null;
    }
  }

  // ── Exports ───────────────────────────────────────────────

  setFiltro(f: typeof this.filtro) { this.filtro = f; }

  imprimir() {
    if (this.generandoPdf) return;
    this.generandoPdf = true;
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const fecha = new Date().toLocaleDateString('es-ES');
      pdf.setFontSize(16);
      pdf.text('Lista de Invitados — Quinceaños Ivana', 105, 14, { align: 'center' });
      pdf.setFontSize(9);
      pdf.text(fecha, 105, 20, { align: 'center' });
      autoTable(pdf, {
        startY: 26,
        head: [['Nombre', 'Telefono', 'Permitidos', 'Asistira', 'Confirmados']],
        body: this.invitados.map(i => [
          i.nombre, i.telefono, i.invitadosPermitidos,
          i.asistira === 'si' ? 'Si' : i.asistira === 'no' ? 'No' : 'Pendiente',
          i.invitadosConfirmados,
        ]),
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [192, 80, 112] },
        alternateRowStyles: { fillColor: [255, 245, 248] },
      });
      pdf.save(`invitados-ivana-${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      this.generandoPdf = false;
    }
  }

  exportarXlsx() {
    const filas = this.invitados.map(i => ({
      'Nombre':               i.nombre,
      'Teléfono':             i.telefono,
      'Invitados permitidos': i.invitadosPermitidos,
      'Asistirá':             i.asistira === 'si' ? 'Sí' : i.asistira === 'no' ? 'No' : 'Pendiente',
      'Personas confirmadas': i.invitadosConfirmados,
    }));
    const hoja  = XLSX.utils.json_to_sheet(filas);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Invitados');
    XLSX.writeFile(libro, `invitados-ivana-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  // ── Charts ────────────────────────────────────────────────

  private renderCharts() {
    setTimeout(() => { this.renderDonut(); this.renderRadial(); }, 50);
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
      plotOptions: { pie: { donut: { size: '65%', labels: { show: true, total: {
        show: true, label: 'Familias', fontFamily: 'Cormorant Garamond, serif',
        fontSize: '12px', color: '#9e9e9e', formatter: () => String(this.totalGrupos),
      }}}}},
      stroke: { width: 2, colors: ['#fff8fa'] },
      theme: { mode: 'light' },
    };
    if (this.donutChart) { this.donutChart.updateOptions(opts, true, true); }
    else { this.donutChart = new ApexCharts(this.donutEl.nativeElement, opts); this.donutChart.render(); }
  }

  private renderRadial() {
    if (!this.radialEl?.nativeElement) return;
    const pctCapacidad = this.totalPersonasMax
      ? Math.round((this.personasAsistiran / this.totalPersonasMax) * 100) : 0;
    const opts: ApexCharts.ApexOptions = {
      chart: { type: 'radialBar', height: 260, background: 'transparent', toolbar: { show: false } },
      series: [this.pctRespuesta, pctCapacidad],
      labels: ['Respondieron', 'Capacidad'],
      colors: ['#c05070', '#9575cd'],
      plotOptions: { radialBar: { hollow: { size: '30%' }, dataLabels: {
        name:  { fontFamily: 'Cormorant Garamond, serif', fontSize: '12px' },
        value: { fontFamily: 'Cormorant Garamond, serif', fontSize: '18px', fontWeight: '700',
                 formatter: (v: number) => v + '%' },
        total: { show: true, label: 'Asistirán', fontFamily: 'Cormorant Garamond, serif',
                 fontSize: '12px', color: '#9e9e9e',
                 formatter: () => this.personasAsistiran + ' personas' },
      }}},
      legend: { show: true, position: 'bottom', fontFamily: 'Cormorant Garamond, serif', fontSize: '13px' },
      theme: { mode: 'light' },
    };
    if (this.radialChart) { this.radialChart.updateOptions(opts, true, true); }
    else { this.radialChart = new ApexCharts(this.radialEl.nativeElement, opts); this.radialChart.render(); }
  }

  // ── Cache ─────────────────────────────────────────────────

  private leerCache(): Cache | null {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) as Cache : null;
    } catch { return null; }
  }

  private guardarCache() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ invitados: this.invitados, timestamp: Date.now() }));
    } catch {}
  }
}
