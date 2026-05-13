import { Document, Page, Text, View, StyleSheet, Svg, Polyline, Line } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#0f172a" },
  header: { fontSize: 16, marginBottom: 8, fontWeight: "bold" },
  sub: { fontSize: 9, color: "#64748b", marginBottom: 16 },
  h2: { fontSize: 12, marginTop: 12, marginBottom: 6, fontWeight: "bold" },
  row: { flexDirection: "row", marginBottom: 4 },
  label: { width: 120, color: "#64748b" },
  val: { flex: 1 },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
    paddingBottom: 4,
    marginTop: 8,
    fontWeight: "bold",
  },
  tableRow: { flexDirection: "row", paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: "#e2e8f0" },
  cellTs: { width: 110, fontSize: 8 },
  cellTipo: { width: 120, fontSize: 8 },
  cellSev: { width: 50, fontSize: 8 },
  cellHash: { flex: 1, fontSize: 7 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    fontSize: 8,
    color: "#64748b",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  ok: { color: "#15803d" },
  bad: { color: "#b91c1c" },
});

export interface ColdChainPdfInput {
  locale: "es-AR" | "en";
  tenantNombre: string;
  localNombre: string;
  deviceNombre: string;
  serial: string;
  periodFrom: string;
  periodTo: string;
  emittedAt: string;
  readingsHourly: { label: string; temp: number | null }[];
  tempMin: number | null;
  tempMax: number | null;
  tempAvg: number | null;
  offlineMinutes: number;
  alertCount: number;
  events: { ts: string; tipo: string; severidad: string; hash: string }[];
  primerHash: string | null;
  ultimoHash: string;
  cadenaValida: boolean;
  firmaValida: boolean;
  verifyUrl: string;
  reportId: string;
}

