import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

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

const STORAGE_KEY = 'rsvp_confirmados';

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

    // 1. comprobar si ya confirmó antes (localStorage)
    const previa = this.leerConfirmacion(tel) ?? this.leerConfirmacion(this.prefijo + tel);
    if (previa) {
      this.confirmacionPrevia = previa;
      this.invitadoEncontrado = { telefono: previa.telefono, nombre: previa.nombre, invitados: previa.invitados };
      this.asistencia = previa.asistencia;
      this.paso = 'ya-confirmado';
      this.buscando = false;
      return;
    }

    try {
      // 2. comprobar hoja de respuestas del formulario
      let respuesta: Confirmacion | null = null;
      try {
        respuesta = await this.fetchRespuesta(this.prefijo + tel)
                 ?? await this.fetchRespuesta(tel);
      } catch (e) {
        console.warn('[RSVP] No se pudo consultar hoja de respuestas:', e);
      }
      if (respuesta) {
        this.guardarConfirmacion(respuesta);
        this.confirmacionPrevia = respuesta;
        this.invitadoEncontrado = { telefono: respuesta.telefono, nombre: respuesta.nombre, invitados: respuesta.invitados };
        this.asistencia = respuesta.asistencia;
        this.paso = 'ya-confirmado';
        return;
      }

      // 3. buscar con prefijo; si no, sin prefijo (por si la hoja no tiene prefijo)
      const invitado = await this.fetchInvitado(this.prefijo + tel)
                    ?? await this.fetchInvitado(tel);
      if (invitado) {
        this.invitadoEncontrado = invitado;
        this.paso = 'confirmar';
      } else {
        this.paso = 'no-encontrado';
      }
    } catch (e) {
      console.error('[RSVP] Error al buscar invitado:', e);
      this.errorMsg = 'Error de conexión. Intenta de nuevo.';
    } finally {
      this.buscando = false;
    }
  }

  private leerConfirmacion(tel: string): Confirmacion | null {
    try {
      const digitos = (s: string) => s.replace(/\D/g, '');
      const mapa: Record<string, Confirmacion> = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
      return mapa[digitos(tel)] ?? null;
    } catch { return null; }
  }

  private guardarConfirmacion(conf: Confirmacion) {
    try {
      const digitos = (s: string) => s.replace(/\D/g, '');
      const mapa: Record<string, Confirmacion> = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
      mapa[digitos(conf.telefono)] = conf;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mapa));
    } catch { /* localStorage no disponible */ }
  }

  private async fetchRespuesta(tel: string): Promise<Confirmacion | null> {
    const res = await fetch(RESPONSES_SHEET_CSV);
    const text = await res.text();
    return this.parseRespuestasCsv(text, tel);
  }

  private parseRespuestasCsv(csv: string, tel: string): Confirmacion | null {
    const digitos = (s: string) => s.replace(/\D/g, '');
    const telNorm = digitos(tel);
    const lines = csv.trim().split(/\r?\n/).slice(1);
    for (const line of lines) {
      if (!line.trim()) continue;
      const cols = line.match(/(".*?"|[^,]+)/g)
        ?.map(c => c.trim().replace(/^"|"$/g, '').trim()) ?? [];
      // columns: Marca temporal, Nombre, Teléfonos, Invitados, Asistirá
      const [, nombre, telCol, inv, asistira] = cols;
      if (telCol && digitos(telCol) === telNorm) {
        return {
          telefono: telCol,
          nombre: nombre ?? '',
          asistencia: asistira?.toLowerCase().startsWith('s') ? 'si' : 'no',
          invitados: parseInt(inv ?? '1', 10) || 1,
        };
      }
    }
    return null;
  }

  private async fetchInvitado(tel: string): Promise<Invitado | null> {
    const res = await fetch(GUEST_SHEET_CSV);
    const text = await res.text();
    return this.parseCsv(text, tel);
  }

  private parseCsv(csv: string, tel: string): Invitado | null {
    // strip everything except digits for robust comparison
    const digitos = (s: string) => s.replace(/\D/g, '');
    const telNorm = digitos(tel);

    // handle both \r\n (Windows) and \n line endings
    const lines = csv.trim().split(/\r?\n/).slice(1);

    for (const line of lines) {
      if (!line.trim()) continue;
      // handle quoted fields (e.g. "Hernandez, Jr.")
      const cols = line.match(/(".*?"|[^,]+)/g)
        ?.map(c => c.trim().replace(/^"|"$/g, '').trim()) ?? [];
      const [telCol, nombre, inv] = cols;
      if (telCol && digitos(telCol) === telNorm) {
        return { telefono: telCol, nombre: nombre ?? '', invitados: parseInt(inv ?? '1', 10) || 1 };
      }
    }
    return null;
  }

  confirmar() {
    if (!this.asistencia || !this.invitadoEncontrado || this.enviando) return;
    this.enviando = true;

    const body = new FormData();
    body.append(ENTRY_NOMBRE,     this.invitadoEncontrado.nombre);
    body.append(ENTRY_TELEFONO,   this.invitadoEncontrado.telefono);
    body.append(ENTRY_INVITADOS,  String(this.invitadoEncontrado.invitados));
    body.append(ENTRY_ASISTENCIA, this.asistencia === 'si' ? 'Si' : 'No');

    fetch(FORM_ACTION, { method: 'POST', mode: 'no-cors', body }).catch(() => {});

    setTimeout(() => {
      this.guardarConfirmacion({
        telefono:   this.invitadoEncontrado!.telefono,
        nombre:     this.invitadoEncontrado!.nombre,
        asistencia: this.asistencia as 'si' | 'no',
        invitados:  this.invitadoEncontrado!.invitados,
      });
      this.enviando = false;
      this.paso = 'enviado';
    }, 800);
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
