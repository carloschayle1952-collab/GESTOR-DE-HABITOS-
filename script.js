"use strict";

/* ---------- Estado ---------- */
const CLAVE = "habitos-diarios-v1";

const state = {
  habits: [],   // { id, nombre, dias: [0-6], historial: ["YYYY-MM-DD"] }
  tasks: [],    // { id, titulo, prioridad, fecha, hecha }
  settings: { tema: "claro" }
};

/* ---------- Almacenamiento ---------- */
const storage = {
  load() {
    try {
      const guardado = JSON.parse(localStorage.getItem(CLAVE));
      if (guardado) Object.assign(state, guardado);
    } catch (e) {
      console.warn("No se pudo leer el almacenamiento local:", e);
    }
  },
  save() {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(state));
    } catch (e) {
      console.warn("No se pudo guardar:", e);
    }
  }
};

/* ---------- Utilidades de fecha ---------- */
const fechas = {
  // Fecha local en formato YYYY-MM-DD (evita desfases de zona horaria)
  clave(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dia = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dia}`;
  },
  // Los 7 días de la semana actual, de lunes a domingo
  semanaActual() {
    const hoy = new Date();
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(lunes);
      d.setDate(lunes.getDate() + i);
      return d;
    });
  }
};

/* ---------- Tareas ---------- */
let filtroTareas = "todas";
const ORDEN_PRIORIDAD = { alta: 0, media: 1, baja: 2 };

const tasks = {
  agregar(titulo, prioridad, fecha) {
    state.tasks.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      titulo, prioridad, fecha, hecha: false
    });
    storage.save();
  },
  alternar(id) {
    const t = state.tasks.find((x) => x.id === id);
    if (t) { t.hecha = !t.hecha; storage.save(); }
  },
  editar(id, titulo) {
    const t = state.tasks.find((x) => x.id === id);
    if (t && titulo.trim()) { t.titulo = titulo.trim(); storage.save(); }
  },
  eliminar(id) {
    state.tasks = state.tasks.filter((x) => x.id !== id);
    storage.save();
  },
  visibles() {
    return state.tasks
      .filter((t) => filtroTareas === "todas" || (filtroTareas === "hechas" ? t.hecha : !t.hecha))
      .sort((a, b) =>
        Number(a.hecha) - Number(b.hecha) ||
        ORDEN_PRIORIDAD[a.prioridad] - ORDEN_PRIORIDAD[b.prioridad] ||
        (a.fecha || "9999").localeCompare(b.fecha || "9999"));
  },
  textoFecha(t) {
    if (!t.fecha) return "sin fecha";
    const hoy = fechas.clave();
    const manana = new Date(); manana.setDate(manana.getDate() + 1);
    if (t.fecha === hoy) return "vence hoy";
    if (t.fecha === fechas.clave(manana)) return "vence mañana";
    const corta = new Date(t.fecha + "T00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short" });
    return (t.fecha < hoy && !t.hecha ? "venció el " : "vence el ") + corta;
  }
};

/* ---------- Hábitos ---------- */
const NOMBRES_DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0]; // semana de lunes a domingo

const habits = {
  agregar(nombre, dias, color) {
    state.habits.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      nombre, dias, color, historial: [], creado: fechas.clave()
    });
    storage.save();
  },
  alternarHoy(id) {
    const h = state.habits.find((x) => x.id === id);
    if (!h) return;
    const hoy = fechas.clave();
    const i = h.historial.indexOf(hoy);
    if (i >= 0) h.historial.splice(i, 1); else h.historial.push(hoy);
    storage.save();
  },
  editar(id, nombre) {
    const h = state.habits.find((x) => x.id === id);
    if (h && nombre.trim()) { h.nombre = nombre.trim(); storage.save(); }
  },
  eliminar(id) {
    state.habits = state.habits.filter((x) => x.id !== id);
    storage.save();
  },
  tocaHoy(h) {
    return h.dias.includes(new Date().getDay());
  },
  // Racha actual y récord: solo cuentan los días en que el hábito toca.
  // Si hoy toca y todavía no está hecho, la racha no se corta hasta mañana.
  rachas(h) {
    if (!h.historial.length) return { actual: 0, record: 0 };
    const hechos = new Set(h.historial);
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const inicio = new Date([...hechos].sort()[0] + "T00:00");
    let actual = 0, record = 0;
    for (let d = new Date(inicio); d <= hoy; d.setDate(d.getDate() + 1)) {
      if (!h.dias.includes(d.getDay())) continue;
      if (hechos.has(fechas.clave(d))) {
        actual++;
        record = Math.max(record, actual);
      } else if (d < hoy) {
        actual = 0;
      }
    }
    return { actual, record };
  },
  textoDias(h) {
    if (h.dias.length === 7) return "todos los días";
    return ORDEN_DIAS.filter((d) => h.dias.includes(d)).map((d) => NOMBRES_DIAS[d]).join(", ");
  }
};

/* ---------- Respaldo ---------- */
const FECHA_OK = /^\d{4}-\d{2}-\d{2}$/;

const respaldo = {
  exportar() {
    const datos = { app: "habitos-diarios", version: 1, exportado: new Date().toISOString(), ...state };
    const blob = new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `habitos-${fechas.clave()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  // Valida y limpia lo que viene del archivo; devuelve null si no tiene el formato esperado
  sanear(d) {
    if (!d || !Array.isArray(d.habits) || !Array.isArray(d.tasks)) return null;
    const texto = (v, max) => String(v ?? "").trim().slice(0, max);
    const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const esFecha = (f) => typeof f === "string" && FECHA_OK.test(f);

    const habitos = d.habits.map((h) => ({
      id: texto(h && h.id, 40) || nuevoId(),
      nombre: texto(h && h.nombre, 60),
      dias: [...new Set((Array.isArray(h && h.dias) ? h.dias : [])
        .map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))],
      historial: [...new Set((Array.isArray(h && h.historial) ? h.historial : []).filter(esFecha))],
      creado: h && esFecha(h.creado) ? h.creado : undefined,
      color: h && /^#[0-9a-f]{6}$/i.test(h.color || "") ? h.color : undefined
    })).filter((h) => h.nombre && h.dias.length);

    const tareas = d.tasks.map((t) => ({
      id: texto(t && t.id, 40) || nuevoId(),
      titulo: texto(t && t.titulo, 120),
      prioridad: t && ["alta", "media", "baja"].includes(t.prioridad) ? t.prioridad : "media",
      fecha: t && esFecha(t.fecha) ? t.fecha : "",
      hecha: !!t && t.hecha === true
    })).filter((t) => t.titulo);

    return { habits: habitos, tasks: tareas };
  },
  async importar(archivo) {
    let datos;
    try {
      datos = this.sanear(JSON.parse(await archivo.text()));
    } catch (e) {
      datos = null;
    }
    if (!datos) return "No se pudo importar: el archivo no es un respaldo válido de esta app.";

    const ok = window.confirm(
      `El archivo tiene ${datos.habits.length} hábitos y ${datos.tasks.length} tareas. ` +
      "Esto reemplaza los datos que tenés ahora. ¿Continuar?"
    );
    if (!ok) return "Importación cancelada.";

    state.habits = datos.habits;
    state.tasks = datos.tasks;
    storage.save();
    return `Datos importados: ${datos.habits.length} hábitos y ${datos.tasks.length} tareas.`;
  }
};

