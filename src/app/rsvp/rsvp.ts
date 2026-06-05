import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { collection, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

const GUEST_SHEET_CSV =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSfHAfCK2YsqN_2MhjTE1n7x5YRQJLuhY6ZtyjisadXW30rV_4UmnauPcWEQvzlkG-0_fzUMDJtNYFy/pub?output=csv';

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
  { code: '+34', flag: '🇪🇸', nombre: 'España' },
  { code: '+504', flag: '🇭🇳', nombre: 'Honduras' },
  { code: '+505', flag: '🇳🇮', nombre: 'Nicaragua' },
  { code: '+52', flag: '🇲🇽', nombre: 'México' },
  { code: '+502', flag: '🇬🇹', nombre: 'Guatemala' },
  { code: '+503', flag: '🇸🇻', nombre: 'El Salvador' },
  { code: '+57', flag: '🇨🇴', nombre: 'Colombia' },
  { code: '+1', flag: '🇺🇸', nombre: 'EEUU / Canadá' },
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
      const digitos = (s: string) => s.replace(/\D/g, '');
      const phonesToTry = [digitos(this.prefijo + tel), digitos(tel)];

      const allRows = this.parseGuestCsv(await this.fetchCsv(GUEST_SHEET_CSV));

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

      const chosen = matches.find(m => m.via === 'telefono') ?? matches[0];
      const docId = digitos(chosen.row.telefono);
      const confSnap = await getDoc(doc(collection(db, 'confirmaciones'), docId));

      if (confSnap.exists()) {
        const data = confSnap.data();
        this.confirmacionPrevia = {
          telefono: data['telefono'] ?? chosen.row.telefono,
          nombre: data['nombre'] ?? chosen.row.nombre,
          asistencia: data['asistencia'] === 'si' ? 'si' : 'no',
          invitados: data['invitados'] ?? 1,
        };
        this.invitadoEncontrado = { telefono: chosen.row.telefono, nombre: chosen.row.nombre, invitados: chosen.row.invitados };
        this.asistencia = this.confirmacionPrevia.asistencia;
        this.paso = 'ya-confirmado';
        return;
      }

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
    return res.text();
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

  async confirmar() {
    if (!this.asistencia || !this.invitadoEncontrado || this.enviando) return;
    this.enviando = true;

    const inv = this.invitadoEncontrado;

    try {
      const docId = inv.telefono.replace(/\D/g, '');
      await setDoc(doc(collection(db, 'confirmaciones'), docId), {
        nombre: inv.nombre,
        telefono: inv.telefono,
        invitados: inv.invitados,
        asistencia: this.asistencia,
        timestamp: serverTimestamp(),
      });
      this.paso = 'enviado';
    } catch (e) {
      console.error('[RSVP] Error al guardar respuesta:', e);
      this.errorMsg = 'Error al guardar. Intenta de nuevo.';
    } finally {
      this.enviando = false;
    }
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
