// ── Ayuda: preguntas y guías paso a paso de cada página ─────────────────────
//
// Aquí está TODO el contenido de la ayuda. Para agregar o corregir una guía
// solo se edita este archivo; las páginas no se tocan.
//
// Cada paso apunta a un elemento de la página con `sel`:
//   - una palabra (ej. 'ee-excel')  → busca el elemento marcado con data-ayuda="ee-excel"
//   - un selector CSS (empieza por . # [ ) → se usa tal cual (ej. '.modal-card')
//   - varias opciones separadas por |  → se usa la primera que esté visible
//   - sin `sel` → el paso sale en el centro de la pantalla, sin resaltar nada
// Si el elemento no aparece (por ejemplo, la tabla está vacía), el paso también
// sale en el centro, así que la guía nunca se rompe.
//
// `accion` dice qué puede hacer la persona con lo resaltado:
//   - 'mirar'  (por defecto) → solo se mira; se avanza con "Siguiente"
//   - 'libre'  → puede escribir o tocar lo resaltado; se avanza con "Siguiente"
//   - 'tocar'  → la guía espera a que toque lo resaltado y avanza sola
//
// `ruta` (opcional) → antes de mostrar el paso, la app va a esa página.

export type Accion = 'mirar' | 'libre' | 'tocar'

export type Paso = {
  sel?: string
  titulo: string
  texto: string
  accion?: Accion
  ruta?: string
}

export type Guia = {
  id: string
  pregunta: string
  icono: keyof typeof ICONOS_AYUDA
  pasos: Paso[]
  /** Solo se muestra si este elemento está en pantalla (ej. un paso del formulario). */
  soloSi?: string
  /** Solo para usuarios tesoreros (el rol consulta no registra ni edita). */
  soloTesorero?: boolean
}

type Pagina = { ruta: string; exacta?: boolean; guias: Guia[] }

// Trazos SVG 24x24 (mismo estilo de íconos de la app)
export const ICONOS_AYUDA = {
  mas:        'M12 5v14M5 12h14',
  calendario: 'M3 5h18v16H3zM16 3v4M8 3v4M3 10h18',
  lapiz:      'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  descargar:  'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  foto:       'M3 7h4l2-3h6l2 3h4v13H3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  clip:       'M21.4 11 12.2 20.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5',
  balanza:    'M12 3v18M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0zM8 21h8',
  ojo:        'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  paginas:    'M4 4h12v16H4zM8 2h12v16',
  persona:    'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-7 8-7s8 3 8 7',
  buscar:     'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  candado:    'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  luna:       'M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z',
  salir:      'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11',
  engranaje:  'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1',
  grafica:    'M3 3v18h18M7 15l4-4 3 3 5-6',
  ayuda:      'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01',
  porcentaje: 'M19 5 5 19M7 7h.01M17 17h.01',
} as const

// ── Guías que se repiten en varias páginas ──────────────────────────────────
function guiaMes(p: string, libro: string): Guia {
  return {
    id: `${p}-mes`, pregunta: '¿Cómo cambio de mes o de año?', icono: 'calendario',
    pasos: [
      { sel: `${p}-anios`, titulo: 'Elige el año', texto: `Toca el año que quieres ver. El ${libro} se carga con los registros de ese año.`, accion: 'libre' },
      { sel: `${p}-meses`, titulo: 'Elige el mes', texto: 'Toca el mes. Al entrar, la página abre sola en el último mes que tiene registros.', accion: 'libre' },
    ],
  }
}

function guiaExcel(p: string, libro: string): Guia {
  return {
    id: `${p}-excel`, pregunta: `¿Cómo descargo el ${libro} en Excel?`, icono: 'descargar',
    pasos: [
      { sel: `${p}-excel`, titulo: 'Exportar Excel', texto: `Toca este botón y se descarga el ${libro} en un archivo de Excel, listo para imprimir o enviar.` },
    ],
  }
}

