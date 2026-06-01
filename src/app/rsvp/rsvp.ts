import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

const GUEST_SHEET_CSV =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSfHAfCK2YsqN_2MhjTE1n7x5YRQJLuhY6ZtyjisadXW30rV_4UmnauPcWEQvzlkG-0_fzUMDJtNYFy/pub?output=csv';

const RESPONSES_SHEET_CSV =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ0xwrqpz1POpk9ykVPvjiv_IasuP-8AxHo70brbCzFlZoDb876LBH60xAkjl0iNlAbh4WF6J3CnGVh/pub?gid=1486628533&single=true&output=csv';

const FORM_ACTION =
  'https://docs.google.com/forms/d/e/1FAIpQLScChIrVd4Y9kdkp1GOMyz0pooNyGbWbK325Fr4Qo7n2y4sYUw/formResponse';
const ENTRY_NOMBRE     = 'entry.811125265';
const ENTRY_TELEFONO   = 'entry.331834702';
const ENTRY_INVITADOS  = 'entry.1683183553';
const ENTRY_ASISTENCIA = 'entry.1011577744';
// ──────────────────────────────────────────────────────────────────────────────

export interface Invitado {
  telefono: string;
  nombre: string;
  invitados: number;
}

interface GuestRow {
  telefono: string;
  nombre: string;
  invitados: number;
  numerosExtras: string[];
}

export const PREFIJOS = [
  { code: '+34',  flag: '🇪🇸', nombre: 'España' },
  { code: '+504', flag: '🇭🇳', nombre: 'Honduras' },
  { code: '+505', flag: '🇳🇮', nombre: 'Nicaragua' },
  { code: '+52',  flag: '🇲🇽', nombre: 'México' },
  { code: '+502', flag: '🇬🇹', nombre: 'Guatemala' },
  { code: '+503', flag: '🇸🇻', nombre: 'El Salvador' },
  { code: '+57',  flag: '🇨🇴', nombre: 'Colombia' },
  { code: '+1',   flag: '🇺🇸', nombre: 'EEUU / Canadá' },
];

interface Confirmacion {
  telefono: string;
  nombre: string;
  asistencia: 'si' | 'no';
  invitados: number;
}

type Paso = 'buscar' | 'confirmar' | 'enviado' | 'ya-confirmado' | 'no-encontrado';

@Component({
  selector: 'app-rsvp',
  imports: [CommonModule, FormsModule],
  templateUrl: './rsvp.html',
  styleUrl: './rsvp.scss',
})
export class Rsvp {
  private router = inject(Router);

  paso: Paso = 'buscar';
  prefijos = PREFIJOS;
  prefijo = PREFIJOS[0].code;   // +34 España por defecto
  telefono = '';
  asistencia: 'si' | 'no' | '' = '';
  invitadoEncontrado: Invitado | null = null;
  confirmacionPrevia: Confirmacion | null = null;
  buscando = false;
  enviando = false;
  errorMsg = '';

  async buscar() {
    const tel = this.telefono.trim();
    if (!tel) return;
    this.buscando = true;
    this.errorMsg = '';

    try {
      const [guestCsv, respCsv] = await Promise.all([
        this.fetchCsv(GUEST_SHEET_CSV),
        this.fetchCsv(RESPONSES_SHEET_CSV).catch(() => ''),
      ]);

      const allRows = this.parseGuestCsv(guestCsv);
      const digitos = (s: string) => s.replace(/\D/g, '');
      const phonesToTry = [digitos(this.prefijo + tel), digitos(tel)];

      const matches: Array<{ row: GuestRow; via: 'telefono' | 'extras' }> = [];
      for (const row of allRows) {
        const rowTel = digitos(row.telefono);
        if (phonesToTry.includes(rowTel)) {
          matches.push({ row, via: 'telefono' });
          continue;
        }
        for (const extra of row.numerosExtras) {
          if (phonesToTry.includes(digitos(extra))) {
            matches.push({ row, via: 'extras' });
            break;
          }
        }
      }

      if (matches.length === 0) {
        this.paso = 'no-encontrado';
        return;
      }

      const respuestas = respCsv ? this.parseRespuestasCsvAll(respCsv) : [];
      const confirmedPhones = new Set(respuestas.map(r => digitos(r.telefono)));
      const available = matches.filter(m => !confirmedPhones.has(digitos(m.row.telefono)));

      if (available.length === 0) {
        const resp = respuestas.find(r => digitos(r.telefono) === digitos(matches[0].row.telefono));
        if (resp) {
          this.confirmacionPrevia = resp;
          this.invitadoEncontrado = { telefono: resp.telefono, nombre: resp.nombre, invitados: resp.invitados };
          this.asistencia = resp.asistencia;
          this.paso = 'ya-confirmado';
        }
        return;
      }

      const chosen = available.find(m => m.via === 'telefono') ?? available[0];

      if (chosen.row.invitados === 0) {
        sessionStorage.setItem('inv_auth', '1');
        this.router.navigate(['/invitados']);
        return;
      }

      this.invitadoEncontrado = { telefono: chosen.row.telefono, nombre: chosen.row.nombre, invitados: chosen.row.invitados };
      this.paso = 'confirmar';
    } catch (e) {
      console.error('[RSVP] Error al buscar invitado:', e);
      this.errorMsg = 'Error de conexión. Intenta de nuevo.';
    } finally {
      this.buscando = false;
    }
  }