/* ---------- Confeti al completar el día ---------- */
function confeti() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const colores = ["#f4c542", "#e2603f", "#7c5cd6", "#2f6fe4", "#d6457f", "#3ddc97"];
  const capa = document.createElement("div");
  capa.className = "confeti";
  capa.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 36; i++) {
    const p = document.createElement("i");
    p.style.left = Math.random() * 100 + "vw";
    p.style.background = colores[i % colores.length];
    p.style.setProperty("--dx", Math.random() * 120 - 60 + "px");
    p.style.setProperty("--giro", Math.random() * 720 - 360 + "deg");
    p.style.animationDuration = 1.6 + Math.random() * 1.2 + "s";
    p.style.animationDelay = Math.random() * 0.3 + "s";
    capa.appendChild(p);
  }
  document.body.appendChild(capa);
  setTimeout(() => capa.remove(), 3500);
}

/* ---------- Interfaz ---------- */
const $ = (id) => document.getElementById(id);

const ui = {
  primera: true,
  completoAntes: false,
  nuevoId: null,
  marcadoId: null,
  // Animaciones: entrada escalonada al abrir, "pop" al crear y pulso al completar
  decorar(li, id, i) {
    if (this.primera) {
      li.classList.add("entra");
      li.style.animationDelay = i * 60 + "ms";
    }
    if (id === this.nuevoId) li.classList.add("nuevo");
    if (id === this.marcadoId) li.classList.add("pulso");
  },
  saludo() {
    const h = new Date().getHours();
    return h < 12 ? "Buen día" : h < 20 ? "Buenas tardes" : "Buenas noches";
  },
  renderCabecera() {
    $("fecha").textContent = new Date().toLocaleDateString("es-AR", {
      weekday: "long"
    });
    $("sello-dia").textContent = new Date().getDate();
    $("sello-mes").textContent = new Date().toLocaleDateString("es-AR", { month: "short" }).replace(".", "");
    $("saludo").textContent = this.saludo();
  },
  renderProgreso() {
    const hoy = fechas.clave();
    const diaSemana = new Date().getDay();
    const habitosHoy = state.habits.filter((h) => h.dias.includes(diaSemana));
    const hechos = habitosHoy.filter((h) => h.historial.includes(hoy)).length;
    const tareasHoy = state.tasks.filter((t) => t.fecha === hoy);
    const tareasHechas = tareasHoy.filter((t) => t.hecha).length;

    const total = habitosHoy.length + tareasHoy.length;
    const completas = hechos + tareasHechas;
    const pct = total ? Math.round((completas / total) * 100) : 0;

    $("progreso-texto").textContent = `${completas} de ${total}`;
    $("barra").style.setProperty("--pct", pct);
    $("anillo-pct").textContent = pct + "%";
    $("barra").setAttribute("aria-valuenow", pct);

    const mensaje = $("mensaje-dia");
    mensaje.hidden = !(total > 0 && completas === total);
    mensaje.textContent = "¡Día completo! Cumpliste todo lo de hoy.";

    const completo = total > 0 && completas === total;
    document.querySelector(".hero").classList.toggle("completo", completo);
    if (completo && !this.completoAntes && !this.primera) confeti();
    this.completoAntes = completo;
  },
  // Hábitos que tocaban ese día (desde que se crearon) y tareas con esa fecha
  resumenDia(d) {
    const dk = fechas.clave(d);
    const hab = state.habits.filter((h) => h.dias.includes(d.getDay()) && (!h.creado || h.creado <= dk));
    const tar = state.tasks.filter((t) => t.fecha === dk);
    return {
      habTotal: hab.length,
      habHechos: hab.filter((h) => h.historial.includes(dk)).length,
      total: hab.length + tar.length,
      hechos: hab.filter((h) => h.historial.includes(dk)).length + tar.filter((t) => t.hecha).length
    };
  },
  renderSemana() {
    const hoy = fechas.clave();
    const cont = $("semana");
    cont.innerHTML = "";
    fechas.semanaActual().forEach((d) => {
      const dk = fechas.clave(d);
      const futuro = dk > hoy;
      const r = this.resumenDia(d);
      const pct = !futuro && r.total ? Math.round((r.hechos / r.total) * 100) : 0;
      const cuenta = futuro || !r.total ? "–" : `${r.hechos}/${r.total}`;
      const nombre = d.toLocaleDateString("es-AR", { weekday: "short" });

      const celda = document.createElement("div");
      celda.className = "dia" + (dk === hoy ? " hoy" : "");
      celda.innerHTML =
        `<small>${nombre}</small>${d.getDate()}` +
        `<span class="cuenta">${cuenta}</span>` +
        `<span class="mini"><i style="width:${pct}%"></i></span>`;
      cont.appendChild(celda);
    });
  },
  renderStats() {
    const hoy = fechas.clave();
    let previstos = 0, cumplidos = 0;
    fechas.semanaActual().forEach((d) => {
      if (fechas.clave(d) > hoy) return;
      const r = this.resumenDia(d);
      previstos += r.habTotal;
      cumplidos += r.habHechos;
    });

    let mejor = { record: 0, nombre: "" };
    state.habits.forEach((h) => {
      const record = habits.rachas(h).record;
      if (record > mejor.record) mejor = { record, nombre: h.nombre };
    });

    const datos = [
      [previstos ? Math.round((cumplidos / previstos) * 100) + "%" : "–", "Hábitos cumplidos esta semana"],
      [mejor.record ? String(mejor.record) : "–", mejor.record ? "Mejor racha: " + mejor.nombre : "Mejor racha"],
      [`${state.tasks.filter((t) => t.hecha).length}/${state.tasks.length}`, "Tareas completadas"]
    ];

    const dl = $("stats");
    dl.innerHTML = "";
    datos.forEach(([valor, etiqueta]) => {
      const caja = document.createElement("div");
      const dt = document.createElement("dt");
      const dd = document.createElement("dd");
      dt.textContent = etiqueta;
      dd.textContent = valor;
      caja.append(dt, dd);
      dl.appendChild(caja);
    });
  },
  renderHabitos() {
    const lista = $("lista-habitos");
    const hoy = fechas.clave();
    lista.innerHTML = "";

    [...state.habits]
      .sort((a, b) => Number(habits.tocaHoy(b)) - Number(habits.tocaHoy(a)))
      .forEach((h, i) => {
        const toca = habits.tocaHoy(h);
        const hecho = h.historial.includes(hoy);
        const { actual, record } = habits.rachas(h);

        const li = document.createElement("li");
        li.className = "item habito" + (toca ? "" : " no-toca") + (hecho ? " hecha" : "");
        li.dataset.id = h.id;
        li.style.setProperty("--c", h.color || "#0f766e");
        this.decorar(li, h.id, i);

        const chk = document.createElement("input");
        chk.type = "checkbox";
        chk.checked = hecho;
        chk.disabled = !toca;
        chk.dataset.accion = "alternar";
        chk.setAttribute("aria-label", "Marcar hecho hoy: " + h.nombre);

        const cuerpo = document.createElement("div");
        cuerpo.className = "item-cuerpo";
        const titulo = document.createElement("span");
        titulo.className = "item-titulo";
        titulo.textContent = h.nombre;
        const meta = document.createElement("small");
        meta.className = "item-meta";
        meta.textContent = `${habits.textoDias(h)}, récord ${record}` + (toca ? "" : ", hoy no toca");
        cuerpo.append(titulo, meta);

        const racha = document.createElement("span");
        racha.className = "racha";
        racha.textContent = `🔥 ${actual}`;
        racha.title = "Racha actual";

        const acciones = document.createElement("div");
        acciones.className = "item-acciones";
        const bEditar = document.createElement("button");
        bEditar.type = "button";
        bEditar.dataset.accion = "editar";
        bEditar.textContent = "✎";
        bEditar.setAttribute("aria-label", "Editar: " + h.nombre);
        const bBorrar = document.createElement("button");
        bBorrar.type = "button";
        bBorrar.dataset.accion = "eliminar";
        bBorrar.textContent = "✕";
        bBorrar.setAttribute("aria-label", "Eliminar: " + h.nombre);
        acciones.append(bEditar, bBorrar);

        li.append(chk, cuerpo, racha, acciones);
        lista.appendChild(li);
      });
  },
  renderTareas() {
    const lista = $("lista-tareas");
    const hoy = fechas.clave();
    lista.innerHTML = "";

    tasks.visibles().forEach((t, i) => {
      const li = document.createElement("li");
      li.className = `item prio-${t.prioridad}` + (t.hecha ? " hecha" : "");
      li.dataset.id = t.id;
      this.decorar(li, t.id, i);

      const chk = document.createElement("input");
      chk.type = "checkbox";
      chk.checked = t.hecha;
      chk.dataset.accion = "alternar";
      chk.setAttribute("aria-label", "Completar: " + t.titulo);

      const cuerpo = document.createElement("div");
      cuerpo.className = "item-cuerpo";
      const titulo = document.createElement("span");
      titulo.className = "item-titulo";
      titulo.textContent = t.titulo;
      const meta = document.createElement("small");
      meta.className = "item-meta" + (t.fecha && t.fecha < hoy && !t.hecha ? " vencida" : "");
      meta.textContent = `Prioridad ${t.prioridad}, ${tasks.textoFecha(t)}`;
      cuerpo.append(titulo, meta);

      const acciones = document.createElement("div");
      acciones.className = "item-acciones";
      const bEditar = document.createElement("button");
      bEditar.type = "button";
      bEditar.dataset.accion = "editar";
      bEditar.textContent = "✎";
      bEditar.setAttribute("aria-label", "Editar: " + t.titulo);
      const bBorrar = document.createElement("button");
      bBorrar.type = "button";
      bBorrar.dataset.accion = "eliminar";
      bBorrar.textContent = "✕";
      bBorrar.setAttribute("aria-label", "Eliminar: " + t.titulo);
      acciones.append(bEditar, bBorrar);

      li.append(chk, cuerpo, acciones);
      lista.appendChild(li);
    });

    $("vacio-tareas").textContent = state.tasks.length
      ? "No hay tareas con este filtro."
      : "Todavía no hay tareas. Agregá la primera arriba.";

    document.querySelectorAll("#filtros-tareas button").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.filtro === filtroTareas));
    });
  },
  aplicarTema() {
    document.documentElement.dataset.tema = state.settings.tema;
  },
  alternarTema() {
    state.settings.tema = state.settings.tema === "oscuro" ? "claro" : "oscuro";
    this.aplicarTema();
    storage.save();
  },
  render() {
    this.renderCabecera();
    this.renderProgreso();
    this.renderHabitos();
    this.renderTareas();
    this.renderSemana();
    this.renderStats();
    this.primera = false;
    this.nuevoId = null;
    this.marcadoId = null;
  }
};