function guiasInforme(tipo: 'ingresos' | 'egresos'): Guia[] {
  const pasos: Paso[] = [
    { sel: 'inf-filtro', titulo: 'Elige el periodo', texto: '«Por mes» muestra un mes completo. «Por rango de fechas» te deja escoger desde qué día y hasta qué día.', accion: 'libre' },
  ]
  if (tipo === 'egresos') pasos.push({ sel: 'inf-tipo', titulo: 'Filtra por tipo (opcional)', texto: 'Si solo quieres ver un tipo de egreso (energía, arriendo, etc.), elígelo aquí.', accion: 'libre' })
  pasos.push(
    { sel: 'inf-buscar', titulo: 'Toca «Generar informe»', texto: 'Con esto se carga el informe del periodo que elegiste.', accion: 'tocar' },
    { sel: 'inf-tabla', titulo: 'Revisa el informe', texto: `Aquí salen los ${tipo} del periodo con sus totales.` },
  )
  return [
    { id: `inf-${tipo}-ver`, pregunta: '¿Cómo veo el informe de un mes o de unas fechas?', icono: 'calendario', pasos },
    {
      id: `inf-${tipo}-exportar`, pregunta: '¿Cómo descargo el informe en PDF o Excel?', icono: 'descargar',
      pasos: [
        { sel: 'inf-exportar', titulo: 'PDF o Excel', texto: 'Primero genera el informe del periodo. Luego toca «PDF» para imprimirlo o guardarlo, o «Excel» para descargarlo como hoja de cálculo.' },
      ],
    },
  ]
}

