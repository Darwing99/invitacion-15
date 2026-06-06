import { Component, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import ApexCharts from 'apexcharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { db } from '../firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';

const ACCESS_CODE = 'Garely25';
const SESSION_KEY = 'inv_auth';

interface FirestoreGuest {
  id: string;
  nombre: string;
  telefono: string;
  invitadosPermitidos: number;
  numerosExtras?: string[];
}

interface FirestoreConfirmacion {
  telefono: string;
  asistencia: 'si' | 'no';
  invitados: number;
}

export interface InvitadoStatus {
  id: string;
  nombre: string;
  telefono: string;
  invitadosPermitidos: number;
  numerosExtras: string[];
  asistira: 'si' | 'no' | 'pendiente';
  invitadosConfirmados: number;
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
  private cdr = inject(ChangeDetectorRef);

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
    if (!this.invitados.length) this.loading = true;

    await this.fetchDesdeFirebase();
    this.loading = false;
    this.actualizando = false;
    this.cdr.detectChanges();
    this.renderCharts();
  }

  private async fetchDesdeFirebase() {
    try {
      const digitos = (s: string) => s.replace(/\D/g, '');

      const [guestsSnap, confsSnap] = await Promise.all([
        getDocs(query(collection(db, 'invitados'), orderBy('nombre'))),
        getDocs(collection(db, 'confirmaciones')),
      ]);

      const guests = guestsSnap.docs.map(d => ({ id: d.id, ...d.data() } as FirestoreGuest));
      const confs  = confsSnap.docs.map(d => d.data() as FirestoreConfirmacion);

      const confMap = new Map<string, FirestoreConfirmacion>();
      for (const c of confs) confMap.set(digitos(c.telefono), c);

      this.invitados = guests.map(g => {
        const conf = confMap.get(digitos(g.telefono));
        return {
          id:                   g.id,
          nombre:               g.nombre,
          telefono:             g.telefono,
          invitadosPermitidos:  g.invitadosPermitidos ?? 0,
          numerosExtras:        g.numerosExtras ?? [],
          asistira:             conf ? conf.asistencia : 'pendiente',
          invitadosConfirmados: conf ? conf.invitados  : 0,
        };
      });

      this.ultimaActualizacion = new Date();
      this.error = '';
    } catch (e: any) {
      console.error('[Invitados] Error Firebase:', e);
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
      numerosExtras:        inv.numerosExtras.join(', '),
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
        nombre:              nombre.trim(),
        telefono:            telefono.trim(),
        invitadosPermitidos: invitadosPermitidos,
        numerosExtras:       extras,
      };

      if (this.modoEdicion && this.editandoId) {
        await updateDoc(doc(db, 'invitados', this.editandoId), payload);
      } else {
        await addDoc(collection(db, 'invitados'), payload);
      }

      await this.fetchDesdeFirebase();
      this.cerrarModal();
      this.cdr.detectChanges();
      this.renderCharts();
    } catch (e: any) {
      this.errorModal = e.message ?? 'Error al guardar.';
    } finally {
      this.guardando = false;
      this.cdr.detectChanges();
    }
  }

  async eliminarInvitado(inv: InvitadoStatus) {
    if (!confirm(`¿Eliminar a ${inv.nombre}?`)) return;
    this.eliminando = inv.id;
    try {
      await deleteDoc(doc(db, 'invitados', inv.id));

      await this.fetchDesdeFirebase();
      this.cdr.detectChanges();
      this.renderCharts();
    } catch (e: any) {
      this.error = e.message ?? 'Error al eliminar.';
    } finally {
      this.eliminando = null;
      this.cdr.detectChanges();
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

}