function chartPoints(readings: ColdChainPdfInput["readingsHourly"], w: number, h: number): string {
  const vals = readings.map((r) => r.temp).filter((x): x is number => x != null && !Number.isNaN(x));
  if (vals.length === 0) return "";
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const pad = 4;
  const span = Math.max(0.001, max - min);
  return readings
    .map((r, i) => {
      if (r.temp == null) return null;
      const x = pad + (i / Math.max(1, readings.length - 1)) * (w - pad * 2);
      const y = pad + (1 - (r.temp - min) / span) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .filter(Boolean)
    .join(" ");
}

export function ColdChainPdfDoc(props: ColdChainPdfInput) {
  const L = props.locale === "en";
  const t = {
    title: L ? "Cold chain certification report" : "Reporte de certificación de cadena de frío",
    block1: L ? "Scope" : "Alcance",
    block2: L ? "Internal temperature (hourly average)" : "Temperatura interna (promedio horario)",
    block3: L ? "Statistics" : "Estadísticas",
    block4: L ? "Events" : "Eventos",
    block5: L ? "Cryptographic verification" : "Verificación criptográfica",
    tenant: L ? "Organization" : "Cliente",
    local: L ? "Site" : "Local",
    device: L ? "Device" : "Dispositivo",
    serial: L ? "Serial" : "N.º de serie",
    period: L ? "Period" : "Período",
    tmin: L ? "Min °C" : "Mín °C",
    tmax: L ? "Max °C" : "Máx °C",
    tavg: L ? "Avg °C" : "Prom °C",
    offline: L ? "Offline (min)" : "Offline (min)",
    alerts: L ? "Alerts in period" : "Alertas en período",
    chainOk: L ? "Chain valid" : "Cadena válida",
    sigOk: L ? "Signatures valid" : "Firmas válidas",
    firstH: L ? "First hash" : "Hash inicial",
    lastH: L ? "Last hash" : "Hash final",
    yes: L ? "Yes" : "Sí",
    no: L ? "No" : "No",
    page: L ? "Page" : "Pág.",
    emitted: L ? "Issued" : "Emitido",
    verify: L ? "Verify at" : "Verificar en",
  };

  const cw = 420;
  const ch = 120;
  const pts = chartPoints(props.readingsHourly, cw, ch);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>WCreation</Text>
        <Text style={styles.sub}>{t.title}</Text>

        <Text style={styles.h2}>{t.block1}</Text>
        <View style={styles.row}>
          <Text style={styles.label}>{t.tenant}</Text>
          <Text style={styles.val}>{props.tenantNombre}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>{t.local}</Text>
          <Text style={styles.val}>{props.localNombre}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>{t.device}</Text>
          <Text style={styles.val}>{props.deviceNombre}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>{t.serial}</Text>
          <Text style={styles.val}>{props.serial}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>{t.period}</Text>
          <Text style={styles.val}>
            {props.periodFrom} — {props.periodTo}
          </Text>
        </View>

        <Text style={styles.h2}>{t.block2}</Text>
        <Svg width={cw} height={ch} viewBox={`0 0 ${cw} ${ch}`}>
          <Line x1="4" y1={String(ch - 4)} x2={String(cw - 4)} y2={String(ch - 4)} stroke="#94a3b8" strokeWidth="1" />
          <Line x1="4" y1="4" x2="4" y2={String(ch - 4)} stroke="#94a3b8" strokeWidth="1" />
          {pts ? <Polyline fill="none" stroke="#0f172a" strokeWidth="1.5" points={pts} /> : null}
        </Svg>

        <Text style={styles.h2}>{t.block3}</Text>
        <View style={styles.row}>
          <Text style={styles.label}>{t.tmin}</Text>
          <Text style={styles.val}>{props.tempMin ?? "—"}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>{t.tmax}</Text>
          <Text style={styles.val}>{props.tempMax ?? "—"}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>{t.tavg}</Text>
          <Text style={styles.val}>{props.tempAvg ?? "—"}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>{t.offline}</Text>
          <Text style={styles.val}>{String(props.offlineMinutes)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>{t.alerts}</Text>
          <Text style={styles.val}>{String(props.alertCount)}</Text>
        </View>

        <Text style={styles.h2}>{t.block4}</Text>
        <View style={styles.tableHeader}>
          <Text style={styles.cellTs}>TS</Text>
          <Text style={styles.cellTipo}>Tipo</Text>
          <Text style={styles.cellSev}>Sev</Text>
          <Text style={styles.cellHash}>Hash</Text>
        </View>
        {props.events.slice(0, 40).map((e) => (
          <View key={`${e.ts}-${e.hash}`} style={styles.tableRow} wrap={false}>
            <Text style={styles.cellTs}>{e.ts}</Text>
            <Text style={styles.cellTipo}>{e.tipo}</Text>
            <Text style={styles.cellSev}>{e.severidad}</Text>
            <Text style={styles.cellHash}>{e.hash}</Text>
          </View>
        ))}

        <Text style={styles.h2}>{t.block5}</Text>
        <View style={styles.row}>
          <Text style={styles.label}>{t.firstH}</Text>
          <Text style={styles.val}>{props.primerHash ?? "—"}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>{t.lastH}</Text>
          <Text style={styles.val}>{props.ultimoHash}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>{t.chainOk}</Text>
          <Text style={[styles.val, props.cadenaValida ? styles.ok : styles.bad]}>
            {props.cadenaValida ? t.yes : t.no}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>{t.sigOk}</Text>
          <Text style={[styles.val, props.firmaValida ? styles.ok : styles.bad]}>
            {props.firmaValida ? t.yes : t.no}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>{t.verify}</Text>
          <Text style={styles.val}>{props.verifyUrl}</Text>
        </View>

        <View style={styles.footer} fixed>
          <Text>
            {t.page} 1 · {t.emitted} {props.emittedAt}
          </Text>
          <Text>ID {props.reportId}</Text>
        </View>
      </Page>
    </Document>
  );
}