// ── Guías por página (las más específicas van primero) ──────────────────────
const PAGINAS: Pagina[] = [
  // ─── Inicio ───
  {
    ruta: '/dashboard', exacta: true, guias: [
      {
        id: 'ini-registrar', pregunta: '¿Cómo registro un ingreso o un egreso?', icono: 'mas', soloTesorero: true,
        pasos: [
          { sel: 'ini-registrar', titulo: 'Botón «Registrar»', texto: 'Tócalo y elige «Ingreso» para los diezmos y ofrendas del día, o «Egreso» para un pago (servicios, arriendo, diezmo de diezmo…).' },
          { titulo: 'Dentro de cada formulario', texto: 'Cuando entres, toca «Ayuda» otra vez: ahí hay una guía paso a paso para llenarlo.' },
        ],
      },
      {
        id: 'ini-resumen', pregunta: '¿Qué significan los números de esta página?', icono: 'grafica',
        pasos: [
          { sel: 'ini-kpis', titulo: 'Resumen del año', texto: 'Ingresos, egresos y balance del año, con lo del mes actual abajo. Toca cualquier tarjeta para ir a su informe.' },
          { sel: 'ini-mapa', titulo: 'Ingresos por día', texto: 'Cada cuadrito es un día de los últimos 12 meses. Entre más verde, más se recibió. Pasa el mouse para ver la fecha y el valor.' },
          { sel: 'ini-movimientos', titulo: 'Últimos movimientos', texto: 'Los ingresos y egresos más recientes. Toca uno para abrir su libro.' },
        ],
      },
      {
        id: 'ini-paquete', pregunta: '¿Cómo descargo el paquete contable del año?', icono: 'descargar',
        pasos: [
          { sel: 'menu-paquete', titulo: 'Exportar paquete contable', texto: 'Está en el menú, en «Estados financieros». Descarga un ZIP con los libros de ingresos, egresos y el auxiliar del año en Excel. Tarda unos segundos.' },
        ],
      },
    ],
  },

  // ─── Registrar ingreso ───
  {
    ruta: '/dashboard/ingresos/registrar', guias: [
      {
        id: 'ing-registrar', pregunta: '¿Cómo registro los diezmos y ofrendas del día?', icono: 'mas', soloTesorero: true,
        pasos: [
          { sel: 'ing-fecha', titulo: 'Elige la fecha', texto: 'Es el día en que se recibieron los sobres. Por defecto sale la fecha de hoy.', accion: 'libre' },
          { sel: 'ing-aportante', titulo: 'Escribe el nombre', texto: 'Empieza a escribir y elige a la persona en la lista. Cuando queda bien escogida, el campo se pone azul con un ✓.', accion: 'libre' },
          { sel: 'ing-valor', titulo: 'Escribe los valores', texto: 'Pon cada valor en su columna (Diezmo, Ofrenda, Voto Arriendo). Si no dio en alguna, déjala vacía.', accion: 'libre' },
          { sel: 'ing-agregar-fila', titulo: 'Una fila por sobre', texto: 'Toca «Agregar fila» para cada persona que falte.' },
          { sel: 'ing-total', titulo: 'Revisa el total', texto: 'Aquí ves el total del día y cuánto va en cada concepto. Se actualiza solo mientras escribes.' },
          { sel: 'ing-ir-distribucion', titulo: 'Revisa la distribución', texto: 'Toca este botón para ver cómo se reparte el dinero antes de guardar.', accion: 'tocar' },
          { sel: 'ing-guardar', titulo: 'Guarda el registro', texto: 'Si todo está bien, toca «Guardar registro». Se guarda una sola vez; si algo falla, la app te avisa.' },
        ],
      },
      {
        id: 'ing-nuevo-miembro', pregunta: '¿Cómo agrego a alguien que no está en la lista?', icono: 'persona', soloTesorero: true,
        pasos: [
          { sel: 'ing-nuevo-miembro', titulo: 'Toca el «+»', texto: 'Está al lado del nombre. Úsalo si la persona todavía no está registrada como miembro.', accion: 'tocar' },
          { sel: '.modal-card', titulo: 'Llena sus datos', texto: 'Nombre y cédula son obligatorios. Al guardar, la persona queda escogida en esa fila.', accion: 'libre' },
        ],
      },
      {
        id: 'ing-columna', pregunta: '¿Cómo agrego otra columna (por ejemplo, Misiones)?', icono: 'mas', soloTesorero: true,
        pasos: [
          { sel: 'ing-agregar-columna', titulo: 'Toca «Columna»', texto: 'Se abre un cuadrito para crear la columna nueva.', accion: 'tocar' },
          { sel: 'ing-form-columna', titulo: 'Nombre y código PUC', texto: 'Por ejemplo: Misiones, 4170-20. Toca «Agregar» y la columna aparece en la tabla.', accion: 'libre' },
        ],
      },
      {
        id: 'ing-distribucion', pregunta: '¿Cómo cambio los porcentajes de la distribución?', icono: 'porcentaje', soloTesorero: true,
        pasos: [
          { sel: 'ing-tab-distribucion', titulo: 'Abre «Distribución»', texto: 'Aquí se ve cómo se reparte el dinero del día.', accion: 'tocar' },
          { sel: 'ing-editar-pct', titulo: 'Cambia un porcentaje', texto: 'Toca el lápiz de un concepto para cambiar su porcentaje o agregarle otro tramo. Toca «Listo» al terminar.' },
          { sel: 'ing-agregar-concepto', titulo: 'Agrega un concepto', texto: 'Escribe el nombre y el porcentaje, y tócalo para agregarlo a la distribución.', accion: 'libre' },
        ],
      },
      {
        id: 'ing-imprimir', pregunta: '¿Cómo imprimo o descargo el comprobante?', icono: 'descargar',
        pasos: [
          { sel: 'ing-imprimir', titulo: 'Imprimir o Excel', texto: 'El primer botón abre el comprobante para imprimirlo o guardarlo como PDF. El segundo lo descarga en Excel.' },
        ],
      },
    ],
  },

  // ─── Formulario de un egreso (tiene que ir ANTES que la lista de tipos) ───
  {
    ruta: '/dashboard/egresos/registrar/', guias: [
      {
        id: 'egf-llenar', pregunta: '¿Cómo lleno este comprobante paso a paso?', icono: 'lapiz', soloSi: 'egf-pasos',
        pasos: [
          { sel: 'egf-pasos', titulo: 'Son 4 pasos', texto: 'Fecha, Pago, Cuentas y Adicional. Esta barra muestra en cuál vas.' },
          { sel: 'egf-fecha', titulo: 'Fecha del pago', texto: 'Elige el día en que se hizo el pago.', accion: 'libre' },
          { sel: 'egf-siguiente', titulo: 'Toca «Siguiente»', texto: 'Pasa al paso 2.', accion: 'tocar' },
          { sel: 'egf-pago', titulo: 'Datos del pago', texto: 'Escribe el valor y elige el concepto con el mes (en «Otro» también a quién se pagó). El valor en letras sale solo.', accion: 'libre' },
          { sel: 'egf-siguiente', titulo: 'Toca «Siguiente»', texto: 'Pasa a las cuentas contables.', accion: 'tocar' },
          { sel: 'egf-cuentas', titulo: 'Cuentas contables', texto: 'Las cuentas del proveedor ya vienen puestas. Pon el valor en Débito (el gasto) y en Crédito (Caja). Abajo te dice si cuadran.', accion: 'libre' },
          { sel: 'egf-siguiente', titulo: 'Toca «Siguiente»', texto: 'Pasa a los datos adicionales.', accion: 'tocar' },
          { sel: 'egf-adicional', titulo: 'Método de pago', texto: 'Elige efectivo o transferencia y, si hace falta, el documento (NIT o C.C.).', accion: 'libre' },
          { sel: 'egf-siguiente', titulo: 'Toca «Ver comprobante»', texto: 'Se abre la vista previa del comprobante.', accion: 'tocar' },
          { sel: 'egf-finalizar', titulo: 'Finaliza', texto: 'Revisa el comprobante y toca «Finalizar». Puedes guardarlo y descargarlo, o solo descargarlo.' },
        ],
      },
      {
        id: 'egf-cuadrar', pregunta: '¿Qué hago si las cuentas no cuadran?', icono: 'balanza', soloSi: 'egf-cuentas',
        pasos: [
          { sel: 'egf-cuentas', titulo: 'Débitos = Créditos', texto: 'La suma de la columna Débito tiene que ser igual a la suma de la columna Crédito.' },
          { sel: 'egf-cuadre', titulo: 'Mira este aviso', texto: 'En verde: cuadra. En rojo: falta o sobra dinero en alguna cuenta.' },
          { sel: 'egf-retencion', titulo: 'Retención en la fuente', texto: 'En el arriendo, la retención (2365-30) va en CRÉDITO. Escribe la base y toca «Aplicar a las cuentas»: la calcula y cuadra todo solo.', accion: 'libre' },
        ],
      },
      {
        id: 'egf-soporte', pregunta: '¿Cómo adjunto la foto o el PDF de la factura?', icono: 'clip', soloSi: 'egf-soportes',
        pasos: [
          { sel: 'egf-soportes', titulo: 'Soportes (opcional)', texto: 'Toca «Adjuntar soporte» y elige las fotos o PDF. Quedan guardados con el egreso cuando lo finalices.', accion: 'libre' },
        ],
      },
      {
        id: 'egf-guardar', pregunta: '¿Cómo guardo y descargo el comprobante?', icono: 'descargar', soloSi: 'egf-finalizar',
        pasos: [
          { sel: 'egf-finalizar', titulo: 'Toca «Finalizar»', texto: 'Se abren las opciones para terminar.', accion: 'tocar' },
          { sel: '.modal-box', titulo: 'Elige cómo terminar', texto: '«Guardar y descargar» lo guarda y abre la impresión (ahí eliges «Guardar como PDF»). «Solo descargar» NO lo guarda.', accion: 'libre' },
        ],
      },
    ],
  },

  // ─── Registrar egreso (elegir tipo) ───
  {
    ruta: '/dashboard/egresos/registrar', exacta: true, guias: [
      {
        id: 'eg-tipo', pregunta: '¿Cómo registro un egreso a mano?', icono: 'lapiz', soloTesorero: true,
        pasos: [
          { sel: 'eg-tipos', titulo: 'Elige el tipo de egreso', texto: 'Cada tarjeta trae listos el proveedor, el NIT y las cuentas PUC. Si el pago no está en la lista, usa «Otro».' },
          { sel: '[data-ayuda="eg-tipos"] .eg-card', titulo: 'Toca una tarjeta', texto: 'Por ejemplo «Energía». Se abre el formulario por pasos; ahí puedes tocar «Ayuda» otra vez.', accion: 'tocar' },
        ],
      },
      {
        id: 'eg-ia', pregunta: '¿Cómo lleno un egreso desde la foto del comprobante?', icono: 'foto', soloTesorero: true,
        pasos: [
          { sel: 'eg-ia', titulo: 'Sube el comprobante', texto: 'Arrastra la foto o el PDF aquí, o tócalo para buscarlo en tu equipo. Puedes subir varios si son del mismo destinatario y de la misma fecha.', accion: 'libre' },
          { sel: '.sc-list', titulo: 'Revisa lo que leyó', texto: 'La IA lee el destinatario, el valor y la fecha. Revisa los datos y las advertencias en amarillo.' },
          { sel: '.sc-go', titulo: 'Llena el egreso', texto: 'Cuando todo esté bien, toca el botón verde. El formulario se abre ya lleno para que lo revises, y la foto queda como soporte.' },
        ],
      },
      {
        id: 'eg-varios', pregunta: '¿Puedo sumar varios comprobantes en un solo egreso?', icono: 'paginas',
        pasos: [
          { titulo: 'Sí, con una condición', texto: 'Solo si todos son para el mismo destinatario y tienen la misma fecha de pago o consignación. Si no, la app te avisa y no deja continuar.' },
          { titulo: 'Consignaciones a la Iglesia en el Distrito', texto: 'Se toman como «Diezmo de Diezmo» (Iglesia en Bogotá).' },
        ],
      },
    ],
  },

  // ─── Estados financieros ───
  {
    ruta: '/dashboard/estados/ver', guias: [
      {
        id: 'ev-que', pregunta: '¿Qué hay en Estados financieros?', icono: 'paginas',
        pasos: [
          { sel: 'ev-tarjetas', titulo: 'Elige un libro', texto: 'Ingresos y Egresos son los libros diarios. El Libro auxiliar muestra el saldo día a día.' },
        ],
      },
    ],
  },
  {
    ruta: '/dashboard/estados/ingresos', guias: [
      guiaMes('ei', 'libro de ingresos'),
      {
        id: 'ei-pasar', pregunta: '¿Cómo paso de un ingreso a otro?', icono: 'paginas',
        pasos: [
          { sel: 'ei-paginas', titulo: 'Un ingreso por página', texto: 'Cada página es un registro completo (un día). Usa las flechas o toca la fecha que quieres ver.', accion: 'libre' },
        ],
      },
      {
        id: 'ei-corregir', pregunta: '¿Cómo corrijo un nombre o un valor?', icono: 'lapiz', soloTesorero: true,
        pasos: [
          { sel: 'ei-modificar', titulo: 'Toca «Modificar»', texto: 'Te va a pedir la clave de modo edición.', accion: 'tocar' },
          { sel: '.modal-card', titulo: 'Escribe la clave', texto: 'Es la clave de modo edición (la crea el tesorero en Configuración). Toca «Confirmar».', accion: 'libre' },
          { sel: 'ei-tabla', titulo: 'Toca lo que quieres cambiar', texto: 'Un nombre para cambiar el miembro, o un valor para corregirlo. Se guarda al presionar Enter.' },
          { sel: '.btn-add-row', titulo: '¿Faltó una ofrenda?', texto: 'En la fila de la iglesia aparece un «+» para agregar una ofrenda o diezmo que se pasó.' },
          { sel: 'ei-modificar', titulo: 'Termina', texto: 'Cuando acabes, toca «Finalizar modificación».' },
        ],
      },
      guiaExcel('ei', 'libro de ingresos'),
    ],
  },
  {
    ruta: '/dashboard/estados/egresos', guias: [
      guiaMes('ee', 'libro de egresos'),
      {
        id: 'ee-corregir', pregunta: '¿Cómo corrijo una fecha, una descripción o un valor?', icono: 'lapiz', soloTesorero: true,
        pasos: [
          { sel: 'ee-actualizar', titulo: 'Activa el modo edición', texto: 'Toca este botón. Te va a pedir la clave de modo edición.', accion: 'tocar' },
          { sel: '.modal-card', titulo: 'Escribe la clave', texto: 'Es la clave de modo edición (la crea el tesorero en Configuración). Toca «Confirmar».', accion: 'libre' },
          { sel: 'ee-tabla', titulo: 'Toca lo que quieres cambiar', texto: 'La fecha, la descripción o el valor. Presiona Enter para guardar. Si cambias el valor, el comprobante también se actualiza.' },
          { sel: 'ee-actualizar', titulo: 'Termina', texto: 'Cuando acabes, toca otra vez este botón para salir del modo edición.' },
        ],
      },
      guiaExcel('ee', 'libro de egresos'),
    ],
  },
  {
    ruta: '/dashboard/estados/auxiliar', guias: [
      guiaMes('ea', 'libro auxiliar'),
      {
        id: 'ea-que', pregunta: '¿Qué muestra el libro auxiliar?', icono: 'grafica',
        pasos: [
          { sel: 'ea-kpis', titulo: 'Resumen del mes', texto: 'Saldo con el que empezó el mes, lo que entró, lo que salió y el saldo final.' },
          { sel: 'ea-grafica', titulo: 'Saldo día a día', texto: 'Cada columna es un movimiento. Pasa el mouse para ver la fecha y el saldo.' },
          { sel: 'ea-tabla', titulo: 'Todos los movimientos', texto: 'Ingresos y egresos en orden, con el saldo que va quedando después de cada uno.' },
        ],
      },
      {
        id: 'ea-saldo', pregunta: '¿Cómo ajusto el saldo inicial del año?', icono: 'candado', soloTesorero: true,
        pasos: [
          { sel: 'ea-saldo', titulo: 'Toca «Ajustar saldo inicial»', texto: 'Sirve para poner el dinero con el que se empezó el año.', accion: 'tocar' },
          { sel: '.modal-card', titulo: 'Clave y monto', texto: 'Escribe la clave de saldo inicial y el monto de apertura del año. Toca «Guardar».', accion: 'libre' },
        ],
      },
      guiaExcel('ea', 'libro auxiliar'),
    ],
  },

  // ─── Informes ───
  { ruta: '/dashboard/informes/ingresos', guias: guiasInforme('ingresos') },
  { ruta: '/dashboard/informes/egresos', guias: guiasInforme('egresos') },

  // ─── Miembros ───
  {
    ruta: '/dashboard/miembros', guias: [
      {
        id: 'mi-agregar', pregunta: '¿Cómo agrego un miembro?', icono: 'persona', soloTesorero: true,
        pasos: [
          { sel: 'mi-agregar', titulo: 'Toca «Agregar miembro»', texto: 'Se abre el formulario.', accion: 'tocar' },
          { sel: '.modal-overlay > *', titulo: 'Llena sus datos', texto: 'Nombre y cédula son obligatorios; teléfono y edad son opcionales. Toca «Guardar».', accion: 'libre' },
        ],
      },
      {
        id: 'mi-buscar', pregunta: '¿Cómo busco a una persona?', icono: 'buscar',
        pasos: [
          { sel: 'mi-buscar', titulo: 'Escribe el nombre o la cédula', texto: 'La lista se filtra mientras escribes.', accion: 'libre' },
          { sel: 'mi-filtro', titulo: 'Activos o inactivos', texto: 'Muestra todos, solo los activos o solo los inactivos.', accion: 'libre' },
        ],
      },
      {
        id: 'mi-editar', pregunta: '¿Cómo cambio los datos de un miembro?', icono: 'lapiz', soloTesorero: true,
        pasos: [
          { sel: 'mi-editar', titulo: 'Toca «Editar»', texto: 'Está en la fila de cada persona. Puedes cambiar sus datos o marcarla como inactiva si ya no asiste.' },
        ],
      },
    ],
  },

  // ─── Configuración ───
  {
    ruta: '/dashboard/configuracion', guias: [
      {
        id: 'cf-que', pregunta: '¿Qué puedo cambiar en Configuración?', icono: 'engranaje',
        pasos: [
          { sel: 'cf-nav', titulo: 'Secciones', texto: 'Datos de la iglesia, proveedores de egresos, cuentas PUC, retención, ingresos, usuarios, numeración, respaldo y apariencia. Toca una para abrirla.' },
          { sel: 'cf-contenido', titulo: 'Aquí se edita', texto: 'Los cambios de cada sección se guardan con su botón «Guardar».' },
        ],
      },
      {
        id: 'cf-proveedor', pregunta: '¿Cómo agrego un proveedor de egresos nuevo?', icono: 'mas', soloTesorero: true,
        pasos: [
          { sel: 'cf-proveedores', titulo: 'Abre «Proveedores de egresos»', texto: 'Aquí están los tipos de egreso que salen como tarjetas al registrar.', accion: 'tocar' },
          { sel: 'cf-contenido', titulo: 'Agrega el proveedor', texto: 'Ponle nombre, a quién se paga, NIT o C.C. y sus cuentas PUC. Queda como una tarjeta nueva en «Registrar egreso».', accion: 'libre' },
        ],
      },
      {
        id: 'cf-usuario', pregunta: '¿Cómo creo un usuario nuevo?', icono: 'persona', soloTesorero: true,
        pasos: [
          { sel: 'cf-usuarios', titulo: 'Abre «Usuarios y seguridad»', texto: 'Aquí se manejan los accesos.', accion: 'tocar' },
          { sel: 'cf-contenido', titulo: 'Crea el usuario', texto: 'Escribe nombre, cédula y una contraseña, y elige el rol: «Tesorero» puede registrar y editar; «Consulta» solo puede mirar.', accion: 'libre' },
        ],
      },
      {
        id: 'cf-claves', pregunta: '¿Cómo cambio las claves de edición y de saldo?', icono: 'candado', soloTesorero: true,
        pasos: [
          { sel: 'cf-usuarios', titulo: 'Abre «Usuarios y seguridad»', texto: 'Las claves están al final de esta sección.', accion: 'tocar' },
          { sel: '.cf-claves', titulo: 'Cambia la clave', texto: 'Escribe la clave actual y la nueva dos veces. Si es la primera vez, deja «Clave actual» vacía.', accion: 'libre' },
        ],
      },
    ],
  },

  // ─── Perfil ───
  {
    ruta: '/dashboard/perfil', guias: [
      {
        id: 'pf-nombre', pregunta: '¿Cómo cambio mi nombre?', icono: 'persona',
        pasos: [{ sel: 'pf-datos', titulo: 'Datos personales', texto: 'Escribe tu nombre completo y toca «Guardar». La cédula no se puede cambiar.', accion: 'libre' }],
      },
      {
        id: 'pf-clave', pregunta: '¿Cómo cambio mi contraseña?', icono: 'candado',
        pasos: [{ sel: 'pf-clave', titulo: 'Cambiar contraseña', texto: 'Escribe tu contraseña actual y la nueva dos veces (mínimo 6 caracteres). Toca «Cambiar contraseña».', accion: 'libre' }],
      },
    ],
  },
]

