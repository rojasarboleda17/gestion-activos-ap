import { PDFDocument, PDFPage, rgb } from "pdf-lib";

type FieldPosition = {
  page: number;
  x: number;
  y: number;
  size?: number;
  maxWidth?: number;
};

type CompraventaField =
  | "city"
  | "date"
  | "buyer_full_name"
  | "buyer_document"
  | "buyer_phone"
  | "buyer_address"
  | "vehicle_class"
  | "vehicle_engine"
  | "vehicle_brand"
  | "vehicle_line"
  | "vehicle_model"
  | "vehicle_plate"
  | "vehicle_vin"
  | "vehicle_color"
  | "vehicle_service"
  | "vehicle_capacity"
  | "vehicle_displacement"
  | "price_text"
  | "price_number"
  | "payment_method_name";

export const FIELD_MAP: Record<CompraventaField, FieldPosition> = {
  city: { page: 0, x: 126, y: 671, size: 10 },
  date: { page: 0, x: 326, y: 671, size: 10 },
  buyer_full_name: { page: 0, x: 160, y: 625, size: 10, maxWidth: 340 },
  buyer_document: { page: 0, x: 150, y: 605, size: 10 },
  buyer_phone: { page: 0, x: 360, y: 605, size: 10 },
  buyer_address: { page: 0, x: 145, y: 585, size: 10, maxWidth: 355 },
  vehicle_class: { page: 0, x: 112, y: 526, size: 9 },
  vehicle_engine: { page: 0, x: 252, y: 526, size: 9 },
  vehicle_brand: { page: 0, x: 396, y: 526, size: 9 },
  vehicle_line: { page: 0, x: 112, y: 505, size: 9 },
  vehicle_model: { page: 0, x: 252, y: 505, size: 9 },
  vehicle_plate: { page: 0, x: 396, y: 505, size: 9 },
  vehicle_vin: { page: 0, x: 112, y: 484, size: 9, maxWidth: 150 },
  vehicle_color: { page: 0, x: 252, y: 484, size: 9 },
  vehicle_service: { page: 0, x: 396, y: 484, size: 9 },
  vehicle_capacity: { page: 0, x: 112, y: 463, size: 9 },
  vehicle_displacement: { page: 0, x: 252, y: 463, size: 9 },
  price_text: { page: 0, x: 150, y: 420, size: 10, maxWidth: 340 },
  price_number: { page: 0, x: 150, y: 400, size: 10 },
  payment_method_name: { page: 1, x: 144, y: 650, size: 10, maxWidth: 350 },
};

// Calibración de coordenadas:
// 1) Generar PDF con ?debug=1 o header X-Debug: 1 para ver grilla cada 50pt y etiquetas x/y.
// 2) Ubicar el marcador rojo del campo y mover (x,y) en FIELD_MAP hasta alinearlo con el input del template.
// 3) Repetir hasta que texto y marcador coincidan con el renglón objetivo.

