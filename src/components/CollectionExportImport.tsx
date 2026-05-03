/**
 * CollectionExportImport.tsx — Full backup export + import with merge/replace mode.
 *
 * Export: triggers browser download of a versioned JSON backup.
 * Import: file picker → mode select (merge/replace) → call importBackup → summary.
 * TS 6.0 erasableSyntaxOnly: zero enum keywords.
 */

import { Spinner } from "@heroui/react";
import { useRef, useState } from "react";
import type { ImportSummary } from "../lib/collection-context";
import { useCollection } from "../lib/collection-context";
import type { MergeStrategy } from "../lib/collection-io";
import { backupFilename, csvFilename } from "../lib/collection-io";

type BackupMode = "merge" | "replace";

export function CollectionExportImport() {
	const { exportBackup, exportCsv, importBackup } = useCollection();

	// Export state
	const [exporting, setExporting] = useState(false);
	const [exportError, setExportError] = useState<string | null>(null);
	const [exportingCsv, setExportingCsv] = useState(false);
	const [exportCsvError, setExportCsvError] = useState<string | null>(null);

	// Import state
	const [importFile, setImportFile] = useState<File | null>(null);
	const [importMode, setImportMode] = useState<BackupMode>("merge");
	const [mergeStrategy, setMergeStrategy] = useState<MergeStrategy>("sum");
	const [importing, setImporting] = useState(false);
	const [importSummary, setImportSummary] = useState<ImportSummary | null>(
		null,
	);
	const [importError, setImportError] = useState<string | null>(null);

	const fileInputRef = useRef<HTMLInputElement>(null);

	async function handleExportCsv() {
		setExportingCsv(true);
		setExportCsvError(null);
		try {
			const blob = await exportCsv();
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = csvFilename();
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} catch {
			setExportCsvError("Error al exportar CSV. Intentá de nuevo.");
		} finally {
			setExportingCsv(false);
		}
	}

	async function handleExport() {
		setExporting(true);
		setExportError(null);
		try {
			const blob = await exportBackup();
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = backupFilename();
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} catch {
			setExportError("Error al exportar. Intentá de nuevo.");
		} finally {
			setExporting(false);
		}
	}

	function handleImportFileChange(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0] ?? null;
		setImportFile(file);
		setImportSummary(null);
		setImportError(null);
		e.target.value = "";
	}

	async function handleImport() {
		if (!importFile) return;
		setImporting(true);
		setImportError(null);
		setImportSummary(null);
		try {
			const summary = await importBackup(
				importFile,
				importMode,
				importMode === "merge" ? mergeStrategy : undefined,
			);
			setImportSummary(summary);
		} catch (err) {
			const msg =
				err instanceof Error && err.message
					? err.message
					: "Error al importar el respaldo.";
			setImportError(msg);
		} finally {
			setImporting(false);
		}
	}

	function handleReset() {
		setImportFile(null);
		setImportSummary(null);
		setImportError(null);
		setImportMode("merge");
		setMergeStrategy("sum");
	}

	return (
		<div className="flex flex-col gap-6">
			{/* CSV Export section */}
			<section className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 flex flex-col gap-3">
				<div>
					<h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
						Exportar CSV (Archidekt / Moxfield)
					</h3>
					<p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
						Descarga tu colección en formato CSV compatible con Archidekt y
						Moxfield para importar directamente.
					</p>
				</div>

				{exportCsvError && (
					<div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/40 dark:border-red-800 p-3 text-sm text-red-800 dark:text-red-200">
						{exportCsvError}
					</div>
				)}

				<button
					type="button"
					onClick={handleExportCsv}
					disabled={exportingCsv}
					className="cursor-pointer self-start rounded-md bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 flex items-center gap-2"
				>
					{exportingCsv && <Spinner size="sm" color="current" />}
					Descargar CSV
				</button>
			</section>

			{/* JSON Backup export section */}
			<section className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 flex flex-col gap-3">
				<div>
					<h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
						Exportar respaldo
					</h3>
					<p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
						Descarga una copia completa de tu colección y mazos en formato JSON.
					</p>
				</div>

				{exportError && (
					<div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/40 dark:border-red-800 p-3 text-sm text-red-800 dark:text-red-200">
						{exportError}
					</div>
				)}

				<button
					type="button"
					onClick={handleExport}
					disabled={exporting}
					className="cursor-pointer self-start rounded-md bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 flex items-center gap-2"
				>
					{exporting && <Spinner size="sm" color="current" />}
					Descargar copia de seguridad
				</button>
			</section>

			{/* Import section */}
			<section className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 flex flex-col gap-4">
				<div>
					<h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
						Importar respaldo
					</h3>
					<p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
						Restaura tu colección desde un archivo de respaldo JSON previamente
						exportado.
					</p>
				</div>

				{importSummary ? (
					/* Summary view */
					<div className="flex flex-col gap-4">
						<p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
							Importación completada.
						</p>
						<div className="grid grid-cols-3 gap-3">
							<div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 text-center">
								<p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
									{importSummary.added}
								</p>
								<p className="text-xs text-zinc-500 mt-1">Añadidas</p>
							</div>
							<div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 text-center">
								<p className="text-2xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">
									{importSummary.updated}
								</p>
								<p className="text-xs text-zinc-500 mt-1">Actualizadas</p>
							</div>
							<div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 text-center">
								<p className="text-2xl font-bold text-zinc-500 tabular-nums">
									{importSummary.skipped}
								</p>
								<p className="text-xs text-zinc-500 mt-1">Omitidas</p>
							</div>
						</div>
						<button
							type="button"
							onClick={handleReset}
							className="cursor-pointer self-start rounded-md border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
						>
							Importar otro archivo
						</button>
					</div>
				) : (
					<>
						{/* File picker */}
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={() => fileInputRef.current?.click()}
								className="cursor-pointer rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
							>
								Elegir archivo
							</button>
							<span className="text-sm text-zinc-500 dark:text-zinc-400 truncate">
								{importFile ? importFile.name : "Ningún archivo seleccionado"}
							</span>
							<input
								ref={fileInputRef}
								type="file"
								accept=".json"
								onChange={handleImportFileChange}
								className="hidden"
								aria-label="Archivo de respaldo JSON"
							/>
						</div>

						{/* Mode selection */}
						{importFile && (
							<div className="flex flex-col gap-3">
								<p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
									Modo de importación:
								</p>
								<div className="flex flex-col gap-2">
									{/* Fusionar */}
									<div className="flex items-start gap-2">
										<input
											id="import-mode-merge"
											type="radio"
											name="importMode"
											checked={importMode === "merge"}
											onChange={() => setImportMode("merge")}
											className="mt-0.5 cursor-pointer flex-shrink-0"
										/>
										<div className="flex flex-col gap-2 flex-1">
											<label
												htmlFor="import-mode-merge"
												className="cursor-pointer"
											>
												<p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
													Fusionar
												</p>
												<p className="text-xs text-zinc-500 dark:text-zinc-400">
													Combina el respaldo con los datos existentes.
												</p>
											</label>

											{importMode === "merge" && (
												<div className="flex flex-col gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
													<p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
														Si la carta ya existe en tu colección:
													</p>
													{[
														{
															key: "sum" as MergeStrategy,
															label: "Sumar cantidades",
															desc: "Se suman las copias del archivo a las que ya tenés.",
														},
														{
															key: "replace" as MergeStrategy,
															label: "Reemplazar cantidad",
															desc: "La cantidad del archivo sobreescribe la actual.",
														},
														{
															key: "skip" as MergeStrategy,
															label: "Ignorar duplicados",
															desc: "Se mantiene la cantidad actual sin modificar.",
														},
													].map(({ key, label, desc }) => (
														<div key={key} className="flex items-start gap-2">
															<input
																id={`import-strategy-${key}`}
																type="radio"
																name="mergeStrategy"
																checked={mergeStrategy === key}
																onChange={() => setMergeStrategy(key)}
																className="mt-0.5 flex-shrink-0 cursor-pointer"
															/>
															<label
																htmlFor={`import-strategy-${key}`}
																className="cursor-pointer"
															>
																<p className="text-sm text-zinc-800 dark:text-zinc-200">
																	{label}
																</p>
																<p className="text-xs text-zinc-500 dark:text-zinc-400">
																	{desc}
																</p>
															</label>
														</div>
													))}
												</div>
											)}
										</div>
									</div>

									{/* Reemplazar todo */}
									<div className="flex items-start gap-2">
										<input
											id="import-mode-replace"
											type="radio"
											name="importMode"
											checked={importMode === "replace"}
											onChange={() => setImportMode("replace")}
											className="mt-0.5 flex-shrink-0 cursor-pointer"
										/>
										<label
											htmlFor="import-mode-replace"
											className="cursor-pointer"
										>
											<p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
												Reemplazar todo
											</p>
											<p className="text-xs text-red-600 dark:text-red-400">
												Elimina todos los datos actuales y los reemplaza con el
												contenido del respaldo.
											</p>
										</label>
									</div>
								</div>
							</div>
						)}

						{/* Import error */}
						{importError && (
							<div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/40 dark:border-red-800 p-3 text-sm text-red-800 dark:text-red-200">
								{importError}
							</div>
						)}

						{/* Import button */}
						<button
							type="button"
							onClick={handleImport}
							disabled={!importFile || importing}
							className="cursor-pointer self-start rounded-md bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 flex items-center gap-2"
						>
							{importing && <Spinner size="sm" color="current" />}
							Importar copia de seguridad
						</button>
					</>
				)}
			</section>
		</div>
	);
}
