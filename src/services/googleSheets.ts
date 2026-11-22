import { Vehicle } from '../types/fleet';

export const DEFAULT_GTP_DRIVE_FOLDER_ID = '11ALNT-21omKj1GnTLnOQNcoDhEQuNSiw';
export const DEFAULT_GTP_DRIVE_FOLDER_NAME = 'GTP · Sistema de Control';
export const DEFAULT_GTP_DRIVE_FOLDER_URL = `https://drive.google.com/drive/folders/${DEFAULT_GTP_DRIVE_FOLDER_ID}`;

export const GOOGLE_SHEET_MIME = 'application/vnd.google-apps.spreadsheet';
export const GOOGLE_FOLDER_MIME = 'application/vnd.google-apps.folder';

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export interface SheetTabInfo {
  sheetId: number;
  title: string;
  rowCount: number;
  columnCount: number;
}

export interface SpreadsheetMetadata {
  spreadsheetId: string;
  title: string;
  sheets: SheetTabInfo[];
}

export function extractDriveFolderId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9-_]+)/);
  if (folderMatch?.[1]) return folderMatch[1];
  return null;
}

export function extractSpreadsheetId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (trimmed.includes('/folders/')) return null;
  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch?.[1]) return urlMatch[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

async function parseGoogleError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    const message = body?.error?.message;
    if (res.status === 401) {
      return 'Tu sesión de Google expiró. Haz clic en "Sign in with Google" nuevamente.';
    }
    if (res.status === 403) {
      return 'Sin permisos para acceder a este recurso en Google Drive / Sheets. Verifica que tu cuenta tenga acceso compartido.';
    }
    if (res.status === 404) {
      return 'Carpeta u hoja de cálculo no encontrada. Verifica el enlace o ID.';
    }
    return message || `Error de Google Workspace (HTTP ${res.status}).`;
  } catch {
    return `Error de Google Workspace (HTTP ${res.status}).`;
  }
}

export async function listDriveFolderFiles(
  folderId: string,
  accessToken: string
): Promise<DriveFileItem[]> {
  const safeId = folderId.replace(/'/g, "\\'");
  const q = `'${safeId}' in parents and trashed = false`;
  const params = new URLSearchParams({
    q,
    fields: 'files(id,name,mimeType,modifiedTime,webViewLink)',
    orderBy: 'folder,modifiedTime desc',
    pageSize: '100',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  });
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(await parseGoogleError(res));
  }
  const data = await res.json();
  return (data.files || []) as DriveFileItem[];
}

export async function listSharedSpreadsheets(accessToken: string): Promise<DriveFileItem[]> {
  const q = `mimeType = '${GOOGLE_SHEET_MIME}' and trashed = false`;
  const params = new URLSearchParams({
    q,
    fields: 'files(id,name,mimeType,modifiedTime,webViewLink)',
    orderBy: 'modifiedTime desc',
    pageSize: '30',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  });
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(await parseGoogleError(res));
  }
  const data = await res.json();
  return (data.files || []) as DriveFileItem[];
}

export async function downloadDriveTextFile(
  fileId: string,
  accessToken: string
): Promise<string> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      fileId
    )}?alt=media&supportsAllDrives=true`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!res.ok) {
    throw new Error(await parseGoogleError(res));
  }
  return await res.text();
}

export async function fetchSpreadsheetMetadata(
  spreadsheetId: string,
  accessToken: string
): Promise<SpreadsheetMetadata> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}?fields=properties.title,sheets.properties(sheetId,title,gridProperties)`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(await parseGoogleError(res));
  }
  const data = await res.json();
  const sheets: SheetTabInfo[] = (data.sheets || []).map(
    (s: {
      properties?: {
        sheetId?: number;
        title?: string;
        gridProperties?: { rowCount?: number; columnCount?: number };
      };
    }) => ({
      sheetId: s.properties?.sheetId ?? 0,
      title: s.properties?.title ?? 'Hoja 1',
      rowCount: s.properties?.gridProperties?.rowCount ?? 0,
      columnCount: s.properties?.gridProperties?.columnCount ?? 0,
    })
  );
  return {
    spreadsheetId,
    title: data.properties?.title || 'Hoja sin título',
    sheets,
  };
}

export async function readSheetValues(
  spreadsheetId: string,
  sheetTitle: string,
  accessToken: string
): Promise<string[][]> {
  const escapedTitle = sheetTitle.replace(/'/g, "''");
  const range = encodeURIComponent(`'${escapedTitle}'!A1:Z1500`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}/values/${range}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(await parseGoogleError(res));
  }
  const data = await res.json();
  return (data.values || []) as string[][];
}

export const FLEET_EXPORT_HEADERS = [
  'Codigo',
  'Nombre',
  'Tipo',
  'Marca',
  'Modelo',
  'Placa',
  'Estado',
  'Horometro',
  'Odometro',
  'Grupo',
  'PM_Proximo',
  'Sticker_HSE',
  'Vencimiento_HSE',
];

export function buildFleetSheetRows(vehicles: Vehicle[]): string[][] {
  return [
    FLEET_EXPORT_HEADERS,
    ...vehicles.map((v) => [
      v.code,
      v.name,
      v.type,
      v.make,
      v.model,
      v.licensePlate,
      v.status,
      String(v.horometerHrs),
      String(v.odometerKm),
      v.group,
      `${v.nextPmLevel} (${v.nextPmHours}h)`,
      v.hseStickerCode,
      v.hseStickerExpiry,
    ]),
  ];
}

export async function writeFleetToSheet(
  spreadsheetId: string,
  sheetTitle: string,
  vehicles: Vehicle[],
  accessToken: string
): Promise<{ updatedRows: number; updatedRange: string }> {
  const values = buildFleetSheetRows(vehicles);
  const escapedTitle = sheetTitle.replace(/'/g, "''");
  const range = `'${escapedTitle}'!A1:M${values.length}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      range,
      majorDimension: 'ROWS',
      values,
    }),
  });
  if (!res.ok) {
    throw new Error(await parseGoogleError(res));
  }
  const data = await res.json();
  return {
    updatedRows: data.updatedRows ?? values.length,
    updatedRange: data.updatedRange ?? range,
  };
}