  private async fetchCsv(url: string): Promise<string> {
    const res = await fetch(url);
    return await res.text();
  }

  private parseGuestCsv(csv: string): GuestRow[] {
    const lines = csv.trim().split(/\r?\n/).slice(1);
    const rows: GuestRow[] = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      const cols = line.match(/(".*?"|[^,]+)/g)
        ?.map(c => c.trim().replace(/^"|"$/g, '').trim()) ?? [];
      const [telCol, nombre, inv, ...rest] = cols;
      const extras = rest.flatMap(s => s.split(',')).map(s => s.trim()).filter(Boolean);
      rows.push({
        telefono: telCol ?? '',
        nombre: nombre ?? '',
        invitados: inv?.trim() ? parseInt(inv, 10) : 1,
        numerosExtras: extras,
      });
    }
    return rows;
  }

  private parseRespuestasCsvAll(csv: string): Confirmacion[] {
    const lines = csv.trim().split(/\r?\n/).slice(1);
    const respuestas: Confirmacion[] = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      const cols = line.match(/(".*?"|[^,]+)/g)
        ?.map(c => c.trim().replace(/^"|"$/g, '').trim()) ?? [];
      const [, nombre, telCol, inv, asistira] = cols;
      if (telCol) {
        respuestas.push({
          telefono: telCol,
          nombre: nombre ?? '',
          asistencia: asistira?.toLowerCase().startsWith('s') ? 'si' : 'no',
          invitados: inv?.trim() ? parseInt(inv, 10) : 1,
        });
      }
    }
    return respuestas;
  }

  async confirmar() {
    if (!this.asistencia || !this.invitadoEncontrado || this.enviando) return;
    this.enviando = true;

    const inv = this.invitadoEncontrado;

    // Google Form (sin verificación posible por no-cors)
    const body = new FormData();
    body.append(ENTRY_NOMBRE,     inv.nombre);
    body.append(ENTRY_TELEFONO,   inv.telefono);
    body.append(ENTRY_INVITADOS,  String(inv.invitados));
    body.append(ENTRY_ASISTENCIA, this.asistencia === 'si' ? 'Si' : 'No');
    fetch(FORM_ACTION, { method: 'POST', mode: 'no-cors', body }).catch(() => {});

    // Firestore (verificado — si falla, seguimos de todas formas)
    try {
      const docId = inv.telefono.replace(/\D/g, '');
      await setDoc(doc(collection(db, 'confirmaciones'), docId), {
        nombre:     inv.nombre,
        telefono:   inv.telefono,
        invitados:  inv.invitados,
        asistencia: this.asistencia,
        timestamp:  serverTimestamp(),
      });
    } catch (e) {
      console.error('[RSVP] Error al guardar en Firestore:', e);
    }

    this.enviando = false;
    this.paso = 'enviado';
  }

  reintentar() {
    this.paso = 'buscar';
    this.telefono = '';
    this.asistencia = '';
    this.invitadoEncontrado = null;
    this.confirmacionPrevia = null;
    this.errorMsg = '';
  }
}
