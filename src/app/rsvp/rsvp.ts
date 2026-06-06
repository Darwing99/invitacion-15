import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { supabase } from '../supabase';

export interface Invitado {
  telefono: string;
  nombre: string;
  invitados: number;
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
  private cdr    = inject(ChangeDetectorRef);

  paso: Paso = 'buscar';
  prefijos = PREFIJOS;
  prefijo = PREFIJOS[0].code;
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

      const { data, error } = await supabase
        .from('invitados')
        .select('id, nombre, telefono, invitados_permitidos, numeros_extras');

      if (error) throw error;

      const allRows = (data ?? []) as Array<{
        id: string;
        nombre: string;
        telefono: string;
        invitados_permitidos: number;
        numeros_extras: string[];
      }>;

      let found: typeof allRows[0] | null = null;
      for (const row of allRows) {
        if (phonesToTry.includes(digitos(row.telefono))) { found = row; break; }
        const extras = (row.numeros_extras ?? []).map(digitos);
        if (phonesToTry.some(p => extras.includes(p))) { found = row; break; }
      }

      if (!found) { this.paso = 'no-encontrado'; this.cdr.detectChanges(); return; }

      const { data: confData } = await supabase
        .from('confirmaciones')
        .select('telefono, nombre, asistencia, invitados')
        .eq('telefono', found.telefono)
        .maybeSingle();

      if (confData) {
        this.confirmacionPrevia = {
          telefono:   confData['telefono'],
          nombre:     confData['nombre'],
          asistencia: confData['asistencia'] === 'si' ? 'si' : 'no',
          invitados:  confData['invitados'],
        };
        this.invitadoEncontrado = {
          telefono: found.telefono,
          nombre:   found.nombre,
          invitados: found.invitados_permitidos,
        };
        this.asistencia = this.confirmacionPrevia.asistencia;
        this.paso = 'ya-confirmado';
        this.cdr.detectChanges();
        return;
      }

      if (found.invitados_permitidos === 0) {
        sessionStorage.setItem('inv_auth', '1');
        this.router.navigate(['/invitados']);
        return;
      }

      this.invitadoEncontrado = {
        telefono: found.telefono,
        nombre:   found.nombre,
        invitados: found.invitados_permitidos,
      };
      this.paso = 'confirmar';
      this.cdr.detectChanges();
    } catch (e) {
      console.error('[RSVP] Error al buscar:', e);
      this.errorMsg = 'Error de conexión. Intenta de nuevo.';
      this.cdr.detectChanges();
    } finally {
      this.buscando = false;
      this.cdr.detectChanges();
    }
  }

  async confirmar() {
    if (!this.asistencia || !this.invitadoEncontrado || this.enviando) return;
    this.enviando = true;
    const inv = this.invitadoEncontrado;

    try {
      const { error } = await supabase.from('confirmaciones').upsert(
        {
          telefono:   inv.telefono,
          nombre:     inv.nombre,
          invitados:  inv.invitados,
          asistencia: this.asistencia,
        },
        { onConflict: 'telefono' }
      );

      if (error) throw error;
      this.paso = 'enviado';
      this.cdr.detectChanges();
    } catch (e) {
      console.error('[RSVP] Error al guardar:', e);
      this.errorMsg = 'Error al guardar. Intenta de nuevo.';
      this.cdr.detectChanges();
    } finally {
      this.enviando = false;
      this.cdr.detectChanges();
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
