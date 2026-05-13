export type NotifyLocale = "es-AR" | "en";

export interface TemplateVars {
  deviceId: string;
  deviceNombre: string;
  serial: string;
  localNombre: string;
  tenantNombre: string;
  tipo: string;
  severidad: string;
  valorLinea: string;
  fechaHora: string;
  detailUrl: string;
  verifyUrl: string;
}

type Row = {
  email?: { subject: string; html: (v: TemplateVars) => string };
  push?: { title: string; body: (v: TemplateVars) => string };
  telegram?: { md: (v: TemplateVars) => string };
};

function emailDoc(title: string, inner: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title}</title></head><body style="font-family:system-ui,sans-serif;background:#f8fafc;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;border:1px solid #e2e8f0;">${inner}
  <p style="font-size:12px;color:#64748b;margin-top:24px;">WCreation · Cadena de frío certificada</p></div></body></html>`;
}

const esAR: Record<string, Row> = {
  umbral_excedido_temp: {
    email: {
      subject: "Alerta · Temperatura fuera de umbral",
      html: (v) =>
        emailDoc(
          "Temperatura",
          `<h1 style="font-size:18px;">Temperatura fuera de rango</h1>
        <p><strong>Dispositivo:</strong> ${v.deviceNombre} (${v.serial})</p>
        <p><strong>Local:</strong> ${v.localNombre}</p>
        <p><strong>Cliente:</strong> ${v.tenantNombre}</p>
        <p><strong>Detalle:</strong> ${v.valorLinea}</p>
        <p><strong>Hora:</strong> ${v.fechaHora}</p>
        <p><a href="${v.detailUrl}">Ver en WCreation</a> · <a href="${v.verifyUrl}">Verificar firma</a></p>`,
        ),
    },
    push: {
      title: "Temperatura fuera de umbral",
      body: (v) => `${v.deviceNombre}: ${v.valorLinea}`,
    },
    telegram: {
      md: (v) =>
        `🔴 *Alerta · Temperatura*\nDispositivo: ${v.deviceNombre} (${v.serial})\nLocal: ${v.localNombre}\n${v.valorLinea}\nHora: ${v.fechaHora}\n[Ver detalle](${v.detailUrl}) · [Verificar firma](${v.verifyUrl})`,
    },
  },
  corte_red: {
    email: {
      subject: "Alerta crítica · Corte de red eléctrica",
      html: (v) =>
        emailDoc(
          "Corte de red",
          `<h1 style="font-size:18px;color:#b91c1c;">Corte de red eléctrica</h1>
        <p><strong>Dispositivo:</strong> ${v.deviceNombre} (${v.serial})</p>
        <p><strong>Local:</strong> ${v.localNombre}</p>
        <p><strong>Hora:</strong> ${v.fechaHora}</p>
        <p><a href="${v.detailUrl}">Ver en WCreation</a></p>`,
        ),
    },
    push: {
      title: "Corte de red eléctrica",
      body: (v) => `${v.deviceNombre} — ${v.localNombre}`,
    },
    telegram: {
      md: (v) =>
        `🔴 *Alerta crítica · Corte de red*\nDispositivo: ${v.deviceNombre} (${v.serial})\nLocal: ${v.localNombre}\nHora: ${v.fechaHora}\n[Ver detalle](${v.detailUrl})`,
    },
  },
  puerta_prolongada: {
    push: {
      title: "Puerta abierta prolongada",
      body: (v) => `${v.deviceNombre}: revisá el equipo`,
    },
    telegram: {
      md: (v) =>
        `🟡 *Puerta prolongada*\nDispositivo: ${v.deviceNombre} (${v.serial})\nLocal: ${v.localNombre}\nHora: ${v.fechaHora}\n[Ver detalle](${v.detailUrl})`,
    },
  },
  bateria_baja: {
    telegram: {
      md: (v) =>
        `🟡 *Batería baja*\nDispositivo: ${v.deviceNombre} (${v.serial})\n${v.valorLinea}\nHora: ${v.fechaHora}`,
    },
  },
  dispositivo_offline: {
    email: {
      subject: "Dispositivo sin conexión",
      html: (v) =>
        emailDoc(
          "Offline",
          `<h1 style="font-size:18px;">Dispositivo sin conexión</h1>
        <p><strong>Dispositivo:</strong> ${v.deviceNombre} (${v.serial})</p>
        <p><strong>Local:</strong> ${v.localNombre}</p>
        <p><strong>Hora:</strong> ${v.fechaHora}</p>
        <p><a href="${v.detailUrl}">Ver en WCreation</a></p>`,
        ),
    },
    push: {
      title: "Dispositivo sin conexión",
      body: (v) => `${v.deviceNombre} — ${v.localNombre}`,
    },
    telegram: {
      md: (v) =>
        `🟠 *Dispositivo offline*\n${v.deviceNombre} (${v.serial})\nLocal: ${v.localNombre}\nHora: ${v.fechaHora}\n[Ver detalle](${v.detailUrl})`,
    },
  },
  cadena_frio_perdida: {
    email: {
      subject: "CRÍTICO · Posible ruptura de cadena de frío",
      html: (v) =>
        emailDoc(
          "Cadena de frío",
          `<h1 style="font-size:20px;color:#b91c1c;">Cadena de frío</h1>
        <p><strong>Dispositivo:</strong> ${v.deviceNombre} (${v.serial})</p>
        <p><strong>Local:</strong> ${v.localNombre}</p>
        <p><strong>Detalle:</strong> ${v.valorLinea}</p>
        <p><strong>Hora:</strong> ${v.fechaHora}</p>
        <p><a href="${v.detailUrl}">Ver en WCreation</a> · <a href="${v.verifyUrl}">Verificar firma</a></p>`,
        ),
    },
    push: {
      title: "CRÍTICO · Cadena de frío",
      body: (v) => `${v.deviceNombre}: ${v.valorLinea}`,
    },
    telegram: {
      md: (v) =>
        `🔴 *Alerta crítica · Cadena de frío*\nDispositivo: ${v.deviceNombre} (${v.serial})\nLocal: ${v.localNombre}\nEvento: ${v.valorLinea}\nHora: ${v.fechaHora}\n[Ver detalle](${v.detailUrl}) · [Verificar firma](${v.verifyUrl})`,
    },
  },
};

const en: Record<string, Row> = {
  umbral_excedido_temp: {
    email: {
      subject: "Alert · Temperature threshold exceeded",
      html: (v) =>
        emailDoc(
          "Temperature",
          `<h1 style="font-size:18px;">Temperature out of range</h1>
        <p><strong>Device:</strong> ${v.deviceNombre} (${v.serial})</p>
        <p><strong>Site:</strong> ${v.localNombre}</p>
        <p><strong>Organization:</strong> ${v.tenantNombre}</p>
        <p><strong>Detail:</strong> ${v.valorLinea}</p>
        <p><strong>Time:</strong> ${v.fechaHora}</p>
        <p><a href="${v.detailUrl}">Open WCreation</a> · <a href="${v.verifyUrl}">Verify signature</a></p>`,
        ),
    },
    push: {
      title: "Temperature threshold exceeded",
      body: (v) => `${v.deviceNombre}: ${v.valorLinea}`,
    },
    telegram: {
      md: (v) =>
        `🔴 *Alert · Temperature*\nDevice: ${v.deviceNombre} (${v.serial})\nSite: ${v.localNombre}\n${v.valorLinea}\nTime: ${v.fechaHora}\n[Details](${v.detailUrl}) · [Verify](${v.verifyUrl})`,
    },
  },
  corte_red: {
    email: {
      subject: "Critical · Mains power loss",
      html: (v) =>
        emailDoc(
          "Power",
          `<h1 style="font-size:18px;color:#b91c1c;">Mains power loss</h1>
        <p><strong>Device:</strong> ${v.deviceNombre} (${v.serial})</p>
        <p><strong>Site:</strong> ${v.localNombre}</p>
        <p><strong>Time:</strong> ${v.fechaHora}</p>
        <p><a href="${v.detailUrl}">Open WCreation</a></p>`,
        ),
    },
    push: {
      title: "Mains power loss",
      body: (v) => `${v.deviceNombre} — ${v.localNombre}`,
    },
    telegram: {
      md: (v) =>
        `🔴 *Critical · Power loss*\nDevice: ${v.deviceNombre} (${v.serial})\nSite: ${v.localNombre}\nTime: ${v.fechaHora}\n[Details](${v.detailUrl})`,
    },
  },
  puerta_prolongada: {
    push: {
      title: "Door open too long",
      body: (v) => `${v.deviceNombre}: please check`,
    },
    telegram: {
      md: (v) =>
        `🟡 *Door open*\nDevice: ${v.deviceNombre} (${v.serial})\nSite: ${v.localNombre}\nTime: ${v.fechaHora}\n[Details](${v.detailUrl})`,
    },
  },
  bateria_baja: {
    telegram: {
      md: (v) =>
        `🟡 *Low battery*\nDevice: ${v.deviceNombre} (${v.serial})\n${v.valorLinea}\nTime: ${v.fechaHora}`,
    },
  },
  dispositivo_offline: {
    email: {
      subject: "Device offline",
      html: (v) =>
        emailDoc(
          "Offline",
          `<h1 style="font-size:18px;">Device offline</h1>
        <p><strong>Device:</strong> ${v.deviceNombre} (${v.serial})</p>
        <p><strong>Site:</strong> ${v.localNombre}</p>
        <p><strong>Time:</strong> ${v.fechaHora}</p>
        <p><a href="${v.detailUrl}">Open WCreation</a></p>`,
        ),
    },
    push: {
      title: "Device offline",
      body: (v) => `${v.deviceNombre} — ${v.localNombre}`,
    },
    telegram: {
      md: (v) =>
        `🟠 *Device offline*\n${v.deviceNombre} (${v.serial})\nSite: ${v.localNombre}\nTime: ${v.fechaHora}\n[Details](${v.detailUrl})`,
    },
  },
  cadena_frio_perdida: {
    email: {
      subject: "CRITICAL · Cold chain at risk",
      html: (v) =>
        emailDoc(
          "Cold chain",
          `<h1 style="font-size:20px;color:#b91c1c;">Cold chain</h1>
        <p><strong>Device:</strong> ${v.deviceNombre} (${v.serial})</p>
        <p><strong>Site:</strong> ${v.localNombre}</p>
        <p><strong>Detail:</strong> ${v.valorLinea}</p>
        <p><strong>Time:</strong> ${v.fechaHora}</p>
        <p><a href="${v.detailUrl}">Open WCreation</a> · <a href="${v.verifyUrl}">Verify signature</a></p>`,
        ),
    },
    push: {
      title: "CRITICAL · Cold chain",
      body: (v) => `${v.deviceNombre}: ${v.valorLinea}`,
    },
    telegram: {
      md: (v) =>
        `🔴 *Critical · Cold chain*\nDevice: ${v.deviceNombre} (${v.serial})\nSite: ${v.localNombre}\nEvent: ${v.valorLinea}\nTime: ${v.fechaHora}\n[Details](${v.detailUrl}) · [Verify](${v.verifyUrl})`,
    },
  },
};

const tables: Record<NotifyLocale, Record<string, Row>> = {
  "es-AR": esAR,
  en,
};

export function renderNotificationTemplate(
  locale: NotifyLocale,
  tipo: string,
  canal: "email" | "push" | "telegram",
  vars: TemplateVars,
): { subject?: string; html?: string; title?: string; body?: string; md?: string } | null {
  const row = tables[locale][tipo] ?? tables["es-AR"][tipo];
  if (!row) return null;
  if (canal === "email" && row.email) {
    return { subject: row.email.subject, html: row.email.html(vars) };
  }
  if (canal === "push" && row.push) {
    return { title: row.push.title, body: row.push.body(vars) };
  }
  if (canal === "telegram" && row.telegram) {
    return { md: row.telegram.md(vars) };
  }
  return null;
}
