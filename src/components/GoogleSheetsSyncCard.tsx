import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  CloudDownload,
  CloudUpload,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderOpen,
  LogOut,
  RefreshCw,
  Table2,
} from 'lucide-react';
import { Modal } from './Modal';
import {
  getGoogleAccessToken,
  initGoogleAuth,
  signInWithGoogleSheets,
  signOutGoogle,
} from '../services/googleAuth';
import {
  DEFAULT_GTP_DRIVE_FOLDER_ID,
  DEFAULT_GTP_DRIVE_FOLDER_NAME,
  DEFAULT_GTP_DRIVE_FOLDER_URL,
  downloadDriveTextFile,
  DriveFileItem,
  extractDriveFolderId,
  extractSpreadsheetId,
  fetchSpreadsheetMetadata,
  GOOGLE_FOLDER_MIME,
  GOOGLE_SHEET_MIME,
  listDriveFolderFiles,
  listSharedSpreadsheets,
  readSheetValues,
  SpreadsheetMetadata,
  writeFleetToSheet,
} from '../services/googleSheets';
import { useFleet } from '../store/FleetContext';

const PREF_STORAGE_KEY = 'vektor_flota_gsheets_prefs_v2';

interface SavedPrefs {
  resourceInput: string;
  selectedTab: string;
}

interface FolderCrumb {
  id: string;
  name: string;
}

function loadPrefs(): SavedPrefs {
  try {
    const raw = localStorage.getItem(PREF_STORAGE_KEY);
    if (!raw) {
      return { resourceInput: DEFAULT_GTP_DRIVE_FOLDER_URL, selectedTab: '' };
    }
    const parsed = JSON.parse(raw);
    return {
      resourceInput:
        typeof parsed.resourceInput === 'string' && parsed.resourceInput.trim()
          ? parsed.resourceInput
          : DEFAULT_GTP_DRIVE_FOLDER_URL,
      selectedTab: typeof parsed.selectedTab === 'string' ? parsed.selectedTab : '',
    };
  } catch {
    return { resourceInput: DEFAULT_GTP_DRIVE_FOLDER_URL, selectedTab: '' };
  }
}