// ── Preguntas que salen en todas las páginas ────────────────────────────────
export const GENERALES: Guia[] = [
  {
    id: 'gen-clave', pregunta: '¿Cómo cambio mi contraseña?', icono: 'candado',
    pasos: [
      { sel: 'menu-perfil', titulo: 'Toca tu ícono', texto: 'Arriba a la derecha está el menú de tu cuenta.', accion: 'tocar' },
      { sel: 'menu-perfil-ir', titulo: 'Toca «Perfil»', texto: 'Ahí están tus datos.', accion: 'tocar' },
      { sel: 'pf-clave', titulo: 'Cambiar contraseña', texto: 'Escribe tu contraseña actual y la nueva dos veces. Toca «Cambiar contraseña».', accion: 'libre' },
    ],
  },
  {
    id: 'gen-tema', pregunta: '¿Cómo pongo el modo claro u oscuro?', icono: 'luna',
    pasos: [
      { sel: 'cf-apariencia', ruta: '/dashboard/configuracion', titulo: 'Abre «Apariencia»', texto: 'Está en Configuración, al final de la lista.', accion: 'tocar' },
      { sel: 'cf-contenido', titulo: 'Elige el modo', texto: 'Claro, oscuro o automático (sigue al de tu equipo). Se guarda en este navegador.', accion: 'libre' },
    ],
  },
  {
    id: 'gen-salir', pregunta: '¿Cómo cierro sesión?', icono: 'salir',
    pasos: [
      { sel: 'menu-perfil', titulo: 'Menú de tu cuenta', texto: 'Toca tu ícono, arriba a la derecha, y luego «Cerrar sesión». Hazlo siempre si usas un computador que no es tuyo.' },
    ],
  },
  {
    id: 'gen-ayuda', pregunta: '¿Cómo funciona esta ayuda?', icono: 'ayuda',
    pasos: [
      { titulo: 'Una guía para cada página', texto: 'La ayuda muestra preguntas sobre la página donde estás. Elige una y te mostramos paso a paso qué hacer.' },
      { titulo: 'Cómo moverte', texto: 'Usa «Siguiente» y «Anterior», o las flechas ← → del teclado. Para salir, toca la X o presiona Esc.' },
      { titulo: 'Cuando hay que tocar', texto: 'Si el paso dice «toca», la guía espera a que toques lo resaltado y sigue sola.' },
      { sel: 'menu-ayuda', titulo: 'Vuelve cuando quieras', texto: '«Ayuda» siempre está al final del menú, en «Apoyo».' },
    ],
  },
]

/** Guías de la página donde está la persona. */
export function guiasDePagina(pathname: string): Guia[] {
  const p = PAGINAS.find(x => x.exacta ? pathname === x.ruta : pathname.startsWith(x.ruta))
  return p ? p.guias : []
}

/** Convierte `sel` en selectores CSS (ver explicación arriba). */
export function selectores(sel?: string): string[] {
  if (!sel) return []
  return sel.split('|').map(s => s.trim()).filter(Boolean)
    .map(s => /^[.#[]/.test(s) || s.includes(' ') ? s : `[data-ayuda="${s}"]`)
}

// ── Guías ya vistas (se guardan en este navegador) ──────────────────────────
const CLAVE_VISTAS = 'ayuda-vistas'

export function guiasVistas(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(CLAVE_VISTAS) || '[]')) } catch { return new Set() }
}

export function marcarVista(id: string) {
  try {
    const v = guiasVistas(); v.add(id)
    localStorage.setItem(CLAVE_VISTAS, JSON.stringify(Array.from(v)))
  } catch { /* sin almacenamiento */ }
}