function getPath(source: unknown, path: string[]): unknown {
  let current = source;
  for (const key of path) {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function firstText(source: unknown, candidates: string[][]): string {
  for (const candidate of candidates) {
    const value = getPath(source, candidate);
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return "";
}

function toDateText(input: string): string {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());
  return `${day}/${month}/${year}`;
}

function buildCompraventaFields(payload: unknown): Record<CompraventaField, string> {
  const buyerFirstNames = firstText(payload, [
    ["sale", "buyer", "first_names"],
    ["sale", "first_names"],
    ["buyer", "first_names"],
  ]);
  const buyerLastNames = firstText(payload, [
    ["sale", "buyer", "last_names"],
    ["sale", "last_names"],
    ["buyer", "last_names"],
  ]);

  const buyerFullName = firstText(payload, [
    ["sale", "buyer", "full_name"],
    ["sale", "full_name"],
    ["buyer", "full_name"],
  ]) || `${buyerFirstNames} ${buyerLastNames}`.trim();

  const createdAt = firstText(payload, [
    ["sale", "date"],
    ["sale", "created_at"],
    ["sale", "document_date"],
  ]);

  return {
    city: firstText(payload, [
      ["sale", "city"],
      ["sale", "buyer", "city"],
      ["buyer", "city"],
    ]),
    date: toDateText(createdAt),
    buyer_full_name: buyerFullName,
    buyer_document: firstText(payload, [
      ["sale", "buyer", "document_id"],
      ["sale", "document_id"],
      ["buyer", "document_id"],
    ]),
    buyer_phone: firstText(payload, [
      ["sale", "buyer", "phone"],
      ["sale", "phone"],
      ["buyer", "phone"],
    ]),
    buyer_address: firstText(payload, [
      ["sale", "buyer", "address"],
      ["sale", "address"],
      ["buyer", "address"],
    ]),
    vehicle_class: firstText(payload, [["vehicle", "class"], ["sale", "vehicle", "class"]]),
    vehicle_engine: firstText(payload, [
      ["vehicle", "motor"],
      ["vehicle", "engine"],
      ["sale", "vehicle", "motor"],
    ]),
    vehicle_brand: firstText(payload, [["vehicle", "brand"], ["sale", "vehicle", "brand"]]),
    vehicle_line: firstText(payload, [["vehicle", "line"], ["sale", "vehicle", "line"]]),
    vehicle_model: firstText(payload, [["vehicle", "model"], ["sale", "vehicle", "model"]]),
    vehicle_plate: firstText(payload, [["vehicle", "plate"], ["sale", "vehicle", "plate"]]),
    vehicle_vin: firstText(payload, [
      ["vehicle", "chassis"],
      ["vehicle", "vin"],
      ["sale", "vehicle", "chassis"],
      ["sale", "vehicle", "vin"],
    ]),
    vehicle_color: firstText(payload, [["vehicle", "color"], ["sale", "vehicle", "color"]]),
    vehicle_service: firstText(payload, [["vehicle", "service"], ["sale", "vehicle", "service"]]),
    vehicle_capacity: firstText(payload, [
      ["vehicle", "capacity"],
      ["sale", "vehicle", "capacity"],
    ]),
    vehicle_displacement: firstText(payload, [
      ["vehicle", "cilindraje"],
      ["vehicle", "displacement"],
      ["sale", "vehicle", "cilindraje"],
    ]),
    price_text: firstText(payload, [
      ["sale", "price_text"],
      ["sale", "price_letters"],
      ["sale", "total_price_text"],
    ]),
    price_number: firstText(payload, [
      ["sale", "price_number"],
      ["sale", "price"],
      ["sale", "total_price"],
    ]),
    payment_method_name: firstText(payload, [
      ["sale", "payment_method_name"],
      ["payment_method_name"],
    ]),
  };
}

function drawDebugMarker(page: PDFPage, field: string, x: number, y: number) {
  page.drawCircle({ x, y, size: 3, color: rgb(1, 0, 0), opacity: 0.85 });
  page.drawRectangle({
    x: x - 2,
    y: y - 2,
    width: 4,
    height: 4,
    borderWidth: 0.8,
    borderColor: rgb(0, 0.4, 1),
    opacity: 0.9,
  });
  page.drawText(field, {
    x: x + 6,
    y: y + 3,
    size: 6,
    color: rgb(0.85, 0.1, 0.1),
  });
}

export function applyCompraventaOverlay(
  pdfDoc: PDFDocument,
  payload: unknown,
  debug: boolean,
): void {
  const pages = pdfDoc.getPages();
  const values = buildCompraventaFields(payload);

  for (const [field, position] of Object.entries(FIELD_MAP) as [CompraventaField, FieldPosition][]) {
    const page = pages[position.page];
    if (!page) {
      continue;
    }

    const text = values[field] ?? "";
    page.drawText(text, {
      x: position.x,
      y: position.y,
      size: position.size ?? 10,
      maxWidth: position.maxWidth,
      color: rgb(0, 0, 0),
    });

    if (debug) {
      drawDebugMarker(page, field, position.x, position.y);
    }
  }
}