export const GoogleSheetsSyncCard: React.FC = () => {
  const { state, can, importFleetMatrix, importFleetRowsFromText } = useFleet();
  const initialPrefs = loadPrefs();

  const [user, setUser] = useState<User | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [resourceInput, setResourceInput] = useState(initialPrefs.resourceInput);
  const [browseMode, setBrowseMode] = useState<'folder' | 'shared'>('folder');
  const [folderPath, setFolderPath] = useState<FolderCrumb[]>([
    { id: DEFAULT_GTP_DRIVE_FOLDER_ID, name: DEFAULT_GTP_DRIVE_FOLDER_NAME },
  ]);
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);

  const [metadata, setMetadata] = useState<SpreadsheetMetadata | null>(null);
  const [selectedTab, setSelectedTab] = useState(initialPrefs.selectedTab);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);

  const [busyAction, setBusyAction] = useState<'browse' | 'sheet' | 'pull' | 'push' | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmPushOpen, setConfirmPushOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = initGoogleAuth(
      (authedUser) => {
        setUser(authedUser);
        setNeedsAuth(false);
      },
      (knownUser) => {
        setUser(knownUser);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        PREF_STORAGE_KEY,
        JSON.stringify({ resourceInput, selectedTab })
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [resourceInput, selectedTab]);

  const requireToken = (): string | null => {
    const token = getGoogleAccessToken();
    if (!token) {
      setNeedsAuth(true);
      setFeedback({
        ok: false,
        text: 'Tu sesión de Google no está activa. Haz clic en "Sign in with Google" para continuar.',
      });
      return null;
    }
    return token;
  };

  const browseFolder = async (
    folderId: string,
    folderName: string,
    token: string,
    resetPath = false
  ) => {
    setBusyAction('browse');
    setFeedback(null);
    setBrowseMode('folder');
    try {
      const files = await listDriveFolderFiles(folderId, token);
      setDriveFiles(files);
      if (resetPath) {
        setFolderPath([{ id: folderId, name: folderName }]);
      }
      setFeedback({
        ok: true,
        text: `Carpeta "${folderName}" abierta · ${files.length} elemento(s) encontrado(s).`,
      });
    } catch (err) {
      setFeedback({
        ok: false,
        text: err instanceof Error ? err.message : 'No se pudo listar la carpeta en Google Drive.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const loadSharedSheets = async (token: string) => {
    setBusyAction('browse');
    setFeedback(null);
    setBrowseMode('shared');
    try {
      const files = await listSharedSpreadsheets(token);
      setDriveFiles(files);
      setFeedback({
        ok: true,
        text: `${files.length} hoja(s) de Google Sheets accesibles desde tu cuenta.`,
      });
    } catch (err) {
      setFeedback({
        ok: false,
        text: err instanceof Error ? err.message : 'No se pudieron listar las hojas compartidas.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const openSpreadsheet = async (spreadsheetId: string, token: string) => {
    setBusyAction('sheet');
    setFeedback(null);
    try {
      const meta = await fetchSpreadsheetMetadata(spreadsheetId, token);
      setMetadata(meta);
      const preferredTab =
        meta.sheets.find((s) => s.title === selectedTab)?.title ||
        meta.sheets.find((s) => /flota|equipos|vehicul|fleet|volquete/i.test(s.title))?.title ||
        meta.sheets[0]?.title ||
        '';
      setSelectedTab(preferredTab);

      if (preferredTab) {
        const rows = await readSheetValues(spreadsheetId, preferredTab, token);
        setPreviewRows(rows.slice(0, 6));
        setFeedback({
          ok: true,
          text: `Hoja "${meta.title}" lista · ${meta.sheets.length} pestaña(s) · ${Math.max(
            0,
            rows.length - 1
          )} fila(s) en "${preferredTab}".`,
        });
      }
    } catch (err) {
      setFeedback({
        ok: false,
        text: err instanceof Error ? err.message : 'No se pudo abrir la hoja de cálculo.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoggingIn(true);
    setFeedback(null);
    try {
      const result = await signInWithGoogleSheets();
      setUser(result.user);
      setNeedsAuth(false);
      // Automatically open GTP · Sistema de Control folder right after sign-in
      const folderId = extractDriveFolderId(resourceInput) || DEFAULT_GTP_DRIVE_FOLDER_ID;
      const sheetId = extractSpreadsheetId(resourceInput);
      if (sheetId) {
        await openSpreadsheet(sheetId, result.accessToken);
      } else {
        await browseFolder(
          folderId,
          folderId === DEFAULT_GTP_DRIVE_FOLDER_ID
            ? DEFAULT_GTP_DRIVE_FOLDER_NAME
            : 'Carpeta Drive',
          result.accessToken,
          true
        );
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'No se pudo iniciar sesión con Google.';
      setFeedback({ ok: false, text: message });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleSignOut = async () => {
    await signOutGoogle();
    setUser(null);
    setNeedsAuth(true);
    setDriveFiles([]);
    setMetadata(null);
    setPreviewRows([]);
    setFeedback(null);
  };

  const handleOpenResourceInput = async () => {
    const token = requireToken();
    if (!token) return;
    const folderId = extractDriveFolderId(resourceInput);
    if (folderId) {
      await browseFolder(
        folderId,
        folderId === DEFAULT_GTP_DRIVE_FOLDER_ID
          ? DEFAULT_GTP_DRIVE_FOLDER_NAME
          : 'Carpeta personalizada',
        token,
        true
      );
      return;
    }
    const sheetId = extractSpreadsheetId(resourceInput);
    if (sheetId) {
      await openSpreadsheet(sheetId, token);
      return;
    }
    setFeedback({
      ok: false,
      text: 'Pega un enlace de carpeta de Google Drive o un enlace/ID de Google Sheets.',
    });
  };

  const handleDriveItemClick = async (item: DriveFileItem) => {
    const token = requireToken();
    if (!token) return;

    if (item.mimeType === GOOGLE_FOLDER_MIME) {
      setFolderPath((prev) => [...prev, { id: item.id, name: item.name }]);
      await browseFolder(item.id, item.name, token, false);
      return;
    }

    if (item.mimeType === GOOGLE_SHEET_MIME) {
      await openSpreadsheet(item.id, token);
      return;
    }

    if (item.mimeType === 'text/csv' || /\.(csv|tsv|txt)$/i.test(item.name)) {
      setBusyAction('pull');
      setFeedback(null);
      try {
        const csvText = await downloadDriveTextFile(item.id, token);
        const res = importFleetRowsFromText(csvText);
        if (!res.ok) {
          setFeedback({
            ok: false,
            text: res.error || `No se pudieron importar filas desde ${item.name}.`,
          });
        } else {
          const { imported = 0, updated = 0 } = res.data || {};
          setFeedback({
            ok: true,
            text: `Archivo "${item.name}" importado: ${imported} equipo(s) nuevo(s) y ${updated} actualizado(s).`,
          });
        }
      } catch (err) {
        setFeedback({
          ok: false,
          text: err instanceof Error ? err.message : `Error al leer ${item.name}.`,
        });
      } finally {
        setBusyAction(null);
      }
      return;
    }

    setFeedback({
      ok: false,
      text: `"${item.name}" no es una Google Sheet ni CSV. Ábrelo en Google Drive y guárdalo como Hoja de cálculo de Google para sincronizarlo en vivo.`,
    });
  };

  const handleBreadcrumbClick = async (idx: number) => {
    const token = requireToken();
    if (!token) return;
    const target = folderPath[idx];
    setFolderPath(folderPath.slice(0, idx + 1));
    await browseFolder(target.id, target.name, token, false);
  };

  const handleChangeTab = async (nextTab: string) => {
    setSelectedTab(nextTab);
    if (!metadata || !nextTab) return;
    const token = requireToken();
    if (!token) return;
    setBusyAction('sheet');
    setFeedback(null);
    try {
      const rows = await readSheetValues(metadata.spreadsheetId, nextTab, token);
      setPreviewRows(rows.slice(0, 6));
      setFeedback({
        ok: true,
        text: `Pestaña "${nextTab}" cargada (${Math.max(0, rows.length - 1)} fila(s) de datos).`,
      });
    } catch (err) {
      setFeedback({
        ok: false,
        text: err instanceof Error ? err.message : 'No se pudo leer la pestaña seleccionada.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handlePullFromSheets = async () => {
    if (!metadata || !selectedTab) return;
    const token = requireToken();
    if (!token) return;

    setBusyAction('pull');
    setFeedback(null);
    try {
      const rows = await readSheetValues(metadata.spreadsheetId, selectedTab, token);
      setPreviewRows(rows.slice(0, 6));
      const res = importFleetMatrix(rows, `Google Sheets · ${metadata.title} (${selectedTab})`);
      if (!res.ok) {
        setFeedback({
          ok: false,
          text: res.error || 'No se pudieron importar filas válidas desde la pestaña.',
        });
      } else {
        const { imported = 0, updated = 0 } = res.data || {};
        setFeedback({
          ok: true,
          text: `Sincronización desde "${metadata.title} → ${selectedTab}" completada: ${imported} equipo(s) nuevo(s) y ${updated} actualizado(s).`,
        });
      }
    } catch (err) {
      setFeedback({
        ok: false,
        text: err instanceof Error ? err.message : 'Error al leer datos desde Google Sheets.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleConfirmedPushToSheets = async () => {
    setConfirmPushOpen(false);
    if (!metadata || !selectedTab) return;
    const token = requireToken();
    if (!token) return;

    setBusyAction('push');
    setFeedback(null);
    try {
      const result = await writeFleetToSheet(
        metadata.spreadsheetId,
        selectedTab,
        state.vehicles,
        token
      );
      const refreshed = await readSheetValues(metadata.spreadsheetId, selectedTab, token);
      setPreviewRows(refreshed.slice(0, 6));
      setFeedback({
        ok: true,
        text: `Hoja actualizada en Google Sheets (${result.updatedRange} · ${result.updatedRows} fila(s) escritas).`,
      });
    } catch (err) {
      setFeedback({
        ok: false,
        text: err instanceof Error ? err.message : 'Error al escribir en Google Sheets.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Table2 className="h-4 w-4 text-blue-700" />
            <h2 className="text-sm font-semibold text-slate-900">
              Conexión en Vivo · Google Drive ({DEFAULT_GTP_DRIVE_FOLDER_NAME}) y Google Sheets
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Preconfigurado con tu carpeta compartida <span className="font-semibold text-slate-700">{DEFAULT_GTP_DRIVE_FOLDER_NAME}</span>. Explora sus subcarpetas, abre tus hojas de Google Sheets o CSV en vivo y sincroniza tu flota con confirmación previa.
          </p>
        </div>

        {!needsAuth && user && (
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className="text-xs font-medium text-slate-800">
                {user.displayName || 'Cuenta Google conectada'}
              </div>
              <div className="font-mono text-[11px] text-slate-500">{user.email}</div>
            </div>
            <button
              type="button"
              onClick={handleGoogleSignOut}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <LogOut className="h-3.5 w-3.5" />
              Desconectar
            </button>
          </div>
        )}
      </div>

      {needsAuth ? (
        <div className="mt-4 flex flex-col gap-3 rounded-md border border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1 text-xs text-slate-600">
            <div>
              Inicia sesión con tu cuenta de Google para abrir automáticamente{' '}
              <span className="font-semibold text-slate-800">{DEFAULT_GTP_DRIVE_FOLDER_NAME}</span>{' '}
              y tus hojas compartidas (como <span className="font-mono">Hermes Panamá</span> o{' '}
              <span className="font-mono">Volquetes</span>).
            </div>
            <div className="font-mono text-[11px] text-slate-400">
              Carpeta destino: {DEFAULT_GTP_DRIVE_FOLDER_ID}
            </div>
          </div>
          <button
            type="button"
            disabled={isLoggingIn}
            onClick={handleGoogleSignIn}
            className="inline-flex h-10 items-center justify-center gap-2.5 rounded-md border border-slate-300 bg-white px-4 text-xs font-medium text-slate-800 shadow-2xs transition-colors hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <svg
              version="1.1"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 48 48"
              className="h-4 w-4 block shrink-0"
              aria-hidden="true"
            >
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
              />
            </svg>
            <span>{isLoggingIn ? 'Conectando...' : 'Sign in with Google'}</span>
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {/* Folder / URL Bar + Quick Source Switch */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto]">
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Carpeta de Google Drive o enlace directo de Google Sheets
              </label>
              <input
                type="text"
                value={resourceInput}
                onChange={(e) => setResourceInput(e.target.value)}
                placeholder={DEFAULT_GTP_DRIVE_FOLDER_URL}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3 font-mono text-xs text-slate-800 focus:border-blue-700 focus:outline-none"
              />
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <button
                type="button"
                disabled={busyAction !== null || !resourceInput.trim()}
                onClick={handleOpenResourceInput}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-slate-900 px-3.5 text-xs font-medium text-white hover:bg-slate-800 disabled:bg-slate-300 whitespace-nowrap shrink-0"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${busyAction === 'browse' ? 'animate-spin' : ''}`}
                />
                Abrir enlace
              </button>
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => {
                  const token = requireToken();
                  if (!token) return;
                  setResourceInput(DEFAULT_GTP_DRIVE_FOLDER_URL);
                  browseFolder(
                    DEFAULT_GTP_DRIVE_FOLDER_ID,
                    DEFAULT_GTP_DRIVE_FOLDER_NAME,
                    token,
                    true
                  );
                }}
                className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-medium whitespace-nowrap shrink-0 ${
                  browseMode === 'folder'
                    ? 'border-blue-700 bg-blue-50 text-blue-800'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <FolderOpen className="h-3.5 w-3.5" />
                GTP · Sistema de Control
              </button>
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => {
                  const token = requireToken();
                  if (!token) return;
                  loadSharedSheets(token);
                }}
                className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-medium whitespace-nowrap shrink-0 ${
                  browseMode === 'shared'
                    ? 'border-blue-700 bg-blue-50 text-blue-800'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Todas mis Sheets
              </button>
            </div>
          </div>

          {/* Drive Folder Browser */}
          <div className="rounded-md border border-slate-200 bg-slate-50/40">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3.5 py-2 text-xs">
              <div className="flex flex-wrap items-center gap-1 text-slate-700">
                {browseMode === 'folder' ? (
                  folderPath.map((crumb, idx) => (
                    <React.Fragment key={crumb.id}>
                      {idx > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
                      <button
                        type="button"
                        onClick={() => handleBreadcrumbClick(idx)}
                        className={`hover:text-blue-700 ${
                          idx === folderPath.length - 1
                            ? 'font-semibold text-slate-900'
                            : 'text-slate-600'
                        }`}
                      >
                        {crumb.name}
                      </button>
                    </React.Fragment>
                  ))
                ) : (
                  <span className="font-semibold text-slate-900">
                    Hojas de Google Sheets accesibles (propias y compartidas)
                  </span>
                )}
              </div>
              <span className="font-mono text-[11px] text-slate-400">
                {driveFiles.length} elemento(s)
              </span>
            </div>

            {driveFiles.length === 0 ? (
              <div className="px-4 py-5 text-center text-xs text-slate-500">
                {busyAction === 'browse'
                  ? 'Consultando Google Drive...'
                  : 'No se encontraron archivos en esta ubicación. Verifica que la carpeta esté compartida con tu cuenta de Google o cambia a "Todas mis Sheets".'}
              </div>
            ) : (
              <div className="max-h-56 divide-y divide-slate-100 overflow-y-auto bg-white">
                {driveFiles.map((file) => {
                  const isFolder = file.mimeType === GOOGLE_FOLDER_MIME;
                  const isSheet = file.mimeType === GOOGLE_SHEET_MIME;
                  const isCsv =
                    file.mimeType === 'text/csv' || /\.(csv|tsv|txt)$/i.test(file.name);
                  const isActiveSheet = metadata?.spreadsheetId === file.id;

                  return (
                    <button
                      key={file.id}
                      type="button"
                      disabled={busyAction !== null}
                      onClick={() => handleDriveItemClick(file)}
                      className={`flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-xs transition-colors hover:bg-slate-50 ${
                        isActiveSheet ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        {isFolder ? (
                          <Folder className="h-4 w-4 shrink-0 text-amber-600" />
                        ) : isSheet ? (
                          <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-700" />
                        ) : (
                          <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                        )}
                        <div className="min-w-0">
                          <div className="truncate font-medium text-slate-900">{file.name}</div>
                          <div className="text-[11px] text-slate-400">
                            {isFolder
                              ? 'Carpeta · Clic para explorar'
                              : isSheet
                              ? 'Google Sheets · Clic para ver pestañas'
                              : isCsv
                              ? 'Archivo CSV · Clic para importar flota'
                              : 'Archivo en Drive'}
                          </div>
                        </div>
                      </div>
                      <span className="shrink-0 text-[11px] font-medium text-blue-700">
                        {isFolder
                          ? 'Abrir'
                          : isSheet
                          ? isActiveSheet
                            ? 'Seleccionada'
                            : 'Seleccionar'
                          : isCsv
                          ? 'Importar'
                          : 'Info'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active Spreadsheet Inspector & Sync Controls */}
          {metadata && (
            <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50/50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-900">{metadata.title}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
                    <span className="font-mono">{metadata.spreadsheetId}</span>
                    <span>·</span>
                    <a
                      href={`https://docs.google.com/spreadsheets/d/${metadata.spreadsheetId}/edit`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-blue-700 hover:underline"
                    >
                      Abrir en Google Sheets
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label="Seleccionar pestaña de Google Sheets"
                    value={selectedTab}
                    onChange={(e) => handleChangeTab(e.target.value)}
                    className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800"
                  >
                    {metadata.sheets.map((tab) => (
                      <option key={tab.sheetId} value={tab.title}>
                        Pestaña: {tab.title}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    disabled={busyAction !== null || !selectedTab || !can('vehicle:create')}
                    onClick={handlePullFromSheets}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md bg-blue-700 px-3.5 text-xs font-medium text-white hover:bg-blue-800 disabled:bg-slate-300 whitespace-nowrap shrink-0"
                  >
                    <CloudDownload className="h-3.5 w-3.5" />
                    {busyAction === 'pull' ? 'Importando...' : 'Importar desde Sheets'}
                  </button>

                  <button
                    type="button"
                    disabled={busyAction !== null || !selectedTab || !can('vehicle:edit')}
                    onClick={() => setConfirmPushOpen(true)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 whitespace-nowrap shrink-0"
                  >
                    <CloudUpload className="h-3.5 w-3.5" />
                    {busyAction === 'push' ? 'Enviando...' : 'Exportar a Sheets'}
                  </button>
                </div>
              </div>

              {previewRows.length > 0 && (
                <div className="overflow-x-auto rounded border border-slate-200 bg-white">
                  <table className="w-full text-left text-[11px]">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                        {previewRows[0].slice(0, 8).map((cell, idx) => (
                          <th key={idx} className="px-3 py-1.5 font-medium whitespace-nowrap">
                            {cell || `Col ${idx + 1}`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {previewRows.slice(1).map((row, rIdx) => (
                        <tr key={rIdx}>
                          {previewRows[0].slice(0, 8).map((_, cIdx) => (
                            <td
                              key={cIdx}
                              className="px-3 py-1.5 font-mono text-slate-700 whitespace-nowrap"
                            >
                              {row[cIdx] ?? '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {feedback && (
        <div
          className={`mt-3 flex items-center gap-2 rounded-md border px-3.5 py-2.5 text-xs ${
            feedback.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {feedback.ok ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Mandatory Confirmation Modal before mutating user's Google Sheet */}
      <Modal
        open={confirmPushOpen}
        onClose={() => setConfirmPushOpen(false)}
        title="Confirmar escritura en Google Sheets"
        subtitle="Esta acción actualizará las celdas de la pestaña seleccionada en tu hoja de cálculo."
        footer={
          <>
            <button
              type="button"
              onClick={() => setConfirmPushOpen(false)}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmedPushToSheets}
              className="rounded-md bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800"
            >
              Confirmar y actualizar hoja
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs text-slate-700">
          <p>
            Se escribirán <strong>{state.vehicles.length} equipo(s)</strong> (más la fila de encabezados) en tu documento de Google Sheets:
          </p>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-[11px] space-y-1">
            <div>
              <span className="text-slate-500">Documento:</span> {metadata?.title}
            </div>
            <div>
              <span className="text-slate-500">Pestaña:</span> {selectedTab}
            </div>
            <div>
              <span className="text-slate-500">Rango afectado:</span> A1:M{state.vehicles.length + 1}
            </div>
          </div>
          <p className="text-slate-500">
            Los datos actuales en el rango indicado serán reemplazados por el inventario vigente en Vektor Flota. Puedes cancelar sin realizar cambios.
          </p>
        </div>
      </Modal>
    </section>
  );
};
