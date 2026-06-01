import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

const ACCESS_CODE = 'Garely25';
const SESSION_KEY = 'inv_auth';

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

@Component({
  selector: 'app-invitados',
  imports: [CommonModule, FormsModule],
  templateUrl: './invitados.html',
  styleUrl: './invitados.scss',
})
export class Invitados implements OnInit, OnDestroy {
  autenticado = false;
  codigoInput = '';
  codigoError = false;

  loading = false;
  error = '';
  invitados: InvitadoStatus[] = [];
  ultimaActualizacion: Date | null = null;

  get totalGrupos() {
    return this.invitados.length;
  }
  get totalPersonasMax() {
    return this.invitados.reduce((s, i) => s + i.invitadosPermitidos, 0);
  }
  get personasAsistiran() {
    return this.invitados
      .filter(i => i.asistira === 'si')
      .reduce((s, i) => s + i.invitadosConfirmados, 0);
  }
  get gruposConfirmadosSi() {
    return this.invitados.filter(i => i.asistira === 'si').length;
  }
  get gruposConfirmadosNo() {
    return this.invitados.filter(i => i.asistira === 'no').length;
  }
  get pendientes() {
    return this.invitados.filter(i => i.asistira === 'pendiente').length;
  }

  ngOnInit() {
    document.body.classList.add('invitados-body');
    this.autenticado = sessionStorage.getItem(SESSION_KEY) === '1';
    if (this.autenticado) this.cargar();
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

  ngOnDestroy() {
    document.body.classList.remove('invitados-body');
  }

  async cargar() {
    this.loading = true;
    this.error = '';

    try {
      const [guestCsv, respCsv] = await Promise.all([
        this.fetchCsv(GUEST_SHEET_CSV),
        this.fetchCsv(RESPONSES_SHEET_CSV).catch(() => ''),
      ]);

      const guests = this.parseGuestCsv(guestCsv);
      const responses = respCsv ? this.parseRespCsv(respCsv) : [];

      const digitos = (s: string) => s.replace(/\D/g, '');
      const respMap = new Map(responses.map(r => [digitos(r.telefono), r]));

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
    } catch {
      this.error = 'No se pudieron cargar los datos. Intenta de nuevo.';
    } finally {
      this.loading = false;
    }
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
          telefono: telefono ?? '',
          nombre: nombre ?? '',
          asistencia: asistira?.toLowerCase().startsWith('s') ? 'si' : 'no',
          invitados: inv?.trim() ? parseInt(inv, 10) : 1,
        } as Confirmacion;
      })
      .filter(r => r.telefono);
  }
}