/* ---------- Inicio ---------- */
function init() {
  storage.load();
  // Si no hay preferencia guardada, respeta el tema del sistema
  if (!localStorage.getItem(CLAVE) && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    state.settings.tema = "oscuro";
  }
  ui.aplicarTema();
  $("btn-tema").addEventListener("click", () => ui.alternarTema());

  // Tareas: alta
  $("tarea-fecha").value = fechas.clave();
  $("form-tarea").addEventListener("submit", (e) => {
    e.preventDefault();
    const titulo = $("tarea-titulo").value.trim();
    if (!titulo) return;
    tasks.agregar(titulo, $("tarea-prioridad").value, $("tarea-fecha").value);
    ui.nuevoId = state.tasks[state.tasks.length - 1].id;
    $("tarea-titulo").value = "";
    $("tarea-titulo").focus();
    ui.render();
  });

  // Tareas: filtros
  $("filtros-tareas").addEventListener("click", (e) => {
    const boton = e.target.closest("button[data-filtro]");
    if (!boton) return;
    filtroTareas = boton.dataset.filtro;
    ui.renderTareas();
  });

  // Tareas: completar, editar y eliminar
  $("lista-tareas").addEventListener("click", (e) => {
    const control = e.target.closest("[data-accion]");
    const item = e.target.closest(".item");
    if (!control || !item) return;
    const id = item.dataset.id;
    const accion = control.dataset.accion;

    if (accion === "alternar") {
      tasks.alternar(id);
      const t = state.tasks.find((x) => x.id === id);
      if (t && t.hecha) ui.marcadoId = id;
    } else if (accion === "editar") {
      const actual = state.tasks.find((t) => t.id === id);
      const nuevo = window.prompt("Editar tarea:", actual ? actual.titulo : "");
      if (nuevo === null) return;
      tasks.editar(id, nuevo);
    } else if (accion === "eliminar") {
      tasks.eliminar(id);
    }
    ui.render();
  });

  // Hábitos: alta
  $("form-habito").addEventListener("submit", (e) => {
    e.preventDefault();
    const nombre = $("habito-nombre").value.trim();
    if (!nombre) return;
    const dias = [...document.querySelectorAll("#form-habito .chip input:checked")].map((c) => Number(c.value));
    if (!dias.length) {
      window.alert("Elegí al menos un día de la semana.");
      return;
    }
    const elegido = document.querySelector('input[name="color-habito"]:checked');
    habits.agregar(nombre, dias, elegido ? elegido.value : "#0f766e");
    ui.nuevoId = state.habits[state.habits.length - 1].id;
    $("habito-nombre").value = "";
    $("habito-nombre").focus();
    ui.render();
  });

  // Hábitos: marcar hoy, editar y eliminar
  $("lista-habitos").addEventListener("click", (e) => {
    const control = e.target.closest("[data-accion]");
    const item = e.target.closest(".item");
    if (!control || !item) return;
    const id = item.dataset.id;
    const accion = control.dataset.accion;

    if (accion === "alternar") {
      habits.alternarHoy(id);
      const h = state.habits.find((x) => x.id === id);
      if (h && h.historial.includes(fechas.clave())) ui.marcadoId = id;
    } else if (accion === "editar") {
      const actual = state.habits.find((h) => h.id === id);
      const nuevo = window.prompt("Editar hábito:", actual ? actual.nombre : "");
      if (nuevo === null) return;
      habits.editar(id, nuevo);
    } else if (accion === "eliminar") {
      if (!window.confirm("¿Eliminar este hábito y todo su historial?")) return;
      habits.eliminar(id);
    }
    ui.render();
  });

  // Respaldo: exportar e importar
  let temporizadorAviso;
  const avisar = (texto) => {
    $("aviso").textContent = texto;
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(() => { $("aviso").textContent = ""; }, 7000);
  };

  $("btn-exportar").addEventListener("click", () => {
    respaldo.exportar();
    avisar("Respaldo descargado. Guardalo en un lugar seguro.");
  });
  $("btn-importar").addEventListener("click", () => $("archivo-importar").click());
  $("archivo-importar").addEventListener("change", async (e) => {
    const archivo = e.target.files[0];
    e.target.value = "";
    if (!archivo) return;
    avisar(await respaldo.importar(archivo));
    ui.render();
  });

  ui.render();
}

document.addEventListener("DOMContentLoaded", init);
